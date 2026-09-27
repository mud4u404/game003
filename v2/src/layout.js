// Scene instances contain no rendering callbacks. Furniture geometry lives in catalog.js.
export const rooms = [
  { id: 'consult', type: 'consultation', name: '诊室', x: 0, y: 0, w: 4, d: 4, color: '#efe4cf', grid: 'rgba(170,140,100,.25)', label: [0.7,3.75] },
  { id: 'lab', type: 'laboratory', name: '检验科', x: 4, y: 0, w: 5, d: 4, color: '#e3e7eb', grid: 'rgba(110,125,140,.25)', label: [5.6,3.6] },
  { id: 'hall', type: 'waiting', name: '候诊大厅', x: 0, y: 4, w: 9, d: 2, color: '#f1eadc', grid: 'rgba(170,140,100,.22)', label: [3.2,5.9] },
  { id: 'xray', type: 'radiology', name: '放射科', x: 0, y: 6, w: 4, d: 3, color: '#e7e3ef', grid: 'rgba(120,110,150,.25)', label: [1.6,8.7] },
  { id: 'ward', type: 'ward', name: '病房', x: 4, y: 6, w: 5, d: 3, color: '#d8eadd', grid: 'rgba(90,140,100,.25)', label: [7.8,8.8] },
];
export const walls = [
  { id:'north', axis:'x', x:0, y:0, length:9, height:1.2, windows:[[5,8]], dado:true },
  { id:'west', axis:'y', x:0, y:0, length:9, height:1.2, windows:[[6.5,8]], dado:true },
  { id:'upper', axis:'x', x:0, y:4, length:9, height:.34 },
  { id:'upper-partition', axis:'y', x:4, y:0, length:4, height:.34 },
  { id:'lower', axis:'x', x:0, y:6, length:9, height:.34 },
  { id:'lower-partition', axis:'y', x:4, y:6, length:3, height:.34 },
  { id:'south', axis:'x', x:0, y:9, length:9, height:.16 },
  { id:'east', axis:'y', x:9, y:0, length:9, height:.16 },
];
export const doors = [
  { id:'consult-door', wall:'upper', offset:1.5, width:1 },
  { id:'lab-door', wall:'upper', offset:6, width:1 },
  { id:'xray-door', wall:'lower', offset:2, width:1 },
  { id:'ward-door', wall:'lower', offset:6.5, width:1 },
  { id:'entrance', wall:'east', offset:4, width:2, type:'glass', height:.9 },
];
const f = (id,type,x,y,room,extra={}) => ({ id,type,x,y,room,orientation:0,...extra });
export const furniture = [
  f('exam-bed','exam-bed',.25,.3,'consult'),
  f('consult-cabinet','cabinet',1.4,.15,'consult',{w:1.6,d:.4,h:.42}),
  f('sink','sink',3.1,.15,'consult'),
  f('desk','desk',1.5,1.3,'consult'),
  f('patient-stool','stool',2.05,2.15,'consult'),
  f('consult-plant','plant',3.2,.5,'consult'),
  f('lab-counter','lab-counter',4.4,.15,'lab'),
  f('lab-fridge','fridge',7.9,.15,'lab'),
  f('lab-table','lab-table',5.3,1.9,'lab'),
  f('sample-chair','sample-chair',4.35,2.6,'lab'),
  f('lab-plant','plant',8.2,3.1,'lab'),
  f('reception','reception',.5,4.6,'hall'),
  ...[4.35,5.2].flatMap((y,row)=>Array.from({length:6},(_,i)=>f(`seat-${row}-${i}`,'chair',4.2+i*.55,y,'hall'))),
  f('water','water',8.3,4.15,'hall'),
  f('xray-bed','xray-bed',.6,6.9,'xray'),
  f('xray-machine','xray-machine',1.1,6.35,'xray'),
  f('xray-cabinet','cabinet',.15,8,'xray',{w:.35,d:.6,h:1}),
  f('xray-control','xray-control',2.8,7.9,'xray'),
  f('xray-warning','warning',2.2,5.96,'xray'),
  ...[4.5,5.9,7.3].flatMap((x,i)=>[f(`bed-${i}`,'bed',x,6.3,'ward'),f(`bedside-${i}`,'cabinet',x+.95,6.4,'ward',{w:.35,d:.35,h:.4,color:'#c79a66'})]),
  f('iv','iv',8.6,6.4,'ward'),
];
export const appearances = {
  doctor:{hair:'#2e2622',skin:'#f1cda9',shirt:'#7fb3d9',pants:'#34465e',coat:'#f7f9fb',steth:1},
  doctor2:{hair:'#5a3d2a',skin:'#e8bf98',shirt:'#e6eef5',pants:'#3b3f4a',coat:'#f7f9fb'},
  nurse:{hair:'#2a2226',skin:'#f1cda9',shirt:'#4a9b94',pants:'#3f8a84',cross:1},
  technician:{hair:'#1f1c1c',skin:'#e3b891',shirt:'#5e82b0',pants:'#34465e'},
  red:{hair:'#3a2a22',skin:'#f1cda9',shirt:'#c65a47',pants:'#3e4a5e'},
  blue:{hair:'#9a9a9a',skin:'#e8c29c',shirt:'#4f7fb8',pants:'#4b4038'},
  yellow:{hair:'#2a2320',skin:'#f1cda9',shirt:'#d6a23f',pants:'#3e4a5e'},
  green:{hair:'#5a3a28',skin:'#e3b891',shirt:'#7b9a58',pants:'#2f3542'},
  purple:{hair:'#1d1d24',skin:'#f1cda9',shirt:'#8a6fb0',pants:'#4a4a52'},
  teal:{hair:'#c9c2b8',skin:'#ecc6a0',shirt:'#5f8c8a',pants:'#4b4038'},
};
const p=(id,name,role,x,y,appearance,pose='stand',extra={})=>({id,name,role,x,y,appearance,pose,...extra});
export const people = [
  p('doctor-1','陈明','医生',2.3,1.05,'doctor'),
  p('wang','王建国','患者',2.28,2.4,'red','seat',{back:true,seat:'patient-stool'}),
  p('lab-tech','刘川','检验技师',6.2,2.9,'technician','stand',{back:true}),
  p('sample-patient','李文','患者',4.6,3.1,'green','seat',{seat:'sample-chair'}),
  p('triage','周宁','护士',1.4,4.35,'nurse'),
  p('queue-1','许舒宁','患者',1.8,5.65,'purple','stand',{back:true}),
  p('queue-2','赵立','患者',1.05,5.8,'blue','stand',{back:true}),
  p('doctor-2','林远','医生',3.4,5.4,'doctor2','walk'),
  p('entrance-patient','沈晓禾','患者',8.5,4.9,'teal','walk'),
  ...[[0,0,'yellow','黄安'],[0,2,'teal','孙宜'],[0,4,'blue','钱平'],[1,1,'red','张成'],[1,4,'purple','吴敏']].map(([row,i,a,name],j)=>p(`waiting-${j}`,name,'患者',4.45+i*.55,[4.35,5.2][row]+.32,a,'seat',{seat:`seat-${row}-${i}`})),
  p('xray-tech','何川','放射技师',3.4,8.85,'technician','stand',{back:true}),
  p('ward-nurse','林静','护士',6.4,8.2,'nurse'),
  ...[4.5,5.9,7.3].map((x,i)=>p(`inpatient-${i}`,['杨康','陈悦','李华'][i],'患者',x+.37,6.6,['blue','yellow','teal'][i],'lie',{bed:`bed-${i}`,z:.45})),
];
export const outdoors = {
  road:{x:12.6,y:-12,w:2.6,d:34}, parking:{x:-5.2,y:0,w:4.4,d:9},
  paving:[{x:-.7,y:-.7,w:10.4,d:10.4},{x:9,y:2.6,w:3.3,d:4.2}],
  cars:[{id:'car-red',x:-4.9,y:.8,color:'#c65a47',orientation:1},{id:'car-blue',x:-4.9,y:3.6,color:'#4f7fb8',orientation:1},{id:'car-white',x:-4.9,y:6.4,color:'#d9d6ce',orientation:1},{id:'ambulance',type:'ambulance',x:10.3,y:4.2}],
  trees:[[1,-2.2],[3.4,-2.6,1.1],[6,-2,.9],[8.4,-2.5,1.05],[-2.4,-1.8,1.1],[10.8,-.8,.95],[10.6,8.3],[-1.8,10.6,1.1],[1.6,11,.95],[-6.4,-.8],[-6.2,8.2,1.05],[12.2,9.8,.9],[5.2,-5,1.1],[-1.5,-5.2],[9.6,-4.6],[2.6,-6.2,1.05],[7.2,-7],[-3.6,-4.4,.95],[0,-8.4],[4.6,-9.2,1.1],[-5.8,-6.6],[11.5,-7.5,1.05]].map(([x,y,scale=1],i)=>({id:`tree-${i}`,x,y,scale})),
};
export const scene = {rooms,walls,doors,furniture,people,outdoors};
