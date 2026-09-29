// Art feasibility probe. Every visible object below is a separate vector element.
// One moving patient demonstrates that the scene is assembled, not a flat concept image.
const svg = document.getElementById('world');
const P = (x, y, z = 0) => [195 + (x - y) * 42, 134 + (x + y) * 21 - z];
const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poly = (points, fill, stroke = '#58646a', width = 1.1, extra = '') =>
  `<polygon points="${points.map(pt).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" ${extra}/>`;
const line = (a, b, stroke, width = 1, extra = '') => `<path d="M${pt(a)} L${pt(b)}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const diamond = (x, y, w, d, z, fill, stroke = '#637179', width = 1) =>
  poly([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill, stroke, width);

let out = `<defs>
  <linearGradient id="hall" x2=".3" y2="1"><stop stop-color="#fcf6e9"/><stop offset="1" stop-color="#e9e1d5"/></linearGradient>
  <linearGradient id="consult" x2="1" y2="1"><stop stop-color="#e3cbaa"/><stop offset="1" stop-color="#c4ad8f"/></linearGradient>
  <linearGradient id="wall" x2=".2" y2="1"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#e4d9c6"/></linearGradient>
  <linearGradient id="outside" x2="0" y2="1"><stop stop-color="#b6c5af"/><stop offset="1" stop-color="#8fac99"/></linearGradient>
  <filter id="shadow"><feGaussianBlur stdDeviation="5"/></filter>
  <pattern id="fleck" width="19" height="17" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r=".55" fill="#9b978b" opacity=".22"/><circle cx="12" cy="11" r=".45" fill="#fff" opacity=".75"/></pattern>
  <clipPath id="floorclip">${diamond(0,0,6,6,0,'#fff','#fff',0)}</clipPath>
  </defs>`;

// Outside, entrance paving, and one parked ambulance kept secondary to the clinic.
out += `<path d="M0 0H390V650H0Z" fill="url(#outside)"/>`;
for (let i = 0; i < 62; i++) {
  const x = (i * 73 + 11) % 390, y = (i * 97 + 27) % 610;
  out += `<path d="M${x} ${y}l-2 -5m2 5l3 -4" stroke="#668e73" stroke-width=".8" opacity=".32" fill="none"/>`;
}
out += `<path d="M-30 466L187 352L440 472L207 590Z" fill="#e8e3d8" stroke="#9ba6a0" stroke-width="2"/>`;
for(let k=-2;k<8;k++)out+=line([k*53-12,472-k*26],[k*53+22,489-k*26],'#d6d3c9',1);
out += `<path d="M-20 568L385 366L435 394L37 606Z" fill="#718087" opacity=".8"/>`;
for(let i=0;i<7;i++)out+=line([i*67-22,562-i*33],[i*67+6,548-i*33],'#f5f0de',2.4);
out += `<g opacity=".92" transform="translate(322 493)"><ellipse cx="-3" cy="12" rx="37" ry="9" fill="#31434b" opacity=".28"/><path d="M-42 -3l12 -11h38l15 11v17h-65z" fill="#eef2ed" stroke="#617076" stroke-width="1.4"/><path d="M-26 -13l5 -11h23l9 11z" fill="#8ca8b3" stroke="#617076" stroke-width="1.2"/><path d="M-39 2h59" stroke="#ce7362" stroke-width="3"/><circle cx="-28" cy="15" r="5" fill="#32444b"/><circle cx="12" cy="15" r="5" fill="#32444b"/><path d="M-10 -1v-10m-5 5h10" stroke="#bd654f" stroke-width="2.5"/></g>`;

// A single continuous isometric floor. Tile lines are generated, not painted into a screenshot.
out += `<ellipse cx="193" cy="322" rx="240" ry="55" fill="#2b3f47" opacity=".23" filter="url(#shadow)"/>`;
out += poly([P(0,0),P(6,0),P(6,6),P(0,6)],'url(#hall)','#46525a',2);
out += `<g clip-path="url(#floorclip)">${diamond(0,0,6,6,0,'url(#fleck)','none',0)}`;
for(let t=0;t<=6;t++){
  out += line(P(t,0),P(t,6),'#c4c8c2',.65,'opacity=".72"');
  out += line(P(0,t),P(6,t),'#c4c8c2',.65,'opacity=".72"');
}
out += `</g>`;
out += diamond(2.15,.18,3.85,2.7,1,'url(#consult)','#7f8a86',1.4);
for(let t=2.3;t<6;t+=.3)out+=line(P(t,.25,1),P(t,2.82,1),'#916d53',.37,'opacity=".35"');
out += line(P(2.15,2.88,1),P(6,2.88,1),'#b9a28a',1.2);

// Back wall has visible depth and dark wall caps; cutaway fronts stay low.
function wall(a,b,height,fill='url(#wall)',cap='#6b7375'){
  const bottomA=P(...a),bottomB=P(...b),topA=P(a[0],a[1],height),topB=P(b[0],b[1],height);
  return poly([bottomA,bottomB,topB,topA],fill,'#586366',1.5)+poly([topA,topB,[topB[0]+2,topB[1]-5],[topA[0]+2,topA[1]-5]],cap,cap,1);
}
out += wall([2.15,.18],[6,.18],72);
out += wall([6,.18],[6,2.88],72);
out += wall([0,0],[2.15,0],52,'#f4eee3','#6c7778');
out += wall([0,0],[0,4.3],32,'#f0eadd','#6c7778');
// A framed window and art on the consultation wall.
out += `<g transform="translate(282 92)"><path d="M0 0l47 23v40L0 40Z" fill="#bad2d0" stroke="#71868c" stroke-width="2"/><path d="M8 11l31 15v21L8 32Z" fill="#dce8de"/><path d="M22 18v22" stroke="#91aaa7"/><path d="M0 43l47 22" stroke="#fff9ec" stroke-width="3"/></g>`;
out += `<g transform="translate(359 136)"><path d="M0 0l24 12v35L0 35Z" fill="#edf3ee" stroke="#84959a" stroke-width="2"/><path d="M5 14l14 6m-14 7l14 7" stroke="#7da4a2" stroke-width="2"/></g>`;

// Reusable floor furniture, with contact shadows and small brushed highlights.
function box(x,y,w,d,h,top,front,side='#718184'){
  const a=P(x,y),b=P(x+w,y),c=P(x+w,y+d),e=P(x,y+d),A=P(x,y,h),B=P(x+w,y,h),C=P(x+w,y+d,h),E=P(x,y+d,h);
  return `<ellipse cx="${(a[0]+c[0])/2}" cy="${(a[1]+c[1])/2+4}" rx="${(w+d)*19}" ry="9" fill="#2c3b3e" opacity=".14"/>`+
    poly([e,c,C,E],front,'#4e5e65',1.15)+poly([b,c,C,B],side,'#4e5e65',1.15)+poly([A,B,C,E],top,'#40545c',1.25);
}
function chair(x,y,rot=0){
  const p=P(x,y);
  return `<g transform="translate(${p[0]} ${p[1]}) rotate(${rot})"><ellipse cy="5" rx="17" ry="7" fill="#273a42" opacity=".16"/>
  <path d="M-13 -2l10 -5 23 11-10 5z" fill="#344b61" stroke="#2e404c" stroke-width="1.4"/>
  <path d="M-13 -2v-16l23 11V9Z" fill="#405a70" stroke="#2e404c" stroke-width="1.5"/><path d="M-9 -13L7 -5" stroke="#7993a2" opacity=".7"/>
  <path d="M-10 5v8m21-2v8" stroke="#53646a" stroke-width="2"/></g>`;
}
function plant(x,y,s=1){const p=P(x,y);return `<g transform="translate(${p[0]} ${p[1]}) scale(${s})"><ellipse cy="4" rx="13" ry="6" fill="#33493d" opacity=".12"/><path d="M-8 -12l16 6-3 11-11-4z" fill="#d2b89a" stroke="#637068"/><path d="M0 -9v-34m0 25l-14-14m14 13l12-17" stroke="#597c5d" stroke-width="1.8" fill="none"/><path d="M-1 -37C-16 -49-20-34-4-30M1-32C15-49 21-39 4-26M-3-22C-21-35-21-19-5-16M4-20C20-33 19-17 4-13" fill="#6f9b75" stroke="#47765c" stroke-width="1.2"/></g>`;}

out += box(2.42,.58,.85,.46,15,'#edf1ed','#b9c6c4','#91aaa7'); // exam couch
out += box(3.35,1.26,1.08,.72,20,'#eee4d1','#bd9f7e','#aa896c'); // consultation desk
out += box(4.65,.72,.5,.48,25,'#d6dfd7','#b6c8c7','#879b9d');
out += `<g transform="translate(${P(3.83,1.23,20).join(' ')})"><path d="M-5 -3l17 9v-22l-17-8z" fill="#3b5362" stroke="#425b64" stroke-width="1.5"/><path d="M-2 -18l11 5v13l-11-5z" fill="#a6ced0"/><path d="M3 7v5m-8-1h16" stroke="#5c6b69" stroke-width="1.5"/></g>`;
out += chair(3.61,2.18,0)+chair(4.23,.97,180);
out += plant(5.23,.53,.78);

// Waiting hall. Chair clusters are repeated game objects, not part of the floor texture.
for(const [x,y] of [[1.45,3.55],[2.05,3.55],[2.65,3.55],[1.15,4.35],[1.75,4.35],[2.35,4.35]])out+=chair(x,y,-1);
out += box(.4,4.5,1.1,.66,19,'#f2f0e6','#d8e1d9','#87a9a5');
out += `<g transform="translate(${P(.87,4.54,19).join(' ')})"><path d="M-4 -2l13 6v-12l-13-6z" fill="#3b535c" stroke="#46636a"/><path d="M-1 -10l7 3v7l-7-3z" fill="#abd1cc"/></g>`;
out += plant(.25,3.15,.93)+plant(4.8,5.25,.7);
// Queue divider and call display.
out += `<g transform="translate(${P(.65,3.2).join(' ')})"><path d="M0 0v-19m24 11v-18m0 9L0-12" fill="none" stroke="#87999c" stroke-width="2"/><circle cy="-19" r="3" fill="#c9d0c7"/><circle cx="24" cy="-26" r="3" fill="#c9d0c7"/></g>`;
out += `<g transform="translate(${P(2.6,2.1,38).join(' ')})"><path d="M0 0l32 16v-18L0-18z" fill="#2b5360" stroke="#d3e3db" stroke-width="2"/><path d="M7 -10l17 8" stroke="#a7d5ca" stroke-width="2"/></g>`;

// Adult proportions: head diameter 6.4, total standing height about 44 (roughly 7 heads).
function personMarkup({coat='#5c887e',pants='#4d5d64',skin='#d4a788',hair='#30343a',pose='stand',bag=false,gesture=false}){
 const seated=pose==='sit',headY=seated?-35:-40,shoulder=seated?-27:-32,hip=seated?-15:-17;
 const legs=seated
  ? `<path d="M-3 ${hip}L-10 -9l-1 8M3 ${hip}L9 -9l3 8" stroke="${pants}" stroke-width="3.7" stroke-linecap="round" fill="none"/>`
  : `<path d="M-3 ${hip}L-5 -2M3 ${hip}L5 -2" stroke="${pants}" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;
 return `<ellipse cy="3" rx="7" ry="2.5" fill="#1c3037" opacity=".16"/>
 ${legs}<path d="M-11 0l4 1m14-1l4 1" stroke="#3c4b4e" stroke-width="2.7" stroke-linecap="round"/>
 <path d="M-5 ${shoulder}q5 -2 10 0l1 ${hip-shoulder}q-6 3-12 0z" fill="${coat}" stroke="#415158" stroke-width="1.15"/>
 <path d="M-5 ${shoulder+2}L-8 ${shoulder+12}m13 -10L${gesture?12:8} ${gesture?shoulder+8:shoulder+13}" stroke="${coat}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
 <path d="M-8 ${shoulder+12}l-1 2m${gesture?21:17} ${gesture?shoulder-shoulder-6:0}l1 2" stroke="${skin}" stroke-width="2.1" stroke-linecap="round"/>
 <path d="M0 ${shoulder+2}v5" stroke="#e9e5d8" stroke-width=".8"/>
 <rect x="-1.2" y="${headY+3}" width="2.4" height="4" rx="1" fill="${skin}"/>
 <ellipse cy="${headY}" rx="3.8" ry="4.2" fill="${skin}" stroke="#745b50" stroke-width=".7"/>
 <path d="M-4 ${headY}q-1 -7 4 -7q7 0 4 8q-3 -3-8-2z" fill="${hair}"/>
 <path d="M1 ${headY+1}l1 .4" stroke="#6c5348" stroke-width=".65"/>
 ${bag?'<path d="M-6 -29q-9 3-8 12l5 3 5-12" fill="#765b46" stroke="#4c4a46" stroke-width=".8"/>':''}`;
}
function actor(id,x,y,style,clickName){const p=P(x,y);return `<g id="${id}" class="actor" data-name="${clickName}" transform="translate(${p[0]} ${p[1]})">${personMarkup(style)}</g>`;}
out += actor('doctor',4.36,1.04,{coat:'#f9f8f2',pants:'#34485b',skin:'#bf8f6f',hair:'#252b30',pose:'sit',gesture:true},'周医生');
out += actor('exam-patient',3.6,2.13,{coat:'#675d57',pants:'#424d56',skin:'#c39a7c',hair:'#303139',pose:'sit'},'王先生');
out += actor('nurse',.7,4.25,{coat:'#4c9a99',pants:'#3e8587',skin:'#c89876',hair:'#252e31',gesture:true},'导诊护士');
out += actor('waiting-1',1.45,3.54,{coat:'#9e8268',pants:'#52616a',skin:'#c99e81',hair:'#313237',pose:'sit'},'候诊患者');
out += actor('waiting-2',2.62,3.54,{coat:'#7b9aa0',pants:'#414e5e',skin:'#d4a987',hair:'#25282d',pose:'sit'},'候诊患者');
out += actor('older',1.16,4.3,{coat:'#8b7d70',pants:'#4b5660',skin:'#c99c81',hair:'#70716d',pose:'sit'},'候诊患者');
out += actor('companion',.88,5.38,{coat:'#9d827e',pants:'#595e68',skin:'#d6aa89',hair:'#2a3035'},'陪同家属');
out += actor('walker',2.2,4.9,{coat:'#618780',pants:'#596473',skin:'#d4a989',hair:'#34353a',bag:true},'陈女士');

// Low cutaway wall is painted last only on visible front segments; doorway remains open.
out += wall([2.15,2.88],[3.18,2.88],15,'#ece4d5','#697578');
out += wall([4.6,2.88],[6,2.88],15,'#ece4d5','#697578');
out += `<g transform="translate(${P(3.24,2.9).join(' ')})"><path d="M0 0l15 8v-44L0-44Z" fill="#b69370" stroke="#59676b" stroke-width="1.6"/><path d="M4 -31l8 4v10l-8-4Z" fill="#a8c9c9"/><circle cx="12" cy="-8" r="1.3" fill="#536566"/></g>`;
out += `<g class="room-label" transform="translate(284 119)"><rect x="-27" y="-11" width="54" height="20" rx="10" fill="#253f49" opacity=".9"/><text y="3" text-anchor="middle">门诊诊室</text></g>`;
out += `<g class="room-label" transform="translate(89 303)"><rect x="-28" y="-11" width="56" height="20" rx="10" fill="#253f49" opacity=".9"/><text y="3" text-anchor="middle">候诊区</text></g>`;

svg.innerHTML = `<g transform="translate(-29 -33) scale(1.15)">${out}</g>`;
const walker=document.getElementById('walker');
let paused=false,follow=true,started=performance.now(),last=-1;
const start={x:2.2,y:4.9},end={x:3.55,y:2.92};
function tick(now){
  if(!paused){
    const seconds=(now-started)/1000;
    // Hold the opening composition so a first screenshot shows a believable waiting state.
    const phase=Math.min(1,Math.max(0,(seconds-3)/8));
    const x=start.x+(end.x-start.x)*phase,y=start.y+(end.y-start.y)*phase;
    const p=P(x,y);walker.setAttribute('transform',`translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
    if(phase!==last){
      const state=phase===0?'候诊中':phase===1?'已到诊室':'前往诊室';
      document.getElementById('patient-state').textContent=state;
      document.getElementById('path-current').textContent=phase===0?'候诊':'问诊';
      document.getElementById('case-note').textContent=phase===0?'她正在候诊区等待叫号。医生空出诊室后，她会自己走进去。':phase===1?'患者已到诊室，医生开始问诊。点击人物可查看当前环节。':'叫号后，患者正沿通道走向诊室。';
      last=phase;
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
document.getElementById('pause').onclick=e=>{paused=!paused;if(!paused)started=performance.now()-Math.max(0,last)*8000-3000;e.currentTarget.textContent=paused?'继续':'暂停';e.currentTarget.setAttribute('aria-pressed',String(paused));};
document.getElementById('follow').onclick=()=>{follow=!follow;document.getElementById('follow').textContent=follow?'跟随患者':'恢复跟随';};
svg.addEventListener('click',e=>{const g=e.target.closest('.actor');if(!g)return;const name=g.dataset.name;document.getElementById('patient-name').innerHTML=`${name} <small>· 场景人物</small>`;document.getElementById('case-note').textContent=name==='陈女士'?'她正在候诊区等待叫号。医生空出诊室后，她会自己走进去。':`${name}正在医院内履行当前任务或等待接诊。`;});
