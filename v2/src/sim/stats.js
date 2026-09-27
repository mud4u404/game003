// 从病历统计汇报数据。只统计院长“看得到”的事实：误诊只有在返诊被发现后才计入。
export function daySummary(engine, date) {
  const recs = engine.s.records.filter(r => engine.local(r.arrivedAt).date === date);
  const lists = { all: [], referred: [], left: [], longWait: [], misdiagnosed: [], treated: [], inProgress: [] };
  const reasons = {};
  let waitSum = 0, waitN = 0, maxWait = 0, revenue = 0;
  for (const r of recs) {
    lists.all.push(r.id);
    const wait = r.waits.doctor != null ? r.waits.doctor + (r.waits.triage || 0) : null;
    if (wait != null) { waitSum += wait; waitN++; maxWait = Math.max(maxWait, wait); if (wait > 60) lists.longWait.push(r.id); }
    if (r.disposition === 'referred') { lists.referred.push(r.id); reasons[r.referralReason] = (reasons[r.referralReason] || 0) + 1; }
    else if (r.disposition === 'left' || r.disposition === 'closed') lists.left.push(r.id);
    else if (r.disposition === 'treated') lists.treated.push(r.id);
    else lists.inProgress.push(r.id);
    if (r.flags.some(f => f.type === 'misdiagnosis')) lists.misdiagnosed.push(r.id);
    if (r.finishedAt != null) revenue += r.disposition === 'left' ? 0 : r.cost;
  }
  return {
    date, arrivals: recs.length, treated: lists.treated.length, referred: lists.referred.length, left: lists.left.length,
    inProgress: lists.inProgress.length, avgWait: waitN ? Math.round(waitSum / waitN) : null, maxWait: waitN ? maxWait : null,
    misdiagnosed: lists.misdiagnosed.length, revenue, referralReasons: reasons, lists,
  };
}

// 离线简报：from~to 分钟之间发生的事。
export function periodSummary(engine, from, to) {
  const inRange = t => t != null && t >= from && t < to;
  const recs = engine.s.records;
  const arrived = recs.filter(r => inRange(r.arrivedAt));
  const finished = recs.filter(r => inRange(r.finishedAt));
  const outcomes = recs.filter(r => r.outcome && inRange(r.outcome.revealAt) && r.outcome.result);
  const discovered = recs.flatMap(r => r.flags.filter(f => f.type === 'misdiagnosis' && inRange(f.t)).map(f => ({ id: r.id, text: f.text })));
  return {
    from, to, arrivals: arrived.length,
    treated: finished.filter(r => r.disposition === 'treated').length,
    referred: finished.filter(r => r.disposition === 'referred').map(r => ({ id: r.id, reason: r.referralReason })),
    left: finished.filter(r => r.disposition === 'left' || r.disposition === 'closed').length,
    revenue: finished.filter(r => r.disposition !== 'left').reduce((a, r) => a + r.cost, 0),
    outcomes: outcomes.map(r => ({ id: r.id, result: r.outcome.result })),
    misdiagnoses: discovered,
  };
}
