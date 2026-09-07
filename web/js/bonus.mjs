// Bonus modes have their own arena, clock and rules. No corridor dependencies.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const BONUS_SCHEDULE=Object.freeze({firstLevel:5,interval:5,types:Object.freeze(['001'])});
export const PIECES_RULES=Object.freeze({
  seconds:45,pointsPerPiece:100,pieces:124,introSeconds:5,smashSeconds:3.6,impactAt:.9,
  speed:6,rushSpeed:10,floorHalfWidth:24,floorNearZ:22,floorFarZ:-14,
  rampHalfWidth:7,rampEndZ:-26,rampHeight:6,landingEndZ:-36,portalZ:-29,
  spawnX:0,spawnZ:12,
  warningSeconds:5,explosionSeconds:2,explosionFadeStarts:.7,
});
export function bonusHeat(timeLeft) {
  if(timeLeft>PIECES_RULES.warningSeconds)return 0;
  const t=clamp(1-timeLeft/PIECES_RULES.warningSeconds);
  return .2+.8*t*t*(3-2*t);
}
export function scheduledBonus(level,cap,schedule=BONUS_SCHEDULE,beforeFinal=false) {
  if(beforeFinal&&level===cap-1&&level>=schedule.firstLevel)return schedule.types[0]??null;
  if(level<schedule.firstLevel||level>=cap||(level-schedule.firstLevel)%schedule.interval!==0) return null;
  return schedule.types[((level-schedule.firstLevel)/schedule.interval)%schedule.types.length]??null;
}
export const multiplyQ=(a,b)=>[
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2],
];
export function rotateQ(p,q) {
  const [x,y,z]=p,[a,b,c,w]=q,tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);
  return [x+w*tx+b*tz-c*ty,y+w*ty+c*tx-a*tz,z+w*tz+a*ty-b*tx];
}
const shapes=new Map();
export function recoveredShape(count) {
  if(!shapes.has(count)) {
    const side=Math.ceil(Math.cbrt(count)),all=[];
    for(let y=0;y<side;y++)for(let z=0;z<side;z++)for(let x=0;x<side;x++)all.push([x-(side-1)/2,y-(side-1)/2,z-(side-1)/2]);
    // Adjacent layers keep every recovered piece connected to the body.
    shapes.set(count,all.slice(0,count));
  }
  return shapes.get(count);
}

export class PickingUpThePieces {
  constructor({rng=Math.random,seconds=PIECES_RULES.seconds}={}) {
    this.rules=PIECES_RULES;this.id='001';this.name='PICKING UP THE PIECES';
    this.duration=clamp(seconds,1,600);this.timeLeft=this.duration;this.elapsed=0;
    this.x=this.rules.spawnX;this.z=this.rules.spawnZ;this.y=.46;
    this.orientation=[0,0,0,1];this.restOrientation=[0,0,0,1];this.roll=null;
    this.collected=0;this.bodyCount=1;this.result=null;this.pickupFlashes=[];this.explosion=[];
    // Stratified scattering keeps every seed distributed across the solid floor.
    this.pieces=Array.from({length:this.rules.pieces},(_,i)=>({
      id:i,collected:false,x:-21+(i%12+.15+rng()*.7)*3.5,
      z:-11+(Math.floor(i/12)+.15+rng()*.7)*2.65,
      arc:4+rng()*8,spin:(rng()-.5)*900,
    }));
    // One piece lies directly ahead to teach collection before the wider search.
    Object.assign(this.pieces[0],{x:this.x,z:this.z-2});
  }
  get potentialScore() {return this.collected*this.rules.pointsPerPiece;}
  get side() {return Math.ceil(Math.cbrt(this.bodyCount));}
  ground(x,z) {
    const r=this.rules;
    return Math.abs(x)<=r.rampHalfWidth?clamp((r.floorFarZ-z)/(r.floorFarZ-r.rampEndZ))*r.rampHeight:0;
  }
  validCenter(x,z,side=this.side) {
    const r=this.rules,margin=side*.72;
    if(Math.abs(x)>r.floorHalfWidth-margin||z>r.floorNearZ-margin||z<r.landingEndZ+margin)return false;
    // The far edge is closed except at the ramp. No invisible corridor floor.
    return z>=r.floorFarZ+margin||Math.abs(x)<=r.rampHalfWidth-margin;
  }
  supportHeight() {
    let support=-Infinity;
    for(const p of recoveredShape(this.bodyCount))for(const dx of [-.46,.46])for(const dy of [-.46,.46])for(const dz of [-.46,.46]) {
      const v=rotateQ([p[0]+dx,p[1]+dy,p[2]+dz],this.orientation);
      support=Math.max(support,this.ground(this.x+v[0],this.z+v[2])-v[1]);
    }
    return support;
  }
  collect() {
    const radius=.72+this.side*.55;
    let count=0;
    for(const p of this.pieces)if(!p.collected&&Math.hypot(p.x-this.x,p.z-this.z)<=radius) {
      p.collected=true;this.collected++;count++;this.pickupFlashes.push({x:p.x,z:p.z,age:0});
    }
    return count;
  }
  update(dt,input={}) {
    if(this.result)return {picked:0};
    dt=Math.max(0,Math.min(dt,this.timeLeft));this.timeLeft=Math.max(0,this.timeLeft-dt);this.elapsed+=dt;
    for(const p of this.pickupFlashes)p.age+=dt;
    this.pickupFlashes=this.pickupFlashes.filter(p=>p.age<.45);
    let left=dt,picked=0;
    while(left>1e-9) {
      if(!this.roll) {
        this.bodyCount=1+this.collected;
        const x=Math.sign(input.x||0),z=Math.sign(input.z||0);
        // One edge at a time. A held second key takes effect on the next roll.
        const dx=Math.abs(input.x||0)>Math.abs(input.z||0)?x:z?0:x,dz=dx?0:z;
        if(!dx&&!dz)break;
        const width=this.side-.08;
        // Absorption happens before the roll completes. Do not let the back
        // edge reject a roll whose path reaches the portal while still on land.
        const entersPortal=dz<0&&this.z>this.rules.portalZ&&this.z-width<=this.rules.portalZ&&this.validCenter(this.x,this.rules.portalZ);
        if(!this.validCenter(this.x+dx*width,this.z+dz*width)&&!entersPortal)break;
        this.roll={x:this.x,z:this.z,dx,dz,width,angle:0};
      }
      const roll=this.roll,speed=input.rush?this.rules.rushSpeed:this.rules.speed;
      const used=Math.min(left,(Math.PI/2-roll.angle)*roll.width/(speed*Math.PI/2));
      roll.angle=Math.min(Math.PI/2,roll.angle+used*speed*Math.PI/2/roll.width);left-=used;
      const distance=roll.width/2*(1-Math.cos(roll.angle)+Math.sin(roll.angle));
      this.x=roll.x+roll.dx*distance;this.z=roll.z+roll.dz*distance;
      const sin=Math.sin(roll.angle/2),stepQ=[roll.dz*sin,0,-roll.dx*sin,Math.cos(roll.angle/2)];
      this.orientation=multiplyQ(stepQ,this.restOrientation);
      picked+=this.collect();
      if(this.z<=this.rules.portalZ&&this.validCenter(this.x,this.rules.portalZ)) {this.result='escaped';break;}
      if(roll.angle>=Math.PI/2-1e-9) {
        const length=Math.hypot(...this.orientation);
        this.orientation=this.orientation.map(v=>v/length);this.restOrientation=[...this.orientation];
        this.roll=null;
      }
    }
    picked+=this.collect();
    if(!this.roll)this.bodyCount=1+this.collected;
    // Grow away from the outside edges so collecting cannot trap the larger body.
    const margin=this.side*.72,r=this.rules;
    this.x=clamp(this.x,-r.floorHalfWidth+margin,r.floorHalfWidth-margin);
    this.z=Math.min(this.z,r.floorNearZ-margin);
    if(this.z<r.floorFarZ+margin)this.x=clamp(this.x,-r.rampHalfWidth+margin,r.rampHalfWidth-margin);
    this.y=this.supportHeight();
    if(this.z<=r.portalZ&&Math.abs(this.x)<=r.rampHalfWidth-margin)this.result='escaped';
    else if(this.timeLeft<=0)this.result='timeout';
    return {picked};
  }
}

// Add future types here, then include their IDs in BONUS_SCHEDULE.types.
export const BONUS_TYPES=Object.freeze({'001':Object.freeze({name:'PICKING UP THE PIECES',create:options=>new PickingUpThePieces(options)})});
export function createBonus(id,options) {
  const type=BONUS_TYPES[id];
  if(!type)throw Error(`Unknown bonus type: ${id}. Available: ${Object.keys(BONUS_TYPES).join(', ')}`);
  return type.create(options);
}
