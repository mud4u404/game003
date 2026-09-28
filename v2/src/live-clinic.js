import { scene as base } from './layout.js';
import { buildScene } from './catalog.js';
import { spriteNode } from './sprites.js';

// One real room converted first; all patients keep the same sprite along their route.
export const liveScene = {
  ...base, clean: true, people: [], outdoors: { trees: [], cars: [] },
  rooms: base.rooms.map(r => ({ ...r,
    name: { consult: '内科诊室', ward: '外科诊室·处置室' }[r.id] || r.name,
    ...(r.id === 'consult' || r.id === 'hall' ? { color: '#f7f9f8', grid: 'rgba(121,153,145,.15)' } : {}),
  })),
  furniture: base.furniture.filter(f => f.room !== 'consult'),
};
export function clinicNodes(assets) {
  const items = [
    ['desk',2.28,1.8], ['monitor',2.48,1.75,.52],
    ['doctor-chair',2.28,1.05], ['patient-chair',2.28,2.4],
    ['exam-bed',.65,1.6], ['cabinet',2,.3], ['sink',3.3,.35],
    ['plant',3.5,2.8], ['lightbox',1.5,.02,.85],
  ];
  return [...buildScene(liveScene), ...items.map(([asset,x,y,z=0],i) =>
    spriteNode(assets.get(asset), { id: `clinic:${i}`, x,y,z, width: asset === 'doctor-chair' ? 16 : asset === 'patient-chair' ? 18 : undefined }))];
}
