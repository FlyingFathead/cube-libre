import { C } from './config.mjs';
import {CHANGES,createChangeSettings,shutterGateCount,shutterStepInterval,changeLevel} from './changes.mjs';

// Original 50-level balance stays immutable for reference tools and legacy campaigns.
// Change the phase levels and late-game limits here; config.mjs retains the PyGame baseline.
export const BALANCE = Object.freeze({
  levelCap: 50,
  spaceStartLevel: 3,
  timeStartLevel: 5,
  entropyStartLevel: 10,
  heatMinLevel: 15, // 0 removes the level gate; the first HEAT banner then appears at level 1.
  get heatStartLevel() { return Math.max(1,this.heatMinLevel); },
  overheatBlocksRecoupling: true,
  lossEnabled: true,
  lossGreyMinLevel: 44,
  lossMinLevel: 44, // First level whose EXIT no longer restores lost cells; 0 means always.
  capLevel: 50,
  minSecondsPerLeg: 10,
  minRecouplingRate: .01,
  overheatGraceReductionSeconds: 1,
  timeReminderLevels: Object.freeze([20,35,50]),
});

// Public new runs use 20. Mode selection is a console/developer setting only.
export const DEFAULT_GAME_MODE=20;
export const GAME_MODES=Object.freeze({
  20:Object.freeze({...BALANCE,levelCap:20,capLevel:20,lossMinLevel:16,lossGreyMinLevel:10,
    get heatStartLevel() {return Math.max(1,this.heatMinLevel);},
    timeReminderLevels:Object.freeze([10,15,20])}),
  50:BALANCE,
});
export function balanceForMode(mode=DEFAULT_GAME_MODE) {
  if(mode!==20&&mode!==50)throw Error('game_mode expects 20 or 50');
  return GAME_MODES[mode];
}

export const heatLevelReached=(level,minLevel=BALANCE.heatMinLevel)=>minLevel===0||level>=minLevel;
export const lossLevelReached=(level,minLevel=BALANCE.lossMinLevel)=>minLevel===0||level>=minLevel;
// Reuse the heat state, regardless of which hazard generated it.
export const recouplingHeatBlocked=(level,overheating,enabled,minLevel=BALANCE.heatMinLevel)=>
  Boolean(enabled&&overheating&&heatLevelReached(level,minLevel));

function progress(level,start,balance) {
  const t=Math.max(0,Math.min(1,(level-start)/(balance.capLevel-start)));
  return t*t*(3-2*t);
}

export function difficultyForLevel(level,balance=BALANCE) {
  const timed=level>=balance.timeStartLevel;
  const entropy=level>=balance.entropyStartLevel;
  const heatStartLevel=balance.heatStartLevel;
  const heat=heatLevelReached(level,balance.heatMinLevel);
  const time=progress(level,balance.timeStartLevel,balance);
  const loss=progress(level,balance.entropyStartLevel,balance);
  return {
    timed,
    entropy,
    heat,
    heatStartLevel,
    overheatGraceSeconds: C.BOUNDARY_OVERHEAT_SECONDS-(heat?balance.overheatGraceReductionSeconds:0),
    secondsPerLeg: Math.round((C.TIME_PER_LEG_SECONDS+
      (balance.minSecondsPerLeg-C.TIME_PER_LEG_SECONDS)*time)*10)/10,
    recouplingRate: entropy ? Math.round((C.ENTROPY_RECOUPLING_GATHER_RATE+
      (balance.minRecouplingRate-C.ENTROPY_RECOUPLING_GATHER_RATE)*loss)*100)/100
      : C.RECOUPLING_GATHER_RATE,
  };
}

export const isTimeIntroductionLevel = (level,balance=BALANCE) =>
  level===balance.timeStartLevel || balance.timeReminderLevels.includes(level);

// One ordered schedule for phase sequencing, banner wording and the Help table.
// Levels reference BALANCE, so moving HEAT moves both heat rules and its message.
const baseFeatures=balance=>[
  {id:'space',level:balance.spaceStartLevel,state:'space_intro',banner:'SPACE ...',flag:'route3d',
    summary:()=> 'World Y axis opens; routes extend through three dimensions.'},
  {id:'time',level:balance.timeStartLevel,state:'time_intro',banner:'TIME ...',
    summary:()=> `${C.TIME_PER_LEG_SECONDS} seconds per leg, tightening to ${balance.minSecondsPerLeg} by level ${balance.capLevel}.`},
  {id:'entropy',level:balance.entropyStartLevel,state:'entropy_intro',banner:'ENTROPY ...',
    summary:()=> `${C.ENTROPY_RECOUPLING_GATHER_RATE*100}% re-coupling yield per request, falling to ${balance.minRecouplingRate*100}% by level ${balance.capLevel}.`},
  {id:'heat',level:balance.heatStartLevel,state:'heat_intro',banner:'HEAT ...',
    summary:()=> `Outside grace drops from ${C.BOUNDARY_OVERHEAT_SECONDS.toFixed(1)} to ${difficultyForLevel(balance.heatStartLevel,balance).overheatGraceSeconds.toFixed(1)} seconds. Re-coupling is blocked while overheating.`},
  ...balance.timeReminderLevels.map(level=>({id:`time_${level}`,level,state:'time_intro',banner:'TIME ...',
    summary:()=> `${difficultyForLevel(level,balance).secondsPerLeg.toFixed(1)} seconds per leg${level>=balance.capLevel?': the final allowance.':'; the clock tightens.'}`})),
];

export function featuresForSettings(settings=createChangeSettings(),flags={},lossMinLevel=undefined,balance=BALANCE) {
  lossMinLevel??=balance.lossMinLevel;
  return [...baseFeatures(balance),
    {id:'loss',level:Math.max(1,lossMinLevel),state:'loss_intro',banner:'LOSS ...',flag:'loss',
      summary:()=> 'Exits carry the exact surviving body to the next level. Retries restore the body you entered with; bonus rounds do not refill it.'},
    ...Object.entries(CHANGES).map(([id,change])=>({
    id,level:Math.max(changeLevel('change_1',settings),changeLevel(id,settings)),state:change.state,banner:change.banner,flag:id,
    summary:()=>`${change.count} distinct shutter gate(s) in one leg, one at a time; ${shutterStepInterval(settings)} seconds between zap starts. Contact costs ${Math.round(settings.change_1_damage_fraction*100)}% of remaining cubes, rounded down.`
  }))].filter(f=>f.level<=balance.levelCap).sort((a,b)=>a.level-b.level);
}
export const LEVEL_FEATURES=Object.freeze(featuresForSettings().map(Object.freeze));
export function introductionsForLevel(level,route3d=true,settings=createChangeSettings(),flags={},lossMinLevel=undefined,balance=BALANCE) {
  return featuresForSettings(settings,flags,lossMinLevel,balance).filter(f=>f.level===level&&(f.flag!=='route3d'||route3d)&&(!f.flag||flags[f.flag]!==false)&&(!Object.hasOwn(CHANGES,f.id)||flags.change_1!==false)).map(f=>f.state);
}

export function introductionCard(state,level,flags={},settings=createChangeSettings(),lossMinLevel=undefined,balance=BALANCE) {
  const feature=featuresForSettings(settings,flags,lossMinLevel,balance).find(f=>f.state===state&&f.level===level);
  if(!feature)return {title:'',subtitle:'',detail:''};
  const change=CHANGES[feature.id];
  if(change) {
    const count=shutterGateCount(level,settings,5,flags);
    const detail=count>1?`${shutterStepInterval(settings)} SECONDS BETWEEN ZAPS\n${count===4&&flags.change_4_pattern!==false?CHANGES.change_4.detail:'A DIFFERENT GATE EACH TIME.'}`:change.detail;
    const subtitle=settings.change_1_gates_per_leg>0||count!==change.count?`${count} GATE${count===1?'':'S'}. ONE AT A TIME.`:change.description;
    return {title:change.banner,subtitle,detail};
  }
  const rules=difficultyForLevel(level,balance);
  const subtitles={
    space_intro:'WORLD Y AXIS OPENS FROM HERE',
    time_intro:`${rules.secondsPerLeg.toFixed(1)} SECONDS PER LEG\n${level===balance.timeStartLevel?'THE CLOCK STARTS NOW':level>=balance.capLevel?'THE FINAL TIME LIMIT':'THE CLOCK TIGHTENS'}`,
    entropy_intro:`${Math.round(rules.recouplingRate*100)}% RE-COUPLING YIELD PER REQUEST\nFALLING TO ${balance.minRecouplingRate*100}% BY LEVEL ${balance.capLevel}`,
    heat_intro:`OVERHEATING AFTER ${rules.overheatGraceSeconds.toFixed(1)} SECONDS\nOUTSIDE THE CORRIDOR`,
    loss_intro:'PORTALS NO LONGER RESTORE LOST PIECES',
  };
  const blocked=flags.overheat_blocks_recoupling??balance.overheatBlocksRecoupling;
  return {title:feature.banner,subtitle:subtitles[state],detail:state==='loss_intro'?'WHAT SURVIVES GOES WITH YOU.':state==='heat_intro'?
    (blocked?'RE-COUPLING DISABLED WHILE OVERHEATING\nRETURN INSIDE TO RE-COUPLE':'OVERHEAT RE-COUPLING RESTRICTION: OFF'):''};
}
