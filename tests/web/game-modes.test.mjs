import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,C,cells,cellColor,ASCENSION_TIMING,THANK_YOU_TIMING} from '../../web/js/core.mjs';
import {DEFAULT_GAME_MODE,BALANCE,GAME_MODES,balanceForMode,difficultyForLevel,introductionCard,featuresForSettings} from '../../web/js/difficulty.mjs';
import {scheduledBonus} from '../../web/js/bonus.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {isEndPortal} from '../../web/js/portal-light.mjs';
import {lossGreyAmount} from '../../web/js/loss.mjs';
import {CheckpointStore,SAVE_KEY,validateCheckpoint,RESUME_TIMING} from '../../web/js/save-game.mjs';

const shape=cells.map((_,i)=>i).filter(i=>i%3===0);
const finishCards=g=>{for(let n=0;n<8&&g.state.endsWith('_intro');n++)g.tick(5.01);};
const enter=g=>{for(let n=0;n<400&&g.state!=='playing';n++)g.tick(.1);assert.equal(g.state,'playing');};
function escape(g,remaining) {g.setState('playing');g.player.alive=new Set(remaining);g.win();if(g.state==='portal_warp'){g.tick(3.41);g.continue();}}
function browser(entries=new Map()) {
  const writes=[],storage={getItem:k=>entries.get(k)??null,setItem(k,v){entries.set(k,v);writes.push(k);},removeItem(k){entries.delete(k);writes.push(k);}};
  return {entries,writes,storage,load:()=>new CheckpointStore(()=>storage)};
}
function boot(b) {
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),start=source.indexOf('  const read=(key,fallback)'),end=source.indexOf('  game.flags.shake=',start);
  const ctx=vm.createContext({Game,CheckpointStore,localStorage:b.storage});vm.runInContext(source.slice(start,end),ctx);
  return vm.runInContext('({game,campaignStore})',ctx);
}

test('new games use twenty levels; the original fifty-level campaign and its bounded routes coexist independently',()=>{
  assert.equal(DEFAULT_GAME_MODE,20);assert.equal(balanceForMode(),GAME_MODES[20]);assert.equal(GAME_MODES[50],BALANCE);
  const compact=new Game(),original=new Game({gameMode:50});
  assert.equal(compact.gameMode,20);assert.equal(compact.levelCap,20);assert.equal(compact.lossMinLevel,16);assert.equal(compact.lossGreyMinLevel,10);
  assert.equal(original.levelCap,50);assert.equal(original.lossMinLevel,44);assert.equal(original.lossGreyMinLevel,44);
  for(const g of [compact,original]) {
    let legs=0;for(let level=1;level<=g.levelCap;level++){g.ready(level);assert.equal(g.course.modules.length,level);assert.equal(g.course.balance,g.balance);legs+=level;}
    assert.equal(legs,g.gameMode===20?210:1275);
    g.command('level 999');assert.equal(g.level,g.levelCap);finishCards(g);assert.equal(g.course.modules.length,g.levelCap);
    const bonuses=Array.from({length:g.levelCap},(_,i)=>i+1).filter(l=>scheduledBonus(l,g.levelCap));
    assert.deepEqual(bonuses,g.gameMode===20?[5,10,15]:[5,10,15,20,25,30,35,40,45]);
  }
  assert.equal(compact.balance.levelCap,20);assert.equal(original.balance.levelCap,50);
  for(const bad of [0,21,30,51,'20',null])assert.throws(()=>new Game({gameMode:bad}),/game_mode/);
});

test('the compressed time and entropy curves reach the original final severity, including actual re-coupling and laser speed',()=>{
  const g=new Game({rng:()=>.5}),old=new Game({gameMode:50,rng:()=>.5});
  const checkpoints=[[5,30,.9],[10,24.8,.5],[15,15.2,.26],[16,13.5,.18],[18,11,.06],[19,10.3,.02],[20,10,.01]];
  for(const [level,seconds,rate] of checkpoints){g.ready(level);assert.equal(g.legTime,seconds);assert.equal(g.difficulty.recouplingRate,rate);}
  // Corresponding normalized points on each unchanged smoothstep curve.
  for(const [a,b] of [[5,5],[10,20],[15,35],[20,50]])assert.equal(difficultyForLevel(a,g.balance).secondsPerLeg,difficultyForLevel(b,old.balance).secondsPerLeg);
  for(const [a,b] of [[10,10],[15,30],[20,50]])assert.equal(difficultyForLevel(a,g.balance).recouplingRate,difficultyForLevel(b,old.balance).recouplingRate);
  for(const game of [g,old]) {
    game.ready(game.levelCap);game.setState('playing');
    for(let i=0;i<100;i++)game.player.destroy(i,game.player.pos(i));
    game.requestRecouple();assert.equal(game.recoupling.length,1,'The final request recovers 1% of 100 loose pieces');
    assert.equal(game.difficulty.overheatGraceSeconds,1.4);
  }
  assert.deepEqual(g.course.lasers.slice(0,5).map(l=>l.spin),old.course.lasers.slice(0,5).map(l=>l.spin));
  g.ready(15);g.setState('playing');for(let i=0;i<100;i++)g.player.destroy(i,g.player.pos(i));g.requestRecouple();assert.equal(g.recoupling.length,26);
  g.paused=true;g.tick(5);assert.equal(g.legTime,15.2);g.paused=false;g.retry();assert.equal(g.legTime,15.2);
  old.ready(15);assert.equal(old.difficulty.recouplingRate,.48);assert.equal(g.difficulty.recouplingRate,.26);
});

test('twenty-level milestones queue the real cards and time warnings without consuming the play clock',()=>{
  const g=new Game(),schedule=featuresForSettings(g.changeSettings,g.flags,g.lossMinLevel,g.balance);
  assert.deepEqual(schedule.map(f=>[f.level,f.state]),[[3,'space_intro'],[4,'change_1_intro'],[5,'time_intro'],[6,'change_2_intro'],[7,'change_3_intro'],[8,'change_4_intro'],[10,'entropy_intro'],[10,'time_intro'],[15,'heat_intro'],[15,'time_intro'],[16,'loss_intro'],[20,'time_intro']]);
  for(const level of [3,4,5,6,7,8,10,15,16,20]) {
    g.command(`level ${level}`);const expected=schedule.filter(f=>f.level===level);const clock=g.legTime;
    for(const feature of expected) {
      assert.equal(g.state,feature.state);
      const card=introductionCard(g.state,g.level,g.flags,g.changeSettings,g.lossMinLevel,g.balance);assert.equal(card.title,feature.banner);assert.ok(card.subtitle);
      assert.ok(!card.subtitle.includes('LEVEL 50'));
      g.paused=true;g.tick(10);assert.equal(g.stateTime,0);g.paused=false;
      g.tick(4.9);assert.equal(g.state,feature.state);assert.equal(g.legTime,clock);g.tick(.11);
    }
    assert.equal(g.state,'level_ready');assert.equal(g.legTime,g.difficulty.secondsPerLeg);
  }
});

test('colour starts subtly at ten, reaches grey at twenty, and remains visible in partial assembly without hiding heat',()=>{
  const g=new Game(),r=Object.create(Renderer.prototype);let previous=0,increment=0;
  g.ready(9);assert.deepEqual(r.lossColor(g,cellColor(0)),cellColor(0));
  for(let level=10;level<=20;level++) {
    g.ready(level);const amount=lossGreyAmount(level,g.lossGreyMinLevel,g.levelCap);
    if(level===10)assert.equal(amount,.025);else {assert.ok(amount-previous>increment);increment=amount-previous;}
    previous=amount;assert.notDeepEqual(r.lossColor(g,cellColor(0)),cellColor(0));
  }
  assert.equal(previous,1);const grey=r.lossColor(g,cellColor(0));assert.equal(grey[0],grey[1]);assert.equal(grey[1],grey[2]);
  g.ready(17,{survivors:shape});g.makeReassembly();g.setState('reassembly');g.stateTime=3.74;
  const colors=[];r.cubes={cube(p,c){colors.push(c);}};r.lines={line(){}};r.reassemble(g);
  const expected=r.lossColor(g,cellColor(shape[0]));colors[0].forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));
  g.ready(20);g.setState('playing');g.heat=1;g.t=.123;colors.length=0;r.player(g);assert.ok(colors[0][0]>colors[0][2]);
  const alive=[...g.player.alive];g.command('loss_grey false');assert.deepEqual(r.lossColor(g,cellColor(0)),cellColor(0));assert.deepEqual([...g.player.alive],alive);
  g.command('loss_grey true');g.command('loss_grey_min_level 0');g.ready(1);assert.notDeepEqual(r.lossColor(g,cellColor(0)),cellColor(0));
});

test('LOSS begins at the exit of sixteen; exact surviving shapes persist through retries, Continue and the final portal',()=>{
  const b=browser(),store=b.load(),g=new Game({rng:()=>.5,saveCheckpoint:d=>store.save(d)});g.newRun();g.ready(15);
  escape(g,shape);assert.equal(g.state,'bonus_intro');g.setState('bonus_playing');g.bonus.result='timeout';g.tick(.01);g.tick(3);g.stateTime=1;g.continue();
  assert.equal(g.state,'loss_intro');finishCards(g);assert.equal(g.level,16);assert.equal(g.entryCells.length,125);
  escape(g,shape);assert.equal(g.level,17);assert.deepEqual(g.entryCells,shape);assert.equal(store.value.gameMode,20);assert.equal(store.value.schema,3);
  g.player.alive=new Set(shape.slice(10));g.retry();assert.deepEqual([...g.player.alive],shape);
  const r=new Game({saveCheckpoint:d=>store.save(d)});assert.equal(r.resumeCheckpoint(b.load().value),true);r.tick(RESUME_TIMING.seconds);finishCards(r);
  assert.equal(r.level,17);assert.deepEqual([...r.player.alive],shape);r.tick(1.66);assert.equal(r.state,'loss_assembly');
  const before=r.stateTime;r.paused=true;r.tick(9);assert.equal(r.stateTime,before);r.paused=false;enter(r);
  for(const level of [17,18,19]) {assert.equal(r.level,level);escape(r,shape.slice(level-16));finishCards(r);assert.deepEqual(r.entryCells,shape.slice(level-16));}
  assert.equal(r.level,20);r.setState('playing');assert.equal(isEndPortal(r),true);r.win();assert.equal(r.state,'ascension');
  assert.equal(store.value.stage,'ending');assert.equal(store.value.level,20);const score=r.score;r.win();assert.equal(r.score,score);
  const resumed=new Game({saveCheckpoint:d=>store.save(d)});resumed.resumeCheckpoint(store.value);resumed.tick(RESUME_TIMING.seconds);assert.equal(resumed.state,'ascension');assert.equal(resumed.score,score);
  resumed.tick(ASCENSION_TIMING.flySeconds);resumed.tick(ASCENSION_TIMING.whiteHoldSeconds);resumed.tick(ASCENSION_TIMING.thankYouStarts);assert.equal(resumed.state,'thank_you_note');
  resumed.continue();assert.equal(resumed.state,'thank_you_note');resumed.tick(THANK_YOU_TIMING.continueAfter);resumed.continue();assert.equal(resumed.state,'run_summary');
  resumed.tick(ASCENSION_TIMING.summaryInputDelay);resumed.continue();assert.equal(resumed.state,'title');assert.equal(store.value,null);
});

test('schema-one saves always resume as the original fifty-level journey, even at an early level, while invalid modes leave storage untouched',()=>{
  const legacy={schema:1,stage:'level',level:6,cells:[...shape],score:7200,completedLevel:5,lastEscape:42,bonusesPlayedAfter:[5],
    runStats:{playSeconds:81,deaths:2,recoupledCubes:15,levelsCleared:5,bonusRounds:1,bonusPieces:8,bonusScore:800}};
  for(const [level,stage] of [[6,'level'],[45,'level'],[50,'ending']]) {
    const data={...legacy,level,stage,completedLevel:stage==='ending'?50:level-1};
    const b=browser(new Map([[SAVE_KEY,JSON.stringify(data)]])),store=b.load();assert.equal(store.value.gameMode,50);assert.equal(store.value.schema,3);assert.equal(b.writes.length,0);
    const g=new Game({saveCheckpoint:d=>store.save(d)});assert.equal(g.gameMode,20);g.resumeCheckpoint(store.value);g.tick(RESUME_TIMING.seconds);finishCards(g);
    assert.equal(g.gameMode,50);assert.equal(g.levelCap,50);assert.equal(g.lossMinLevel,44);assert.equal(g.lossGreyMinLevel,44);assert.equal(g.level,level);assert.deepEqual([...g.player.alive],shape);assert.equal(g.score,7200);
    assert.equal(g.difficulty.secondsPerLeg,difficultyForLevel(level).secondsPerLeg);
    g.newRun();assert.equal(g.gameMode,20,'Continue does not silently change the next public new run');assert.equal(store.value.gameMode,20);
  }
  const valid={...legacy,schema:2,gameMode:20};
  for(const data of [{...valid,gameMode:50.5},{...valid,gameMode:'20'},{...valid,gameMode:undefined},{...valid,level:45},{...valid,stage:'ending',level:20,completedLevel:19},{...valid,schema:99}]) {
    assert.equal(validateCheckpoint(data),null);const json=JSON.stringify(data),b=browser(new Map([[SAVE_KEY,json]])),store=b.load();assert.equal(store.value,null);assert.equal(store.status,'incompatible');assert.equal(b.entries.get(SAVE_KEY),json);assert.equal(b.writes.length,0);
  }
});

test('game_mode console queries are inert; changing modes clears active play without replacing a saved run or leaking records',()=>{
  const b=browser(),store=b.load(),g=new Game({saveCheckpoint:d=>store.save(d)});g.newRun();g.ready(6);g.setState('playing');g.driftVelocity.x=2;
  const before=JSON.stringify({state:g.state,t:g.t,clock:g.legTime,save:store.value,records:g.modeRecords}),course=g.course,writes=b.writes.length;
  for(const cmd of ['game_mode','get game_mode','view game_mode','status game_mode','set game_mode','flag game_mode'])assert.equal(g.command(cmd),'Status for game_mode is: 20');
  for(const cmd of ['game_mode 0','game_mode 1','game_mode 30','game_mode 50.1','game_mode NaN','game_mode true','toggle game_mode','game_mode 50 extra'])assert.throws(()=>g.command(cmd));
  g.command('game_mode 20');assert.equal(g.course,course);assert.equal(JSON.stringify({state:g.state,t:g.t,clock:g.legTime,save:store.value,records:g.modeRecords}),before);assert.equal(b.writes.length,writes);
  g.command('loss_min_level 0');g.command('loss_grey_min_level 2');g.command('set game_mode 50');
  assert.equal(g.state,'title');assert.equal(g.level,1);assert.equal(g.lossMinLevel,44);assert.equal(g.lossGreyMinLevel,44);assert.equal(g.campaignSaving,false);assert.equal(g.driftVelocity.length(),0);assert.equal(g.command('toplevel'),'TOP LEVEL: 1/50');assert.equal(b.writes.length,writes);
  assert.ok(g.command('viewconfig').includes('game_mode | 50 | Campaign variant |'));
  g.command('newrun');assert.equal(store.value.gameMode,50);g.ready(45);assert.equal(g.command('toplevel'),'TOP LEVEL: 45/50');
  g.command('game_mode 20');assert.equal(g.command('toplevel'),'TOP LEVEL: 6/20');assert.equal(store.value.gameMode,50);assert.equal(g.lossMinLevel,16);assert.equal(g.lossGreyMinLevel,10);
  g.command('loss_grey_min_level 11');g.command('loss_min_level 17');assert.equal(g.lossGreyMinLevel,11);assert.equal(g.lossMinLevel,17);
  g.command('change_1_min_level 21');const state=g.state;assert.throws(()=>g.command('test change_1'),/above the game_mode 20 cap/);assert.equal(g.state,state);
  for(const key of ['loss_min_level','loss_grey_min_level'])for(const bad of ['-1','21','1.5','NaN'])assert.throws(()=>g.command(`${key} ${bad}`));
});

test('the real browser boot migrates old records into mode fifty and saves and resets each mode independently',()=>{
  const old={highest_level:50,best_score:45000,best_escape:120};
  const b=browser(new Map([['cube-libre-scores-v1',JSON.stringify(old)],['cube-libre-shake-v1','false']]));
  const {game:g}=boot(b);assert.equal(g.command('toplevel'),'TOP LEVEL: 1/20');assert.equal(b.writes.length,0);
  g.newRun();g.ready(12);g.stats.best_score=17000;g.persist();assert.equal(g.command('toplevel'),'TOP LEVEL: 12/20');
  g.command('game_mode 50');assert.equal(g.command('toplevel'),'TOP LEVEL: 50/50');assert.equal(g.stats.best_score,45000);
  g.command('toplevel reset');assert.equal(g.stats.highest_level,1);assert.equal(g.stats.best_score,45000);
  const r=boot(b).game;assert.equal(r.command('toplevel'),'TOP LEVEL: 12/20');assert.equal(r.stats.best_score,17000);r.command('game_mode 50');assert.equal(r.command('toplevel'),'TOP LEVEL: 1/50');assert.equal(r.stats.best_escape,120);
  assert.equal(b.entries.get('cube-libre-scores-v1'),JSON.stringify(old));assert.equal(b.entries.get('cube-libre-shake-v1'),'false');
});

test('the compact final-portal preview reaches the complete ending with real movement and cannot overwrite a campaign',()=>{
  const b=browser(),store=b.load(),g=new Game({rng:()=>.5,saveCheckpoint:d=>store.save(d)});g.newRun();g.ready(6);const saved=JSON.stringify(store.value),records={...g.stats},score=g.score;
  g.command('test end_portal');assert.equal(g.level,20);assert.equal(g.timedModule,19);assert.equal(g.legTime,10);assert.equal(isEndPortal(g),true);
  const start=g.player.origin.array();g.command('restart');assert.deepEqual(g.player.origin.array(),start);
  for(let i=0;i<120*8&&g.state==='playing';i++){const {x,y,z}=g.course.portal.bx;g.tick(1/120,{x,y,z});}
  assert.equal(g.state,'ascension');assert.equal(g.runSummary.finalLevel,20);assert.ok(g.player.alive.size>0);assert.equal(g.score,score);assert.deepEqual(g.stats,records);assert.equal(JSON.stringify(store.value),saved);
  g.ready(19);g.setState('playing');assert.equal(isEndPortal(g),false);g.command('game_mode 50');g.ready(20);g.setState('playing');assert.equal(isEndPortal(g),false);
});

test('all twenty final-level legs remain traversable with the final time limit, original lasers and timed shutters',()=>{
  const g=new Game({rng:()=>.5});g.ready(20);enter(g);
  const targets=g.course.modules.flatMap((m,i)=>[{p:m.world(-16),leg:i,wait:true},{p:i===19?m.world(25):m.end(),leg:i,wait:false}]);
  let target=0,minLeft=Infinity;
  for(let frame=0;frame<120*150&&g.state==='playing';frame++) {
    const stage=targets[target],delta=stage.p.sub(g.player.origin),input={rush:true};
    for(const axis of ['x','y','z'])input[axis]=Math.max(-1,Math.min(1,delta[axis]/(15.6/120)));
    if(delta.length()<.03){const pulse=g.shutters.pulse,open=!pulse||pulse.leg!==stage.leg||pulse.closesAt-g.shutters.time>2.65;if((!stage.wait||open)&&target<targets.length-1)target++;}
    if(frame%252===0)g.requestRecouple();g.tick(1/120,input);minLeft=Math.min(minLeft,g.legTime);
  }
  assert.equal(g.state,'ascension');assert.equal(g.completedLevel,20);assert.equal(g.timedModule,19);assert.equal(g.course.collapsed.size,19);assert.ok(g.player.alive.size>0);assert.ok(minLeft>2);
});
