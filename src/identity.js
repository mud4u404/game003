// These are fictional generator profiles, not rules for inferring real people's sex from names.
export const GIVEN_PROFILES = [
  ['文清','female'],['明远','male'],['舒宁','female'],['子安','male'],
  ['雅琴','female'],['建平','male'],['晓禾','female'],['雨桐','female'],
  ['思源','male'],['清和','male'],['书言','male'],['知夏','female']
];
export function identityHash(p) {
  let h=2166136261;
  const id=p.clinical?.episodeId||p.identityId||p.id.replace(/-v\d+$/,'');
  for(const c of `${id}:${p.name}:${p.appearance}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  return h;
}
export function patientSex(p) {
  if(['female','male'].includes(p.sex))return p.sex;
  const prior=GIVEN_PROFILES.find(([given])=>p.name.endsWith(given));
  return prior?.[1]||(identityHash(p)%2?'female':'male');
}
export const sexLabel=p=>patientSex(p)==='female'?'女':'男';
