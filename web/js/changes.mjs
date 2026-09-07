// Numbered mechanic changes. Thresholds, timings and pitches share the console registry.
export const CHANGES=Object.freeze({
  change_1:Object.freeze({banner:'CHANGE ...',state:'change_1_intro',count:1,
    description:'THE LASERS NOW OPEN AND CLOSE',detail:'WATCH THE WARNING. PASS WHILE OPEN.',
    enabled:true,randomPerLeg:true,noRepeatLeg:true}),
  change_2:Object.freeze({banner:'CHANGE ...',state:'change_2_intro',count:2,
    description:'TWO GATES. ONE AFTER ANOTHER.',detail:'A DIFFERENT GATE ANSWERS THE FIRST.',enabled:true}),
  change_3:Object.freeze({banner:'CHANGE ...',state:'change_3_intro',count:3,
    description:'NOW THERE ARE THREE.',detail:'LISTEN FOR THE THIRD ZAP.',enabled:true}),
  change_4:Object.freeze({banner:'CHANGE ...',state:'change_4_intro',count:4,
    description:'FOUR GATES. A PATTERN EMERGES.',detail:'INNER. FAR END. OTHER END. OTHER INNER.',enabled:true}),
});
export const CHANGE_NUMBERS=Object.freeze({
  change_1_min_level:{value:4,min:0,max:50,integer:true},
  change_2_min_level:{value:6,min:0,max:50,integer:true},
  change_3_min_level:{value:7,min:0,max:50,integer:true},
  change_4_min_level:{value:8,min:0,max:50,integer:true},
  change_1_interval:{value:4,min:.5,max:60}, // Between the last zap of one sequence and the next sequence's first.
  change_1_step_seconds:{value:2,min:.5,max:60}, // Between zap starts inside a sequence.
  change_1_closed_seconds:{value:.8,min:.05,max:30},
  change_1_warning_seconds:{value:.4,min:0,max:10},
  change_1_damage_fraction:{value:.5,min:0,max:1},
  change_1_damage_cooldown:{value:1.5,min:0,max:30},
  change_1_gates_per_leg:{value:0,min:0,max:5,integer:true}, // 0: staged progression, 1–5: override sequence length.
  change_1_gate_cooldown:{value:.8,min:0,max:60}, // Open rest before the next gate's warning.
  ...Object.fromEntries([0,-3,3,7,-7].map((value,i)=>[`change_1_pitch_${i+1}`,{value,min:-12,max:12}])),
});
export const createChangeSettings=()=>Object.fromEntries(Object.entries(CHANGE_NUMBERS).map(([k,v])=>[k,v.value]));
export function setChangeNumber(settings,key,value) {
  const rule=Object.hasOwn(CHANGE_NUMBERS,key)?CHANGE_NUMBERS[key]:null,n=Number(value);
  if(!rule)throw Error(`${key} not found!`);
  if(value===undefined||String(value).trim()===''||!Number.isFinite(n)||n<rule.min||n>rule.max||rule.integer&&!Number.isInteger(n))
    throw Error(`${key} expects ${rule.integer?'an integer':'a number'} from ${rule.min} to ${rule.max}`);
  const candidate={...settings,[key]:n};
  for(const interval of ['change_1_interval','change_1_step_seconds'])
    if(candidate.change_1_closed_seconds+candidate.change_1_warning_seconds>=candidate[interval])
      throw Error(`Closed duration plus warning must be shorter than ${interval}`);
  settings[key]=n;return n;
}
export const changeLevel=(id,settings)=>Math.max(1,settings[`${id}_min_level`]);
export const changeReached=(id,level,settings,flags={})=>flags.change_1!==false&&flags[id]!==false&&
  level>=changeLevel('change_1',settings)&&level>=changeLevel(id,settings);
export const shutterEnabled=(level,flags,settings)=>Boolean(flags.lasers&&changeReached('change_1',level,settings,flags));
export const shutterLoss=(count,fraction)=>Math.min(Math.max(0,count-1),Math.floor(count*fraction));
const minimumSpacing=settings=>settings.change_1_closed_seconds+settings.change_1_warning_seconds+settings.change_1_gate_cooldown;
export const shutterInterval=settings=>Math.max(settings.change_1_interval,minimumSpacing(settings));
export const shutterStepInterval=settings=>Math.max(settings.change_1_step_seconds,minimumSpacing(settings));
export function shutterGateCount(level,settings,total=5,flags={}) {
  if(!changeReached('change_1',level,settings,flags))return 0;
  if(settings.change_1_gates_per_leg>0)return Math.min(total,settings.change_1_gates_per_leg);
  return Math.min(total,Math.max(...Object.entries(CHANGES).filter(([id])=>changeReached(id,level,settings,flags)).map(([,c])=>c.count)));
}

export class Shutters {
  constructor(rng=Math.random) {this.seed=rng();this.restart();}
  restart() {
    this.time=0;this.immunity=0;this.contacts=new Map();
    this.sequence=null;this.pulse=null;this.lastLeg=null;this.serial=0;this.sequenceSerial=0;this.nextWarningAt=null;
  }
  tick(dt) {this.time+=dt;this.immunity=Math.max(0,this.immunity-dt);}
  rank(leg,gate=0,round=0) {return ((Math.sin((leg+1)*127.1+(gate+1)*78.233+this.seed*311.7+round*39.425)*43758.5453)%1+1)%1;}
  selectedGates(leg,total,level,settings,randomPerLeg=true,flags={}) {
    const count=shutterGateCount(level,settings,total,flags),round=this.sequenceSerial;
    if(count===4&&total===5&&flags.change_4_pattern!==false) {
      return randomPerLeg&&this.rank(leg,0,round)<.5?[3,0,4,1]:[1,4,0,3];
    }
    const gates=Array.from({length:total},(_,i)=>i);
    if(randomPerLeg)gates.sort((a,b)=>this.rank(leg,a,round)-this.rank(leg,b,round));
    return gates.slice(0,count);
  }
  nextPulse(warnsAt,settings) {
    const seq=this.sequence,step=seq.step;
    this.pulse={leg:seq.leg,gates:[seq.gates[step]],step,sequence:seq.id,
      semitones:settings[`change_1_pitch_${step+1}`],warnsAt,
      closesAt:warnsAt+settings.change_1_warning_seconds,
      opensAt:warnsAt+settings.change_1_warning_seconds+settings.change_1_closed_seconds,
      serial:this.serial++,started:false};
  }
  schedule(legs,level,settings,randomPerLeg=true,noRepeatLeg=true,flags={}) {
    // A whole sequence owns one revealed leg. Each step closes exactly one gate;
    // alternation applies between complete sequences, never between their steps.
    const events=[],interval=shutterInterval(settings),warning=settings.change_1_warning_seconds,closed=settings.change_1_closed_seconds;
    if(this.nextWarningAt===null)this.nextWarningAt=interval-warning-closed;
    if(this.pulse&&!legs.has(this.pulse.leg)) {
      // Abort a vanished leg without catching up its unplayed steps or making
      // the newly revealed leg zap immediately. Preserve the rest budget.
      this.nextWarningAt=Math.max(this.time,this.pulse.closesAt+interval-warning);
      this.pulse=null;this.sequence=null;
    }
    if(this.pulse&&this.time>=this.pulse.closesAt&&!this.pulse.started) {
      this.pulse.started=true;this.lastLeg=this.pulse.leg;events.push({name:'shutter_close',...this.pulse});
    }
    if(this.pulse&&this.time>=this.pulse.opensAt) {
      const previous=this.pulse;
      if(previous.started)events.push({name:'shutter_open',...previous});
      this.sequence.step++;
      if(this.sequence.step<this.sequence.gates.length) {
        this.nextPulse(Math.max(this.time,previous.closesAt+shutterStepInterval(settings)-warning),settings);
      } else {
        this.nextWarningAt=previous.closesAt+interval-warning;
        this.pulse=null;this.sequence=null;
      }
    }
    if(!this.pulse) {
      const eligible=[...legs.keys()].filter(leg=>(!noRepeatLeg||leg!==this.lastLeg)&&shutterGateCount(level,settings,legs.get(leg),flags)>0);
      if(eligible.length) {
        eligible.sort(randomPerLeg?(a,b)=>this.rank(a,0,this.sequenceSerial)-this.rank(b,0,this.sequenceSerial):(a,b)=>a-b);
        const leg=eligible[0],gates=this.selectedGates(leg,legs.get(leg),level,settings,randomPerLeg,flags);
        this.sequence={id:this.sequenceSerial++,leg,gates,step:0};
        this.nextPulse(Math.max(this.time,this.nextWarningAt),settings);
      }
      // A lone leg completes all steps, then waits for an alternative leg.
    }
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
