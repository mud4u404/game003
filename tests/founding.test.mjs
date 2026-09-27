import test from 'node:test';
import assert from 'node:assert/strict';
import {createVenture,createState,advanceTo,restoreState,STAFF,MINUTE,HOUR,applyManagementAction} from '../src/simulation.js';
import {configureDraft,quotePlan,signPlan,openVenture,acceptingAt,staffFor,serviceAvailable,enableService,relocate,relocationQuote,advanceVenture,MONTH,DAY} from '../src/business.js';
const START=Date.parse('2026-09-28T08:00:00+08:00');
const run=(s,to)=>{while(!advanceTo(s,to).caughtUp){}return s;};
function planned({site='willow',loan='none',services=[]}={}){const s=createVenture(START,741);for(const [kind,id] of [['site',site],['model','general'],...services.map(x=>['service',x]),...['lin','chen','he',...(services.includes('pharmacy')?['lu']:[])].map(x=>['staff',x]),['loan',loan]])assert.equal(configureDraft(s,kind,id).ok,true);return s;}
function opened(options){const s=planned(options);assert.equal(signPlan(s).ok,true);run(s,START+2*HOUR);assert.equal(openVenture(s).ok,true);return s;}
test('founding is empty and free until a complete valid plan is signed; signing is idempotent',()=>{
 const s=createVenture(START);assert.equal(s.patients.length,0);assert.equal(signPlan(s).ok,false);run(s,START+DAY);assert.equal(s.cash,180000);assert.equal(s.metrics.revenue,0);assert.deepEqual(staffFor(s,STAFF),[]);
 const p=planned({services:['chronic','sampling','pharmacy'],loan:'small'}),q=quotePlan(p);assert.deepEqual(q.issues,[]);assert.equal(signPlan(p).ok,true);assert.equal(p.cash,180000+60000-q.upfront);assert.equal(p.metrics.revenue,0);const cash=p.cash;assert.equal(signPlan(p).ok,false);assert.equal(p.cash,cash);assert.equal(openVenture(p).ok,false);run(p,p.venture.readyAt);assert.equal(p.venture.stage,'ready');assert.equal(p.patients.length,0);assert.equal(p.metrics.revenue,0);assert.equal(p.medical.pharmacy.enabled,true);assert.equal(openVenture(p).ok,true);assert.equal(openVenture(p).ok,false);
});
test('scope and required staff block invalid opening; selections and reserve alter actual budget',()=>{
 const s=planned({site:'garden',services:['chronic','sampling','pharmacy']});configureDraft(s,'staff','gu');configureDraft(s,'staff','xu');assert.ok(quotePlan(s).issues.length);assert.equal(signPlan(s).ok,false);configureDraft(s,'loan','small');assert.equal(quotePlan(s).issues.length,0);delete s.venture.draft.staff.pharmacist;assert.match(quotePlan(s).issues.join(),/药师/);assert.equal(signPlan(s).ok,false);
});
test('business hours apply to admissions and visible staff, not employed roster or existing care',()=>{
 const s=opened();assert.equal(acceptingAt(s),true);assert.deepEqual(staffFor(s,STAFF).map(p=>p.name),['林岚','陈雪','何川']);const night=Date.parse('2026-09-28T18:00:00+08:00');run(s,night);assert.equal(acceptingAt(s),false);assert.equal(s.patients.length,0);assert.equal(staffFor(s,STAFF,true).length,0);assert.equal(staffFor(s,STAFF).length,3);assert.equal(acceptingAt(s,Date.parse('2026-10-03T10:00:00+08:00')),false);assert.ok(s.metrics.completed>0);
});
test('adding services affects capacity to receive people without altering underlying city demand',()=>{
 const a=opened(),b=opened();assert.equal(serviceAvailable(a,'workup'),false);assert.equal(enableService(b,'sampling').ok,false);assert.equal(enableService(b,'chronic').ok,true);assert.equal(enableService(b,'sampling').ok,true);assert.equal(enableService(b,'sampling').ok,false);run(a,START+5*DAY);run(b,START+5*DAY);assert.deepEqual(a.demandTrace,b.demandTrace);assert.equal(a.medical.stats.sampled,0);assert.ok(b.medical.stats.sampled>0);assert.ok(a.venture.world.unavailable>b.venture.world.unavailable);
});
test('new venture is deterministic across offline batching, reload and small online updates',()=>{
 const a=opened({services:['chronic','sampling','pharmacy'],loan:'small'}),b=structuredClone(a);run(a,START+8*DAY);for(let at=b.time+7*MINUTE;at<START+8*DAY;at+=7*MINUTE)advanceTo(b,at);run(b,START+8*DAY);assert.deepEqual(a,b);assert.deepEqual(restoreState(JSON.stringify(a)),a);assert.equal(a.cash,180000+60000+a.metrics.revenue-a.metrics.operating-a.metrics.investment-a.venture.debtPaid);
});
test('small property prevents overbuilding; moving preserves care records, debt and money accounting',()=>{
 const s=opened({loan:'large',services:['chronic','pharmacy']});assert.equal(applyManagementAction(s,{action:'openSecondRoom'},'investor').ok,false);run(s,START+6*HOUR);const histories=structuredClone(s.medical.records),principal=s.venture.loan.principal,q=relocationQuote(s,'station'),cash=s.cash;assert.equal(relocate(s,'station').ok,true);assert.equal(s.cash,cash-q.cost);assert.equal(acceptingAt(s),false);assert.equal(relocate(s,'station').ok,false);run(s,s.venture.relocation.due+HOUR);assert.equal(s.venture.site,'station');assert.equal(s.venture.stage,'open');assert.equal(s.venture.loan.principal,principal);assert.ok(histories.every(x=>s.medical.records.some(y=>y.id===x.id)));assert.equal(s.venture.ledger.find(x=>x.category==='depositReturn').amount,q.refund);assert.equal(applyManagementAction(s,{action:'openSecondRoom'},'investor').ok,true);assert.equal(s.cash,180000+120000+s.metrics.revenue-s.metrics.operating-s.metrics.investment-s.venture.debtPaid+q.refund);assert.deepEqual(restoreState(JSON.stringify(s)),s);
});
test('loan payments separate principal from expenses, retain unpaid amounts and finish after repayment',()=>{
 const s=planned({loan:'small'});signPlan(s);s.venture.nextBill=null;const initial=s.cash,operating=s.metrics.operating;s.time=s.venture.loan.nextDue;advanceVenture(s);assert.equal(s.venture.loan.principal,55000);assert.equal(initial-s.cash,5300);assert.equal(s.metrics.operating-operating,300);assert.equal(s.venture.debtPaid,5000);
 s.cash=100;s.time=s.venture.loan.nextDue;advanceVenture(s);assert.equal(s.venture.loan.principal,55000);assert.equal(s.venture.loan.interestDue,175);assert.equal(s.venture.arrears,5175);assert.equal(s.cash,0);
 s.cash=100000;for(let i=0;i<12&&s.venture.loan;i++){s.time=s.venture.loan.nextDue;advanceVenture(s);}assert.equal(s.venture.loan,null);assert.equal(s.venture.arrears,0);assert.equal(s.venture.debtPaid,60000);
});
test('malformed founding saves are rejected and legacy saves remain operational',()=>{
 const s=opened();for(const mutate of [x=>x.venture.site='bad',x=>delete x.venture.plan.staff.nurse,x=>x.venture.nextBill=x.time-1,x=>x.venture.plan.services.push('bad'),x=>x.venture.stage='moving']){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreState(JSON.stringify(bad)));}const old=createState(START);assert.deepEqual(restoreState(JSON.stringify(old)),old);assert.equal(old.venture,undefined);
});
test('external-only checks never fabricate an in-house sample and still return for review',()=>{
 const s=opened({services:['chronic']});run(s,START+4*DAY);assert.equal(s.medical.stats.sampled,0);assert.ok(s.medical.stats.reported>0);assert.ok(s.medical.stats.reviewed>0);const checked=s.medical.records.filter(r=>r.clinical.report);assert.ok(checked.length);assert.ok(checked.every(r=>r.clinical.report.source==='external'&&r.clinical.report.orderedAt&&!r.clinical.report.sampledAt));assert.deepEqual(restoreState(JSON.stringify(s)),s);
});
test('reselecting a chosen direction preserves services and recruited staff',()=>{
 const s=planned({services:['chronic','sampling','pharmacy']});const before=structuredClone(s.venture.draft);configureDraft(s,'model','general');assert.deepEqual(s.venture.draft,before);
});
