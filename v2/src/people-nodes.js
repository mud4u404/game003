// 把 Actors 里的人物变成可排序、可点选的绘制节点（绘制方式沿用 T001 的人物画法）。
import { project } from './iso.js';
import { appearances } from './layout.js';

export function personNodes(actors) {
  return actors.people().map(a => {
    const p = project(a.x, a.y, a.z || 0), look = appearances[a.appearance] || appearances.blue;
    const seated = a.pose === 'seat', lying = a.pose === 'lie';
    return {
      id: `actor:${a.id}`,
      bounds: { x: a.x - .09, y: a.y - .09, w: .18, d: .18, z: lying ? .45 : seated ? .21 : 0, h: lying ? .1 : seated ? .65 : 1.05 },
      draw: r => {
        if (lying) { r.ell(p.x, p.y - 1, 4.6, 4.2, look.hair, 'rgba(45,52,64,.75)', .4); r.ell(p.x - .3, p.y + .4, 3.6, 2.8, look.skin); }
        else r.person(p.x, p.y, { ...look, pose: a.pose, back: a.back, walk: a.pose === 'walk' });
      },
      person: a,
      screenBounds: { left: p.x - 8, right: p.x + 8, top: p.y - (lying ? 6 : seated ? 28 : 34), bottom: p.y + 2 },
    };
  });
}
