// Numbered mechanic changes: keep each change's identity, banner and defaults here.
export const CHANGES=Object.freeze({
  change_1:Object.freeze({banner:'CHANGE ...',state:'change_1_intro',
    description:'THE LASERS NOW OPEN AND CLOSE',detail:'PASS THROUGH WHILE THEY ARE OPEN',
    enabled:true,randomPerLeg:true,noRepeatLeg:true}),
});
export const CHANGE_NUMBERS=Object.freeze({
  change_1_min_level:{value:7,min:0,max:50,integer:true},
  change_1_interval:{value:4,min:.5,max:60},
  change_1_closed_seconds:{value:.8,min:.05,max:30},
  change_1_warning_seconds:{value:.4,min:0,max:10},
  change_1_damage_fraction:{value:.5,min:0,max:1},
  change_1_damage_cooldown:{value:1.5,min:0,max:30},
  change_1_gates_per_leg:{value:0,min:0,max:5,integer:true}, // 0: use the level-based ramp.
  change_1_start_gates:{value:1,min:1,max:5,integer:true},
  change_1_max_gates:{value:4,min:1,max:5,integer:true},
  change_1_ramp_end_level:{value:50,min:1,max:50,integer:true},
  change_1_gate_cooldown:{value:1.2,min:0,max:60}, // Minimum open rest before the next warning.
  change_1_max_simultaneous:{value:2,min:1,max:5,integer:true},
});
export const createChangeSettings=()=>Object.fromEntries(Object.entries(CHANGE_NUMBERS).map(([k,v])=>[k,v.value]));
export function setChangeNumber(settings,key,value) {
  const rule=Object.hasOwn(CHANGE_NUMBERS,key)?CHANGE_NUMBERS[key]:null,n=Number(value);
  if(!rule)throw Error(`${key} not found!`);
  if(value===undefined||String(value).trim()===''||!Number.isFinite(n)||n<rule.min||n>rule.max||rule.integer&&!Number.isInteger(n))
    throw Error(`${key} expects ${rule.integer?'an integer':'a number'} from ${rule.min} to ${rule.max}`);
  const candidate={...settings,[key]:n};
  if(candidate.change_1_closed_seconds+candidate.change_1_warning_seconds>=candidate.change_1_interval)
    throw Error('Closed duration plus warning must be shorter than the shutter interval');
  if(candidate.change_1_start_gates>candidate.change_1_max_gates)throw Error('Starting shutter count cannot exceed the maximum count');
  if(candidate.change_1_ramp_end_level<Math.max(1,candidate.change_1_min_level))throw Error('Shutter ramp endpoint cannot precede its introduction level');
  settings[key]=n;return n;
}
export const shutterEnabled=(level,flags,settings)=>Boolean(flags.change_1&&flags.lasers&&
  (settings.change_1_min_level===0||level>=settings.change_1_min_level));
export const shutterLoss=(count,fraction)=>Math.min(Math.max(0,count-1),Math.floor(count*fraction));
export const shutterInterval=settings=>Math.max(settings.change_1_interval,
  settings.change_1_closed_seconds+settings.change_1_warning_seconds+settings.change_1_gate_cooldown);
export function shutterGateCount(level,settings,total=5) {
  if(level<Math.max(1,settings.change_1_min_level))return 0;
  if(settings.change_1_gates_per_leg>0)return Math.min(total,settings.change_1_gates_per_leg);
  const start=Math.max(1,settings.change_1_min_level),end=settings.change_1_ramp_end_level;
  const progress=end<=start?1:Math.max(0,Math.min(1,(level-start)/(end-start)));
  return Math.min(total,settings.change_1_start_gates+Math.floor((settings.change_1_max_gates-settings.change_1_start_gates)*progress+1e-10));
}

export class Shutters {
  constructor(rng=Math.random) {this.seed=rng();this.restart();}
  restart() {
    this.time=0;this.immunity=0;this.contacts=new Map();this.plans=new Map();
    this.pulse=null;this.lastLeg=null;this.serial=0;this.nextWarningAt=null;
  }
  tick(dt) {this.time+=dt;this.immunity=Math.max(0,this.immunity-dt);}
  rank(leg,gate=0,round=0) {return ((Math.sin((leg+1)*127.1+(gate+1)*78.233+this.seed*311.7+round*39.425)*43758.5453)%1+1)%1;}
  selectedGates(leg,total,level,settings,randomPerLeg=true) {
    const count=shutterGateCount(level,settings,total),key=`${leg}:${total}:${count}:${randomPerLeg}`;
    if(!this.plans.has(key)) {
      const gates=Array.from({length:total},(_,i)=>i);
      if(randomPerLeg)gates.sort((a,b)=>this.rank(leg,a)-this.rank(leg,b));
      this.plans.set(key,gates.slice(0,count));
    }
    return this.plans.get(key);
  }
  schedule(legs,level,settings,randomPerLeg=true,noRepeatLeg=true) {
    // One global pulse owns one nearby revealed leg. The simultaneous cap applies
    // across the whole active scene, not separately to several overlapping legs.
    const events=[],interval=shutterInterval(settings),warning=settings.change_1_warning_seconds,closed=settings.change_1_closed_seconds;
    if(this.nextWarningAt===null)this.nextWarningAt=interval-warning-closed;
    if(this.pulse&&!legs.has(this.pulse.leg)) {
      // Culling/collapse may remove a pending or active pulse. Preserve its rest
      // budget so visibility changes cannot produce back-to-back closures.
      this.nextWarningAt=Math.max(this.nextWarningAt,this.pulse.warnsAt+interval);
      this.pulse=null;
    }
    if(this.pulse&&this.time>=this.pulse.closesAt&&!this.pulse.started) {
      this.pulse.started=true;this.lastLeg=this.pulse.leg;events.push({name:'shutter_close',...this.pulse});
    }
    if(this.pulse&&this.time>=this.pulse.opensAt) {
      if(this.pulse.started)events.push({name:'shutter_open',...this.pulse});
      this.nextWarningAt=this.pulse.warnsAt+interval;this.pulse=null;
    }
    if(!this.pulse) {
      const eligible=[...legs.keys()].filter(leg=>(!noRepeatLeg||leg!==this.lastLeg)&&shutterGateCount(level,settings,legs.get(leg))>0);
      if(eligible.length) {
        eligible.sort(randomPerLeg?(a,b)=>this.rank(a,0,this.serial)-this.rank(b,0,this.serial):(a,b)=>a-b);
        const leg=eligible[0],pool=[...this.selectedGates(leg,legs.get(leg),level,settings,randomPerLeg)];
        if(randomPerLeg)pool.sort((a,b)=>this.rank(leg,a,this.serial+1)-this.rank(leg,b,this.serial+1));
        else {const rotate=this.serial%pool.length;pool.push(...pool.splice(0,rotate));}
        const warnsAt=Math.max(this.time,this.nextWarningAt);
        this.pulse={leg,gates:pool.slice(0,settings.change_1_max_simultaneous),warnsAt,closesAt:warnsAt+warning,
          opensAt:warnsAt+warning+closed,serial:this.serial++,started:false};
      }
      // With no alternative visible leg, wait. Never invent a remote hazard or
      // immediately repeat the previous leg to keep the clock moving.
    }
    // A zero-warning setting may begin immediately on this same frame.
    if(this.pulse&&!this.pulse.started&&this.time>=this.pulse.closesAt) {
      this.pulse.started=true;this.lastLeg=this.pulse.leg;events.push({name:'shutter_close',...this.pulse});
    }
    return events;
  }
  stateFor(leg,gate,time=this.time) {
    const p=this.pulse;if(!p||p.leg!==leg||!p.gates.includes(gate))return null;
    const closed=time>=p.closesAt&&time<p.opensAt,warning=time>=p.warnsAt&&time<p.closesAt;
    return {closed,warning,cycle:p.serial,charge:closed?1:warning?(time-p.warnsAt)/(p.closesAt-p.warnsAt):0,
      untilChange:closed?p.opensAt-time:Math.max(0,p.closesAt-time)};
  }
}
