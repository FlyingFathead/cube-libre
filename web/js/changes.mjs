// Numbered mechanic changes: keep each change's identity, banner and defaults here.
export const CHANGES=Object.freeze({
  change_1:Object.freeze({banner:'CHANGE ...',state:'change_1_intro',
    description:'THE LASERS NOW OPEN AND CLOSE',detail:'PASS THROUGH WHILE THEY ARE OPEN',
    enabled:true,randomPerLeg:true}),
});
export const CHANGE_NUMBERS=Object.freeze({
  change_1_min_level:{value:7,min:0,max:50,integer:true},
  change_1_interval:{value:4,min:.5,max:60},
  change_1_closed_seconds:{value:.8,min:.05,max:30},
  change_1_warning_seconds:{value:.4,min:0,max:10},
  change_1_damage_fraction:{value:.5,min:0,max:1},
  change_1_damage_cooldown:{value:1.5,min:0,max:30},
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
  settings[key]=n;return n;
}
export const shutterEnabled=(level,flags,settings)=>Boolean(flags.change_1&&flags.lasers&&
  (settings.change_1_min_level===0||level>=settings.change_1_min_level));
export const shutterLoss=(count,fraction)=>Math.min(Math.max(0,count-1),Math.floor(count*fraction));

export class Shutters {
  constructor(rng=Math.random) {this.seed=rng();this.restart();}
  restart() {this.time=0;this.immunity=0;this.contacts=new Map();}
  tick(dt) {this.time+=dt;this.immunity=Math.max(0,this.immunity-dt);}
  phase(leg,settings,randomPerLeg=true,time=this.time) {
    const interval=settings.change_1_interval,closedSeconds=settings.change_1_closed_seconds,warningSeconds=settings.change_1_warning_seconds;
    // One stable timing offset per leg; no RNG or growing timers per frame.
    const unit=((Math.sin((leg+1)*127.1+this.seed*311.7)*43758.5453)%1+1)%1;
    const offset=randomPerLeg?unit*(interval-closedSeconds-warningSeconds):0;
    const clock=Math.max(0,time)+offset,cycle=Math.floor((clock+1e-10)/interval);
    const phase=Math.max(0,clock-cycle*interval),closeAt=interval-closedSeconds;
    const closed=phase>=closeAt-1e-10;
    const warning=!closed&&warningSeconds>0&&phase>=closeAt-warningSeconds-1e-10;
    return {closed,warning,cycle,charge:closed?1:warning?Math.max(0,Math.min(1,(phase-closeAt+warningSeconds)/warningSeconds)):0,
      untilChange:closed?interval-phase:closeAt-phase};
  }
}
