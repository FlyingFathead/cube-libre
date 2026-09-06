import { C } from './config.mjs';

// Web balance: gentle introductions, then a bounded ramp toward level 50.
// Change the phase levels and late-game limits here; config.mjs retains the PyGame baseline.
export const BALANCE = Object.freeze({
  levelCap: 50,
  timeStartLevel: 5,
  entropyStartLevel: 10,
  heatDelayLevels: 5,
  capLevel: 50,
  minSecondsPerLeg: 10,
  minRecouplingRate: .01,
  overheatGraceReductionSeconds: 1,
  timeReminderLevels: Object.freeze([20,35,50]),
});

function progress(level,start) {
  const t=Math.max(0,Math.min(1,(level-start)/(BALANCE.capLevel-start)));
  return t*t*(3-2*t);
}

export function difficultyForLevel(level) {
  const timed=level>=BALANCE.timeStartLevel;
  const entropy=level>=BALANCE.entropyStartLevel;
  const heatStartLevel=BALANCE.entropyStartLevel+BALANCE.heatDelayLevels;
  const heat=level>=heatStartLevel;
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

export function introductionsForLevel(level,route3d=true) {
  const phases=[];
  if(level===3&&route3d) phases.push('space_intro');
  if(isTimeIntroductionLevel(level)) phases.push('time_intro');
  if(level===BALANCE.entropyStartLevel) phases.push('entropy_intro');
  if(level===BALANCE.entropyStartLevel+BALANCE.heatDelayLevels) phases.push('heat_intro');
  return phases;
}
