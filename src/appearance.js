import { identityHash, patientSex } from './identity.js';
// Appearance is derived from identity, never from the world's demand RNG.
// Names, age, sex and sprites share one profile; follow-up visits preserve the episode identity.
export function patientAppearance(patient) {
  const hash=identityHash(patient),sex=patientSex(patient);
  const choices = sex==='female' ? (patient.age>=60?[6]:[7,10]) : (patient.age>=60?[5]:patient.age<40?[9]:[8,9,11]);
  const index = choices[hash % choices.length];
  const heights = { 5: 75, 6: 70, 7: 75, 8: 77, 9: 86, 10: 78, 11: 76 };
  return { index, seatedIndex: index - 5, height: heights[index] + ((hash >>> 5) % 7) - 3,
    widthScale: .94 + ((hash >>> 12) % 13) / 100, rhythm: hash % 900 };
}
export const STAFF_APPEARANCE = {
  doctor1: { index: 0, seatedIndex: 14, height: 78, widthScale: 1 },
  doctor2: { index: 1, seatedIndex: 15, height: 83, widthScale: 1.03 },
  nurse: { index: 2, height: 76, widthScale: 1 },
  nurse2: { index: 2, height: 80, widthScale: .95 },
  pharmacist: { index: 1, seatedIndex:15, height: 80, widthScale: .97 },
  director: { index: 3, height: 79, widthScale: 1 },
  reception: { index: 4, height: 77, widthScale: 1 }
};
export class ArtLibrary {
  constructor() { this.atlases = {}; this.ready = false; }
  async load() {
    const response = await fetch('/assets/art/atlas.json');
    if (!response.ok) throw new Error('Art atlas could not load');
    const manifest = await response.json();
    await Promise.all(Object.entries(manifest).map(async ([name, spec]) => {
      const image = new Image(); image.src = spec.src; await image.decode();
      this.atlases[name] = { ...spec, image };
    }));
    this.ready = true;
  }
  draw(ctx, atlas, index, x, y, width, height, flip = false) {
    if (!this.ready) return false;
    const { image, bounds, rowHeights, columns=4, anchors } = this.atlases[atlas];
    const [sx, sy, sw, sh] = bounds[index];
    const ratio = rowHeights ? height / rowHeights[Math.floor(index/columns)] : Math.min(width / sw, height / sh), w = sw * ratio, h = sh * ratio;
    ctx.save();
    ctx.translate(x + width / 2, y + height);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, sw, sh, -w*(anchors?.[index]??.5), -h, w, h);
    ctx.restore();
    return true;
  }
}
