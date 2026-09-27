#!/usr/bin/env node
// Claude → ChatGPT 接力脚本：在用户电脑上后台运行。
// 每分钟查看 GitHub 上带接力标记的新评论（Claude 发的任务或审查意见），
// 一旦发现，就在本机调用 Codex CLI 处理，处理结束后在同一个 PR 上留言，Claude 会立即收到通知。
// 依赖：已登录的 gh CLI、Codex CLI。无第三方 npm 依赖。用法见 docs/WORKFLOW.md。
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.env.RELAY_REPO || 'mud4u404/game003';
const intervalMs = Number(process.env.RELAY_INTERVAL_SEC || 60) * 1000;
const codexCmd = process.env.CODEX_CMD || 'codex exec --full-auto';
const authors = (process.env.RELAY_AUTHORS || repo.split('/')[0]).split(',').map(s => s.trim()).filter(Boolean);
const MARK = '<!-- relay:codex -->';
const dir = path.join(root, 'tools', '.relay');
const stateFile = path.join(dir, 'state.json');
mkdirSync(path.join(dir, 'logs'), { recursive: true });

const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(line); appendFileSync(path.join(dir, 'relay.log'), line + '\n'); };
const gh = (...args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 << 20 });
const loadState = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return { since: new Date().toISOString(), handled: [] }; } };
const saveState = s => writeFileSync(stateFile, JSON.stringify(s, null, 2));

function runCodex(prompt, logFile) {
  return new Promise(resolve => {
    const [cmd, ...args] = codexCmd.split(' ').filter(Boolean);
    const child = spawn(cmd, [...args, prompt], { cwd: root, env: process.env });
    let tail = '';
    const keep = d => { appendFileSync(logFile, d); tail = (tail + d).slice(-6000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    child.on('error', e => { keep(String(e)); resolve({ code: -1, tail }); });
    child.on('close', code => resolve({ code, tail }));
  });
}

async function handle(c, state) {
  const number = Number(c.issue_url.split('/').pop());
  let branch = '';
  try { branch = gh('pr', 'view', String(number), '--repo', repo, '--json', 'headRefName', '-q', '.headRefName').trim(); } catch {}
  const target = branch ? `PR #${number}（分支 ${branch}）` : `Issue #${number}`;
  log('处理', target, c.html_url);
  const prompt = [
    `你是本项目的开发者（ChatGPT）。Claude 在 ${target} 上给你留了下面这条消息。`,
    '请先 git fetch，按 AGENTS.md 和 docs/WORKFLOW.md 的要求处理：',
    branch ? `切换到已有分支 ${branch}（不要新建分支），完成消息里的要求，运行要求的检查，提交并推送到同一分支。` : '按消息要求处理。',
    '最后一段输出请用中文写清：做了什么、运行了哪些检查及结果、还有什么没完成或需要 Claude 决定。',
    '', '--- Claude 的消息 ---', c.body.replace(MARK, '').trim(),
  ].join('\n');
  const logFile = path.join(dir, 'logs', `${Date.now()}-${number}.log`);
  const { code, tail } = await runCodex(prompt, logFile);
  const body = [
    `ChatGPT 已处理 Claude 的消息（Codex 退出码 ${code}）。`, '',
    '最后的输出：', '```', tail.slice(-3500).trim(), '```', '',
    '<!-- relay:done -->',
  ].join('\n');
  try { gh('pr', 'comment', String(number), '--repo', repo, '--body', body); }
  catch { try { gh('issue', 'comment', String(number), '--repo', repo, '--body', body); } catch (e) { log('留言失败', String(e)); } }
  state.handled.push(c.id); saveState(state);
  log('完成', target, '退出码', code);
}

async function tick() {
  const state = loadState();
  const startedAt = new Date().toISOString();
  let comments = [];
  try { comments = JSON.parse(gh('api', `repos/${repo}/issues/comments?since=${encodeURIComponent(state.since)}&per_page=100`)); }
  catch (e) { log('读取评论失败', String(e).split('\n')[0]); return; }
  const todo = comments.filter(c => c.body?.includes(MARK) && authors.includes(c.user?.login) && !state.handled.includes(c.id));
  for (const c of todo) await handle(c, state);
  state.since = startedAt; saveState(state);
}

log(`接力脚本启动：仓库 ${repo}，每 ${intervalMs / 1000} 秒检查一次，允许的发送者 ${authors.join(',')}，命令 ${codexCmd}`);
for (;;) { await tick(); await new Promise(r => setTimeout(r, intervalMs)); }
