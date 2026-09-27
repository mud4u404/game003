import {GIVEN_PROFILES} from './identity.js';
import {newClinicalCase,CLINICAL_CASES} from './medical.js';

// A bounded initial community cohort exists before any site/service choice.
// Separate RNG: booking appointments must not consume or re-roll future city demand.
export function communityRequests(seed,at){
  let rng=(seed^0x71a57c31)>>>0;
  const draw=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const surnames=['陈','林','周','王','徐','沈','赵','方','许','李','吴','何'];
  return Array.from({length:12},(_,i)=>{
    const surname=surnames[Math.floor(draw()*surnames.length)],profile=GIVEN_PROFILES[Math.floor(draw()*GIVEN_PROFILES.length)];
    const p={id:'opening-'+i,name:surname+profile[0],sex:profile[1],age:22+Math.floor(draw()*54),appearance:Math.floor(draw()*4),color:'#78938a',kind:'routine',arrivedAt:at};
    p.clinical=newClinicalCase(p);p.thought=CLINICAL_CASES[p.clinical.type].complaint;return p;
  });
}
export function eligibleRequests(s){
  const services=s.venture?.plan?.services||s.venture?.draft?.services||[];
  return (s.venture?.openingRequests||[]).filter(p=>p.clinical.type!=='urgent'&&(p.clinical.type==='respiratory'?services.includes('consult'):services.includes('chronic'))).slice(0,2);
}
export function validateOpening(v){
  const list=v.openingRequests;
  if(!Array.isArray(list)||list.length>12||new Set(list.map(p=>p?.id)).size!==list.length||list.some(p=>!p||typeof p.id!=='string'||!/^opening-\d+$/.test(p.id)||typeof p.name!=='string'||p.name.length>80||typeof p.thought!=='string'||p.kind!=='routine'||p.color!=='#78938a'||!['male','female'].includes(p.sex)||!Number.isInteger(p.age)||p.age<18||!Number.isInteger(p.appearance)||p.appearance<0||p.appearance>3||!Number.isFinite(p.arrivedAt)||!CLINICAL_CASES[p.clinical?.type]||p.clinical.episodeId!==p.id||!Array.isArray(p.clinical.trail)||p.clinical.trail.length>24||JSON.stringify(p.clinical)!==JSON.stringify(newClinicalCase(p))))throw Error('开业预约档案不完整');
}

export function countInitialRequests(s){
  const list=s.venture.openingRequests;s.metrics.demand+=list.length;
  s.demandTrace.push(...list.map(p=>({id:p.id,at:s.time,kind:p.kind})));
  s.demandTrace=s.demandTrace.slice(-256);
}
