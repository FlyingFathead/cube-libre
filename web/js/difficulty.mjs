import { C } from './config.mjs';

// Web balance: gentle introductions, then a bounded ramp toward level 50.
// Change the phase levels and late-game limits here; config.mjs retains the PyGame baseline.
export const BALANCE = Object.freeze({
  levelCap: 50,
  spaceStartLevel: 3,
  timeStartLevel: 5,
  entropyStartLevel: 10,
  heatMinLevel: 15, // 0 removes the level gate; the first HEAT banner then appears at level 1.
  get heatStartLevel() { return Math.max(1,this.heatMinLevel); },
  overheatBlocksRecoupling: true,
  capLevel: 50,
  minSecondsPerLeg: 10,
  minRecouplingRate: .01,
  overheatGraceReductionSeconds: 1,
  timeReminderLevels: Object.freeze([20,35,50]),
});

export const heatLevelReached=(level,minLevel=BALANCE.heatMinLevel)=>minLevel===0||level>=minLevel;
// Reuse the heat state, regardless of which hazard generated it.
export const recouplingHeatBlocked=(level,overheating,enabled,minLevel=BALANCE.heatMinLevel)=>
  Boolean(enabled&&overheating&&heatLevelReached(level,minLevel));

function progress(level,start) {
  const t=Math.max(0,Math.min(1,(level-start)/(BALANCE.capLevel-start)));
  return t*t*(3-2*t);
}

export function difficultyForLevel(level) {
  const timed=level>=BALANCE.timeStartLevel;
  const entropy=level>=BALANCE.entropyStartLevel;
  const heatStartLevel=BALANCE.heatStartLevel;
  const heat=heatLevelReached(level);
  const time=progress(level,BALANCE.timeStartLevel);
  const loss=progress(level,BALANCE.entropyStartLevel);
  return {
    timed,
    entropy,
    heat,
    heatStartLevel,
    overheatGraceSeconds: C.BOUNDARY_OVERHEAT_SECONDS-(heat?BALANCE.overheatGraceReductionSeconds:0),
    secondsPerLeg: Math.round((C.TIME_PER_LEG_SECONDS+
      (BALANCE.minSecondsPerLeg-C.TIME_PER_LEG_SECONDS)*time)*10)/10,
    recouplingRate: entropy ? Math.round((C.ENTROPY_RECOUPLING_GATHER_RATE+
      (BALANCE.minRecouplingRate-C.ENTROPY_RECOUPLING_GATHER_RATE)*loss)*100)/100
      : C.RECOUPLING_GATHER_RATE,
  };
}

export const isTimeIntroductionLevel = level =>
  level===BALANCE.timeStartLevel || BALANCE.timeReminderLevels.includes(level);

// One ordered schedule for phase sequencing, banner wording and the Help table.
// Levels reference BALANCE, so moving HEAT moves both heat rules and its message.
export const LEVEL_FEATURES=Object.freeze([
  {id:'space',level:BALANCE.spaceStartLevel,state:'space_intro',banner:'SPACE ...',flag:'route3d',
    summary:()=> 'World Y axis opens; routes extend through three dimensions.'},
  {id:'time',level:BALANCE.timeStartLevel,state:'time_intro',banner:'TIME ...',
    summary:()=> `${C.TIME_PER_LEG_SECONDS} seconds per leg, tightening to ${BALANCE.minSecondsPerLeg} by level ${BALANCE.capLevel}.`},
  {id:'entropy',level:BALANCE.entropyStartLevel,state:'entropy_intro',banner:'ENTROPY ...',
    summary:()=> `${C.ENTROPY_RECOUPLING_GATHER_RATE*100}% re-coupling yield per request, falling to ${BALANCE.minRecouplingRate*100}% by level ${BALANCE.capLevel}.`},
  {id:'heat',level:BALANCE.heatStartLevel,state:'heat_intro',banner:'HEAT ...',
    summary:()=> `Outside grace drops from ${C.BOUNDARY_OVERHEAT_SECONDS.toFixed(1)} to ${difficultyForLevel(BALANCE.heatStartLevel).overheatGraceSeconds.toFixed(1)} seconds. Re-coupling is blocked while overheating.`},
  ...BALANCE.timeReminderLevels.map(level=>({id:`time_${level}`,level,state:'time_intro',banner:'TIME ...',
    summary:()=> `${difficultyForLevel(level).secondsPerLeg.toFixed(1)} seconds per leg${level>=BALANCE.capLevel?': the final allowance.':'; the clock tightens.'}`})),
].sort((a,b)=>a.level-b.level).map(Object.freeze));

export function introductionsForLevel(level,route3d=true) {
  return LEVEL_FEATURES.filter(f=>f.level===level&&(f.flag!=='route3d'||route3d)).map(f=>f.state);
}

export function introductionCard(state,level,flags={}) {
  const feature=LEVEL_FEATURES.find(f=>f.state===state&&f.level===level);
  if(!feature)return {title:'',subtitle:'',detail:''};
  const rules=difficultyForLevel(level);
  const subtitles={
    space_intro:'WORLD Y AXIS OPENS FROM HERE',
    time_intro:`${rules.secondsPerLeg.toFixed(1)} SECONDS PER LEG\n${level===BALANCE.timeStartLevel?'THE CLOCK STARTS NOW':level>=BALANCE.capLevel?'THE FINAL TIME LIMIT':'THE CLOCK TIGHTENS'}`,
    entropy_intro:`${Math.round(rules.recouplingRate*100)}% RE-COUPLING YIELD PER REQUEST\nFALLING TO ${BALANCE.minRecouplingRate*100}% BY LEVEL ${BALANCE.capLevel}`,
    heat_intro:`OVERHEATING AFTER ${rules.overheatGraceSeconds.toFixed(1)} SECONDS\nOUTSIDE THE CORRIDOR`,
  };
  const blocked=flags.overheat_blocks_recoupling??BALANCE.overheatBlocksRecoupling;
  return {title:feature.banner,subtitle:subtitles[state],detail:state==='heat_intro'?
    (blocked?'RE-COUPLING DISABLED WHILE OVERHEATING\nRETURN INSIDE TO RE-COUPLE':'OVERHEAT RE-COUPLING RESTRICTION: OFF'):''};
}
