// Cube Libre: browser-independent simulation, ported from cube_libre_pygame.py.
// Rendering, audio, persistence and input are injected by the browser adapter.
import { C,VISUAL_EFFECTS,PLAYER_ROTATION } from './config.mjs';
import {BONUS_SCHEDULE,createBonus,scheduledBonus,recoveredShape,rotateQ} from './bonus.mjs';
import { BALANCE,difficultyForLevel,introductionsForLevel } from './difficulty.mjs';
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
  flySeconds: 4.8, fadeStarts: 1.8, fadeSeconds: 3,
  whiteHoldSeconds: 2, titleFadeSeconds: 1.4,
  subtitleStarts: .9, subtitleFadeSeconds: 1.2, continueAfter: 2.3,
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
  reset() { this.origin=V.of(C.START_ORIGIN); this.alive=new Set(cells.map((_,i)=>i)); this.fragments=[]; this.setSpinAngle(0); }
  setSpinAngle(degrees) {
    this.spinAngle=((degrees%360)+360)%360;
    // Cache this pair once per tick, instead of repeating trig for each collision.
    this.spinCos=Math.cos(radians(this.spinAngle));this.spinSin=Math.sin(radians(this.spinAngle));
  }
  pos(i) {
    const [x,y,z]=cells[i],c=this.spinCos,s=this.spinSin,spacing=C.CELL_SPACING;
    return new V(this.origin.x+(x*c+z*s)*spacing,this.origin.y+y*spacing,this.origin.z+(z*c-x*s)*spacing);
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
    const preferred=(route3d && i+1>=3 ? C.COURSE_ROUTE_3D_SPINE:C.COURSE_ROUTE_2D_SPINE);
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
}

export class Course {
  constructor(level,route3d=true) {
    this.level=level; this.modules=[]; let start=new V(-23,0,0);
    for(const d of routeDirections(Math.min(7,level),route3d)) {
      const m=new Module(this.modules.length,start,d); this.modules.push(m); start=m.end();
    }
    this.portal=this.modules.at(-1);
    this.joints=this.modules.slice(0,-1).map((m,i)=>({center:m.end(),open:[m.bx.mul(-1).array(),this.modules[i+1].bx.array()]}));
    this.lasers=this.modules.flatMap(m=>laserTemplates.map(t=>new Laser(t,m,level)));
    this.revealed=new Map(level<3?this.modules.map(m=>[m.index,-9999]):[[0,-9999]]);
    this.collapsed=new Map();
    const pts=[];
    for(const m of this.modules) for(const x of this.span(m)) for(const y of [-7,7]) for(const z of [-7,7]) pts.push(m.world(x,y,z));
    for(const j of this.joints) for(const x of [-7,7]) for(const y of [-7,7]) for(const z of [-7,7]) pts.push(j.center.add(new V(x,y,z)));
    this.bounds=[...['x','y','z'].flatMap(k=>[Math.min(...pts.map(p=>p[k])),Math.max(...pts.map(p=>p[k]))])];
    const b=this.bounds; this.center=new V((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2);
    this.zoom=Math.min(120,48+Math.max(0,Math.max(b[1]-b[0],b[3]-b[2],b[5]-b[4])-46)*.38);
  }
  span(m,pad=0) { return [-23+(m.index>0?7:0)-pad,23-(m.index<this.modules.length-1?7:0)+pad]; }
  jointAt(p,pad=0) { return this.joints.findIndex(j=>p.sub(j.center).array().every(x=>Math.abs(x)<=7+pad)); }
  inside(p,pad=0) {
    return this.modules.some(m=>{const l=m.local(p),[a,b]=this.span(m,pad);
      return l.x>=a&&l.x<=b&&Math.abs(l.y)<=7+pad&&Math.abs(l.z)<=7+pad;
    }) || this.jointAt(p,pad)>=0;
  }
  location(p) {
    let index=0,x=-23,score=-Infinity;
    for(const m of this.modules) {
      const l=m.local(p);
      if(Math.abs(l.z)>14 || Math.abs(l.y)>14 || l.x< -30 || l.x>30) continue;
      const lx=clamp(l.x,-23,23),s=m.index*1000+lx;
      if(s>score) { index=m.index; x=lx; score=s; }
    }
    return {index,x};
  }
  revealIndex(p) {
    if(this.level<3) return this.modules.length-1;
    const j=this.jointAt(p,1.2);
    return j>=0?Math.min(this.modules.length-1,j+1):this.location(p).index;
  }
  revealProgress(i,t) { const start=this.revealed.get(i); return start===undefined?0:smooth((t-start)/1.45); }
  distanceFade(i,p) {
    const {index,x}=this.location(p),collapse=i+2;
    if(index<collapse) return 0;
    if(index>collapse) return 1;
    return smooth((x-(-23+.35))/C.TRAIL_FADE_DISTANCE);
  }
  fade(i,p,t) { return Math.max(this.distanceFade(i,p),this.collapsed.has(i)?smooth((t-this.collapsed.get(i))/1.25):0); }
  activeLaser(l,p,t) {
    const i=l.module.index,{index}=this.location(p);
    if(this.level>=3 && (i<index-1||i>index+2||i>this.revealIndex(p))) return false;
    const hardCulled=this.level>=3&&i<index&&this.collapsed.has(i)&&t-this.collapsed.get(i)>=1.25;
    return !hardCulled && this.revealProgress(i,t)>=.78 && this.distanceFade(i,p)<.98;
  }
  update(p,t,emit) {
    for(let i=0;i<=this.revealIndex(p);i++) if(!this.revealed.has(i)) {
      this.revealed.set(i,t); emit('laser_reveal',this.modules[i].start);
    }
    const {index}=this.location(p);
    for(let i=0;i<=index-2;i++) if(!this.collapsed.has(i)&&this.distanceFade(i,p)>=.04) {
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
    this.flags={...C.DEBUG_FLAGS,shake:VISUAL_EFFECTS.shakingEnabled,spin:PLAYER_ROTATION.enabled}; this.player=new Player(rng); this.t=0; this.angles=[0,0,0];
    this.level=1; this.score=0; this.locate=false; this.paused=false; this.help=false; this.events=[]; this.pendingIntroductions=[];
    this.runStats={playSeconds:0,deaths:0,recoupledCubes:0,levelsCleared:0,bonusRounds:0,bonusPieces:0,bonusScore:0}; this.runSummary=null;
    this.bonusesPlayedAfter=new Set();this.bonus=null;this.previewReturn=null;
    this.state='title'; this.stateTime=0; this.message=''; this.messageTime=0; this.resetAttempt();
  }
  emit(name,pos) { this.events.push({name,pos}); }
  persist() { this.save({...this.stats}); }
  messageSet(text,time=1.6) { this.message=text; this.messageTime=time; }
  setState(s) { this.state=s; this.stateTime=0; }
  get difficulty() { return difficultyForLevel(this.level); }
  resetLegClock() {
    this.legTime=this.difficulty.secondsPerLeg;
    this.timeResetNotice=this.difficulty.timed?1.6:0;
  }
  resetAttempt() {
    this.player.reset(); this.course=new Course(this.level,this.flags.route3d); this.geometryVersion=(this.geometryVersion||0)+1;
    this.damageTimer=.45; this.legTime=this.difficulty.secondsPerLeg; this.timedModule=0; this.timeResetNotice=0;
    this.outsideTime=0; this.heat=0; this.lastHeat=0; this.coolTime=0; this.cool=0;
    this.recoupling=[]; this.recoupleTime=0; this.requests=[]; this.cooldown=0;
    this.particles=[]; this.impacts=[]; this.shake=0; this.outside=false;
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
    const phases=introductionsForLevel(target,this.flags.route3d);
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
    if(!this.recoupling.length&&!this.player.fragments.some(f=>f.age<7.95)) { this.messageSet('NO RECOVERABLE LOOSE CELLS',.75); return; }
    this.requests=this.requests.filter(t=>t>=this.t-10);
    if(this.requests.length>=5) { this.cooldown=Math.max(0,this.requests[0]+10-this.t); this.messageSet('RE-COUPLING ON COOLDOWN',1.45); return; }
    this.requests.push(this.t);
    if(this.recoupling.length) { this.messageSet('RE-COUPLING ALREADY ACTIVE',.55); return; }
    this.recoupling=beginRecouple(this.player,this.level); this.recoupleTime=0;
    if(this.recoupling.length) { this.emit('recouple'); this.messageSet(`RE-COUPLING REQUESTED: ${this.recoupling.length} CELLS`); }
  }
  move(dt,input) {
    const step=6*(input.rush?2.6:1)*dt;
    this.player.origin=this.player.origin.add(new V(clamp(input.x||0,-1,1),clamp(input.y||0,-1,1),clamp(input.z||0,-1,1)).mul(step));
    if(this.flags.suction) suction(this.course,this.player,dt);
    if(!this.flags.noclip) {
      const b=this.course.bounds,p=this.player.origin;
      p.x=clamp(p.x,b[0]-5,b[1]+5); p.y=clamp(p.y,b[2]-5,b[3]+5); p.z=clamp(p.z,b[4]-5,b[5]+5);
    }
  }
  updatePlayerSpin(dt) {
    const p=this.player;
    if(!this.flags.spin) {if(p.spinAngle!==0)p.setSpinAngle(0);return;}
    p.setSpinAngle(p.spinAngle+PLAYER_ROTATION.degreesPerSecond*dt);
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
  damage() {
    if(!this.flags.damage) return null;
    const p=this.player,candidates=[];
    if(this.flags.lasers) {
      const active=this.course.lasers.filter(l=>this.course.activeLaser(l,p.origin,this.t));
      for(const i of p.alive) for(const l of active) if(this.course.jointAt(p.pos(i))<0&&l.hits(p.pos(i),this.t)) {
        const v=l.local(p.pos(i),this.t); candidates.push({i,l,exposure:Math.abs(v.x)+.04*(Math.abs(v.y)+Math.abs(v.z))}); break;
      }
    }
    let type='laser'; candidates.sort((a,b)=>a.exposure-b.exposure);
    if(!candidates.length&&this.flags.bounds&&!this.flags.noclip) {
      type='bounds'; for(const i of p.alive) if(!this.course.inside(p.pos(i),.25)) candidates.push({i,l:null});
    }
    let destroyed=0;
    for(const {i,l} of candidates.slice(0,2)) {
      const pos=p.pos(i);
      if(p.destroy(i,l?l.center:p.origin,this.heat)) {
        destroyed++; this.impacts.push({pos,age:0,type,laser:l});
        for(let k=0;k<8;k++) this.particles.push({pos,vel:randV(this.rng,7),age:0,life:.3,color:type==='laser'?[1,.12,.05]:[.35,.8,1]});
      }
    }
    if(destroyed) {
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
    if(['course_materialize','playing','reassembly_flash'].includes(this.state))this.updatePlayerSpin(dt);
    this.player.update(dt);
    for(const p of this.particles) { p.age+=dt; p.pos=p.pos.add(p.vel.mul(dt)); p.vel.y-=1.2*dt; }
    this.particles=this.particles.filter(p=>p.age<p.life).slice(-300);
    for(const p of this.impacts) p.age+=dt;
    this.impacts=this.impacts.filter(p=>p.age<.22).slice(-80);
    switch(this.state) {
      case 'opening_intro':
        if(this.stateTime>=OPENING_DURATION) { this.openingTransition=true; this.setState('level_ready'); } break;
      case 'level_ready':
        if(this.stateTime>=1.65) { this.setState('course_materialize'); this.emit('materialize'); } break;
      case 'space_intro': case 'time_intro': case 'entropy_intro': case 'heat_intro':
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
        const heat=this.thermal(dt);
        if(this.difficulty.timed) {
          const loc=this.course.location(this.player.origin),j=this.course.jointAt(this.player.origin,.46);
          if(loc.index>this.timedModule) { this.timedModule=loc.index; this.resetLegClock(); }
          else this.legTime=Math.max(0,this.legTime-dt);
          if(this.legTime<=0||this.course.collapsed.has(loc.index)||(j>=0&&this.course.collapsed.has(j))) {
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
    if(cmd==='view_end_anim_v1'||cmd==='test'&&arg==='ending_1') { this.beginAscension(true); return 'End animation preview'; }
    if(cmd==='test'&&arg==='bonus_round_1'||cmd==='view_bonus_001'||cmd==='bonus') {
      this.startBonus(cmd==='bonus'?(arg||'001'):'001',{preview:true});return `Bonus round 001 test · exit to level ${this.previewReturn.nextLevel}`;
    }
    if(cmd==='test')throw Error('Available previews: test ending_1, test bonus_round_1');
    const bool=s=>{if(['1','on','true','yes'].includes(s)) return true; if(['0','off','false','no'].includes(s)) return false; throw Error('Expected on or off');};
    const number=(s,min,max)=>{const n=Number(s); if(s===undefined||!Number.isFinite(n)) throw Error('Expected a number'); return clamp(Math.trunc(n),min,max);};
    const setFlag=(key,v)=>{if(!(key in this.flags)) throw Error(`Unknown flag: ${key}`); this.flags[key]=v;
      if(key==='spin'&&!v)this.player.setSpinAngle(0);
      if(key==='route3d') { this.course=new Course(this.level,v); this.geometryVersion++; } return `${key} = ${v?'on':'off'}`;};
    if(cmd==='help'||cmd==='?') return 'help, clear, flags, get <flag>, set <flag> <on|off>, toggle <flag>\nFlags: damage lasers bounds noclip portal suction route3d shake spin\nlevel <n>, restart, newrun, title, kill, heal, cubes <n>, portal, pos, route, score [n], locate <on|off>\nPreviews: test ending_1, test bonus_round_1, bonus <type>';
    if(cmd==='flags') return Object.entries(this.flags).map(([k,v])=>`${k} = ${v?'on':'off'}`).join('\n');
    if(cmd==='get') {if(!(arg in this.flags)) throw Error('Unknown flag'); return `${arg} = ${this.flags[arg]?'on':'off'}`;}
    if(['set','flag','toggle'].includes(cmd)) return setFlag(arg,cmd==='toggle'?!this.flags[arg]:bool(value));
    // "portal" alone is the original teleport command, not the flag shortcut.
    if(cmd in this.flags && (cmd!=='portal'||arg)) return setFlag(cmd,arg?bool(arg):!this.flags[cmd]);
    if(cmd==='level') { this.ready(number(arg,1,1000000)); return `Starting level ${this.level}`; }
    if(cmd==='restart') {this.ready(this.level); return 'Restarting current level';}
    if(['newrun','new','run'].includes(cmd)) {this.newRun(); return 'New run';}
    if(cmd==='title') {this.title(); return 'Title screen';}
    if(cmd==='kill') {this.player.alive.clear(); this.player.fragments=[]; return 'Cube killed';}
    if(cmd==='heal'||cmd==='cubes') {this.player.setCount(cmd==='heal'?125:number(arg,0,125)); return `Cubes: ${this.player.alive.size}`;}
    if(cmd==='portal') {this.player.origin=this.course.portal.world(15); return 'Moved near portal';}
    if(cmd==='pos'||cmd==='where') return `Position ${this.player.origin.array().map(n=>n.toFixed(2)).join(', ')}\nLeg ${this.course.location(this.player.origin).index+1}/${this.course.modules.length}`;
    if(cmd==='route') return this.course.modules.map(m=>m.bx.array().join(',')).join(' → ');
    if(cmd==='score') {if(arg!==undefined) this.score=number(arg,0,Number.MAX_SAFE_INTEGER); return `Score: ${this.score}`;}
    if(cmd==='locate') {this.locate=arg?bool(arg):!this.locate; return `Locate: ${this.locate?'on':'off'}`;}
    throw Error('Unknown command. Type help.');
  }
}
