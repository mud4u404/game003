// 把 Actors 里的人物变成可排序、可点选的绘制节点（新素材与尚未换装的旧人物并存）。
import { project } from './iso.js';
import { spriteNode } from './sprites.js';
import { appearances } from './layout.js';

export function personNodes(actors, assets) {
  return actors.people().map(a => {
    if (assets && a.pose !== 'lie' && (a.kind === 'patient' || a.id === 'doctor-1')) {
      const prefix = a.kind === 'staff' ? 'doctor' : a.sex === 'male' ? 'patient-male' : 'patient';
      const transition = a.transition;
      const progress = transition ? transition.elapsed / transition.duration : 0;
      const seated = transition ? (transition.kind === 'rise' ? progress < .5 : progress >= .5) : a.pose === 'seat';
      const key = `${prefix}-${seated ? 'seat' : 'stand'}-${a.back ? 'back' : 'front'}`;
      const frame = Math.floor((a.walkDistance || 0) / .85 * 8) % 8;
      const asset = assets.get(a.pose === 'walk' && !transition ? `${key}:walk:${frame}` : key) || assets.get(key);
      const node = spriteNode(asset, { id: `actor:${a.id}`, x: a.x, y: a.y, z: (a.z || 0) + (seated ? .001 : 0), person: a, mirror: !!a.mirror });
      // A short eased dip bridges the two poses; feet stay anchored to the floor.
      if (transition) {
        const draw = node.draw, foot = project(a.x, a.y, a.z || 0);
        const scale = 1 - Math.sin(progress * Math.PI) * .10;
        node.draw = r => { const g = r.context; g.save(); g.translate(foot.x, foot.y); g.scale(1, scale); g.translate(-foot.x, -foot.y); draw(r); g.restore(); };
        const hit = node.hit;
        node.hit = point => hit({ x: point.x, y: foot.y + (point.y - foot.y) / scale });
      }
      return node;
    }
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
