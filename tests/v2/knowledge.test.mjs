import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
const root = new URL('../../data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const files = readdirSync(new URL('diseases/', root)).filter(f => !f.startsWith('._') && f.endsWith('.json')).sort();
const dataset = { diseases: files.map(f => read(`diseases/${f}`)), exams: read('exams.json'), glossary: read('glossary.json'), sources: read('sources.json'), ids: read('ids.json') };
const expected = ['upper_respiratory_infection','community_acquired_pneumonia','acute_gastroenteritis','essential_hypertension','type_2_diabetes','lower_urinary_tract_infection','acute_appendicitis','soft_tissue_injury','distal_radius_fracture','acute_urticaria','acute_coronary_syndrome'];
const requiredExams = ['cbc','urinalysis','blood_glucose','hba1c','ecg','troponin','chest_xray','limb_xray','abdominal_ultrasound','abdominal_ct'];
const status = value => assert.ok(['draft','claude_reviewed'].includes(value), `reviewStatus: ${value}`);
const obj = value => assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'expected object');
const str = value => assert.ok(typeof value === 'string' && value.trim(), 'expected nonempty string');
const num = (value, min = 0, max = Infinity) => assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `invalid number: ${value}`);
const arr = (value, fn, min = 0) => { assert.ok(Array.isArray(value) && value.length >= min, 'expected array'); value.forEach(fn); };
const keys = (value, names) => { obj(value); names.forEach(k => assert.ok(Object.hasOwn(value,k), `missing ${k}`)); };
const id = value => { str(value); assert.match(value,/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/); };
const plain = value => { str(value); assert.ok([...value].length <= 120, 'plain exceeds 120 characters'); };
const unique = (entries, key) => { const all = entries.map(e=>e[key]); assert.equal(new Set(all).size,all.length, `duplicate ${key}`); return new Set(all); };
const refs = (value, set, min = 0) => arr(value, x => assert.ok(set.has(x), `unknown reference ${x}`), min);
const range = value => { arr(value,x=>num(x),2); assert.equal(value.length,2); assert.ok(value[0] <= value[1]); };
const probabilities = (value, names) => {
  keys(value,names); assert.deepEqual(Object.keys(value).sort(), [...names].sort());
  names.forEach(k=>num(value[k],0,1));
  assert.ok(Math.abs(names.reduce((sum,k)=>sum+value[k],0)-1)<=.001, 'probabilities must sum to 1');
};
function validate(data) {
  const {diseases, exams, glossary, sources, ids} = data;
  [diseases,exams,glossary,sources].forEach(a=>assert.ok(Array.isArray(a) && a.length));
  const ds=unique(diseases,'id'), es=unique(exams,'id'), ss=unique(sources,'id'); unique(glossary,'term');
  const registry={};
  for(const kind of ['departments','rooms','equipment','staff']) {
    arr(ids[kind], entry=>{ keys(entry,['id','name']);id(entry.id);str(entry.name); },1);
    registry[kind]=unique(ids[kind],'id');
  }
  const allIds=Object.values(registry).flatMap(s=>[...s]);
  assert.equal(new Set(allIds).size,allIds.length,'resource namespaces must not collide');
  const common = e=>{ refs(e.sourceIds,ss,1);status(e.reviewStatus); };
  const verification = e=>{ if(Object.hasOwn(e,'needsVerification')) { assert.equal(typeof e.needsVerification,'boolean'); if(e.needsVerification)str(e.verificationNote); } };
  for(const s of sources) {
    keys(s,['id','title','publisher','year','scope','needsVerification','verificationNote','accessedOn']); id(s.id);str(s.title);str(s.publisher);str(s.scope);str(s.verificationNote);
    if(s.year===null)assert.equal(s.needsVerification,true);else { num(s.year,1900,2100);assert.ok(Number.isInteger(s.year)); }
    assert.equal(typeof s.needsVerification,'boolean');
    if(Object.hasOwn(s,'url')) {str(s.url);assert.equal(new URL(s.url).protocol,'https:');}
    assert.match(s.accessedOn,/^\d{4}-\d{2}-\d{2}$/);
  }
  for(const e of exams) {
    keys(e,['id','name','room','equipment','staff','durationMinutes','resultMinutes','costCNY','plain','sourceIds','reviewStatus','basis','simplifications']);
    id(e.id);str(e.name);assert.ok(registry.rooms.has(e.room));refs(e.equipment,registry.equipment,1);refs(e.staff,registry.staff,1);
    num(e.durationMinutes,0);num(e.resultMinutes,0);range(e.costCNY);plain(e.plain);common(e);str(e.basis);assert.match(e.basis,/游戏估计/);arr(e.simplifications,str,1);
  }
  for(const e of glossary) {
    keys(e,['term','plain','sourceIds','reviewStatus']);str(e.term);plain(e.plain);common(e);verification(e);
  }
  for(const d of diseases) {
    keys(d,['id','name','icd10','department','relatedDepartments','population','epidemiology','triage','presentation','differentials','workup','diagnosis','treatment','referral','outcomes','costCNY','plain','businessNote','sourceIds','simplifications','reviewStatus']);
    id(d.id);str(d.name);assert.ok(ds.has(d.id));common(d);plain(d.plain);str(d.businessNote);str(d.referral);range(d.costCNY);arr(d.simplifications,str,1);
    if(d.icd10===null) assert.ok(d.simplifications.some(s=>s.includes('icd10为null')),'null ICD needs reason');
    else assert.match(d.icd10,/^[A-Z]\d{2}(?:\.\d{1,2})?$/);
    assert.ok(registry.departments.has(d.department));refs(d.relatedDepartments,registry.departments);
    keys(d.population,['minimumAge','scope']);num(d.population.minimumAge,0,120);assert.ok(Number.isInteger(d.population.minimumAge));str(d.population.scope);
    const ep=d.epidemiology;
    keys(ep,['annualIncidencePer100k','metric','ageWeights','sexRatio','seasonality','basis']);num(ep.annualIncidencePer100k);assert.equal(ep.metric,'annual_consultations_per_100k');str(ep.basis);
    assert.deepEqual(Object.keys(ep.ageWeights).sort(),['0–14','15–44','45–64','65+'].sort());Object.values(ep.ageWeights).forEach(n=>num(n));assert.ok(Object.values(ep.ageWeights).some(n=>n>0));
    num(ep.sexRatio,0);arr(ep.seasonality,n=>num(n));assert.equal(ep.seasonality.length,12);assert.ok(ep.seasonality.some(n=>n>0));
    probabilities(d.triage,['I','II','III','IV']);
    keys(d.presentation,['chiefComplaints','symptoms','signs']);arr(d.presentation.chiefComplaints,str,2);assert.ok(d.presentation.chiefComplaints.length<=4);
    arr(d.presentation.symptoms,s=>{ keys(s,['name','probability']);str(s.name);num(s.probability,0,1); },1);arr(d.presentation.signs,str,1);
    arr(d.differentials,x=>{str(x);assert.ok(ds.has(x)||/[\u3400-\u9fff]/u.test(x),`unknown differential ${x}`);},1);
    arr(d.workup,w=>{keys(w,['examId','purpose','typicalFinding','diagnosticValue']);assert.ok(es.has(w.examId),`unknown exam ${w.examId}`);str(w.purpose);str(w.typicalFinding);assert.ok(['essential','supportive','rule_out'].includes(w.diagnosticValue));});
    keys(d.diagnosis,['criteria','difficulty','misdiagnosisRisks']);str(d.diagnosis.criteria);num(d.diagnosis.difficulty,1,5);assert.ok(Number.isInteger(d.diagnosis.difficulty));arr(d.diagnosis.misdiagnosisRisks,str,1);
    arr(d.treatment,t=>{keys(t,['setting','description','requires','duration']);assert.ok(['outpatient','observation','inpatient','surgery','referral'].includes(t.setting));str(t.description);str(t.duration);keys(t.requires,['departments','equipment','staff']);for(const kind of ['departments','equipment','staff'])refs(t.requires[kind],registry[kind],kind==='equipment'?0:1);},1);
    keys(d.outcomes,['timely','delayed','missed','basis','horizonDays','scope']);
    for(const scenario of ['timely','delayed','missed'])probabilities(d.outcomes[scenario],['recovered','improved','complication','death']);
    str(d.outcomes.basis);num(d.outcomes.horizonDays,1);assert.ok(Number.isInteger(d.outcomes.horizonDays));str(d.outcomes.scope);
    assert.match(ep.basis,/游戏估计/);assert.match(d.outcomes.basis,/游戏估计/);assert.ok(d.simplifications.some(s=>s.includes('游戏估计')));
  }
}
test('knowledge: full schema, ranges, references and probability distributions',()=>validate(dataset));
test('knowledge: T002 scope, draft status, canonical UTF-8 JSON and glossary names',()=>{
  assert.deepEqual([...dataset.diseases.map(d=>d.id)].sort(),expected.sort());
  requiredExams.forEach(id=>assert.ok(dataset.exams.some(e=>e.id===id)));
  for(const [i,d] of dataset.diseases.entries())assert.equal(files[i],`${d.id}.json`);
  for(const e of [...dataset.diseases,...dataset.exams,...dataset.glossary])assert.equal(e.reviewStatus,'draft');
  for(const e of [...dataset.diseases,...dataset.exams])assert.ok(dataset.glossary.some(g=>g.term===e.name));
  for(const file of [...files.map(f=>`diseases/${f}`),'exams.json','glossary.json','sources.json','ids.json']) {
    const content=readFileSync(new URL(file,root),'utf8');assert.equal(content,JSON.stringify(JSON.parse(content),null,2)+'\n');assert.ok(!content.includes('\uFFFD'));
  }
});
// These negative cases demonstrate rejection; validating only today's good data would
// not catch an accidentally weakened validator when later tasks extend the schema.
const invalidCases = [
 ['missing nested field',d=>delete d.diseases[0].diagnosis.criteria],
 ['wrong type',d=>d.exams[0].durationMinutes='5'],
 ['unknown source',d=>d.glossary[0].sourceIds=['invented_source']],
 ['unknown exam',d=>d.diseases[0].workup[0].examId='invented_exam'],
 ['unknown department',d=>d.diseases[0].department='invented_department'],
 ['unknown room',d=>d.exams[0].room='invented_room'],
 ['unknown equipment',d=>d.exams[0].equipment=['invented_equipment']],
 ['unknown staff',d=>d.diseases[0].treatment[0].requires.staff=['invented_staff']],
 ['unknown differential id',d=>d.diseases[0].differentials=['invented_disease']],
 ['negative probability',d=>d.diseases[0].triage.I=-.01],
 ['triage sum',d=>d.diseases[0].triage.I=.7],
 ['outcome sum',d=>d.diseases[0].outcomes.timely.death=.7],
 ['missing age band',d=>delete d.diseases[0].epidemiology.ageWeights['65+']],
 ['wrong month count',d=>d.diseases[0].epidemiology.seasonality.pop()],
 ['long plain',d=>d.glossary[0].plain='字'.repeat(121)],
 ['empty plain',d=>d.exams[0].plain=''],
 ['unknown review status',d=>d.diseases[0].reviewStatus='approved'],
 ['unexplained null',d=>{d.diseases[0].icd10=null;d.diseases[0].simplifications=['游戏估计'];}],
 ['duplicate id',d=>d.exams.push(d.exams[0])],
 ['unexplained verification flag',d=>{d.sources[0].needsVerification=true;d.sources[0].verificationNote='';}],
 ['reversed cost range',d=>d.diseases[0].costCNY=[100,1]],
 ['invalid age weight',d=>d.diseases[0].epidemiology.ageWeights['65+']=NaN],
 ['invalid numeric infinity',d=>d.exams[0].resultMinutes=Infinity]
];
for(const [label,mutate] of invalidCases)test(`knowledge rejects ${label}`,()=>{const copy=structuredClone(dataset);mutate(copy);assert.throws(()=>validate(copy));});
