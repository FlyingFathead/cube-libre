import {balanceForMode} from './difficulty.mjs';

export const SAVE_KEY='cube-libre-campaign-v1';
export const RESUME_TIMING=Object.freeze({lineFade:1,welcomeStarts:1.5,welcomeFade:1.5,fadeOutStarts:4.5,fadeOutSeconds:1.5,seconds:6});
export const RUN_STAT_KEYS=Object.freeze(['playSeconds','deaths','recoupledCubes','levelsCleared','bonusRounds','bonusPieces','bonusScore']);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;

// Save stable level-entry checkpoints, never live input, debris or renderer state.
// Schema changes require an explicit migration; an unknown save is left untouched.
export function validateCheckpoint(data) {
  if(!data||typeof data!=='object'||![1,2].includes(data.schema)||!['level','bonus','ending'].includes(data.stage))return null;
  const gameMode=data.schema===1?50:data.gameMode;
  if(gameMode!==20&&gameMode!==50)return null;
  const balance=balanceForMode(gameMode);
  if(!integer(data.level,1,balance.levelCap)||!integer(data.score,0,Number.MAX_SAFE_INTEGER))return null;
  if(!Array.isArray(data.cells)||!data.cells.length||data.cells.length>125||new Set(data.cells).size!==data.cells.length||!data.cells.every(i=>integer(i,0,124)))return null;
  if(!integer(data.completedLevel,0,balance.levelCap)||!integer(data.lastEscape,0,125))return null;
  if(data.stage==='ending'?data.level!==balance.levelCap||data.completedLevel!==balance.levelCap:data.completedLevel>=data.level)return null;
  if(data.stage==='bonus'&&(data.level<2||data.completedLevel!==data.level-1))return null;
  if(!Array.isArray(data.bonusesPlayedAfter)||data.bonusesPlayedAfter.length>50||!data.bonusesPlayedAfter.every(i=>integer(i,1,balance.levelCap-1)))return null;
  if(!data.runStats||RUN_STAT_KEYS.some(k=>typeof data.runStats[k]!=='number'||!Number.isFinite(data.runStats[k])||data.runStats[k]<0||data.runStats[k]>Number.MAX_SAFE_INTEGER||k!=='playSeconds'&&!Number.isInteger(data.runStats[k])))return null;
  return {schema:2,gameMode,stage:data.stage,level:data.level,cells:[...data.cells],score:data.score,
    completedLevel:data.completedLevel,lastEscape:data.lastEscape,
    bonusesPlayedAfter:[...new Set(data.bonusesPlayedAfter)],runStats:Object.fromEntries(RUN_STAT_KEYS.map(k=>[k,data.runStats[k]]))};
}

export class CheckpointStore {
  constructor(storage=()=>globalThis.localStorage) {
    this.storage=storage;this.value=null;this.status='ready';
    let raw;
    try {raw=storage().getItem(SAVE_KEY);}catch {this.status='unavailable';return;}
    if(raw!==null) {
      try {this.value=raw.length<=64000?validateCheckpoint(JSON.parse(raw)):null;}catch {}
      if(!this.value)this.status='incompatible';
    }
  }
  save(data) {
    const next=data===null?null:validateCheckpoint(data);
    if(data!==null&&!next)return false;
    // Retain a useful same-page Continue even when browser persistence is blocked.
    this.value=next;
    try {
      if(next)this.storage().setItem(SAVE_KEY,JSON.stringify(next));else this.storage().removeItem(SAVE_KEY);
      this.status='ready';return true;
    }catch {this.status='unavailable';return false;}
  }
  get note() {
    if(this.status==='unavailable')return 'Browser saving unavailable. Progress can only be continued while this page stays open.';
    if(this.status==='incompatible')return 'The saved run could not be read by this version. Start a new run to replace it.';
    if(!this.value)return 'Progress saves at level checkpoints in this browser.';
    const c=this.value,place=c.stage==='bonus'?`Bonus round before level ${c.level}`:c.stage==='ending'?'The ending':`Level ${c.level} · ${c.cells.length}/125 cubes`;
    return `${place} · ${c.gameMode}-level journey · Saved in this browser`;
  }
}
