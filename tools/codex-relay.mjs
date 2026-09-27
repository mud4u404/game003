#!/usr/bin/env node
// Sequential, durable GitHub PR → local Codex relay. No npm dependencies.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MARK = '<!-- relay:codex -->';
export const DONE = '<!-- relay:done -->';
export function commandArgs(value) {
  if (!value) return ['codex', 'exec', '--approve-for-me', '-c', 'sandbox_workspace_write.network_access=true'];
  if (value.trim().startsWith('[')) {
    const args = JSON.parse(value);
    if (!Array.isArray(args) || !args.length || args.some(a => typeof a !== 'string' || !a)) throw new Error('CODEX_CMD must be a nonempty string array');
    return args;
  }
  // Shell-like quoting, but never invoke a shell or expand substitutions.
  const result = []; let word = '', quote = '', escaped = false;
  for (const c of value.trim()) {
    if (escaped) { word += c; escaped = false; }
    else if (c === '\\' && quote !== "'") escaped = true;
    else if (quote) { if (c === quote) quote = ''; else word += c; }
    else if (c === '"' || c === "'") quote = c;
    else if (/\s/.test(c)) { if (word) { result.push(word); word = ''; } }
    else word += c;
  }
  if (escaped || quote) throw new Error('Unclosed quote in CODEX_CMD');
  if (word) result.push(word);
  if (!result.length) throw new Error('Empty CODEX_CMD');
  return result;
}
export function pendingComments(comments, authors, jobs) {
  return comments.filter(c => c.body?.includes(MARK) && !c.body.includes(DONE) && authors.includes(c.user?.login) && !jobs[String(c.id)])
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
}
export function readState(file, since = new Date().toISOString()) {
  if (!existsSync(file)) return { since, jobs: {} };
  const state = JSON.parse(readFileSync(file, 'utf8')); // Corruption must not silently reset the cursor.
  if (!state.since || (!state.jobs && !Array.isArray(state.handled))) throw new Error('Invalid relay state');
  state.jobs ||= Object.fromEntries(state.handled.map(id => [String(id), { status: 'notified' }]));
  return state;
}
export function saveState(file, state) {
  writeFileSync(file + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
export function acquireLock(file) {
  try { const fd = openSync(file, 'wx', 0o600); writeFileSync(fd, String(process.pid));closeSync(fd); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = Number(readFileSync(file, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid relay lock; inspect before removing');
    try { process.kill(pid, 0); throw new Error(`Relay already running: PID ${pid}`); }
    catch (err) { if (err.code !== 'ESRCH') throw err; }
    unlinkSync(file);return acquireLock(file);
  }
  return () => { if (existsSync(file) && readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file); };
}

export async function main() {
  const root = path.resolve(process.env.RELAY_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const repo = process.env.RELAY_REPO || 'mud4u404/game003';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid RELAY_REPO');
  const intervalMs = Number(process.env.RELAY_INTERVAL_SEC || 60) * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new Error('Invalid interval');
  const args = commandArgs(process.env.CODEX_CMD), authors = (process.env.RELAY_AUTHORS || repo.split('/')[0]).split(',').map(s => s.trim()).filter(Boolean);
  const dir = path.resolve(process.env.RELAY_STATE_DIR || path.join(root, 'tools/.relay'));
  mkdirSync(path.join(dir, 'logs'), { recursive: true, mode: 0o700 });
  const stateFile = path.join(dir, 'state.json'), release = acquireLock(path.join(dir, 'relay.lock'));
  process.on('exit', release);
  let child = null, stopping = false, timer, wake;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; child?.kill('SIGTERM'); clearTimeout(timer); wake?.(); });
  const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`;console.log(line);appendFileSync(path.join(dir, 'relay.log'), line + '\n', { mode: 0o600 }); };
  const run = (cmd, argv) => execFileSync(cmd, argv, { cwd: root, encoding: 'utf8', maxBuffer: 32 << 20, timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' } }).trim();
  const gh = (...argv) => run(process.env.GH_BIN || 'gh', argv);
  const git = (...argv) => run('git', argv);
  const state = readState(stateFile, process.env.RELAY_SINCE);
  saveState(stateFile, state); // Persist start time before the first network request.
  for (const job of Object.values(state.jobs)) if (job.status === 'running') {
    job.status = 'finished';job.code = -1;job.summary = '上次接力进程在执行中退出。为避免重复改动，没有自动重跑；请检查该分支并发新评论接力。';
  }
  saveState(stateFile, state);

  async function notify(job, id) {
    const marker = `<!-- relay-result:${id} -->`;
    // Reconcile a crash after GitHub accepted the comment but before state was saved.
    const prior = JSON.parse(gh('api', `repos/${repo}/issues/${job.number}/comments?per_page=100`, '--paginate', '--slurp')).flat();
    if (!prior.some(c => c.body?.includes(marker))) {
      const body = `${job.code === 0 ? '完成，请审查。' : '接力未完成，请检查。'} Codex 退出码：${job.code}。\n\n${job.summary.slice(-10000)}\n\n${DONE}\n${marker}`;
      const bodyFile = path.join(dir, 'logs', `${id}-comment.md`);writeFileSync(bodyFile, body, { mode: 0o600 });
      gh('pr', 'comment', String(job.number), '--repo', repo, '--body-file', bodyFile);
    }
    job.status = 'notified';saveState(stateFile, state);
  }
  async function handle(comment) {
    const number = Number(comment.issue_url.split('/').pop()), id = String(comment.id);
    if (!Number.isSafeInteger(number)) throw new Error('Invalid PR number');
    let pr;
    try { pr = JSON.parse(gh('api', `repos/${repo}/pulls/${number}`)); }
    catch (e) {
      if (!String(e.stderr || e.message).includes('HTTP 404')) throw e;
      state.jobs[id] = { status: 'ignored', reason: 'Not a pull request' };saveState(stateFile, state);return;
    }
    if (pr.state !== 'open' || pr.head.repo?.full_name !== repo || !/^codex\/[\w./-]+$/.test(pr.head.ref)) {
      state.jobs[id] = { status: 'ignored', reason: 'Not an open same-repository codex PR' };saveState(stateFile, state);return;
    }
    const branch = pr.head.ref, job = state.jobs[id] = { status: 'running', number, branch, url: comment.html_url };
    saveState(stateFile, state);
    const stem = path.join(dir, 'logs', id), output = stem + '-result.txt';
    try {
      // Only this dedicated checkout is switched; preserve all unfinished files/commits.
      if (git('status', '--porcelain')) throw new Error('Relay checkout has uncommitted changes; preserve them and resolve before the next task');
      const current = git('branch', '--show-current');
      if (current) {
        let ahead;
        try { ahead = git('rev-list', '--count', '@{upstream}..HEAD'); } catch { throw new Error('Current relay branch has no upstream; refusing to abandon it'); }
        if (ahead !== '0') throw new Error('Relay checkout has unpushed commits; preserve them before switching');
      }
      git('fetch', 'origin', `refs/heads/${branch}:refs/remotes/origin/${branch}`);
      git('switch', branch);git('merge', '--ff-only', `origin/${branch}`);
      const prompt = [
        `用户已授权 Claude 通过 GitHub PR 指派任务。处理 ${repo} PR #${number} 的消息 ${comment.html_url}。`,
        `当前已在专用工作目录及已有分支 ${branch}。先读 AGENTS.md、README.md、HANDOFF.md、docs/WORKFLOW.md 和对应任务单。`,
        '只处理下面的任务；保留已有工作，不新建任务分支、不强制推送、不合并 PR，不修改已安装的后台服务配置、凭据或仓库外本机配置。',
        `完成必要检查，更新执行记录及 HANDOFF.md，提交任务相关文件并推送 origin ${branch}，核对远程提交。`,
        '最后用中文说明完成内容、命令与结果、最新提交、未完成项。不要输出密钥、令牌、环境变量或私密日志。',
        'Git 元数据受沙箱保护；如出现 index.lock、update_ref failed 或 Operation not permitted，即使退出码为 0，也请通过自动批准机制请求权限后重试。不要绕过沙箱或手写 Git 元数据。',
        '接力脚本负责在这个 PR 发布最终回复，请不要重复留言。',
        '\n--- 允许账号发出的任务内容 ---\n', comment.body.replaceAll(MARK, '').trim(),
      ].join('\n');
      log('开始', `PR #${number}`, branch, comment.html_url);
      job.code = await new Promise(resolve => {
        child = spawn(args[0], [...args.slice(1), '-C', root, '--output-last-message', output, '-'], { cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
        for (const stream of [child.stdout, child.stderr]) stream.on('data', data => appendFileSync(stem + '.log', data, { mode: 0o600 }));
        child.stdin.on('error', () => {});child.stdin.end(prompt);
        child.on('error', e => { log('Codex 启动失败', e.message);resolve(-1); });child.on('close', code => { child = null;resolve(code ?? -1); });
      });
      job.summary = existsSync(output) ? readFileSync(output, 'utf8').trim() : '没有最终输出。请检查本机接力日志。';
      if (job.code === 0) {
        const head = git('rev-parse', 'HEAD'), remote = git('ls-remote', 'origin', `refs/heads/${branch}`).split(/\s/)[0];
        if (git('branch', '--show-current') !== branch || git('status', '--porcelain') || head !== remote) {
          job.code = -1;job.summary += '\n\n接力核对未通过：分支、工作区或远程提交不同步；未声明已交付。';
        } else job.summary += `\n\n接力已核对远程提交：${head}`;
      }
    } catch (e) { job.code = -1;job.summary = `接力失败：${e.message.split('\n')[0]}`; }
    job.status = 'finished';saveState(stateFile, state);
    if (!stopping) await notify(job, id);
    log('结束', `PR #${number}`, '退出码', job.code);
  }
  async function tick() {
    if (!process.argv.includes('--check')) for (const [id, job] of Object.entries(state.jobs)) if (job.status === 'finished') await notify(job, id);
    const startedAt = new Date().toISOString();
    const pages = JSON.parse(gh('api', `repos/${repo}/issues/comments?since=${encodeURIComponent(state.since)}&per_page=100&sort=updated&direction=asc`, '--paginate', '--slurp'));
    const todo = pendingComments(pages.flat(), authors, state.jobs);
    if (process.argv.includes('--check')) { log('检查通过', `${todo.length} 条待处理评论`, `当前分支 ${git('branch', '--show-current')}`);return; }
    for (const c of todo) { if (stopping) return;await handle(c); }
    state.since = startedAt;saveState(stateFile, state);
  }
  try {
    log('启动', repo, `每 ${intervalMs / 1000} 秒`, `允许账号 ${authors.join(',')}`, `工作目录 ${root}`);
    do {
      try { await tick(); } catch (e) { log('检查失败，保留状态等待重试', e.message.split('\n')[0]);if(process.argv.includes('--check'))throw e; }
      if (process.argv.includes('--check') || process.argv.includes('--once') || stopping) break;
      await new Promise(resolve => { wake = resolve;timer = setTimeout(resolve, intervalMs); });
    } while (!stopping);
  } finally { release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message);process.exitCode = 1; });
