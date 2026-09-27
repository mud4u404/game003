import { staffFor, siteOf, acceptingAt } from './business.js';
import { drawTown } from './town-scene.js';
import { clinicalStatus } from './medical.js';
import { nursePose } from './staff-behavior.js';
import { staffActivity, destinationLabel } from './activity.js';
import { FIXED_SEATS, actorSeat, seatedFeet } from './seating.js';
import { STAFF } from './simulation.js';
import { ArtLibrary, patientAppearance, STAFF_APPEARANCE } from './appearance.js';
const P = { grass: '#9cb27c', lawn: '#d5dfc8', ink: '#647665', wall: '#e9ebdc', edge: '#bcc8b2', floor: '#e4d8c2', blue: '#a2b7b6', dark: '#526860', wood: '#c8b895' };
import { patientPose, STAFF_POS, seatPosition as seat,
  sampleMotion, settledMotion } from './movement.js';
export function patientPosition(p, s) { return patientPose(p, s.time).position; }
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
        const pad=8/this.scale;
        const hit = this.hits.filter(h=>Math.abs(h.x-point[0])<=h.width/2+pad && point[1]>=h.y-h.height-pad && point[1]<=h.bottom+pad)
          .sort((a,b)=>b.y-a.y)[0];
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
  worldPoint(x, y) { if(this.townTransform){const t=this.townTransform;return [(x-t.ox)/t.scale,(y-t.oy)/t.scale];}const o = this.origin(); return [(x-o[0])/this.scale,(y-o[1])/this.scale]; }
  changeZoom(factor, anchor = [this.width/2, this.height/2]) {
    const before = this.worldPoint(...anchor); this.zoom = Math.max(.75, Math.min(2.8, this.zoom * factor));
    const o = this.origin(); this.pan[0] += anchor[0] - (before[0] * this.scale + o[0]); this.pan[1] += anchor[1] - (before[1] * this.scale + o[1]);
  }
  reset() { this.zoom = this.expanded?.72:1; this.pan = this.expanded?[-150*this.scale,0]:[0,0]; }
  focusAnnex(){this.zoom=1.5;this.pan=[(340-800)*this.scale,(550-650)*this.scale];}
  focus(id, s) {
    const p = s.patients.find(p => p.id === id), xy = p ? patientPosition(p,s) : id.startsWith('nurse')?nursePose(s,id).position:STAFF_POS[id];
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
      const look = staff ? actor.art===0||actor.art===1 ? {...STAFF_APPEARANCE[actor.id],index:actor.art,seatedIndex:actor.art===0?14:15}:STAFF_APPEARANCE[actor.id] : patientAppearance(actor);
      const pose = actor.pose;
      const support = actorSeat(actor,pose.rising);
      // A seated pose must always have a physical supporting seat.
      const sit = support ? staff ? 1 : pose.sit : 0;
      const spriteHeight = look.height*(1-.13*sit);
      if(sit>0) {
        const seated = seatedFeet(support,spriteHeight);
        x += (seated[0]-x)*sit; y += (seated[1]-y)*sit;
      }
      const width = look.height * .95 * look.widthScale;
      const visibleBottom=staff ? actor.id==='reception'?Math.min(y,791):actor.id==='pharmacist'?Math.min(y,515):actor.id.startsWith('doctor')?Math.min(y,215):y : y;
      this.hits.push({id:actor.id,x,y,width:width*.75,height:spriteHeight,bottom:visibleBottom});
      const seatedPhase = !staff && pose.rising ? actor.previousPhase : actor.phase;
      const seatedFacesRight = [3,4,5].includes(look.seatedIndex);
      const flip = walk ? pose.direction[0] < -.05 : staff ?
        actor.id === 'doctor2' || actor.id.startsWith('nurse') && actor.working :
        seatedPhase === 'consultation' ? seatedFacesRight : ['nursing','sampling'].includes(seatedPhase) ? !seatedFacesRight : false;
      this.ellipse(x,y+3,width*.23,5,'#263b4b28');
      if(selected) {
        const c=this.ctx; c.strokeStyle='#345b78'; c.lineWidth=2;
        c.beginPath(); c.ellipse(x,y+3,width*.34,8,0,0,Math.PI*2); c.stroke();
      }
      const c=this.ctx, breathe=Math.sin(tick/920+(look.rhythm||0))*.3;
      const drawSprite=(atlas,index,height,opacity)=>{
        if(opacity<=0)return; c.save(); c.globalAlpha=opacity;
        if(actor.id.startsWith('nurse') && ['care','preparing'].includes(actor.activity?.mode)) {
          c.translate(x,y);c.rotate((actor.activity.mode==='care'?-1:1)*(.025+.015*Math.sin(tick/1100)));c.translate(-x,-y);
        }
        const idleRight=[0,1,3,4,5].includes(index),faceRight=staff ? actor.activity?.mode==='preparing' : ['nursing','sampling'].includes(seatedPhase);
        const direction=['work','nurseWork'].includes(atlas)?false:atlas==='idle'?idleRight!==faceRight:flip;
        this.art.draw(c,atlas,index,x-width/2,y-height+breathe,width,height,direction);c.restore();
      };
      if (walk && (!staff || actor.id.startsWith('nurse'))) {
        const row=staff?7:look.index-5, frame=Math.floor(pose.distance/11)%4;
        drawSprite('walk',row*4+frame,look.height,1);
      } else if(staff && actor.id.startsWith('nurse') && actor.activity?.clinicalRow!=null){
        drawSprite('nurseWork',actor.activity.clinicalRow*3+actor.activity.frame,look.height,1);
      } else if(staff && ['doctor1','doctor2','reception','pharmacist'].includes(actor.id) && actor.activity?.mode!=='available') {
        const row=actor.id.startsWith('doctor')&&actor.art!==undefined?actor.art:{doctor1:0,doctor2:1,reception:2,pharmacist:1}[actor.id];
        drawSprite('work',row*3+actor.activity.frame,spriteHeight,1);
      } else {
        const sitting = sit > .5;
        const atlas = sitting ? staff&&(actor.id.startsWith('doctor')||actor.id==='pharmacist')?'characters':'seated' : !staff||actor.id.startsWith('nurse')?'idle':'characters';
        const index = sitting ? staff ? actor.id==='reception'?7:look.seatedIndex : look.seatedIndex : !staff?look.index-5:actor.id.startsWith('nurse')?7:look.index;
        // One body at a time: lift/lower over the transition without translucent double heads.
        drawSprite(atlas,index,spriteHeight,1);
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
  drawAnnex(s,module){
    const m=s.medical,c=this.ctx;
    if(!m.annex&&!m.annexProject){
      this.box(677,434,265,228,'#9aac8835',5);c.save();c.setLineDash([8,9]);c.strokeStyle='#6a7d65';c.lineWidth=2;c.strokeRect(677,434,265,228);c.restore();
      this.text('相邻单元 · 可租赁',809,551,15,'#4d645e','center');return;
    }
    this.box(638,406,330,531,'#647179',5);this.box(644,411,315,505,'#e2d8c8');
    for(let x=649;x<958;x+=43)this.line(x,415,x,914,'#b9af9c60');for(let y=424;y<915;y+=43)this.line(644,y,958,y,'#b9af9c60');
    if(!m.annex){
      this.box(664,447,273,187,'#c7c9bb');this.text('采样单元 · 装修与人员准备',800,520,14,'#465d6e','center');
      const q=(s.time-m.annexProject.startedAt)/(m.annexProject.completesAt-m.annexProject.startedAt);
      this.box(708,556,183,5,'#a4ad9d');this.box(708,556,183*q,5,'#456a75');return;
    }
    // This opening matches the navigation corridor; the rented module joins the existing lobby.
    this.box(615,690,50,66,'#e4d8c2');this.line(617,688,653,688,'#ece8dd',7);this.line(617,760,653,760,'#ece8dd',7);
    module(0,208,()=>{this.room(655,300,'采样与检查交接',5,'#d4d4cf');this.cabinet(687,290,76,32);this.prop('furniture',7,884,248,60,70);this.prop('furniture',5,906,350,33,45);});
    this.box(674,838,186,24,'#465d6e',2);this.text('外检交接 · 标本核对',684,855,12,'#f1f2eb');
    this.text('相邻单元 / 已租赁',804,891,12,'#5f6f74','center');
    this.line(960,409,960,915,'#deded6',8);
  }
  drawClinicalWork(s,actors,tick){
    for(const a of actors){if(!a.clinical||a.walk||s.time<a.serviceAt)continue;
      const x=a.pos[0],y=a.pos[1],stage=a.clinical.stage;
      if(a.phase==='urgent'){this.box(x-39,y-98,78,21,'#8e5244',3);this.text('急救接续',x,y-83,12,'#fff8ee','center');}
      if(a.phase==='consultation'&&stage==='review'){this.box(x-51,y-42,15,21,'#f2f0e7',1);this.line(x-48,y-36,x-40,y-36,'#57768b',2);this.line(x-48,y-31,x-40,y-31,'#57768b',1);}
    }
  }
  draw(s, tick) {
    if(s.venture?.stage==='planning'){drawTown(this,s,tick);return;}this.townTransform=null;
    const c = this.ctx;this.expanded=Boolean(s.medical?.annex||s.medical?.annexProject);
    if(this.frameBucket!==Math.floor(s.time/100)) {
      this.frameBucket=Math.floor(s.time/100);this.canvas.dataset.sceneTime=String(s.time);
    }
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
      this.desk(256, 318, 92);
      this.bed(203, 270); this.cabinet(366, 253, 64, 39); this.plant(413, 404, .67);
    });
    module(-134, -102, () => {
      this.room(448, 260, s.secondRoom ? '第二诊室' : s.project ? '诊室 · 筹备中' : '预留诊室', 2, s.secondRoom ? '#e2d5bd' : '#c8ccb4');
      if (s.secondRoom) {
        this.desk(516, 318, 92);
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
      this.room(708, 260, s.venture&&!s.venture.plan?.services.includes('sampling')?'评估与测量室':s.medical?'检查与采样室':'基础护理', 3, '#d4d4cf');
      this.bed(737,278);
      this.prop('furniture',7,887,240,75,77);
      this.prop('furniture',5,911,348,43,58);
    });
    module(-664, 208, () => {
      const pharmacy=s.medical?.pharmacy;
      this.room(978,260,pharmacy?.enabled?'药房 · 审方与发药':pharmacy?.project?'药房 · 筹备中':'行政 / 可改药房',4,'#e1d6c4');
      this.desk(1068,324,111);
      if(pharmacy?.enabled){
        this.cabinet(1187,249,40,61);
        this.box(1007,250,55,56,'#e0dfd3',2);
        for(let row=0;row<3;row++){this.line(1010,265+row*15,1058,265+row*15,'#819093',2);for(let col=0;col<4;col++)this.box(1013+col*11,255+row*15,8,10,['#adbdba','#d7bba0','#a9b9cd'][row],1);}
        this.box(1150,332,20,19,'#eeeae0',1);this.line(1154,338,1167,338,'#627f8b',2);
      }else{
        this.chair(1121,312,'#81958c');this.chair(1137,391);this.cabinet(1187,249,40,61);this.plant(1212,402,.72);
        this.text(pharmacy?.project?'药柜、库存及药师准备中':'院外药房接续',1099,281,12,'#596e79','center');
      }
    });
    for(const y of [124,436]) { this.box(572,y,12,231,'#8e999d'); this.box(572,y-5,7,231,'#e1e0d8'); }
    for (const y of [100,410]) for (const x of [94,354]) {
      this.box(x,y,116,20,'#798b95',2); this.box(x+4,y+3,108,13,'#b4c2c5',1);
      this.line(x+58,y+3,x+58,y+16,'#566772',2);
    }
    this.text('门 诊', 569, 386, 12, '#66737a', 'right');
    this.text(s.medical?'检 查 与 药 事':'照 护 与 院 务', 569, 696, 11, '#66737a', 'right');
    for (const [id,seat] of Object.entries(FIXED_SEATS)) {
      if (!s.secondRoom && (id==='doctor2'||id==='consultation2')) continue;
      if(id==='pharmacist'&&!s.medical?.pharmacy?.enabled)continue;
      if(id==='sampling'&&!s.medical?.annex)continue;
      if(id==='urgent'){for(const p of s.patients.filter(p=>p.phase==='urgent'))this.chair(287-(p.urgentSlot||0)*60,721);continue;}
      this.chair(seat.x,seat.y);
    }
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

    if(s.medical)this.drawAnnex(s,module);
    const actors = staffFor(s,STAFF,true).filter(a=>(a.id!=='doctor2'||s.secondRoom)&&(a.id!=='nurse2'||s.medical?.annex)&&(a.id!=='pharmacist'||s.medical?.pharmacy?.enabled)).map(a=>{
      const pose=a.id.startsWith('nurse')?nursePose(s,a.id):sampleMotion(settledMotion(STAFF_POS[a.id],s.time),s.time);
      const activity=staffActivity(s,a.id),working=['working','care'].includes(activity.mode);
      return {...a,pose,pos:pose.position,staff:true,walk:pose.moving,working,activity,variant:STAFF.indexOf(a)};
    });
    for (const p of s.patients) {
      const pose=patientPose(p,s.time);
      actors.push({...p,pose,pos:pose.position,staff:false,walk:pose.moving,variant:p.appearance});
    }
    for (const a of actors) {
      this.layers.push({depth:a.pos[1],draw:()=>this.person(...a.pos,a.color,a.staff,a.variant,a.walk,a.id===this.selected,tick,a)});
      if(!this.art.ready)this.hits.push({id:a.id,x:a.pos[0],y:a.pos[1],width:32,height:52,bottom:a.pos[1]});
    }
    const selectedPatient=s.patients.find(p=>p.id===this.selected);
    if(selectedPatient && selectedPatient.motion && s.time<selectedPatient.motion.end) {
      const pose=patientPose(selectedPatient,s.time),m=selectedPatient.motion;
      let remaining=pose.distance, next=1;
      while(next<m.points.length){const a=m.points[next-1],b=m.points[next],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=d)break;remaining-=d;next++;}
      c.save();c.setLineDash([4,7]);c.lineWidth=2;c.strokeStyle='#436b87a0';c.beginPath();c.moveTo(...pose.position);
      for(const point of m.points.slice(next))c.lineTo(...point);c.stroke();c.restore();
      const end=m.points.at(-1);c.strokeStyle='#436b87';c.lineWidth=2;c.beginPath();c.ellipse(end[0],end[1],13,6,0,0,Math.PI*2);c.stroke();
    }
    this.layers.sort((a,b)=>a.depth-b.depth).forEach(layer=>layer.draw());
    this.drawClinicalWork(s,actors,tick);
    this.text('接 待',172,841,12,'#526475','center');
    if(s.venture){this.box(70,365,370,28,'#f1efe3ef',3);this.text(siteOf(s.venture.site).name+' · '+(s.venture.stage==='fitting'?'筹建中':s.venture.stage==='ready'?'待开业':s.venture.stage==='moving'?'迁址交接中':acceptingAt(s)?'营业中':'非接诊时段'),84,384,13,'#435d70');}
    const labeled=[];
    for(const a of actors.filter(a=>!a.staff && (a.walk||a.phase==='waiting'||a.id===this.selected) || a.staff && a.id.startsWith('nurse') && (a.walk||a.activity?.mode==='preparing')).sort((a,b)=>Number(b.id===this.selected)-Number(a.id===this.selected))) {
      if(labeled.length>=3 || labeled.some(p=>Math.hypot(p[0]-a.pos[0],p[1]-a.pos[1])<110))continue;
      const label=a.staff?(a.activity.label.includes('评估')?'评估':a.activity.label.includes('采样')?'采样':a.activity.label.includes('急救')?'急救接续':a.activity.label.includes('备物')||a.activity.mode==='preparing'?'备物':a.activity.label.includes('返回')?'归位':'护理'):!a.walk&&a.clinical?(a.phase==='waiting'&&a.clinical.stage==='assessment'&&a.clinical.readyAt>s.time?'静息 '+Math.ceil((a.clinical.readyAt-s.time)/60000)+'分':clinicalStatus(a,s.time)):destinationLabel(a);
      const h=a.staff?STAFF_APPEARANCE[a.id].height:patientAppearance(a).height,font=Math.max(12,Math.min(20,9/this.scale)),y=a.pos[1]-h-12,w=label.length*font+16;
      this.box(a.pos[0]-w/2,y-font,w,font+8,'#edf0e9ed',4);this.text(label,a.pos[0],y,font,'#40576b','center',500);
      labeled.push(a.pos);
    }
    // Door leaves swing aside as people approach; clear passages are kept in the navigation mesh.
    for (const [x,y] of [[238,342],[498,342],[247,652],[433,652]]) {
      const near=actors.filter(a=>a.walk).reduce((d,a)=>Math.min(d,Math.hypot(a.pos[0]-x,a.pos[1]-y)),Infinity);
      const open=Math.max(0,Math.min(1,(80-near)/50));
      this.box(x-24,y-8,44*(1-open)+5,6+24*open,'#bca781',1);
      this.line(x-23,y-8,x-23,y-2+24*open,'#716b60',1.5);
    }
    this.tree(30,441,.56); if(!this.expanded)this.tree(652,719,.62); this.tree(646,88,.69); this.tree(13,946,.63);
    this.box(-2000,1028,4700,116,'#7c8486'); this.box(-2000,1029,4700,4,'#535f67');
    for(let x=-500;x<1500;x+=130) this.box(x,1080,55,3,'#d9dcda',2);
    this.text('青 禾 路',492,1062,12,'#c7cccc','center');
    const carX=((tick/55)%1500)-400;
    this.box(carX,1091,98,35,'#b8c4b0',10); this.box(carX+20,1088,56,34,'#d4ddcb',8);
    this.box(carX+32,1092,22,25,'#adbfba',4);
  }
}
