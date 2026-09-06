// Cube Libre: browser-independent simulation, ported from cube_libre_pygame.py.
// Rendering, audio, persistence and input are injected by the browser adapter.
import { C,VISUAL_EFFECTS,PLAYER_ROTATION,PLAYER_PROPULSION,CAMERA_RULES,PREVIEW_NUMBERS } from './config.mjs';
import {BONUS_SCHEDULE,createBonus,scheduledBonus,recoveredShape,rotateQ} from './bonus.mjs';
import { BALANCE,difficultyForLevel,introductionsForLevel,recouplingHeatBlocked } from './difficulty.mjs';
import {CHANGES,CHANGE_NUMBERS,createChangeSettings,setChangeNumber,Shutters,shutterEnabled,shutterLoss} from './changes.mjs';
import {CONFIG_COMMANDS,describeConsoleConfig} from './console-config.mjs';
export { BALANCE } from './difficulty.mjs';
export { C };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const mix = (a, b, t) => a + (b - a) * t;
export const radians = d => d * Math.PI / 180;
export const OPENING_DURATION = 9.2;
export const openingLineOpacity = (time,line) =>
  smooth((time-.8-line*1.6)/1.2)*(1-smooth((time-7.2)/1.2));
export const ASCENSION_TIMING = Object.freeze({
  riseStarts: .6, riseSeconds: 5.8, starStarts: 5.2, starSeconds: 1.2,
  flySeconds: 10, fadeStarts: 7.6, fadeSeconds: 2.4,
  whiteHoldSeconds: 2, titleFadeSeconds: 1.4, titleHoldSeconds: 2,
  get subtitleStarts() { return this.titleFadeSeconds+this.titleHoldSeconds; },
  subtitleFadeSeconds: 1.2,
  get continueAfter() { return this.subtitleStarts+this.subtitleFadeSeconds+.2; },
  summaryInputDelay: .35,
});
export class V {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, {x, y, z}); }
  add(b) { return new V(this.x + b.x, this.y + b.y, this.z + b.z); }
  sub(b) { return new V(this.x - b.x, this.y - b.y, this.z - b.z); }
  mul(s) { return new V(this.x * s, this.y * s, this.z * s); }
  dot(b) { return this.x*b.x + this.y*b.y + this.z*b.z; }
  cross(b) { return new V(this.y*b.z-this.z*b.y, this.z*b.x-this.x*b.z, this.x*b.y-this.y*b.x); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  norm() { const n = this.length(); return n > 1e-9 ? this.mul(1/n) : new V(0,1,0); }
  array() { return [this.x, this.y, this.z]; }
  static of(a) { return new V(...a); }
}
export const lerp = (a,b,t) => a.mul(1-t).add(b.mul(t));
export const rotate = (v, axis, degrees) => {
  const a=axis.norm(), angle=radians(degrees), c=Math.cos(angle), s=Math.sin(angle);
  return v.mul(c).add(a.cross(v).mul(s)).add(a.mul(a.dot(v)*(1-c)));
};
export const rand = (rng, lo, hi) => mix(lo,hi,rng());
export const randV = (rng, scale=1) => new V(...Array.from({length:3},()=>rand(rng,-scale,scale)));
export const cells = [];
for(let x=-2;x<=2;x++) for(let y=-2;y<=2;y++) for(let z=-2;z<=2;z++) cells.push([x,y,z]);
const compactOrder = (i,j) => {
  const a=cells[i],b=cells[j];
  return a.reduce((n,v)=>n+v*v,0)-b.reduce((n,v)=>n+v*v,0) ||
    a.reduce((n,v)=>n+Math.abs(v),0)-b.reduce((n,v)=>n+Math.abs(v),0) || i-j;
};
export const cellColor = i => {
  const [,y,z]=cells[i],t=(y+2)/4,zt=(z+2)/4;
  return [mix(1,.08,t),.18+.32*zt,mix(.15,.95,t)];
};

export class Player {
  constructor(rng=Math.random) { this.rng=rng; this.reset(); }
  reset() { this.origin=V.of(C.START_ORIGIN); this.alive=new Set(cells.map((_,i)=>i)); this.fragments=[]; this.setSpinAngles(0,0,0); }
  setSpinAngles(x,y,z) {
    this.spinAngles=[x,y,z].map(degrees=>((degrees%360)+360)%360);
    const [ax,ay,az]=this.spinAngles.map(degrees=>radians(degrees)*.5);
    const sx=Math.sin(ax),cx=Math.cos(ax),sy=Math.sin(ay),cy=Math.cos(ay),sz=Math.sin(az),cz=Math.cos(az);
    // Compose X, then Y, then Z. Different phase speeds make the tumble's axis
    // evolve smoothly instead of merely spinning around a fixed diagonal.
    const a=sx*cy*cz-cx*sy*sz,b=cx*sy*cz+sx*cy*sz,c=cx*cy*sz-sx*sy*cz,w=cx*cy*cz+sx*sy*sz;
    this.spinQuaternion=[a,b,c,w];
    // Share this pose with rendering; cache its matrix once for all cell queries.
    this.spinMatrix=[
      1-2*(b*b+c*c),2*(a*b-c*w),2*(a*c+b*w),
      2*(a*b+c*w),1-2*(a*a+c*c),2*(b*c-a*w),
      2*(a*c-b*w),2*(b*c+a*w),1-2*(a*a+b*b),
    ];
  }
  pos(i) {
    const [x,y,z]=cells[i],m=this.spinMatrix,spacing=C.CELL_SPACING;
    return new V(this.origin.x+(m[0]*x+m[1]*y+m[2]*z)*spacing,
      this.origin.y+(m[3]*x+m[4]*y+m[5]*z)*spacing,
      this.origin.z+(m[6]*x+m[7]*y+m[8]*z)*spacing);
  }
  destroy(i, blast, heat=0) {
    if(!this.alive.delete(i)) return false;
    const rng=this.rng,pos=this.pos(i);
    const vel=pos.sub(blast).norm().mul(rand(rng,2,4.6)).add(randV(rng,.65));
    vel.y+=rand(rng,.3,1.1);
    this.fragments.push({pos,vel,color:cellColor(i),axis:randV(rng).norm(),angle:rand(rng,0,360),
      spin:rand(rng,-280,280),age:0,heat});
    return true;
  }
  update(dt) {
    for(const f of this.fragments) {
      f.age+=dt; f.pos=f.pos.add(f.vel.mul(dt)); f.angle+=f.spin*dt; f.vel=f.vel.mul(Math.max(0,1-.18*dt));
    }
    this.fragments=this.fragments.filter(f=>f.age<8);
  }
  setCount(count) {
    this.alive=new Set(cells.map((_,i)=>i).sort(compactOrder).slice(0,clamp(count,0,125)));
    if(count>=125) this.fragments=[];
  }
}

export class Module {
  constructor(index,start,dir) {
    this.index=index; this.start=start; this.bx=V.of(dir);
    this.by=new V(0,dir[1] ? 0:1,dir[1] ? 1:0); this.bz=this.bx.cross(this.by).norm();
  }
  world(x,y=0,z=0) { return this.start.add(this.bx.mul(x-C.COURSE_X_MIN)).add(this.by.mul(y)).add(this.bz.mul(z)); }
  local(p) { const d=p.sub(this.start); return new V(C.COURSE_X_MIN+d.dot(this.bx),d.dot(this.by),d.dot(this.bz)); }
  end() { return this.world(C.COURSE_X_MAX); }
}

export function routeDirections(count,route3d=true) {
  const dirs=[],boxes=[]; let cursor=new V(-23,0,0),last=null;
  const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].filter(d=>route3d||!d[1]);
  for(let i=0;i<count;i++) {
    const preferred=(route3d && i+1>=BALANCE.spaceStartLevel ? C.COURSE_ROUTE_3D_SPINE:C.COURSE_ROUTE_2D_SPINE);
    const candidates=[preferred[i%preferred.length],...axes].filter(d=>!last||V.of(d).dot(last)===0);
    let found=false;
    for(const d of candidates) {
      const end=cursor.add(V.of(d).mul(46)),s=cursor.array(),e=end.array();
      const box=s.flatMap((v,k)=>[Math.min(d[k]?v:v-8,e[k]-8), Math.max(d[k]?v:v+8,e[k]+8)]);
      if(boxes.slice(0,-1).some(b=>[0,2,4].every(k=>box[k+1]>b[k]&&b[k+1]>box[k]))) continue;
      dirs.push(d); boxes.push(box); cursor=end; last=V.of(d); found=true; break;
    }
    if(!found) throw new Error('Route generator could not find a clear turn');
  }
  return dirs;
}

export const laserTemplates = [
  [-11,6.4,1.60,.055,[1,0,0],47,0,3.10,0,0,0,0],
  [-5,6.4,1.55,.052,[1,0,0],-62,35,3.00,0,0,0,0],
  [2,6.6,1.65,.055,[0,1,0],27,20,3.05,0,0,0,0],
  [8,6.7,1.60,.052,[0,0,1],-31,80,3.00,.35,.30,34,0],
  [14,6.2,1.45,.050,[1,0,0],24,10,2.95,.45,.38,-28,90],
];
export class Laser {
  constructor(template,module,level) {
    const [x,half,spacing,radius,axis,spin,phase,safe,oy,oz,gspin,gphase]=template;
    const offset=module.index===0?0:module.index*23+level*5;
    Object.assign(this,{module,center:module.world(x),half,spacing,radius,axis:V.of(axis),
      spin:spin*(1+Math.min(.45,(level-1)*.035)),phase:phase+offset,safe,oy,oz,gspin,gphase:gphase+offset});
  }
  angle(t) { return this.phase+t*this.spin; }
  gap(t) { const a=radians(this.gphase+t*this.gspin); return [Math.sin(a)*this.oy,Math.cos(a)*this.oz]; }
  local(p,t) {
    const d=p.sub(this.center),m=this.module;
    return rotate(new V(d.dot(m.bx),d.dot(m.by),d.dot(m.bz)),this.axis,-this.angle(t));
  }
  hits(p,t) {
    const l=this.local(p,t),[gy,gz]=this.gap(t);
    if(Math.abs(l.x)>this.radius+C.CELL_HALF*.48 || Math.abs(l.y)>this.half+C.CELL_HALF || Math.abs(l.z)>this.half+C.CELL_HALF) return false;
    if(Math.abs(l.y-gy)<=this.safe+C.CELL_HALF*.18 && Math.abs(l.z-gz)<=this.safe+C.CELL_HALF*.18) return false;
    const dist=v=>Math.abs(v-Math.round(v/this.spacing)*this.spacing);
    return dist(l.y)<this.radius+C.CELL_HALF*.18 || dist(l.z)<this.radius+C.CELL_HALF*.18;
  }
  touchesShutter(p,t) {
    const l=this.local(p,t);
    return Math.abs(l.x)<=this.radius+C.CELL_HALF*.48&&Math.abs(l.y)<=this.half+C.CELL_HALF&&Math.abs(l.z)<=this.half+C.CELL_HALF;
  }
}

export class Course {
  constructor(level,route3d=true,{moduleCount=clamp(Math.trunc(level),1,BALANCE.levelCap)}={}) {
    this.level=level; this.modules=[]; let start=new V(-23,0,0);
    for(const d of routeDirections(moduleCount,route3d)) {
      const m=new Module(this.modules.length,start,d); this.modules.push(m); start=m.end();
    }
    this.portal=this.modules.at(-1);
    this.joints=this.modules.slice(0,-1).map((m,i)=>({index:i,center:m.end(),open:[m.bx.mul(-1).array(),this.modules[i+1].bx.array()]}));
    this.moduleLasers=this.modules.map(m=>laserTemplates.map(t=>new Laser(t,m,level)));
    this.lasers=this.moduleLasers.flat();
    this.revealed=new Map(level<BALANCE.spaceStartLevel?this.modules.map(m=>[m.index,-9999]):[[0,-9999]]);
    this.collapsed=new Map();
    const pts=[];
    for(const m of this.modules) for(const x of this.span(m)) for(const y of [-7,7]) for(const z of [-7,7]) pts.push(m.world(x,y,z));
    for(const j of this.joints) for(const x of [-7,7]) for(const y of [-7,7]) for(const z of [-7,7]) pts.push(j.center.add(new V(x,y,z)));
    this.bounds=[...['x','y','z'].flatMap(k=>[Math.min(...pts.map(p=>p[k])),Math.max(...pts.map(p=>p[k]))])];
    const b=this.bounds; this.center=new V((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2);
    this.zoom=Math.min(120,48+Math.max(0,Math.max(b[1]-b[0],b[3]-b[2],b[5]-b[4])-46)*.38);
    // A fixed-size spatial broad phase keeps cell queries local on long routes.
    // The expanded boxes cover location(), and all normal collision padding.
    this.spatial=new Map();this.emptyNearby={modules:[],joints:[]};
    const add=(kind,item,bounds)=>{
      const lo=[bounds[0],bounds[2],bounds[4]].map(v=>Math.floor(v/46));
      const hi=[bounds[1],bounds[3],bounds[5]].map(v=>Math.floor(v/46));
      for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++) {
        const key=`${x},${y},${z}`;
        if(!this.spatial.has(key))this.spatial.set(key,{modules:[],joints:[]});
        this.spatial.get(key)[kind].push(item);
      }
    };
    for(const m of this.modules) {
      const a=m.world(-30,-14,-14),b=m.world(30,14,14);
      add('modules',m,['x','y','z'].flatMap(k=>[Math.min(a[k],b[k]),Math.max(a[k],b[k])]));
    }
    for(const j of this.joints)add('joints',j,['x','y','z'].flatMap(k=>[j.center[k]-10,j.center[k]+10]));
  }
  nearby(p,pad=0) {
    if(pad>3)return {modules:this.modules,joints:this.joints};
    return this.spatial.get(`${Math.floor(p.x/46)},${Math.floor(p.y/46)},${Math.floor(p.z/46)}`)||this.emptyNearby;
  }
  span(m,pad=0) { return [-23+(m.index>0?7:0)-pad,23-(m.index<this.modules.length-1?7:0)+pad]; }
  jointAt(p,pad=0) { return this.nearby(p,pad).joints.find(j=>Math.abs(p.x-j.center.x)<=7+pad&&Math.abs(p.y-j.center.y)<=7+pad&&Math.abs(p.z-j.center.z)<=7+pad)?.index??-1; }
  inside(p,pad=0) {
    return this.nearby(p,pad).modules.some(m=>{const l=m.local(p),[a,b]=this.span(m,pad);
      return l.x>=a&&l.x<=b&&Math.abs(l.y)<=7+pad&&Math.abs(l.z)<=7+pad;
    }) || this.jointAt(p,pad)>=0;
  }
  collapsedSectionAt(p,pad=C.CELL_HALF) {
    // location() is a broad visibility hint and falls back to leg zero when
    // nothing is nearby. A lethal collapse requires physical containment.
    const nearby=this.nearby(p,pad);
    for(const m of nearby.modules) if(this.collapsed.has(m.index)) {
      const l=m.local(p),[a,b]=this.span(m,pad);
      if(l.x>=a&&l.x<=b&&Math.abs(l.y)<=7+pad&&Math.abs(l.z)<=7+pad)return m.index;
    }
    for(const j of nearby.joints) if(this.collapsed.has(j.index)&&
      Math.abs(p.x-j.center.x)<=7+pad&&Math.abs(p.y-j.center.y)<=7+pad&&Math.abs(p.z-j.center.z)<=7+pad)return j.index;
    return -1;
  }
  location(p) {
    let index=0,x=-23,score=-Infinity;
    for(const m of this.nearby(p).modules) {
      const l=m.local(p);
      if(Math.abs(l.z)>14 || Math.abs(l.y)>14 || l.x< -30 || l.x>30) continue;
      const lx=clamp(l.x,-23,23),s=m.index*1000+lx;
      if(s>score) { index=m.index; x=lx; score=s; }
    }
    return {index,x};
  }
  revealIndex(p) {
    if(this.level<BALANCE.spaceStartLevel) return this.modules.length-1;
    const j=this.jointAt(p,1.2);
    return j>=0?Math.min(this.modules.length-1,j+1):this.location(p).index;
  }
  revealProgress(i,t) { const start=this.revealed.get(i); return start===undefined?0:smooth((t-start)/1.45); }
  distanceFade(i,p) {
    if(this.level<BALANCE.spaceStartLevel)return 0;
    const {index,x}=this.location(p),collapse=i+1;
    if(index<collapse) return 0;
    if(index>collapse) return 1;
    // The location hint can favor the next leg before the turn is cleared.
    // Begin sealing only beyond its exit, with room for the rotating body.
    return smooth((x-(-23+8))/C.TRAIL_FADE_DISTANCE);
  }
  fade(i,p,t) { return Math.max(this.distanceFade(i,p),this.collapsed.has(i)?smooth((t-this.collapsed.get(i))/1.25):0); }
  activeLaser(l,p,t) {
    const i=l.module.index,{index}=this.location(p);
    if(this.level>=BALANCE.spaceStartLevel && (i<index-1||i>index+2||i>this.revealIndex(p))) return false;
    const hardCulled=this.level>=BALANCE.spaceStartLevel&&i<index&&this.collapsed.has(i)&&t-this.collapsed.get(i)>=1.25;
    return !hardCulled && this.revealProgress(i,t)>=.78 && this.distanceFade(i,p)<.98;
  }
  activeLasers(p,t) {
    const index=this.location(p).index,active=[];
    const first=this.level<BALANCE.spaceStartLevel?0:Math.max(0,index-1),last=this.level<BALANCE.spaceStartLevel?this.modules.length-1:Math.min(this.modules.length-1,index+2);
    for(let i=first;i<=last;i++)for(const l of this.moduleLasers[i])if(this.activeLaser(l,p,t))active.push(l);
    return active;
  }
  update(p,t,emit) {
    for(let i=0;i<=this.revealIndex(p);i++) if(!this.revealed.has(i)) {
      this.revealed.set(i,t); emit('laser_reveal',this.modules[i].start);
    }
    const {index}=this.location(p);
    for(let i=0;this.level>=BALANCE.spaceStartLevel&&i<=index-1;i++) if(!this.collapsed.has(i)&&this.distanceFade(i,p)>=.04) {
      this.collapsed.set(i,t); emit('collapse',this.modules[i].end()); emit('laser_dissipate');
    }
  }
}

export function portalMetrics(course,player) {
  const half=C.PORTAL_CAPTURE_HALF; let absorbed=0,overlap=0,generous=0;
  for(const i of player.alive) {
    const l=course.portal.local(player.pos(i)),dx=l.x-20,lat=Math.max(Math.abs(l.y),Math.abs(l.z));
    if(dx>=C.PORTAL_ABSORB_X&&lat<=half) absorbed++;
    if(dx>=-1.15&&dx<=2.4&&lat<=half) overlap++;
    if(dx>=-1.7&&dx<=3.15&&lat<=half+.45) generous++;
  }
  const count=player.alive.size,ratio=count?absorbed/count:0;
  const l=course.portal.local(player.origin);
  const lateral=1-clamp((Math.max(Math.abs(l.y),Math.abs(l.z))-(C.PORTAL_SIZE*.5+1.1))/3);
  const hint=clamp((l.x-(20-6.2))/6.2)*lateral*.16+clamp(generous/Math.max(1,count)/.5)*.18;
  let charge=clamp(hint,0,.36);
  if(ratio>=.5) charge=ratio<2/3 ? .48+.24*smooth((ratio-.5)/(2/3-.5)):.72+.28*smooth((ratio-2/3)/(1-2/3));
  return {absorbed,overlap,ratio,charge};
}
export function suction(course,player,dt) {
  const l=course.portal.local(player.origin),dx=l.x-20,lat=Math.max(Math.abs(l.y),Math.abs(l.z));
  if(!player.alive.size||dx< -6.8||dx>3.2||lat>C.PORTAL_CAPTURE_HALF+2.3) return;
  const strength=smooth((dx+6.8)/6.8)*(1-clamp((lat-C.PORTAL_CAPTURE_HALF)/2.3));
  const gain=Math.min(1,7*dt*strength),forward=Math.min(Math.max(0,1.95-dx),4.4*dt*strength),m=course.portal;
  player.origin=player.origin.add(m.bx.mul(forward)).add(m.by.mul(-l.y*gain)).add(m.bz.mul(-l.z*gain));
}

export function recoupleTargets(player,count) {
  const neighbors=i=>cells.reduce((n,c,j)=>n+(player.alive.has(j)&&c.reduce((s,v,k)=>s+Math.abs(v-cells[i][k]),0)===1?1:0),0);
  return cells.map((_,i)=>i).filter(i=>!player.alive.has(i)).sort((a,b)=>neighbors(b)-neighbors(a)||compactOrder(a,b)).slice(0,count);
}
export function beginRecouple(player,level) {
  const usable=player.fragments.filter(f=>f.age<7.95).sort((a,b)=>a.age-b.age||a.pos.sub(player.origin).length()-b.pos.sub(player.origin).length());
  const maximum=Math.min(125-player.alive.size,usable.length);
  if(maximum<=0) return [];
  const desired=maximum*difficultyForLevel(level).recouplingRate;
  const count=clamp(Math.floor(desired)+(player.rng()<desired%1?1:0),1,maximum);
  const targets=recoupleTargets(player,count),selected=usable.slice(0,targets.length);
  player.fragments=player.fragments.filter(f=>!selected.includes(f));
  return selected.map((f,i)=>({...f,start:f.pos,target:targets[i],delay:rand(player.rng,0,.2),scale:rand(player.rng,.8,1.08)}));
}

export class Game {
  constructor({rng=Math.random,stats={},save=()=>{}}={}) {
    this.rng=rng; this.save=save; this.stats={best_escape:0,highest_level:1,best_score:0,...stats};
    this.flags={...C.DEBUG_FLAGS,shake:VISUAL_EFFECTS.shakingEnabled,spin:PLAYER_ROTATION.enabled,portal_white_light:VISUAL_EFFECTS.portalWhiteLight,culling:VISUAL_EFFECTS.courseCulling,preview_outline:VISUAL_EFFECTS.previewOutline,rotation_shocks:VISUAL_EFFECTS.rotationShocks,microgravity:PLAYER_PROPULSION.enabled,overheat_blocks_recoupling:BALANCE.overheatBlocksRecoupling}; this.player=new Player(rng); this.t=0; this.angles=[0,0,0];
    this.flags.change_1=CHANGES.change_1.enabled;this.flags.change_1_random_per_leg=CHANGES.change_1.randomPerLeg;this.flags.change_1_no_repeat_leg=CHANGES.change_1.noRepeatLeg;
    this.changeSettings=createChangeSettings();
    this.autoLocateMinLevel=CAMERA_RULES.autoLocateMinLevel;
    this.previewSettings=Object.fromEntries(Object.entries(PREVIEW_NUMBERS).map(([k,r])=>[k,r.value]));
    this.starPattern=VISUAL_EFFECTS.starPattern;
    this.level=1; this.score=0; this.locate=false; this.paused=false; this.help=false; this.events=[]; this.pendingIntroductions=[];
    this.consoleSettings={};this.consoleNumbers={}; // Browser-owned controls join the same command interface.
    this.runStats={playSeconds:0,deaths:0,recoupledCubes:0,levelsCleared:0,bonusRounds:0,bonusPieces:0,bonusScore:0}; this.runSummary=null;
    this.bonusesPlayedAfter=new Set();this.bonus=null;this.previewReturn=null;
    this.state='title'; this.stateTime=0; this.message=''; this.messageTime=0; this.resetAttempt();
  }
  emit(name,pos) { this.events.push({name,pos}); }
  persist() { this.save({...this.stats}); }
  messageSet(text,time=1.6) { this.message=text; this.messageTime=time; }
  setState(s) { this.state=s; this.stateTime=0; }
  get difficulty() { return difficultyForLevel(this.level); }
  get autoLocate() { return this.autoLocateMinLevel===0||this.level>=this.autoLocateMinLevel; }
  get recouplingBlockedByHeat() { return recouplingHeatBlocked(this.level,this.heat>0,this.flags.overheat_blocks_recoupling); }
  resetLegClock() {
    this.legTime=this.difficulty.secondsPerLeg;
    this.timeResetNotice=this.difficulty.timed?1.6:0;
  }
  resetAttempt() {
    this.player.reset(); this.course=new Course(this.level,this.flags.route3d); this.geometryVersion=(this.geometryVersion||0)+1;
    this.driftVelocity=new V();
    this.shutters=new Shutters(this.rng);
    this.damageTimer=.45; this.legTime=this.difficulty.secondsPerLeg; this.timedModule=0; this.timeResetNotice=0;
    this.outsideTime=0; this.heat=0; this.lastHeat=0; this.coolTime=0; this.cool=0;
    this.recoupling=[]; this.recoupleTime=0; this.requests=[]; this.cooldown=0;
    this.particles=[]; this.impacts=[]; this.shake=0; this.outside=false;
    this.rotationShock={angle:new V(),velocity:new V(),hits:0};
  }
  ready(level) {
    this.bonus=null;this.previewReturn=null;
    this.pendingIntroductions=[];
    this.level=clamp(Math.trunc(level),1,BALANCE.levelCap); this.paused=false; this.openingTransition=false; this.resetAttempt();
    this.stats.highest_level=Math.max(this.stats.highest_level,this.level); this.persist();
    this.setState('level_ready');
  }
  newRun() {
    this.score=0; this.completedLevel=0; this.lastEscape=0; this.help=false;
    this.runStats={playSeconds:0,deaths:0,recoupledCubes:0,levelsCleared:0,bonusRounds:0,bonusPieces:0,bonusScore:0}; this.runSummary=null;
    this.bonusesPlayedAfter=new Set();this.bonus=null;this.previewReturn=null;
    this.ready(1); this.setState('opening_intro');
  }
  title() { this.bonus=null;this.previewReturn=null;this.paused=false; this.help=false; this.pendingIntroductions=[]; this.setState('title'); this.recoupling=[]; this.emit('stop'); }
  advance() {
    const target=Math.max(this.level+1,(this.completedLevel||0)+1,2);
    if(target>BALANCE.levelCap) { this.beginAscension(); return; }
    const type=scheduledBonus(this.completedLevel||0,BALANCE.levelCap);
    if(type&&!this.bonusesPlayedAfter.has(this.completedLevel)) {
      this.bonusesPlayedAfter.add(this.completedLevel);this.startBonus(type);return;
    }
    this.introduceLevel(target);
  }
  introduceLevel(target) {
    const phases=introductionsForLevel(target,this.flags.route3d,this.changeSettings,this.flags);
    if(phases.length) {
      this.level=target; this.pendingIntroductions=phases.slice(1); this.setState(phases[0]);
    } else this.ready(target);
  }
  continue() {
    if(this.paused||this.help) return;
    if(this.state==='title') this.newRun();
    else if(this.state==='result_overlay') this.advance();
    else if(this.state==='bonus_result'&&this.stateTime>=.4) {
      if(this.previewReturn) {
        const target=this.previewReturn.nextLevel;this.previewReturn=null;this.bonus=null;
        this.paused=false;this.help=false;this.introduceLevel(target);
      }
      else {this.bonus=null;this.advance();}
    }
    else if(this.state==='ascension_title'&&this.stateTime>=ASCENSION_TIMING.continueAfter) this.setState('run_summary');
    else if(this.state==='run_summary'&&this.stateTime>=ASCENSION_TIMING.summaryInputDelay) this.title();
  }
  startBonus(id,{preview=false}={}) {
    const bonus=createBonus(id,{rng:this.rng}); // Validate before changing the current run.
    if(preview&&!this.previewReturn) {
      const noActiveLevel=['title','quit_confirm','ended','ascension','ascension_white','ascension_title','run_summary'].includes(this.state);
      const hasCurrentLevel=Number.isInteger(this.level)&&this.level>=1;
      this.previewReturn={nextLevel:noActiveLevel||!hasCurrentLevel?BONUS_SCHEDULE.firstLevel:Math.min(BALANCE.levelCap,this.level+1)};
    }
    this.bonus=bonus;this.bonusPreview=preview;this.setState('bonus_intro');this.emit('stop');
  }
  tickBonus(dt,input) {
    const b=this.bonus;
    if(this.state==='bonus_intro'&&this.stateTime>=b.rules.introSeconds)this.setState('bonus_smash');
    else if(this.state==='bonus_smash') {
      if(this.stateTime>=b.rules.impactAt&&this.stateTime-dt<b.rules.impactAt) {this.emit('crash');this.emit('collapse');}
      if(this.stateTime>=b.rules.smashSeconds)this.setState('bonus_playing');
    } else if(this.state==='bonus_playing') {
      const before=b.timeLeft,{picked}=b.update(dt,input);
      if(!this.bonusPreview)this.runStats.playSeconds+=before-b.timeLeft;
      if(picked)this.emit('recouple');
      if(b.result) {
        if(!this.bonusPreview) {
          this.runStats.bonusRounds++;
          if(b.result==='escaped') {
            this.score+=b.potentialScore;this.runStats.bonusScore+=b.potentialScore;this.runStats.bonusPieces+=b.collected;
            this.stats.best_score=Math.max(this.stats.best_score,this.score);this.persist();
          }
        }
        if(b.result==='timeout')this.explodeBonus();
        this.setState('bonus_escape');this.emit(b.result==='escaped'?'portal':'time_buzzer');
      }
    } else if(this.state==='bonus_escape'&&this.stateTime>=(b.result==='timeout'?b.rules.explosionSeconds:2))this.setState('bonus_result');
  }
  explodeBonus() {
    const b=this.bonus;
    if(b.explosion.length)return;
    const center=new V(b.x,b.y,b.z);
    b.explosion=recoveredShape(b.bodyCount).map((offset,i)=>{
      const relative=V.of(rotateQ(offset,b.orientation));
      const direction=relative.length()>.01?relative.norm():randV(this.rng).norm();
      const vel=direction.mul(rand(this.rng,5,11)).add(randV(this.rng,.65));
      vel.y=Math.abs(vel.y)+rand(this.rng,1.5,3.5);
      return {origin:center.add(relative),vel,color:i===0?[1,.96,.73]:cellColor(i),
        axis:randV(this.rng).norm(),spin:rand(this.rng,-280,280),orientation:[...b.orientation]};
    });
    b.pickupFlashes=[];
    this.emit('crash');this.emit('collapse');this.emit('death');
  }
  requestRecouple() {
    if(this.state!=='playing'||this.paused||this.help) return;
    if(this.recouplingBlockedByHeat) { this.messageSet('TOO HOT TO RE-COUPLE · RETURN INSIDE',1.45); return; }
    if(!this.recoupling.length&&!this.player.fragments.some(f=>f.age<7.95)) { this.messageSet('NO RECOVERABLE LOOSE CELLS',.75); return; }
    this.requests=this.requests.filter(t=>t>=this.t-10);
    if(this.requests.length>=5) { this.cooldown=Math.max(0,this.requests[0]+10-this.t); this.messageSet('RE-COUPLING ON COOLDOWN',1.45); return; }
    this.requests.push(this.t);
    if(this.recoupling.length) { this.messageSet('RE-COUPLING ALREADY ACTIVE',.55); return; }
    this.recoupling=beginRecouple(this.player,this.level); this.recoupleTime=0;
    if(this.recoupling.length) { this.emit('recouple'); this.messageSet(`RE-COUPLING REQUESTED: ${this.recoupling.length} CELLS`); }
  }
  move(dt,input) {
    const rules=PLAYER_PROPULSION,speed=rules.speed*(input.rush?rules.rushMultiplier:1);
    const target=new V(clamp(input.x||0,-1,1),clamp(input.y||0,-1,1),clamp(input.z||0,-1,1)).mul(speed);
    if(this.flags.microgravity) {
      const travel=new V();
      for(const axis of ['x','y','z']) {
        let velocity=this.driftVelocity[axis],remaining=dt;
        const goal=target[axis];
        // Integrate counter-thrust to the zero crossing, then accelerate anew.
        // Splitting there keeps the response independent of the frame rate.
        if(velocity*goal<0) {
          const tau=rules.reverseResponseSeconds,crossing=tau*Math.log1p(-velocity/goal),brakeTime=Math.min(dt,crossing);
          const gain=-Math.expm1(-brakeTime/tau);
          travel[axis]=goal*brakeTime+(velocity-goal)*tau*gain;
          velocity=dt>=crossing?0:velocity+(goal-velocity)*gain;
          remaining-=brakeTime;
        }
        if(remaining>0) {
          const tau=goal===0?rules.coastResponseSeconds:rules.thrustResponseSeconds,gain=-Math.expm1(-remaining/tau);
          travel[axis]+=goal*remaining+(velocity-goal)*tau*gain;
          velocity+=(goal-velocity)*gain;
        }
        this.driftVelocity[axis]=velocity;
      }
      this.player.origin=this.player.origin.add(travel);
    } else {
      this.driftVelocity=new V();this.player.origin=this.player.origin.add(target.mul(dt));
    }
    if(this.flags.suction) suction(this.course,this.player,dt);
    if(!this.flags.noclip) {
      const b=this.course.bounds,p=this.player.origin;
      for(const [i,axis] of ['x','y','z'].entries()) {
        const bounded=clamp(p[axis],b[i*2]-5,b[i*2+1]+5);
        if(bounded!==p[axis])this.driftVelocity[axis]=0;
        p[axis]=bounded;
      }
    }
  }
  updatePlayerSpin(dt) {
    const p=this.player;
    if(!this.flags.spin) {if(p.spinAngles.some(angle=>angle!==0))p.setSpinAngles(0,0,0);return;}
    const [x,y,z]=p.spinAngles,speed=PLAYER_ROTATION.degreesPerSecond;
    p.setSpinAngles(x+speed.x*dt,y+speed.y*dt,z+speed.z*dt);
  }
  kickRotation(impact,normal=new V(0,1,0)) {
    if(!this.flags.rotation_shocks)return;
    const s=this.rotationShock,n=++s.hits;
    let axis=impact.sub(this.player.origin).cross(normal);
    const variation=new V(Math.sin(n*2.399+.7),Math.cos(n*1.71),Math.sin(n*3.13+1.2));
    axis=axis.length()>.01?axis.norm().add(variation.mul(.35)).norm():variation.norm();
    s.velocity=s.velocity.add(axis.mul(VISUAL_EFFECTS.impactAngularSpeed));
    s.velocity=s.velocity.mul(Math.min(1,VISUAL_EFFECTS.impactMaxSpeed/Math.max(.001,s.velocity.length())));
  }
  updateRotationShock(dt) {
    const s=this.rotationShock;
    if(!this.flags.rotation_shocks) {s.angle=new V();s.velocity=new V();return;}
    if(s.angle.length()===0&&s.velocity.length()===0)return;
    // Exact damped-spring step: the recoil stays smooth at different frame rates.
    const damping=6,spring=120,w=Math.sqrt(spring-damping*damping),decay=Math.exp(-damping*dt),c=Math.cos(w*dt),sn=Math.sin(w*dt);
    const angle=s.angle,velocity=s.velocity;
    s.angle=angle.mul(c).add(velocity.add(angle.mul(damping)).mul(sn/w)).mul(decay);
    s.velocity=velocity.mul(c).sub(velocity.mul(damping).add(angle.mul(spring)).mul(sn/w)).mul(decay);
    s.angle=s.angle.mul(Math.min(1,VISUAL_EFFECTS.impactMaxAngle/Math.max(.001,s.angle.length())));
    if(s.angle.length()<.02&&s.velocity.length()<.08) {s.angle=new V();s.velocity=new V();}
  }
  thermal(dt) {
    this.outside=this.flags.bounds&&!this.flags.noclip&&[...this.player.alive].some(i=>!this.course.inside(this.player.pos(i),.25*.45));
    if(this.outside) {
      const threshold=this.difficulty.overheatGraceSeconds;
      this.outsideTime+=dt; const h=smooth((this.outsideTime-threshold)/C.BOUNDARY_OVERHEAT_RAMP_SECONDS);
      this.lastHeat=Math.max(this.lastHeat,h); this.coolTime=0; this.cool=0;
      this.heat=this.outsideTime>=threshold?Math.max(.38,h):0; return h;
    }
    if(this.outsideTime>0&&this.lastHeat>.01) this.coolTime=Math.max(this.coolTime,1.75*this.lastHeat);
    this.outsideTime=0; this.lastHeat=0; this.heat=0;
    this.coolTime=Math.max(0,this.coolTime-dt); this.cool=smooth(this.coolTime/1.75); return 0;
  }
  shutterState(l,time=this.shutters.time) {
    if(this.state!=='playing'||!shutterEnabled(this.level,this.flags,this.changeSettings)||!this.course.activeLaser(l,this.player.origin,this.t))return null;
    const grids=this.course.moduleLasers[l.module.index];
    return this.shutters.stateFor(l.module.index,grids.indexOf(l),time);
  }
  updateShutters(dt) {
    this.shutters.tick(dt);
    if(!shutterEnabled(this.level,this.flags,this.changeSettings))return;
    const active=this.course.activeLasers(this.player.origin,this.t),current=this.course.location(this.player.origin).index;
    const nearby=active.filter(l=>!this.flags.culling||l.module.index>=current-1&&l.module.index<=current+1);
    const legs=new Map(nearby.map(l=>[l.module.index,this.course.moduleLasers[l.module.index].length]));
    const events=this.shutters.schedule(legs,this.level,this.changeSettings,this.flags.change_1_random_per_leg,this.flags.change_1_no_repeat_leg);
    for(const event of events) {
      const grid=nearby.find(l=>l.module.index===event.leg&&event.gates.includes(this.course.moduleLasers[event.leg].indexOf(l))&&l.center.sub(this.player.origin).length()<28);
      if(grid)this.emit(event.name,grid.center);
    }
    for(const l of nearby) {
      const phase=this.shutterState(l);if(!phase)continue;
      if(!phase.closed||this.shutters.contacts.get(l)===phase.cycle)continue;
      const contact=[...this.player.alive].find(i=>this.course.jointAt(this.player.pos(i))<0&&l.touchesShutter(this.player.pos(i),this.t));
      if(contact===undefined)continue;
      // Consume this closure contact even during immunity: no delayed repeat bite.
      this.shutters.contacts.set(l,phase.cycle);
      if(!this.flags.damage||this.shutters.immunity>0)continue;
      const loss=shutterLoss(this.player.alive.size,this.changeSettings.change_1_damage_fraction);
      if(!loss)continue;
      const hit=this.player.pos(contact),nearest=[...this.player.alive].sort((a,b)=>
        Math.abs(l.local(this.player.pos(a),this.t).x)-Math.abs(l.local(this.player.pos(b),this.t).x));
      for(const i of nearest.slice(0,loss))this.player.destroy(i,l.center,this.heat);
      this.shutters.immunity=this.changeSettings.change_1_damage_cooldown;
      this.kickRotation(hit,l.module.bx);this.shake=.35;this.lastHit='laser';this.hitTime=.3;
      this.impacts.push({pos:hit,age:0,type:'laser',laser:l});
      for(let i=0;i<32;i++)this.particles.push({pos:hit,vel:randV(this.rng,9),age:0,life:.4,color:[.55,.85,1]});
      this.emit('crash');this.emit('structure_alert');this.messageSet(`SHUTTER HIT: -${loss} CUBES`,1.2);
    }
  }
  damage() {
    if(!this.flags.damage) return null;
    const p=this.player,candidates=[];
    if(this.flags.lasers&&this.shutters.immunity<=0) {
      const active=this.course.activeLasers(p.origin,this.t).filter(l=>!this.shutterState(l)?.closed);
      for(const i of p.alive) for(const l of active) if(this.course.jointAt(p.pos(i))<0&&l.hits(p.pos(i),this.t)) {
        const v=l.local(p.pos(i),this.t); candidates.push({i,l,exposure:Math.abs(v.x)+.04*(Math.abs(v.y)+Math.abs(v.z))}); break;
      }
    }
    let type='laser'; candidates.sort((a,b)=>a.exposure-b.exposure);
    if(!candidates.length&&this.flags.bounds&&!this.flags.noclip) {
      type='bounds'; for(const i of p.alive) if(!this.course.inside(p.pos(i),.25)) candidates.push({i,l:null});
    }
    let destroyed=0,shockImpact;
    for(const {i,l} of candidates.slice(0,2)) {
      const pos=p.pos(i);
      if(p.destroy(i,l?l.center:p.origin,this.heat)) {
        shockImpact??={pos,normal:l?.module.bx};
        destroyed++; this.impacts.push({pos,age:0,type,laser:l});
        for(let k=0;k<8;k++) this.particles.push({pos,vel:randV(this.rng,7),age:0,life:.3,color:type==='laser'?[1,.12,.05]:[.35,.8,1]});
      }
    }
    if(destroyed) {
      this.kickRotation(shockImpact.pos,shockImpact.normal);
      this.shake=.22; this.emit('crash'); this.emit('structure_alert'); this.lastHit=type; this.hitTime=.22;
      this.messageSet(`${type==='laser'?'HIT':this.heat?'OVERHEATING':'FIELD EDGE'}: -${destroyed} CUBES`,.7);
      return type;
    }
    return null;
  }
  makeReassembly() {
    const wreck=[...this.player.fragments.map(f=>f.pos),...[...this.player.alive].map(i=>this.player.pos(i))];
    if(!wreck.length) wreck.push(this.player.origin);
    this.reassembly=cells.map((c,i)=>{
      const target=V.of(C.START_ORIGIN).add(V.of(c));
      return {origin:wreck[i%wreck.length].add(randV(this.rng,.3)),target,
        star:target.add(new V(rand(this.rng,-18,18),rand(this.rng,-13,13),rand(this.rng,-36,-18))),
        axis:randV(this.rng).norm(),phase:rand(this.rng,0,360),delay:rand(this.rng,0,.24),color:cellColor(i)};
    });
  }
  die() {
    this.runStats.deaths++;
    this.recoupling=[]; this.makeReassembly(); this.setState('death_dissolve'); this.damageTimer=999;
    this.emit('death'); this.messageSet('CUBICALLY DECOMMISSIONED',1.1);
  }
  win() {
    if(this.state!=='playing') return;
    this.recoupling=[]; this.completedLevel=this.level; this.lastEscape=this.player.alive.size;
    this.runStats.levelsCleared++;
    this.stats.best_escape=Math.max(this.stats.best_escape,this.lastEscape);
    this.score+=this.lastEscape*100; this.stats.best_score=Math.max(this.stats.best_score,this.score); this.persist();
    if(this.level>=BALANCE.levelCap) this.beginAscension(); else this.setState('portal_warp');
    this.emit('portal');
  }
  beginAscension(preview=false) {
    if(!preview&&['ascension','ascension_white','ascension_title','run_summary'].includes(this.state)) return;
    this.pendingIntroductions=[];
    this.runSummary=Object.freeze({...this.runStats,score:this.score,finalLevel:this.completedLevel||this.level,
      finalCubes:this.lastEscape||0,bestScore:this.stats.best_score,bestEscape:this.stats.best_escape});
    this.setState('ascension');
  }
  tick(dt,input={}) {
    if(this.paused) return;
    // Help suspends the simulation too, so debris and leg clocks cannot expire while reading.
    if(this.help) return;
    this.t+=dt; this.stateTime+=dt;
    this.angles=this.angles.map((v,i)=>(v+[7.5,13,4.5][i]*dt)%360);
    this.messageTime=Math.max(0,this.messageTime-dt); this.shake=Math.max(0,this.shake-dt);
    this.timeResetNotice=Math.max(0,this.timeResetNotice-dt);
    this.hitTime=Math.max(0,(this.hitTime||0)-dt); this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.state.startsWith('bonus_')) {this.tickBonus(dt,input);return;}
    if(['course_materialize','playing','reassembly_flash'].includes(this.state)) {this.updatePlayerSpin(dt);this.updateRotationShock(dt);}
    this.player.update(dt);
    for(const p of this.particles) { p.age+=dt; p.pos=p.pos.add(p.vel.mul(dt)); p.vel.y-=1.2*dt; }
    this.particles=this.particles.filter(p=>p.age<p.life).slice(-300);
    for(const p of this.impacts) p.age+=dt;
    this.impacts=this.impacts.filter(p=>p.age<.22).slice(-80);
    switch(this.state) {
      case 'opening_intro':
        if(this.stateTime>=OPENING_DURATION) {
          const phases=introductionsForLevel(this.level,this.flags.route3d,this.changeSettings,this.flags);
          this.openingTransition=true;this.pendingIntroductions=phases.slice(1);
          this.setState(phases[0]||'level_ready');
        } break;
      case 'level_ready':
        if(this.stateTime>=1.65) { this.setState('course_materialize'); this.emit('materialize'); } break;
      case 'space_intro': case 'time_intro': case 'entropy_intro': case 'heat_intro': case 'change_1_intro':
        if(this.stateTime>=5) {
          if(this.pendingIntroductions.length) this.setState(this.pendingIntroductions.shift());
          else this.ready(this.level);
        } break;
      case 'course_materialize':
        if(this.stateTime>=7) { this.resetLegClock(); this.setState('playing'); this.damageTimer=.45; } break;
      case 'playing': {
        this.runStats.playSeconds+=dt;
        if(this.recoupling.length) {
          this.recoupleTime+=dt;
          if(this.recoupleTime>=1.18) {
            const before=this.player.alive.size;
            for(const p of this.recoupling) this.player.alive.add(p.target);
            this.runStats.recoupledCubes+=this.player.alive.size-before;
            this.messageSet(`RE-COUPLED +${this.player.alive.size-before} CUBES`,.85); this.recoupling=[];
          }
        }
        this.move(dt,input);
        this.course.update(this.player.origin,this.t,(name,pos)=>{
          this.emit(name,pos);
          if(name==='collapse') for(let i=0;i<70;i++) this.particles.push({pos:pos.add(randV(this.rng,7)),vel:randV(this.rng,7),age:0,life:1.25,color:[.4,.8,1]});
        });
        if(this.particles.length>300)this.particles.splice(0,this.particles.length-300);
        const heat=this.thermal(dt);
        this.updateShutters(dt);
        if(this.difficulty.timed) {
          const loc=this.course.location(this.player.origin);
          if(loc.index>this.timedModule) { this.timedModule=loc.index; this.resetLegClock(); }
          else this.legTime=Math.max(0,this.legTime-dt);
          if(this.legTime<=0||this.course.collapsedSectionAt(this.player.origin)>=0) {
            this.player.alive.clear(); this.emit('collapse',this.player.origin); this.emit('laser_dissipate');
          }
        }
        this.damageTimer-=dt;
        if(this.damageTimer<=0&&this.player.alive.size) {
          const source=this.damage();
          if(source) this.damageTimer=.16/(source==='bounds'&&heat>0?1.15:1);
        }
        if(!this.player.alive.size) this.die();
        else if(this.flags.portal&&portalMetrics(this.course,this.player).ratio>=.985) this.win();
        break;
      }
      case 'death_dissolve':
        if(this.stateTime>=.48) { this.player.alive.clear(); this.player.fragments=[]; this.setState('reassembly'); this.emit('reassembly'); } break;
      case 'reassembly':
        if(this.stateTime>=3.75) { this.resetAttempt(); this.setState('reassembly_flash'); this.damageTimer=.7; } break;
      case 'reassembly_flash':
        if(this.stateTime>=1.1) { this.resetLegClock(); this.setState('playing'); this.damageTimer=.4; this.reassembly=[]; } break;
      case 'portal_warp':
        if(this.stateTime>=3.4) this.setState('result_overlay'); break;
      case 'result_overlay':
        if(this.stateTime>=4.25) this.advance(); break;
      case 'ascension':
        if(this.stateTime>=ASCENSION_TIMING.flySeconds) this.setState('ascension_white'); break;
      case 'ascension_white':
        if(this.stateTime>=ASCENSION_TIMING.whiteHoldSeconds) this.setState('ascension_title'); break;
    }
  }
  command(text) {
    const parts=text.trim().toLowerCase().split(/\s+/),[cmd,arg,value]=parts;
    const topLevelCommand=['toplevel','top_level'].includes(cmd);
    if(topLevelCommand) {
      if(parts.length===1)return `TOP LEVEL: ${this.stats.highest_level}/${BALANCE.levelCap}`;
      if(parts.length!==2||arg!=='reset')throw Error(`Usage: ${cmd} [reset]`);
    }
    if(cmd==='view_end_anim_v1'||cmd==='test'&&arg==='ending_1') { this.beginAscension(true); return 'End animation preview'; }
    if(cmd==='test'&&arg==='bonus_round_1'||cmd==='view_bonus_001'||cmd==='bonus') {
      this.startBonus(cmd==='bonus'?(arg||'001'):'001',{preview:true});return `Bonus round 001 test · exit to level ${this.previewReturn.nextLevel}`;
    }
    if(cmd==='test'&&arg==='change_1') {
      this.flags.change_1=true;this.flags.lasers=true;this.ready(Math.max(1,this.changeSettings.change_1_min_level));
      this.setState(CHANGES.change_1.state);return `CHANGE 1 test · level ${this.level}`;
    }
    if(cmd==='test')throw Error('Available previews: test ending_1, test bonus_round_1, test change_1');
    if(cmd==='reset'||topLevelCommand) {
      if(cmd==='reset'&&!['top level','top_level','toplevel','highest_level'].includes(parts.slice(1).join(' ')))
        throw Error('Usage: reset top level (aliases: reset top_level, reset toplevel, reset highest_level)');
      this.stats.highest_level=1;this.persist();
      return `Top level reset to 1/${BALANCE.levelCap}. Best score and best escape kept.`;
    }
    const trueValues=['1','on','true','enabled','yes'],falseValues=['0','off','false','disabled','no'];
    const bool=s=>{if(trueValues.includes(s)) return true; if(falseValues.includes(s)) return false; throw Error('Expected true/false, on/off, 1/0 or enabled/disabled');};
    const number=(s,min,max)=>{const n=Number(s); if(s===undefined||!Number.isFinite(n)) throw Error('Expected a number'); return clamp(Math.trunc(n),min,max);};
    const settings=new Map(Object.keys(this.flags).map(key=>[key,{
      get:()=>this.flags[key],set:v=>{
        this.flags[key]=v;
        if(key==='spin'&&!v)this.player.setSpinAngles(0,0,0);
        if(key==='microgravity')this.driftVelocity=new V();
        if(key==='rotation_shocks'&&!v) {this.rotationShock.angle=new V();this.rotationShock.velocity=new V();}
        if(key.startsWith('change_1'))this.shutters.restart();
        if(key==='route3d') {this.course=new Course(this.level,v);this.geometryVersion++;this.shutters.restart();}
      }
    }]));
    settings.set('locate',{get:()=>this.locate,set:v=>{this.locate=v;}});
    for(const [key,setting] of Object.entries(this.consoleSettings))settings.set(key,setting);
    const values=new Map([['level',()=>this.level],['score',()=>this.score],['cubes',()=>this.player.alive.size],['top_level',()=>this.stats.highest_level]]);
    const numeric=new Map(Object.keys(CHANGE_NUMBERS).map(key=>[key,{
      get:()=>this.changeSettings[key],set:value=>{const n=setChangeNumber(this.changeSettings,key,value);this.shutters.restart();return n;}
    }]));
    numeric.set('auto_locate_min_level',{get:()=>this.autoLocateMinLevel,set:value=>{
      const n=Number(value);if(value===undefined||!Number.isInteger(n)||n<0||n>1000000)throw Error('auto_locate_min_level expects an integer from 0 to 1000000');
      this.autoLocateMinLevel=n;return n;
    }});
    for(const [key,rule] of Object.entries(PREVIEW_NUMBERS))numeric.set(key,{get:()=>this.previewSettings[key],set:value=>{
      const n=Number(value);if(value===undefined||String(value).trim()===''||!Number.isFinite(n)||n<rule.min||n>rule.max||rule.integer&&!Number.isInteger(n))throw Error(`${key} expects ${rule.integer?'an integer':'a number'} from ${rule.min} to ${rule.max}`);
      this.previewSettings[key]=n;return n;
    }});
    for(const [key,setting] of numeric)values.set(key,setting.get);
    numeric.set('star_pattern',{get:()=>this.starPattern,set:value=>{
      const n=Number(value);if(value===undefined||!Number.isInteger(n)||n<0||n>2)throw Error('star_pattern expects 0, 1 or 2');
      this.starPattern=n;return n;
    }});
    values.set('star_pattern',()=>this.starPattern);
    for(const [key,setting] of Object.entries(this.consoleNumbers)){numeric.set(key,setting);values.set(key,setting.get);}
    const actions=new Set([...CONFIG_COMMANDS,'help','clear','cls','flags','reset','toplevel','restart','newrun','new','run','title','kill','heal','pos','where','route','test','bonus','view_end_anim_v1','view_bonus_001']);
    if(CONFIG_COMMANDS.includes(cmd)) {
      if(parts.length!==1)throw Error(`Usage: ${cmd}`);
      return describeConsoleConfig(settings,values);
    }
    const requireSetting=key=>{
      if(!key)throw Error(`Usage: ${cmd} <thing>${cmd==='set'?' [value]':''}`);
      if(settings.has(key)&&typeof settings.get(key).get()==='boolean')return settings.get(key);
      if(settings.has(key)||values.has(key)||actions.has(key))throw Error(`${key} cannot be toggled with on/off!`);
      throw Error(`${key} not found!`);
    };
    const status=key=>{
      if(values.has(key))return `Status for ${key} is: ${values.get(key)()}`;
      return `Status for ${key} is: ${requireSetting(key).get()?'Enabled':'Disabled'}`;
    };
    const setFlag=(key,v)=>{requireSetting(key).set(v);return `${key} set to ${v}`;};
    if(cmd==='help'||cmd==='?') return 'viewconfig / showconfig / showvars / viewvars / listvars / listconfig: list all settings\nhelp, clear, flags, toggle <thing>, set <thing> [value]\nStatus aliases: status <thing>, view <thing>, get <thing>, set <thing>\nValues: true/false, on/off, 1/0, enabled/disabled\nFlags: damage lasers bounds noclip portal suction route3d shake spin rotation_shocks portal_white_light culling microgravity overheat_blocks_recoupling change_1 change_1_random_per_leg change_1_no_repeat_leg locate'+(this.consoleSettings.mute?' mute':'')+'\nlevel <n> / set level <n>, restart, newrun, title, kill, heal, cubes <n>, portal, pos, route, score [n]\nNumbers: '+[...numeric.keys()].join(' ')+'\nRecords: toplevel / top_level (query); toplevel reset / top_level reset / reset top level (reset); keeps other records\nPreviews: test ending_1, test bonus_round_1, test change_1, bonus <type>';
    if(cmd==='flags')return [...settings.keys()].map(status).join('\n');
    if(['get','view','status'].includes(cmd)||['set','flag'].includes(cmd)&&value===undefined)return status(arg==='toplevel'?'top_level':arg);
    const numericKey=['set','flag'].includes(cmd)?arg:cmd;
    if(numeric.has(numericKey)) {
      const value=['set','flag'].includes(cmd)?parts[2]:arg;
      if(value===undefined)return status(numericKey);
      if(parts.length>(['set','flag'].includes(cmd)?3:2))throw Error(`Usage: set ${numericKey} <number>`);
      if([...trueValues,...falseValues].includes(value)&&!['0','1'].includes(value))throw Error(`${numericKey} cannot be toggled with on/off!`);
      return `${numericKey} set to ${numeric.get(numericKey).set(value)}`;
    }
    if(cmd==='level'||cmd==='set'&&arg==='level') {
      const target=cmd==='level'?arg:value;
      if([...trueValues,...falseValues].includes(target)&&!['0','1'].includes(target))throw Error('level cannot be toggled with on/off!');
      this.ready(number(target,1,1000000));return `Starting level ${this.level}`;
    }
    if(['set','flag','toggle'].includes(cmd)) {
      const setting=requireSetting(arg);
      if(parts.length>(cmd==='toggle'?2:3))throw Error(`Usage: ${cmd} <thing>${cmd==='toggle'?'':' <value>'}`);
      return setFlag(arg,cmd==='toggle'?!setting.get():bool(value));
    }
    // "portal" alone is the original teleport command, not the flag shortcut.
    if(settings.has(cmd)&&(cmd!=='portal'||arg))return setFlag(cmd,arg?bool(arg):!requireSetting(cmd).get());
    if(cmd==='restart') {this.ready(this.level); return 'Restarting current level';}
    if(['newrun','new','run'].includes(cmd)) {this.newRun(); return 'New run';}
    if(cmd==='title') {this.title(); return 'Title screen';}
    if(cmd==='kill') {this.player.alive.clear(); this.player.fragments=[]; return 'Cube killed';}
    if(cmd==='heal'||cmd==='cubes') {this.player.setCount(cmd==='heal'?125:number(arg,0,125)); return `Cubes: ${this.player.alive.size}`;}
    if(cmd==='portal') {this.player.origin=this.course.portal.world(15);this.driftVelocity=new V(); return 'Moved near portal';}
    if(cmd==='pos'||cmd==='where') return `Position ${this.player.origin.array().map(n=>n.toFixed(2)).join(', ')}\nLeg ${this.course.location(this.player.origin).index+1}/${this.course.modules.length}`;
    if(cmd==='route') return this.course.modules.map(m=>m.bx.array().join(',')).join(' → ');
    if(cmd==='score') {if(arg!==undefined) this.score=number(arg,0,Number.MAX_SAFE_INTEGER); return `Score: ${this.score}`;}
    throw Error('Unknown command. Type help.');
  }
}
