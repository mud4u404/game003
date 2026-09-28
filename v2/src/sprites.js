import { project } from './iso.js';

// Alpha masks are read once at load, never during a frame or a pointer event.
export async function loadSprites(url = '/v2/assets/manifest.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`素材清单加载失败 (${response.status})`);
  const manifest = await response.json(), assets = new Map();
  await Promise.all(Object.entries(manifest.assets).map(async ([id, spec]) => {
    const image = new Image(); image.src = new URL(spec.file, new URL(url, location.href)).href;
    await image.decode();
    const canvas = document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const rgba=ctx.getImageData(0,0,image.width,image.height).data;
    const alpha=new Uint8Array(image.width*image.height);
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
    assets.set(id,{...spec,image,alpha,pixelWidth:image.width,pixelHeight:image.height});
  }));
  return assets;
}

export function alphaHit(asset, rect, point, mirror=false) {
  const u=(point.x-rect.left)/rect.width,v=(point.y-rect.top)/rect.height;
  if(u<0||u>=1||v<0||v>=1)return false;
  let x=Math.floor(u*asset.pixelWidth);if(mirror)x=asset.pixelWidth-1-x;
  return asset.alpha[Math.floor(v*asset.pixelHeight)*asset.pixelWidth+x]>=32;
}

export function spriteNode(asset, instance) {
  const {x,y,z=0,id,person,mirror=false}=instance;
  const p=project(x,y,z),width=instance.width||asset.displayWidth;
  const height=width*asset.pixelHeight/asset.pixelWidth;
  const rect={left:p.x-width*(mirror?1-asset.anchor[0]:asset.anchor[0]),top:p.y-height*asset.anchor[1],width,height};
  const [w,d]=asset.footprint;
  return {
    id,pixelHit:true,bounds:{x:x-w/2,y:y-d/2,w,d,z,h:asset.height},person,
    screenBounds:{left:rect.left,right:rect.left+width,top:rect.top,bottom:rect.top+height},
    hit:point=>alphaHit(asset,rect,point,mirror),
    draw:r=>{const g=r.context;g.save();g.translate(rect.left+(mirror?width:0),rect.top);if(mirror)g.scale(-1,1);g.drawImage(asset.image,0,0,width,height);g.restore();},
  };
}

// Cache a small gait cycle once. No pixel reads, allocations or frame loop while idle.
export function prepareWalkFrames(assets) {
  for (const [id, source] of [...assets]) {
    if (!id.includes('-stand-')) continue;
    const w = 128, h = Math.round(w * source.pixelHeight / source.pixelWidth);
    for (let frame = 0; frame < 8; frame++) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const phase = frame / 8 * Math.PI * 2, hip = h * .56;
      // Pivot each lower-body half at the hip. The upper body overlaps the seams.
      for (const side of [0, 1]) {
        ctx.save(); ctx.translate(w * .5, hip);
        ctx.rotate(Math.sin(phase + side * Math.PI) * .055);
        ctx.drawImage(source.image, side * source.pixelWidth / 2, source.pixelHeight * .54,
          source.pixelWidth / 2, source.pixelHeight * .46,
          side * w / 2 - w * .5, h * .54 - hip, w / 2, h * .46);
        ctx.restore();
      }
      ctx.drawImage(source.image, 0, 0, source.pixelWidth, source.pixelHeight * .58,
        0, -Math.abs(Math.sin(phase)) * h * .007, w, h * .58);
      const rgba = ctx.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      assets.set(`${id}:walk:${frame}`, { ...source, image: canvas, alpha, pixelWidth: w, pixelHeight: h });
    }
  }
}
