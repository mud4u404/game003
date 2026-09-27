// 可玩原型 v0.1：实时模拟接入等轴场景。
import { scene as baseScene } from './layout.js';
import { buildScene } from './catalog.js';
import { sortNodes } from './depth.js';
import { render } from './renderer.js';
import { pickPerson } from './picking.js';
import { defaultCamera, constrain, bindCamera, invalidator } from './camera.js';
import { project, toScreen } from './iso.js';
import { Engine, OUTCOME_LABELS, RULES } from './sim/engine.js';
import { daySummary, periodSummary } from './sim/stats.js';
import { Actors } from './actors.js';
import { personNodes } from './people-nodes.js';

const $ = s => document.querySelector(s);
const canvas = $('#scene'), ctx = canvas.getContext('2d'), panel = $('#panel'), body = $('#panel-body'), backBtn = $('#back');
const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const SAVE_KEY = 'renhe.v2.save';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LEVEL = ['', 'I', 'II', 'III', 'IV'];
const WEEK = '日一二三四五六';

// ---------- 数据与存档 ----------
async function loadData() {
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); });
  const [manifest, exams, config] = await Promise.all([get('/data/manifest.json'), get('/data/exams.json'), get('/data/hospital-default.json')]);
  const diseases = await Promise.all(manifest.diseases.map(id => get(`/data/diseases/${id}.json`)));
  return { kb: { diseases, exams }, config };
}
function readSave() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return { status: 'unavailable' }; }
  if (!raw) return { status: 'none' };
  try { const s = JSON.parse(raw); if (s.version !== 1 || !s.engine) throw new Error('version'); return { status: 'ok', save: s }; }
  catch { return { status: 'corrupt' }; }
}

// ---------- 时钟（开发者模式可指定时刻和倍速，只用于测试截图，不写玩家存档） ----------
function devClock(config) {
  const at = params.get('at') || '2026-09-28T10:30';
  const [d, t = '10:30'] = at.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
  const atMs = Date.UTC(y, mo - 1, da, h, mi) - config.timezoneOffsetMinutes * 60000;
  const dayStart = Date.UTC(y, mo - 1, da) - config.timezoneOffsetMinutes * 60000;
  const speed = Number(params.get('speed') || 1), t0 = performance.now();
  return { atMs, dayStart, now: () => atMs + (performance.now() - t0) * speed };
}

// ---------- 启动 ----------
let engine, config, clock, lastSeen = null, dirty = false, lastSave = 0;
const actors = new Actors();
const scene = { ...baseScene, people: [], rooms: baseScene.rooms.map(r => ({ ...r, name: { consult: '内科诊室', ward: '外科诊室·处置室' }[r.id] || r.name })) };
const staticNodes = buildScene(scene);
let nodes = staticNodes, camera, width = 0, height = 0, dpr = 1, selected = null, view = null;
const nav = [];   // 面板返回栈
let current = null; // 当前面板 { kind, arg }

async function start() {
  let data;
  try { data = await loadData(); } catch (e) { showFatal(`数据加载失败：${e.message}`); return; }
  config = data.config;
  if (DEV) {
    const c = devClock(config);
    engine = new Engine(data.kb, config, { seed: Number(params.get('seed') || 1), startMs: c.dayStart });
    for (const [k, v] of params) if (k === 'examStrategy' || k === 'scope') engine.setRule(k, v);
    engine.advanceTo(c.atMs);
    clock = c.now;
  } else {
    clock = () => Date.now();
    const saved = readSave();
    if (saved.status === 'corrupt') { showCorrupt(data); return; }
    if (saved.status === 'ok') {
      engine = Engine.restore(data.kb, config, saved.save.engine);
      lastSeen = saved.save.lastSeen;
    } else {
      engine = new Engine(data.kb, config, { seed: (Math.random() * 2 ** 31) >>> 0, startMs: Date.now() });
    }
    engine.advanceTo(Date.now());
    save();
  }
  view = engine.view();
  actors.sync(view); actors.settle();
  refreshHud(); rebuild(); invalidate();
  if (!DEV && lastSeen && Date.now() - lastSeen > 30 * 60000) openPanel('brief', { from: Math.floor(lastSeen / 60000), to: engine.s.minute });
  setInterval(tick, 1000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else tick(); });
  if (DEV) window.__game = { engine, actors, openPanel, select: id => { const a = actors.list.get(id); if (a) selectActor(a); }, screenOf: id => { const a = actors.list.get(id); return a && toScreen(project(a.x, a.y, a.z || 0), camera); }, camera: () => camera, invalidate };
}
function save() {
  if (DEV || !engine) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), lastSeen: Date.now(), engine: engine.serialize() })); lastSave = Date.now(); dirty = false; }
  catch (e) { banner(`存档失败：${e.message}`, true); }
}
function tick() {
  if (!engine) return;
  const before = engine.s.minute;
  engine.advanceTo(clock());
  if (engine.s.minute !== before) {
    view = engine.view(); dirty = true;
    if (actors.sync(view)) animate();
    rebuild(); invalidate(); refreshHud();
    if (current && ['record', 'staff', 'report', 'people', 'money'].includes(current.kind)) renderPanel(false);
  }
  if (dirty && Date.now() - lastSave > 30000) save();
}

// ---------- 画面 ----------
const invalidate = invalidator(() => {
  render(ctx, scene, nodes, camera, width, height, dpr, selected && actors.list.get(selected.id) ? selected : null);
  canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
});
function rebuild() { nodes = sortNodes([...staticNodes, ...personNodes(actors)]); }
let animating = false, lastT = 0;
function animate() {
  if (animating) return; animating = true; lastT = performance.now();
  const step = t => {
    const dt = Math.min(.1, (t - lastT) / 1000); lastT = t;
    const moving = actors.step(dt); rebuild(); invalidate();
    if (moving) requestAnimationFrame(step); else animating = false;
  };
  requestAnimationFrame(step);
}
function resize() {
  const rect = canvas.getBoundingClientRect(), nextDpr = window.devicePixelRatio || 1;
  if (width === rect.width && height === rect.height && dpr === nextDpr) return;
  const ow = width, oh = height; width = rect.width; height = rect.height; dpr = nextDpr;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  if (!camera) camera = defaultCamera(width, height);
  else { const next = defaultCamera(width, height); camera.x += (width - ow) / 2; camera.y += (height - oh) / 2; camera.zoom *= next.base / camera.base; camera.base = next.base; constrain(camera, width, height); }
  invalidate();
}
bindCamera(canvas, () => camera, () => ({ width, height }), invalidate, point => {
  const hit = pickPerson(point, camera, nodes);
  if (hit) selectActor(hit); else closePanel();
});
function selectActor(a) {
  selected = a; nav.length = 0;
  openPanel(a.kind === 'patient' ? 'record' : 'staff', a.id, true);
  invalidate();
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// ---------- 顶栏 ----------
function fmtTime(minute) { const t = engine.local(minute); return `${pad(t.hour)}:${pad(t.minute)}`; }
function fmtDate(minute) { const t = engine.local(minute), d = new Date(t.day * 86400000); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 周${WEEK[d.getUTCDay()]}`; }
function fmtDateTime(minute) { return `${fmtDate(minute)} ${fmtTime(minute)}`; }
const pad = n => String(n).padStart(2, '0');
function refreshHud() {
  const t = engine.local();
  $('#clock').textContent = `${fmtDate(engine.s.minute)} ${fmtTime(engine.s.minute)}${DEV ? '（测试时钟）' : ''}`;
  $('#status').textContent = view.open ? '营业中' : '已下班';
  $('#status').className = `status ${view.open ? 'open' : 'closed'}`;
  const today = daySummary(engine, t.date);
  $('#cash').textContent = `¥${today.revenue.toLocaleString('zh-CN')}`;
  const alerts = today.left + today.misdiagnosed;
  $('#alerts').hidden = !alerts; $('#alerts').textContent = alerts;
  if (!view.open) banner(`已下班 · ${engine.local(view.nextOpening).day === t.day ? '今天' : '明天'} ${fmtTime(view.nextOpening)} 开门。你离开后医院照常运转，回来时会补算。`);
  else if (view.patients.length === 0) banner('营业中 · 暂时没有病人，病人会陆续到院');
  else banner(null);
}
function banner(text, warn = false) { const b = $('#banner'); b.hidden = !text; b.textContent = text || ''; b.classList.toggle('warn', warn); }

// ---------- 面板 ----------
function openPanel(kind, arg, reset = false) {
  if (reset) nav.length = 0; else if (current) nav.push(current);
  current = { kind, arg };
  for (const b of document.querySelectorAll('.nav button')) b.setAttribute('aria-pressed', String(b.dataset.panel === ({ report: '汇报', list: '汇报', rules: '规则', people: '人事', money: '资金', build: '建设' }[kind] || '医院')));
  renderPanel(true);
}
function closePanel() { current = null; nav.length = 0; selected = null; panel.hidden = true; for (const b of document.querySelectorAll('.nav button')) b.setAttribute('aria-pressed', String(b.dataset.panel === '医院')); invalidate(); }
backBtn.addEventListener('click', () => { current = nav.pop() || null; if (!current) closePanel(); else renderPanel(true); });
$('#close').addEventListener('click', closePanel);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
for (const b of document.querySelectorAll('[data-panel]')) b.addEventListener('click', () => {
  const k = { 医院: null, 汇报: 'report', 建设: 'build', 人事: 'people', 规则: 'rules', 资金: 'money' }[b.dataset.panel];
  selected = null; invalidate();
  if (!k) closePanel(); else openPanel(k, { date: engine.local().date }, true);
});
body.addEventListener('click', e => {
  const t = e.target.closest('[data-open]'); if (!t) return;
  const [kind, arg] = [t.dataset.open, t.dataset.arg];
  if (kind === 'rule') { const [name, value] = arg.split('='); engine.setRule(name, value); dirty = true; save(); renderPanel(false); return; }
  if (kind === 'record') { const a = actors.list.get(arg); selected = a || null; invalidate(); }
  openPanel(kind, kind === 'list' ? JSON.parse(arg) : kind === 'report' ? { date: arg } : arg);
});
function renderPanel(scrollTop) {
  if (!current) return;
  const html = PANELS[current.kind](current.arg);
  const y = body.scrollTop; body.innerHTML = html; if (!scrollTop) body.scrollTop = y; else body.scrollTop = 0;
  panel.hidden = false; backBtn.hidden = !nav.length;
  panel.classList.toggle('tall', current.kind !== 'build');
}
const row = (label, value, open, arg) => `<div class="row${open ? ' link' : ''}"${open ? ` data-open="${open}" data-arg='${esc(arg)}'` : ''}><span>${label}</span><b>${value}</b>${open ? '<i>›</i>' : ''}</div>`;
function waitingRow() {
  const waiting = Object.values(engine.s.patients).filter(p => p.stage === 'triage_wait' || p.stage === 'wait_doctor');
  const longest = waiting.reduce((m, p) => Math.max(m, engine.s.minute - engine.record(p.id).arrivedAt), 0);
  return row('此刻正在候诊', waiting.length ? `${waiting.length} 人（最久已等 ${longest} 分钟）` : '0 人');
}
const PANELS = {
  record(id) {
    const r = engine.record(id); if (!r) return '<p>找不到这份病历。</p>';
    const live = engine.s.patients[id], stage = live ? engine.view().patients.find(p => p.id === id)?.stageLabel : null;
    const status = live ? `<span class="pill live">${esc(stage)}</span>` : `<span class="pill">${{ treated: '已处置离院', referred: '已转诊', left: '未就诊离开', closed: '未完成，约次日' }[r.disposition] || ''}</span>`;
    const revealed = r.outcome && r.outcome.result && engine.s.minute >= r.outcome.revealAt;
    const outcome = !r.outcome ? '就诊中' : !r.outcome.result ? esc(r.outcome.note) : revealed ? `${OUTCOME_LABELS[r.outcome.result]}（${esc(r.outcome.note)}）` : `随访中，${fmtDate(r.outcome.revealAt)}揭晓`;
    const exams = r.exams.length ? r.exams.map(x => `<li><b>${esc(x.name)}</b>：${x.available === false ? '<span class="muted">本院无法进行</span>' : x.finding ? esc(x.finding) : x.doneAt != null ? '等待结果' : '排队中'}</li>`).join('') : '<li class="muted">未开检查</li>';
    return `<h2>${esc(r.name)} <small>${r.sex === 'male' ? '男' : '女'} · ${r.age} 岁 · ${esc(r.source)}</small></h2>
      <p class="tags"><span class="pill lv${r.triageLevel}">${LEVEL[r.triageLevel]} 级</span>${status}${r.flags.map(f => `<span class="pill warn">${esc(f.text)}</span>`).join('')}</p>
      <dl>
        <dt>主诉</dt><dd>“${esc(r.complaint)}”</dd>
        <dt>症状</dt><dd>${esc(r.symptoms.join('、'))}</dd>
        <dt>接诊</dt><dd>${esc(r.doctorName || '待分配')}${r.waits.doctor != null ? `（候诊 ${r.waits.doctor + (r.waits.triage || 0)} 分钟）` : ''}</dd>
        <dt>初步考虑</dt><dd>${esc(r.suspicion?.name || '—')}</dd>
        <dt>检查</dt><dd><ul>${exams}</ul></dd>
        <dt>诊断</dt><dd>${r.diagnosis ? `<b>${esc(r.diagnosis.name)}</b>${r.diagnosis.tentative ? '（疑似）' : ''}` : '—'}</dd>
        <dt>处置</dt><dd>${r.treatment ? esc(r.treatment.text) : '—'}${r.referralReason ? `<br><span class="warn-text">转诊原因：${esc(r.referralReason)}</span>` : ''}</dd>
        <dt>结局</dt><dd>${outcome}</dd>
        <dt>费用</dt><dd>¥${r.cost}</dd>
      </dl>
      ${r.returnOf ? `<p class="link" data-open="record" data-arg="${r.returnOf}">查看上次就诊病历 ›</p>` : ''}${r.returnedAs ? `<p class="link" data-open="record" data-arg="${r.returnedAs}">查看返诊病历 ›</p>` : ''}
      <details><summary>就诊经过（${r.timeline.length}）</summary><ol class="timeline">${r.timeline.map(t => `<li><time>${fmtTime(t.t)}</time>${esc(t.text)}</li>`).join('')}</ol></details>
      <p class="note">示意数据：医学内容来自知识库草稿，未经临床审阅；结局概率为游戏估计。</p>`;
  },
  staff(id) {
    const st = engine.view().staff.find(s => s.id === id); if (!st) return '';
    const cfg = config.staff.find(s => s.id === id), p = st.patientId && engine.record(st.patientId);
    const seen = engine.s.records.filter(r => r.doctorId === id && engine.local(r.arrivedAt).date === engine.local().date).length;
    return `<h2>${esc(st.name)} <small>${esc(st.title || '')}${esc(st.roleLabel)}</small></h2>
      ${row('当前', st.status + (p ? ` · ${esc(p.name)}` : ''), p ? 'record' : null, st.patientId)}
      ${row('疲劳', `<span class="bar"><span style="width:${st.fatigue}%"></span></span> ${st.fatigue}`)}
      ${row('能力', Math.round(cfg.skill * 100))}${row('速度', `${Math.round(cfg.speed * 100)}%`)}
      ${st.role === 'physician' ? row('今日接诊', seen) : ''}
      <p class="note">疲劳越高，做事越慢、越容易出错；每天清零。招聘与排班将在后续版本开放。</p>`;
  },
  report({ date }) {
    const s = daySummary(engine, date), today = engine.local().date;
    const prev = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
    const list = (key, title) => JSON.stringify({ date, key, title });
    const reasons = Object.entries(s.referralReasons).map(([k, v]) => `<li>${esc(k)}：${v} 人</li>`).join('') || '<li class="muted">无</li>';
    return `<h2>门诊日报 <small>${esc(date)}${date === today ? '（今天，实时）' : ''}</small></h2>
      <p class="tabs"><span class="link" data-open="report" data-arg="${prev}">‹ 前一天</span>${date !== today ? `<span class="link" data-open="report" data-arg="${today}">回到今天 ›</span>` : ''}</p>
      ${row('到院', `${s.arrivals} 人`, 'list', list('all', '全部到院'))}
      ${row('处置离院', `${s.treated} 人`, 'list', list('treated', '处置离院'))}
      ${row('转诊', `${s.referred} 人`, 'list', list('referred', '转诊患者'))}
      <ul class="sub-list">${reasons}</ul>
      ${row('未就诊离开', `${s.left} 人`, 'list', list('left', '未就诊离开'))}
      ${date === today ? waitingRow() : ''}
      ${row('平均候诊（已看上病的人）', s.avgWait == null ? '—' : `${s.avgWait} 分钟`)}
      ${row('候诊超过 60 分钟', `${s.lists.longWait.length} 人（最长 ${s.maxWait ?? 0} 分钟）`, 'list', list('longWait', '候诊超过 60 分钟'))}
      ${row('返诊发现的误诊', `${s.misdiagnosed} 例`, 'list', list('misdiagnosed', '初诊误诊'))}
      ${row('就诊中', `${s.inProgress} 人`, 'list', list('inProgress', '仍在就诊'))}
      ${row('收入', `¥${s.revenue.toLocaleString('zh-CN')}`)}
      <p class="note">每个数字都能点开，看到对应的病人和病历。误诊只有在病人返诊后才会被发现。</p>`;
  },
  list({ date, key, title }) {
    const ids = daySummary(engine, date).lists[key] || [];
    const items = ids.map(id => engine.record(id)).map(r => `<li class="link" data-open="record" data-arg="${r.id}"><b>${esc(r.name)}</b> ${r.sex === 'male' ? '男' : '女'} ${r.age} · ${esc(r.diagnosis?.name || r.suspicion?.name || '未诊断')}<span class="muted"> · ${fmtTime(r.arrivedAt)} 到院${r.referralReason ? ' · ' + esc(r.referralReason) : ''}</span></li>`).join('');
    return `<h2>${esc(title)} <small>${esc(date)} · ${ids.length} 人</small></h2><ul class="people">${items || '<li class="muted">没有</li>'}</ul>`;
  },
  rules() {
    const group = (name, title, desc) => `<h3>${title}</h3><p class="note">${desc}</p><div class="choices">${Object.entries(RULES[name]).map(([v, label]) => `<button type="button" data-open="rule" data-arg="${name}=${v}" aria-pressed="${engine.s.rules[name] === v}">${label}</button>`).join('')}</div>`;
    return `<h2>医院规则 <small>院长不在时，大家按规则办事</small></h2>
      ${group('examStrategy', '检查策略', '精简：只做必需检查，快、便宜，但更容易误诊。规范：必需加支持性检查。全面：再加鉴别诊断的检查，更准，但更慢更贵。')}
      ${group('scope', '接诊范围', '能力外直接转诊：本院做不了的检查或治疗，问诊后立即转走。尽量处理：先做本院能做的检查再决定，收入多一些，但可能耽误时间。')}
      <p class="note">修改立即生效，影响之后问诊的病人。效果会在汇报里体现。</p>`;
  },
  people() {
    return `<h2>人事 <small>${view.staff.length} 名员工</small></h2><ul class="people">${view.staff.map(s => `<li class="link" data-open="staff" data-arg="${s.id}"><b>${esc(s.name)}</b> ${esc(s.title)}${esc(s.roleLabel)}<span class="muted"> · ${esc(s.status)} · 疲劳 ${s.fatigue}</span></li>`).join('')}</ul><p class="note">招聘、任命、排班将在后续版本开放。</p>`;
  },
  money() {
    const t = engine.local(), today = daySummary(engine, t.date), y = daySummary(engine, new Date(Date.parse(t.date) - 86400000).toISOString().slice(0, 10));
    const total = engine.s.records.filter(r => r.finishedAt != null && r.disposition !== 'left').reduce((a, r) => a + r.cost, 0);
    return `<h2>资金 <small>简化版</small></h2>${row('今日收入', `¥${today.revenue.toLocaleString('zh-CN')}`)}${row('昨日收入', `¥${y.revenue.toLocaleString('zh-CN')}`)}${row('开业以来收入', `¥${total.toLocaleString('zh-CN')}`)}<p class="note">工资、房租、药耗等支出和贷款将在后续版本接入，目前只统计门诊收入。</p>`;
  },
  build() { return '<h2>建设 <small>即将开放</small></h2><p class="note">划房间、摆设备、开设新科室将在后续版本开放。</p>'; },
  brief({ from, to }) {
    const s = periodSummary(engine, from, to);
    const count = k => s.outcomes.filter(o => o.result === k).length;
    return `<h2>离线简报 <small>${fmtDateTime(from)} — ${fmtDateTime(to)}</small></h2>
      <p>你离开的这段时间，医院照常运转：</p>
      ${row('到院', `${s.arrivals} 人`)}${row('处置离院', `${s.treated} 人`)}${row('转诊', `${s.referred.length} 人`)}${row('未就诊离开', `${s.left} 人`)}${row('收入', `¥${s.revenue.toLocaleString('zh-CN')}`)}
      ${s.outcomes.length ? `<h3>随访结局</h3>${row('治愈', count('recovered'))}${row('好转 / 控制', count('improved'))}${row('并发症', count('complication'))}${row('死亡', count('death'))}` : ''}
      ${s.misdiagnoses.length ? `<h3>返诊发现的误诊</h3><ul class="people">${s.misdiagnoses.map(m => `<li class="link" data-open="record" data-arg="${m.id}">${esc(engine.record(m.id).name)}：${esc(m.text)}</li>`).join('')}</ul>` : ''}
      <p class="link" data-open="report" data-arg="${engine.local().date}">查看今日门诊日报 ›</p>`;
  },
};

function showFatal(msg) { body.innerHTML = `<h2>无法启动</h2><p>${esc(msg)}</p>`; panel.hidden = false; }
function showCorrupt(data) {
  body.innerHTML = '<h2>存档损坏</h2><p>本地存档无法读取。为避免丢失，没有覆盖它。</p><p><button type="button" id="new-game">新建医院（会覆盖旧存档）</button></p>';
  panel.hidden = false;
  $('#new-game').addEventListener('click', () => { try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); });
}

start();
