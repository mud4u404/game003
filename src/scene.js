import { STAFF } from './simulation.js';
const P = { grass: '#e3e9da', lawn: '#d5dfc8', ink: '#647665', wall: '#e9ebdc', edge: '#bcc8b2', floor: '#f5f3e8', blue: '#a2b7b6', dark: '#526860', wood: '#c8b895' };
const ROOM = { 1: [360, 326], 2: [620, 326] };
const STAFF_POS = { doctor1: [306, 312], doctor2: [566, 312], nurse: [881, 316], reception: [321, 561], director: [1132, 314] };
const DOOR = { 1: 373, 2: 633 };
const ENTRY = [710, 765], DESK = [397, 583];
const seat = i => [520 + (i % 7) * 56, 572 + Math.floor(i / 7) * 47];
const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
function route(points, t) {
  const ds = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let d = ds.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, t));
  for (let i = 0; i < ds.length; i++) { if (d <= ds[i]) return [lerp(points[i][0], points[i+1][0], d / (ds[i] || 1)), lerp(points[i][1], points[i+1][1], d / (ds[i] || 1))]; d -= ds[i]; }
  return points.at(-1);
}
function fromRoom(p) { const r = ROOM[p.room || 1]; return [r, [DOOR[p.room || 1], 410], [DOOR[p.room || 1], 493]]; }
export function patientPosition(p, s) {
  const age = Math.max(0, s.time - p.phaseAt), targetSeat = seat(p.seat || 0);
  if (p.phase === 'arriving') return route([[ENTRY[0] + (p.appearance - 1.5) * 27, ENTRY[1] + p.appearance * 12], [710, 669], [449, 651], [436, 582]], age / 8000);
  if (p.phase === 'registerQueue') {
    const index = s.patients.filter(x => x.phase === 'registerQueue').indexOf(p);
    return [445 + (index % 3) * 42, 603 + Math.floor(index / 3) * 39];
  }
  if (p.phase === 'registration') return route([[436, 582], DESK], age / 1800);
  if (p.phase === 'waiting') return route([DESK, [465, 523], [targetSeat[0], 523], targetSeat], age / 6000);
  if (p.phase === 'consultation') {
    const dest = ROOM[p.room];
    const origin = p.waited < 6000 ? DESK : targetSeat;
    return route([origin, [origin[0], 492], [DOOR[p.room], 492], [DOOR[p.room], 380], dest], age / 8000);
  }
  if (p.phase === 'nursingQueue') {
    const index = s.patients.filter(x => x.phase === 'nursingQueue').indexOf(p);
    return route([...fromRoom(p), [886 + index * 35, 501]], age / 6000);
  }
  if (p.phase === 'nursing') return route([...fromRoom(p), [920, 492], [920, 375], [838, 347]], age / 7000);
  if (p.phase === 'leaving') {
    const origin = p.previousPhase === 'nursing' ? [[838, 347], [920, 392], [920, 494]] : fromRoom(p);
    return route([...origin, [955, 650], [710, 676], ENTRY], age / 12000);
  }
  return ENTRY;
}
export class ClinicScene {
  constructor(canvas, select, interact) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.select = select; this.interact = interact;
    this.zoom = 1; this.pan = [0, 0]; this.hits = []; this.pointers = new Map(); this.dragged = false; this.selected = null;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      this.start = [e.clientX, e.clientY]; this.dragged = false; this.interact();
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      const old = this.pointers.get(e.pointerId), fresh = [e.clientX, e.clientY];
      if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const before = Math.hypot(old[0]-other[0], old[1]-other[1]);
        const after = Math.hypot(fresh[0]-other[0], fresh[1]-other[1]);
        if (before > 4) this.changeZoom(after / before, [(fresh[0]+other[0])/2, (fresh[1]+other[1])/2]);
        this.dragged = true;
      } else {
        this.pan[0] += fresh[0] - old[0]; this.pan[1] += fresh[1] - old[1];
        if (Math.hypot(fresh[0]-this.start[0], fresh[1]-this.start[1]) > 5) this.dragged = true;
      }
      this.pointers.set(e.pointerId, fresh);
    });
    const end = e => {
      if (!this.dragged && this.pointers.size === 1 && e.type === 'pointerup') {
        const point = this.worldPoint(e.clientX, e.clientY);
        const hit = this.hits.filter(h => Math.hypot(h.x - point[0], h.y - 20 - point[1]) < Math.max(28, 23 / this.scale))
          .sort((a,b) => Math.hypot(a.x-point[0],a.y-20-point[1])-Math.hypot(b.x-point[0],b.y-20-point[1]))[0];
        this.select(hit?.id || null);
      }
      this.pointers.delete(e.pointerId);
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.changeZoom(Math.exp(-e.deltaY * .0015), [e.clientX,e.clientY]); this.interact(); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)) {
        e.preventDefault(); this.interact();
        if (e.key === '+') this.changeZoom(1.2); else if (e.key === '-') this.changeZoom(1/1.2);
        else if (e.key === '0') this.reset(); else { this.pan[0] += e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0; this.pan[1] += e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0; }
      }
    });
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.width = r.width; this.height = r.height; this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr); this.canvas.height = Math.round(r.height * this.dpr);
    this.base = Math.min(this.width / 1520, (this.height - (this.height < 520 ? 65 : 125)) / 830);
    if (this.height < 520) this.base = Math.min(this.width / 1420, (this.height - 115) / 550);
    if (this.width < 500 && this.height > this.width) this.base = this.width / 490;
    this.centerX = this.width < 500 && this.height > this.width ? 450 : 750;
    this.base = Math.max(this.base, .2);
  }
  get scale() { return this.base * this.zoom; }
  origin() { return [this.width / 2 + this.pan[0] - this.centerX * this.scale, this.height / 2 + this.pan[1] - 465 * this.scale]; }
  worldPoint(x, y) { const o = this.origin(); return [(x-o[0])/this.scale,(y-o[1])/this.scale]; }
  changeZoom(factor, anchor = [this.width/2, this.height/2]) {
    const before = this.worldPoint(...anchor); this.zoom = Math.max(.75, Math.min(2.8, this.zoom * factor));
    const o = this.origin(); this.pan[0] += anchor[0] - (before[0] * this.scale + o[0]); this.pan[1] += anchor[1] - (before[1] * this.scale + o[1]);
  }
  reset() { this.zoom = 1; this.pan = [0,0]; }
  focus(id, s) {
    const p = s.patients.find(p => p.id === id), xy = p ? patientPosition(p,s) : STAFF_POS[id];
    if (!xy) return;
    if (this.width < 600) { this.zoom = 1.35; this.pan = [(this.centerX-xy[0])*this.scale, (460-xy[1])*this.scale-60]; }
  }
  box(x,y,w,h,color,r=0) { const c=this.ctx; c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill(); }
  line(x,y,x2,y2,color,width=1) { const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke(); }
  ellipse(x,y,rx,ry,color) { const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill(); }
  text(t,x,y,size=14,color=P.ink,align='left',weight=400) { const c=this.ctx;c.fillStyle=color;c.font=`${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;c.textAlign=align;c.fillText(t,x,y); }
  plant(x,y,size=1) { const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);this.ellipse(3,4,23,9,'#4e634013');this.box(-11,-10,22,22,'#c7baa2',4);this.box(-13,-14,26,8,'#d4c9b3',3);for(const [a,b,r] of [[-8,-22,12],[9,-20,11],[0,-31,13],[-13,-31,8],[13,-32,9]]){this.ellipse(a,b,r,r*.78,'#8da584');this.ellipse(a-2,b-3,r*.65,r*.48,'#a4b797');}c.restore(); }
  tree(x,y,size=1) {const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);this.ellipse(20,15,58,20,'#546b4415');this.box(-5,-32,10,46,'#adab87',3);for(const [a,b,r,col]of[[-23,-50,29,'#b4c6a0'],[23,-51,30,'#adc299'],[0,-75,38,'#becfac'],[-23,-78,21,'#c7d6b6'],[26,-81,23,'#bed0ab']])this.ellipse(a,b,r,r*.9,col);c.restore();}
  chair(x,y,color='#a1b5a6',facing='up') {this.box(x-19,y-10,38,27,'#71867725',5);this.box(x-17,y-21,34,26,color,5);this.box(x-17,y+2,34,7,'#879b8c',3);this.box(x-19,y-24,38,12,color,4);this.line(x-12,y+9,x-12,y+14,'#6e8173',3);this.line(x+12,y+9,x+12,y+14,'#6e8173',3);}
  bench(x,y,count=3) {for(let i=0;i<count;i++)this.chair(x+i*56,y);}
  cabinet(x,y,w=60,h=40) {this.box(x+3,y+8,w,h,'#677c6412',3);this.box(x,y,w,h,'#c1cbb9',2);this.box(x,y-8,w,h-8,'#e2e7d9',2);this.line(x+w/2,y+5,x+w/2,y+h-3,'#acbca6');this.line(x+w/2-7,y+9,x+w/2-7,y+19,'#84947d',2);this.line(x+w/2+7,y+9,x+w/2+7,y+19,'#84947d',2);}
  bed(x,y) {this.box(x+5,y+5,62,114,'#64756313',8);this.box(x,y,62,111,'#a7b9b4',6);this.box(x+3,y-7,56,101,'#dbe5dd',6);this.box(x+8,y-4,46,28,'#f9faf1',6);this.box(x+4,y+31,54,61,'#c1d4cb',3);this.line(x+10,y+44,x+53,y+44,'#dce8dd',2);this.box(x+4,y+92,54,7,'#b4c9bc',2);this.line(x+7,y+108,x+7,y+118,'#7c9184',3);this.line(x+55,y+108,x+55,y+118,'#7c9184',3);}
  desk(x,y,w=120) {this.box(x+4,y+11,w,58,'#5a715814',6);this.box(x,y,w,54,'#b7ac8c',5);this.box(x,y-11,w,54,'#ded6bd',5);this.line(x+4,y+40,x+w-4,y+40,'#eee9d4',2);this.box(x+20,y-11,37,24,'#61766d',3);this.box(x+23,y-9,31,18,'#9cafaa',1);this.box(x+30,y+16,19,4,'#9baca0',1);this.box(x+20,y+22,35,9,'#c0c9b9',2);this.box(x+w-30,y+8,20,27,'#f4f3e6',1);this.line(x+w-26,y+15,x+w-13,y+15,'#c7cfbd');this.line(x+w-26,y+21,x+w-13,y+21,'#c7cfbd');}
  room(x,w,label,num,tint='#f3f2e5') {
    this.box(x,221,w,229,tint); const c=this.ctx;c.save();c.beginPath();c.rect(x,221,w,229);c.clip();
    for(let yy=235;yy<470;yy+=44)this.line(x,yy,x+w,yy,'#dfe4d340');for(let xx=x+23;xx<x+w;xx+=46)this.line(xx,221,xx,450,'#dfe4d340');c.restore();
    this.box(x,210,w,21,'#c4ceba');this.box(x,202,w,12,'#f1f1e3');
    this.box(x,216,10,235,'#c0cbb5');this.box(x-3,209,12,235,'#e9eddd');
    // Door opening keeps all routes visible in the shared corridor.
    const gap = num === 3 ? x+167 : num === 4 ? x+93 : x+158;
    this.box(x,435,gap-x,21,'#b9c7b1');this.box(x-3,429,gap-x+3,10,'#e8eada');
    this.box(gap+53,435,x+w-gap-53,21,'#b9c7b1');this.box(gap+53,429,x+w-gap-53,10,'#e8eada');
    this.box(x+20,418,Math.min(125,w-30),22,'#778b75',3);this.text(label,x+31,433,11,'#f5f6eb');this.text('0'+num,x+w-22,251,11,'#99a68f','right');
    this.box(gap,445,53,9,'#e0d9c1');this.line(gap,439,gap+34,410,'#aabca1',3);
  }
  person(x,y,color,staff=false,variant=0,walk=false,selected=false,tick=0) {
    const c=this.ctx;c.save();c.translate(x,y);const bob=walk?Math.sin(tick/140+variant)*1.5:0;c.translate(0,bob);
    if(selected){this.ellipse(0,1,23,10,'#5e856828');c.strokeStyle='#6a8c6d';c.lineWidth=1.5;c.beginPath();c.ellipse(0,1,23,10,0,0,Math.PI*2);c.stroke();}
    else this.ellipse(2,2,16,6,'#41523d1a');
    const stride=walk?Math.sin(tick/150+variant)*3:0;
    this.box(-9,-11+stride,7,13,'#59645b',2);this.box(3,-11-stride,7,13,'#59645b',2);
    this.box(-10,-1+stride,9,4,'#4c5d53',2);this.box(3,-1-stride,10,4,'#4c5d53',2);
    this.box(-13,-33,26,26,color,7);this.box(-17,-29,6,18,color,3);this.box(11,-29,6,18,color,3);
    this.box(-16,-13,5,5,'#dbb79a',2);this.box(11,-13,5,5,'#dbb79a',2);
    if(staff){this.line(0,-29,0,-8,'#a8b8ac');this.box(5,-26,5,7,'#88a7a0',1);this.line(-7,-32,-2,-23,'#b1c2b6',2);}
    this.ellipse(0,-41,11,12,'#ddba9e');
    const hair=['#686354','#555b51','#8c8170','#4d554e'][variant%4];
    c.fillStyle=hair;c.beginPath();c.ellipse(0,-45,12,10,0,Math.PI,Math.PI*2);c.fill();this.box(-12,-46,5,10,hair,3);this.box(7,-46,5,7,hair,3);
    if(variant%2===1)this.ellipse(-9,-35,4,6,hair);
    this.ellipse(-4,-40,1,1.1,'#6d6251');this.ellipse(4,-40,1,1.1,'#6d6251');
    c.restore();
  }
  draw(s, tick) {
    const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);this.box(0,0,this.width,this.height,P.grass);
    const o=this.origin();c.translate(...o);c.scale(this.scale,this.scale);this.hits=[];
    // Quiet town surroundings, drawn from reusable shapes.
    this.box(-3000,777,7500,160,'#d7ddd0');this.box(-3000,779,7500,5,'#c6d0bf');this.box(-3000,806,7500,3,'#e7ecdf');
    for(let x=-500;x<2100;x+=145)this.box(x,854,61,3,'#eff1e6',2);
    this.box(144,175,1172,591,'#c8d3bd',24);this.box(155,182,1150,562,'#ecebdc',18);
    this.box(166,198,1134,527,'#bccab416',15);this.box(192,225,1116,477,'#8c9d8620',6);
    this.box(180,210,1118,477,'#c7ccb8',5);this.box(180,198,1118,477,P.floor,5);
    // Corridor floor grid.
    for(let x=188;x<1298;x+=48)this.line(x,451,x,675,'#d9decc66');for(let y=452;y<675;y+=43)this.line(180,y,1298,y,'#d9decc66');
    this.room(187,261,'全科诊室',1);this.room(448,260,s.secondRoom?'第二诊室':s.project?'诊室 · 筹备中':'预留诊室',2,s.secondRoom?'#f3f2e5':'#eeeee2');
    this.room(708,270,'基础护理',3,'#edf1e5');this.room(978,309,'院务办公室',4,'#f1edde');
    this.box(1285,211,12,458,'#c4ceba');this.box(1284,204,13,455,'#eef0df');
    // Windows in the back wall.
    for(const x of[227,487,752,1040]) {this.box(x,204,116,20,'#bdcfc4',2);this.box(x+4,207,108,13,'#deebe0',1);this.line(x+58,207,x+58,220,'#a7bda9',2);}
    this.desk(256,318,92);this.chair(302,307,'#8ca5a1');this.chair(360,326,'#a7b3a0');this.bed(203,270);this.cabinet(366,253,64,39);this.plant(413,404,.67);
    if(s.secondRoom) {this.desk(516,318,92);this.chair(562,307,'#8ca5a1');this.chair(620,326,'#a7b3a0');this.bed(463,270);this.cabinet(627,253,61,39);this.plant(674,405,.67);}
    else {this.box(509,277,131,90,'#e4e7d8',4);c.setLineDash([5,6]);c.strokeStyle='#bdc8b2';c.lineWidth=1;c.strokeRect(507,275,135,94);c.setLineDash([]);this.text(s.project?'设施准备中':'留给未来的空间',574,324,12,'#9ba68d','center');this.cabinet(468,252,53,36);this.box(636,387,42,31,'#cbbd99',2);this.box(635,381,44,8,'#dbcfaf',2);this.line(657,381,657,415,'#b7ac8b',3);if(s.project){const q=Math.min(1,(s.time-s.project.startedAt)/(s.project.completesAt-s.project.startedAt));this.box(520,343,109,3,'#d0d9c4');this.box(520,343,109*q,3,'#8aa080');}}
    this.bed(737,278);this.bed(808,279);this.cabinet(891,253,66,42);this.box(891,267,30,5,'#a9c0b2',1);this.box(906,258,6,22,'#a9c0b2',1);this.box(914,367,31,34,'#c1cec0',3);this.box(911,361,37,12,'#e5e8db',2);this.line(920,400,918,409,'#8d9f88',2);this.line(938,400,940,409,'#8d9f88',2);
    this.desk(1068,324,111);this.chair(1121,312,'#81958c');this.chair(1081,391,'#b2b9a0');this.chair(1137,391,'#b2b9a0');this.cabinet(1204,249,60,61);this.plant(1244,402,.86);
    // Office pinboard.
    this.box(1007,248,50,57,'#c2b495',3);this.box(1013,254,38,45,'#eae5d0',2);this.box(1018,260,15,17,'#f5f1db',1);this.box(1034,275,11,15,'#aec3ac',1);
    this.bench(520,572,7);this.bench(520,619,7);
    // Reception counter: rounded timber front, practical workstation.
    this.box(231,528,173,87,'#b6b796',8);this.box(230,521,175,69,'#d9d4b7',8);this.box(235,517,163,10,'#ede8cf',3);this.box(246,536,48,28,'#60796f',3);this.box(250,540,40,18,'#a8bfb3',2);this.box(257,568,30,5,'#adb5a1',2);this.box(357,545,25,33,'#f9f6e7',2);this.line(361,554,376,554,'#b9c6ae');this.line(361,561,376,561,'#b9c6ae');this.text('接待 / RECEPTION',314,606,10,'#7e866e','center');
    this.plant(218,629,.92);this.plant(463,645,.6);this.plant(961,627,.77);
    this.box(1031,536,202,43,'#d4d3b6',8);this.box(1031,529,202,34,'#e1dec6',8);this.box(1043,518,54,12,'#d4ddc8',4);this.box(1107,518,54,12,'#d4ddc8',4);this.box(1171,518,50,12,'#d4ddc8',4);
    this.box(1089,594,70,32,'#d7cbb0',6);this.box(1089,588,70,29,'#e7ddc4',6);this.box(1101,592,22,14,'#c9d4bd',1);this.box(1127,594,19,12,'#eaeade',1);
    this.text('等 候 区',695,662,12,'#a2ab94','center');this.text('慢慢生长，认真照护。',1140,649,10,'#a1a991','center');
    // Exterior facade interrupted by entrance.
    this.box(178,663,473,25,'#c3cbb5');this.box(178,659,473,10,'#edf0df');this.box(769,663,529,25,'#c3cbb5');this.box(769,659,529,10,'#edf0df');this.box(658,671,103,9,'#d0d1b9');this.box(651,681,117,8,'#e8e6d6');
    this.box(571,692,93,30,'#6e856e',5);this.text('梅 奥 诊 所',618,712,13,'#f5f6e7','center',500);
    this.box(685,697,54,5,'#b8c6ae',2);this.box(686,706,53,5,'#c1cdb7',2);
    this.plant(198,706,.9);this.plant(1273,706,.9);
    // People sorted by feet for stable depth.
    const actors = STAFF.filter(a=>a.id!=='doctor2'||s.secondRoom).map(a=>({...a,pos:STAFF_POS[a.id],staff:true,walk:false,variant:STAFF.indexOf(a)}));
    for(const p of s.patients){const moving=['arriving','leaving'].includes(p.phase)||(['consultation','waiting','nursing','nursingQueue'].includes(p.phase)&&s.time-p.phaseAt<7000);actors.push({...p,pos:patientPosition(p,s),staff:false,walk:moving,variant:p.appearance});}
    actors.sort((a,b)=>a.pos[1]-b.pos[1]);
    for(const a of actors){this.person(...a.pos,a.color,a.staff,a.variant,a.walk,a.id===this.selected,tick);this.hits.push({id:a.id,x:a.pos[0],y:a.pos[1]});if(a.staff&&a.id!=='director')this.ellipse(a.pos[0],a.pos[1]-65,2,2,'#a2b698');}
    // Foreground landscaping and town details.
    this.tree(117,286,1.07);this.tree(1350,273,1.24);this.tree(1342,605,1.02);this.tree(100,596,.96);this.tree(91,757,.75);this.tree(1408,755,.72);
    this.box(1368,461,12,99,'#b1bca2',3);this.box(1363,465,22,8,'#cfccb0',2);this.box(1363,483,22,8,'#cfccb0',2);this.box(1363,501,22,8,'#cfccb0',2);this.box(1363,519,22,8,'#cfccb0',2);
    this.box(211,750,283,3,'#c3cfb7');this.box(911,750,293,3,'#c3cfb7');this.text('青 禾 路',1160,840,12,'#a9b4a0','center');
    // Small, slow ambient movement has no simulation effects.
    const carX = ((tick/55)%2300)-400;
    this.box(carX+5,881,100,38,'#9bab8e13',12);this.box(carX,867,98,35,'#b8c4b0',10);this.box(carX+20,864,56,34,'#d4ddcb',8);this.box(carX+32,868,22,25,'#adbfba',4);this.box(carX+3,898,15,4,'#83907c',2);this.box(carX+78,898,15,4,'#83907c',2);
  }
}
