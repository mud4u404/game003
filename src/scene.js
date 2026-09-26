import { STAFF } from './simulation.js';
import { ArtLibrary, patientAppearance, STAFF_APPEARANCE } from './appearance.js';
const P = { grass: '#9cb27c', lawn: '#d5dfc8', ink: '#647665', wall: '#e9ebdc', edge: '#bcc8b2', floor: '#e4d8c2', blue: '#a2b7b6', dark: '#526860', wood: '#c8b895' };
import { patientPose, STAFF_POS, NURSE_CARE_POS, seatPosition as seat,
  planRoute, routeLength, sampleMotion, settledMotion, WALK_SPEED } from './movement.js';
export function patientPosition(p, s) { return patientPose(p, s.time).position; }
function nursePose(s) {
  const active = s.patients.find(p => p.phase === 'nursing');
  const leaving = s.patients.find(p => p.phase === 'leaving' && p.previousPhase === 'nursing');
  const from = active ? STAFF_POS.nurse : NURSE_CARE_POS;
  const to = active ? NURSE_CARE_POS : STAFF_POS.nurse;
  if (!active && !leaving) return sampleMotion(settledMotion(STAFF_POS.nurse,s.time),s.time);
  const points = planRoute(from,to), length = routeLength(points), duration = length/WALK_SPEED*1000;
  const start = active ? Math.max(active.phaseAt,active.serviceAt-duration-600) : leaving.phaseAt;
  return sampleMotion({points,length,at:start,start,end:start+duration,ready:start+duration},s.time);
}
export class ClinicScene {
  constructor(canvas, select, interact) {
    this.art = new ArtLibrary();
    this.art.load().then(() => canvas.dataset.artReady = 'true').catch(error => { canvas.dataset.artReady = 'failed'; console.warn(error); });
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.select = select; this.interact = interact;
    this.zoom = 1; this.pan = [0, 0]; this.hits = []; this.pointers = new Map(); this.dragged = false; this.selected = null;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, this.clientPoint(e.clientX, e.clientY));
      this.start = this.clientPoint(e.clientX, e.clientY); this.dragged = false; this.interact();
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      const old = this.pointers.get(e.pointerId), fresh = this.clientPoint(e.clientX, e.clientY);
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
        const point = this.worldPoint(...this.clientPoint(e.clientX, e.clientY));
        const hit = this.hits.filter(h => Math.hypot(h.x - point[0], h.y - 20 - point[1]) < Math.max(28, 23 / this.scale))
          .sort((a,b) => Math.hypot(a.x-point[0],a.y-20-point[1])-Math.hypot(b.x-point[0],b.y-20-point[1]))[0];
        this.select(hit?.id || null);
      }
      this.pointers.delete(e.pointerId);
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.changeZoom(Math.exp(-e.deltaY * .0015), this.clientPoint(e.clientX,e.clientY)); this.interact(); }, { passive: false });
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
    this.base = Math.max(.12, Math.min(this.width / 690, this.height / 1060));
  }
  get scale() { return this.base * this.zoom; }
  clientPoint(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return [x - r.left, y - r.top];
  }
  origin() { return [this.width / 2 + this.pan[0] - 340 * this.scale, this.height / 2 + this.pan[1] - 550 * this.scale]; }
  worldPoint(x, y) { const o = this.origin(); return [(x-o[0])/this.scale,(y-o[1])/this.scale]; }
  changeZoom(factor, anchor = [this.width/2, this.height/2]) {
    const before = this.worldPoint(...anchor); this.zoom = Math.max(.75, Math.min(2.8, this.zoom * factor));
    const o = this.origin(); this.pan[0] += anchor[0] - (before[0] * this.scale + o[0]); this.pan[1] += anchor[1] - (before[1] * this.scale + o[1]);
  }
  reset() { this.zoom = 1; this.pan = [0,0]; }
  focus(id, s) {
    const p = s.patients.find(p => p.id === id), xy = p ? patientPosition(p,s) : STAFF_POS[id];
    if (!xy) return;
    this.zoom = 1.6;
    this.pan = [(340-xy[0])*this.scale, (550-xy[1])*this.scale-this.height*.18];
  }
  box(x,y,w,h,color,r=0) { const c=this.ctx; c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill(); }
  line(x,y,x2,y2,color,width=1) { const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke(); }
  ellipse(x,y,rx,ry,color) { const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill(); }
  text(t,x,y,size=14,color=P.ink,align='left',weight=400) { const c=this.ctx;c.fillStyle=color;c.font=`${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;c.textAlign=align;c.fillText(t,x,y); }
  prop(atlas,index,x,y,w,h,depth=y+h) {
    if (!this.art.ready) return false;
    const matrix = this.ctx.getTransform();
    this.layers.push({depth:depth+(this.moduleY||0), draw:()=>{
      this.ctx.save(); this.ctx.setTransform(matrix); this.art.draw(this.ctx,atlas,index,x,y,w,h); this.ctx.restore();
    }});
    return true;
  }
  plant(x,y,size=1) { if(this.prop('furniture',6,x-20*size,y-58*size,40*size,62*size))return; const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);this.ellipse(3,4,23,9,'#4e634013');this.box(-11,-10,22,22,'#c7baa2',4);this.box(-13,-14,26,8,'#d4c9b3',3);for(const [a,b,r] of [[-8,-22,12],[9,-20,11],[0,-31,13],[-13,-31,8],[13,-32,9]]){this.ellipse(a,b,r,r*.78,'#8da584');this.ellipse(a-2,b-3,r*.65,r*.48,'#a4b797');}c.restore(); }
  tree(x,y,size=1) {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);
    this.ellipse(14,15,49,16,'#31473122');
    this.box(-7,-29,15,47,'#786b51',3);
    this.line(1,-28,2,12,'#4c5547',3);
    for(const [x,y,r,color] of [[-25,-45,29,'#607f54'],[24,-48,31,'#5a7d51'],[0,-74,38,'#708e5c'],[-25,-73,23,'#789862'],[24,-78,25,'#72925d']]) {
      c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();c.strokeStyle='#3f5a45';c.lineWidth=2;c.stroke();
    }
    this.ellipse(-10,-81,28,21,'#7d9b65');c.restore();
  }
  chair(x,y,color='#a1b5a6',facing='up') { if(this.prop('furniture',3,x-21,y-42,42,61,y-12))return;this.box(x-19,y-10,38,27,'#71867725',5);this.box(x-17,y-21,34,26,color,5);this.box(x-17,y+2,34,7,'#879b8c',3);this.box(x-19,y-24,38,12,color,4);this.line(x-12,y+9,x-12,y+14,'#6e8173',3);this.line(x+12,y+9,x+12,y+14,'#6e8173',3);}
  bench(x,y,count=3) {for(let i=0;i<count;i++)this.chair(x+i*56,y);}
  cabinet(x,y,w=60,h=40) { if(this.prop('furniture',2,x-7,y-20,w+14,h+24))return;this.box(x+3,y+8,w,h,'#677c6412',3);this.box(x,y,w,h,'#c1cbb9',2);this.box(x,y-8,w,h-8,'#e2e7d9',2);this.line(x+w/2,y+5,x+w/2,y+h-3,'#acbca6');this.line(x+w/2-7,y+9,x+w/2-7,y+19,'#84947d',2);this.line(x+w/2+7,y+9,x+w/2+7,y+19,'#84947d',2);}
  bed(x,y) { if(this.prop('furniture',0,x-2,y-12,66,136))return;this.box(x+5,y+5,62,114,'#64756313',8);this.box(x,y,62,111,'#a7b9b4',6);this.box(x+3,y-7,56,101,'#dbe5dd',6);this.box(x+8,y-4,46,28,'#f9faf1',6);this.box(x+4,y+31,54,61,'#c1d4cb',3);this.line(x+10,y+44,x+53,y+44,'#dce8dd',2);this.box(x+4,y+92,54,7,'#b4c9bc',2);this.line(x+7,y+108,x+7,y+118,'#7c9184',3);this.line(x+55,y+108,x+55,y+118,'#7c9184',3);}
  desk(x,y,w=120) { if(this.prop('furniture',1,x-4,y-26,w+8,91))return;this.box(x+4,y+11,w,58,'#5a715814',6);this.box(x,y,w,54,'#b7ac8c',5);this.box(x,y-11,w,54,'#ded6bd',5);this.line(x+4,y+40,x+w-4,y+40,'#eee9d4',2);this.box(x+20,y-11,37,24,'#61766d',3);this.box(x+23,y-9,31,18,'#9cafaa',1);this.box(x+30,y+16,19,4,'#7e8c94',1);this.box(x+20,y+22,35,9,'#c0c9b9',2);this.box(x+w-30,y+8,20,27,'#f4f3e6',1);this.line(x+w-26,y+15,x+w-13,y+15,'#c7cfbd');this.line(x+w-26,y+21,x+w-13,y+21,'#c7cfbd');}
  room(x,w,label,num,tint='#e2d5bd') {
    this.box(x,221,w,229,tint); const c=this.ctx;c.save();c.beginPath();c.rect(x,221,w,229);c.clip();
    for(let yy=235;yy<470;yy+=44)this.line(x,yy,x+w,yy,'#dfe4d340');for(let xx=x+23;xx<x+w;xx+=46)this.line(xx,221,xx,450,'#dfe4d340');c.restore();
    this.box(x,210,w,21,'#b9bbba');this.box(x,202,w,12,'#ece9e0');
    this.box(x,216,10,235,'#919ba0');this.box(x-3,209,12,235,'#ece8dd');
    // Door opening keeps all routes visible in the shared corridor.
    const gap = num === 3 ? x+167 : num === 4 ? x+93 : x+158;
    this.box(x,435,gap-x,21,'#687379');this.box(x-3,429,gap-x+3,10,'#d5d7d1');
    this.box(gap+53,435,x+w-gap-53,21,'#687379');this.box(gap+53,429,x+w-gap-53,10,'#d5d7d1');
    this.box(x+20,418,Math.min(125,w-30),22,'#465d6e',3);this.text(label,x+31,433,11,'#f5f6eb');this.text('0'+num,x+w-22,251,11,'#738182','right');
    this.box(gap,445,53,9,'#ab9a7c');this.box(gap+2,420,9,32,'#bca781',1);this.line(gap+3,423,gap+3,450,'#6f6858',1.5);this.line(gap+8,436,gap+8,444,'#596872',2);
    this.line(x,214,x+w,214,'#657077',1.3);this.line(x,455,gap,455,'#56636a',1.5);this.line(gap+53,455,x+w,455,'#56636a',1.5);
  }
  person(x,y,color,staff=false,variant=0,walk=false,selected=false,tick=0,actor=null) {
    if (actor && this.art.ready) {
      const look = staff ? STAFF_APPEARANCE[actor.id] : patientAppearance(actor);
      const pose = actor.pose;
      const sit = staff ? (actor.id.startsWith('doctor') || actor.id === 'reception' ? 1 : 0) : pose.sit;
      const width = look.height * .95 * look.widthScale;
      const seatedPhase = !staff && pose.rising ? actor.previousPhase : actor.phase;
      const seatedFacesRight = [3,4,5].includes(look.seatedIndex);
      const flip = walk ? pose.direction[0] < -.05 : staff ?
        actor.id === 'doctor2' || actor.id === 'nurse' && actor.working :
        seatedPhase === 'consultation' ? seatedFacesRight : seatedPhase === 'nursing' ? !seatedFacesRight : false;
      this.ellipse(x,y+3,width*.23,5,'#263b4b28');
      if(selected) {
        const c=this.ctx; c.strokeStyle='#345b78'; c.lineWidth=2;
        c.beginPath(); c.ellipse(x,y+3,width*.34,8,0,0,Math.PI*2); c.stroke();
      }
      const c=this.ctx, breathe=Math.sin(tick/920+(look.rhythm||0))*.3;
      const drawSprite=(atlas,index,height,opacity)=>{
        if(opacity<=0)return; c.save(); c.globalAlpha=opacity;
        this.art.draw(c,atlas,index,x-width/2,y-height+breathe,width,height,flip);c.restore();
      };
      if (walk && (!staff || actor.id === 'nurse')) {
        const row=staff?7:look.index-5, frame=Math.floor(pose.distance/11)%4;
        drawSprite('walk',row*4+frame,look.height,1);
      } else {
        const sitting = sit > .5;
        const atlas = sitting ? staff&&actor.id.startsWith('doctor')?'characters':'seated' : staff&&actor.id==='nurse'?'walk':'characters';
        const index = sitting ? staff ? actor.id==='reception'?7:look.seatedIndex : look.seatedIndex : staff&&actor.id==='nurse'?29:look.index;
        // One body at a time: lift/lower over the transition without translucent double heads.
        drawSprite(atlas,index,look.height*(1-.13*sit),1);
      }
      // Small hand/pen movement only when a patient has arrived and work has begun.
      if(actor.working && !walk) {
        const pulse=Math.sin(tick/230)*2, handY=y-look.height*.37;
        this.line(x+8,handY-5,x+16+pulse,handY,'#d5b49a',3);
        if(actor.id !== 'nurse') this.line(x+15+pulse,handY-3,x+19+pulse,handY+2,'#415364',1.3);
      }
      return;
    }
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
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    this.box(0, 0, this.width, this.height, P.grass);
    c.translate(...this.origin()); c.scale(this.scale, this.scale); this.hits = []; this.layers = []; this.moduleY = 0;

    // A compact two-row clinic: one continuous corridor joins care, rooms and reception.
    this.box(28, 72, 624, 917, '#66747b', 22);
    this.box(37, 81, 605, 894, '#aab0ad', 16);
    this.box(49, 106, 589, 826, '#8c9d8620', 5);
    this.box(46, 103, 584, 822, '#606b70', 4);
    this.box(46, 96, 584, 819, P.floor, 4);
    for (let x = 50; x < 628; x += 45) this.line(x, 98, x, 915, '#c2b69e75');
    for (let y = 109; y < 915; y += 43) this.line(48, y, 627, y, '#c2b69e75');
    this.box(46, 97, 9, 815, '#ece8dd');
    this.box(624, 98, 9, 815, '#b9bbba');
    this.box(624, 95, 10, 814, '#deded6');

    // Keep original modular furniture at its natural proportions; translate each room together.
    const module = (dx, dy, draw) => { c.save(); c.translate(dx, dy); this.moduleY=dy; draw(); this.moduleY=0; c.restore(); };
    module(-133, -102, () => {
      this.room(187, 261, '全科诊室', 1);
      this.desk(256, 318, 92); this.chair(302, 307, '#8ca5a1'); this.chair(388, 345);
      this.bed(203, 270); this.cabinet(366, 253, 64, 39); this.plant(413, 404, .67);
    });
    module(-134, -102, () => {
      this.room(448, 260, s.secondRoom ? '第二诊室' : s.project ? '诊室 · 筹备中' : '预留诊室', 2, s.secondRoom ? '#e2d5bd' : '#c8ccb4');
      if (s.secondRoom) {
        this.desk(516, 318, 92); this.chair(562, 307, '#8ca5a1'); this.chair(649, 345);
        this.bed(463, 270); this.cabinet(627, 253, 61, 39); this.plant(674, 405, .67);
      } else {
        this.box(509, 277, 131, 90, '#b9c0ad', 4);
        c.setLineDash([5,6]); c.strokeStyle = '#7b897c'; c.lineWidth = 1; c.strokeRect(507,275,135,94); c.setLineDash([]);
        this.text(s.project ? '设施准备中' : '留给未来的空间',574,324,12,'#707b74','center');
        this.cabinet(468,252,53,36); this.box(636,387,42,31,'#cbbd99',2); this.box(635,381,44,8,'#dbcfaf',2);
        this.line(657,381,657,415,'#b7ac8b',3);
        if(s.project) {
          const q=Math.min(1,(s.time-s.project.startedAt)/(s.project.completesAt-s.project.startedAt));
          this.box(520,343,109,3,'#d0d9c4'); this.box(520,343,109*q,3,'#8aa080');
        }
      }
    });
    module(-654, 208, () => {
      this.room(708, 260, '基础护理', 3, '#d4d4cf');
      this.bed(737,278); this.chair(855,348);
      this.prop('furniture',7,887,240,75,77);
      this.prop('furniture',5,911,348,43,58);
    });
    module(-664, 208, () => {
      this.room(978, 260, '院务办公室', 4, '#e1d6c4');
      this.desk(1068,324,111); this.chair(1121,312,'#81958c'); this.chair(1081,391); this.chair(1137,391);
      this.cabinet(1187,249,40,61); this.plant(1212,402,.72);
      this.box(1007,248,50,57,'#c2b495',3); this.box(1013,254,38,45,'#eae5d0',2);
      this.box(1018,260,15,17,'#f5f1db',1); this.box(1034,275,11,15,'#aec3ac',1);
    });
    for(const y of [124,436]) { this.box(572,y,12,231,'#8e999d'); this.box(572,y-5,7,231,'#e1e0d8'); }
    for (const y of [100,410]) for (const x of [94,354]) {
      this.box(x,y,116,20,'#798b95',2); this.box(x+4,y+3,108,13,'#b4c2c5',1);
      this.line(x+58,y+3,x+58,y+16,'#566772',2);
    }
    this.text('门 诊', 569, 386, 12, '#66737a', 'right');
    this.text('照 护 与 院 务', 569, 696, 11, '#66737a', 'right');
    for (let i=0;i<16;i++) this.chair(...seat(i));
    // Reception sits by the entrance; the right aisle remains unobstructed.
    this.prop('furniture',4,81,751,185,105);
    this.text('接待 / RECEPTION',172,845,10,'#7e866e','center');
    this.text('候 诊',427,911,11,'#707d7d','center');
    this.plant(92,713,.85); this.plant(102,889,.72); this.plant(603,136,.7);
    this.box(45,913,244,25,'#626c73'); this.box(45,909,244,10,'#d6d7d2');
    this.box(380,913,252,25,'#626c73'); this.box(380,909,252,10,'#d6d7d2');
    this.box(291,921,87,9,'#849098'); this.box(283,931,103,8,'#c8ccc9');
    this.box(151,942,115,30,'#344b5c',5); this.text('梅 奥 诊 所',208,962,13,'#f2f2ec','center',500);

    const actors = STAFF.filter(a=>a.id!=='doctor2'||s.secondRoom).map(a=>{
      const pose=a.id==='nurse'?nursePose(s):sampleMotion(settledMotion(STAFF_POS[a.id],s.time),s.time);
      const working=s.patients.some(p=>s.time>=p.serviceAt && (
        a.id==='reception'&&p.phase==='registration'||a.id==='nurse'&&p.phase==='nursing'||
        a.id==='doctor1'&&p.phase==='consultation'&&p.room===1||a.id==='doctor2'&&p.phase==='consultation'&&p.room===2));
      return {...a,pose,pos:pose.position,staff:true,walk:pose.moving,working,variant:STAFF.indexOf(a)};
    });
    for (const p of s.patients) {
      const pose=patientPose(p,s.time);
      actors.push({...p,pose,pos:pose.position,staff:false,walk:pose.moving,variant:p.appearance});
    }
    for (const a of actors) {
      this.layers.push({depth:a.pos[1],draw:()=>this.person(...a.pos,a.color,a.staff,a.variant,a.walk,a.id===this.selected,tick,a)});
      this.hits.push({id:a.id,x:a.pos[0],y:a.pos[1]});
    }
    this.layers.sort((a,b)=>a.depth-b.depth).forEach(layer=>layer.draw());
    // Door leaves swing aside as people approach; clear passages are kept in the navigation mesh.
    for (const [x,y] of [[238,342],[498,342],[247,652],[433,652]]) {
      const near=actors.filter(a=>a.walk).reduce((d,a)=>Math.min(d,Math.hypot(a.pos[0]-x,a.pos[1]-y)),Infinity);
      const open=Math.max(0,Math.min(1,(80-near)/50));
      this.box(x-24,y-8,44*(1-open)+5,6+24*open,'#bca781',1);
      this.line(x-23,y-8,x-23,y-2+24*open,'#716b60',1.5);
    }
    this.tree(30,441,.56); this.tree(652,719,.62); this.tree(646,88,.69); this.tree(13,946,.63);
    this.box(-2000,1028,4700,116,'#7c8486'); this.box(-2000,1029,4700,4,'#535f67');
    for(let x=-500;x<1500;x+=130) this.box(x,1080,55,3,'#d9dcda',2);
    this.text('青 禾 路',492,1062,12,'#c7cccc','center');
    const carX=((tick/55)%1500)-400;
    this.box(carX,1091,98,35,'#b8c4b0',10); this.box(carX+20,1088,56,34,'#d4ddcb',8);
    this.box(carX+32,1092,22,25,'#adbfba',4);
  }
}
