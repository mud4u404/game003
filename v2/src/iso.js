// World units match concept C: one floor tile = 0.5 units.
export const HW = 25, HH = 12.5, ZS = 30;
export function project(x, y, z = 0) { return { x: (x - y) * HW, y: (x + y) * HH - z * ZS }; }
export function unproject(x, y, z = 0) { return { x: (x / HW + (y + z * ZS) / HH) / 2, y: ((y + z * ZS) / HH - x / HW) / 2 }; }
export function toScreen(p, camera) { return { x: camera.x + p.x * camera.zoom, y: camera.y + p.y * camera.zoom }; }
export function fromScreen(p, camera) { return { x: (p.x - camera.x) / camera.zoom, y: (p.y - camera.y) / camera.zoom }; }
export function shade(hex, f) { return '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''); }
