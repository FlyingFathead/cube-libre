import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,cells,smooth,ASCENSION_TIMING,THANK_YOU_TIMING} from '../../web/js/core.mjs';
import {CheckpointStore,SAVE_KEY,validateCheckpoint,RESUME_TIMING} from '../../web/js/save-game.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {lossGreyAmount,LOSS_ASSEMBLY} from '../../web/js/loss.mjs';

function browser() {
  const entries=new Map(),writes=[];
  const storage={getItem:k=>entries.get(k)??null,setItem(k,v){entries.set(k,v);writes.push(k);},removeItem(k){entries.delete(k);writes.push(k);}};
  const load=()=>new CheckpointStore(()=>storage);
  return {entries,writes,storage,load};
}
const savedGame=store=>new Game({gameMode:50,rng:()=>.5,saveCheckpoint:data=>store.save(data)});
const shape=cells.map((_,i)=>i).filter(i=>i%3===0);
const welcome=g=>{assert.equal(g.state,'resume_intro');g.tick(RESUME_TIMING.seconds);};
const enter=g=>{for(let i=0;i<300&&g.state!=='playing';i++)g.tick(.1);assert.equal(g.state,'playing');};

test('browser checkpoints resume at the level entrance with saved score, progress and cells, without serializing live hazards',()=>{
  const b=browser(),store=b.load(),g=savedGame(store);assert.equal(store.value,null);
  g.newRun();assert.equal(store.value.level,1);assert.equal(store.value.cells.length,125);
  g.ready(3);g.setState('playing');g.player.alive=new Set(shape);g.win();
  assert.equal(store.value.level,4);assert.equal(store.value.score,shape.length*100);assert.equal(store.value.cells.length,125,'Before LOSS, each new level receives a full body');
  assert.equal(store.value.completedLevel,3);assert.equal(store.value.runStats.levelsCleared,1);
  const persisted=JSON.parse(b.entries.get(SAVE_KEY));assert.equal('shutters' in persisted,false);assert.equal('position' in persisted,false);
  const reload=b.load(),r=savedGame(reload);assert.equal(r.resumeCheckpoint(reload.value),true);
  welcome(r);assert.equal(r.state,'change_1_intro');enter(r);
  assert.equal(r.level,4);assert.equal(r.course.location(r.player.origin).index,0);assert.equal(r.score,g.score);
  assert.equal(r.runStats.levelsCleared,1);assert.equal(r.player.alive.size,125);
  assert.equal(r.player.fragments.length,0);assert.deepEqual(r.driftVelocity.array(),[0,0,0]);
  const count=b.writes.length;r.tick(.1);r.title();assert.equal(b.writes.length,count,'Neither frames nor menu entry rewrites the checkpoint');
  r.newRun();assert.equal(reload.value.level,1);assert.equal(reload.value.score,0);assert.equal(reload.value.cells.length,125);
});

test('LOSS continues with the exact holes and level greyness, then plays the failed partial assembly before returning control',()=>{
  for(const level of [45,46,50]) {
    const b=browser(),store=b.load(),g=savedGame(store);g.newRun();g.ready(level-1);g.setState('playing');g.player.alive=new Set(shape);g.win();
    // Avoid a scheduled bonus in this test; its independent resume path is covered below.
    if(store.value.stage==='bonus'){g.tick(3.5);g.continue();g.setState('bonus_playing');g.bonus.result='timeout';g.tick(.01);}
    const checkpoint=store.value;assert.equal(checkpoint.level,level);assert.deepEqual(checkpoint.cells,shape);
    const r=savedGame(b.load());r.resumeCheckpoint(checkpoint);welcome(r);
    while(r.state.endsWith('_intro'))r.tick(5.01);
    assert.equal(r.state,'level_ready');assert.deepEqual([...r.player.alive],shape);assert.equal(r.missingEntryCells.length,125-shape.length);
    r.tick(1.66);assert.equal(r.state,'loss_assembly');r.tick(LOSS_ASSEMBLY.scatterAt+.01);assert.equal(r.events.filter(e=>e.name==='loss_weep').length,1);
    const renderer=Object.create(Renderer.prototype),grey=renderer.lossColor(r,[1,0,.4]);
    assert.equal(r.level,level);assert.ok(lossGreyAmount(level)>0);
    if(level===50)assert.ok(Math.abs(grey[0]-grey[1])<1e-12&&Math.abs(grey[1]-grey[2])<1e-12);
    enter(r);assert.deepEqual([...r.player.alive],shape);assert.equal(r.player.fragments.length,0);
    r.player.alive=new Set(shape.slice(10));r.retry();assert.deepEqual([...r.player.alive],shape);
    assert.deepEqual(b.load().value.cells,shape,'Reload and retry share the entry checkpoint, never a full replacement body');
  }
});

test('bonus checkpoints preserve the normal LOSS body and bank each completed bonus once across page reloads',()=>{
  for(const after of [5,45])for(const result of ['escaped','timeout']) {
    const b=browser(),store=b.load(),g=savedGame(store);g.newRun();g.ready(after);g.setState('playing');g.player.alive=new Set(shape);g.win();
    assert.equal(store.value.stage,'bonus');assert.equal(store.value.level,after+1);const baseScore=store.value.score;
    const r=savedGame(b.load());r.resumeCheckpoint(store.value);welcome(r);assert.equal(r.state,'bonus_intro');
    assert.equal(r.bonusPreview,false);assert.ok(r.bonusesPlayedAfter.has(after));
    r.setState('bonus_playing');r.bonus.collected=12;r.bonus.result=result;r.tick(.01);
    const completed=b.load().value;assert.equal(completed.stage,'level');assert.equal(completed.level,after+1);
    assert.equal(completed.score,baseScore+(result==='escaped'?1200:0));assert.equal(completed.runStats.bonusRounds,1);
    assert.deepEqual(completed.cells,after===45?shape:cells.map((_,i)=>i));
    const next=savedGame(b.load());next.resumeCheckpoint(completed);welcome(next);enter(next);
    assert.equal(next.level,after+1);assert.equal(next.bonus,null);assert.equal(next.score,completed.score);assert.deepEqual([...next.player.alive],completed.cells);
  }
});

test('clearing 50 saves the ending without duplicating its award; finishing the ending clears Continue',()=>{
  const b=browser(),store=b.load(),g=savedGame(store);g.newRun();g.ready(50,{survivors:shape});g.setState('playing');g.win();
  assert.equal(store.value.stage,'ending');const checkpoint=store.value,score=g.score;
  const r=savedGame(b.load());r.resumeCheckpoint(checkpoint);welcome(r);assert.equal(r.state,'ascension');assert.equal(r.score,score);
  r.tick(ASCENSION_TIMING.flySeconds);r.tick(ASCENSION_TIMING.whiteHoldSeconds);r.tick(ASCENSION_TIMING.thankYouStarts);
  assert.equal(r.state,'thank_you_note');r.tick(THANK_YOU_TIMING.continueAfter);r.continue();r.tick(1);r.continue();
  assert.equal(r.state,'title');assert.equal(b.load().value,null);assert.equal(r.score,score);
});

test('console previews and debug jumps cannot replace or clear a saved campaign, while visual queries leave saving active',()=>{
  for(const command of ['test end_portal','test ending_1','thank_you_note','test loss','test change_1','test bonus_round_1','level 50','set level 44','heal','cubes 2','portal','score 500']) {
    const b=browser(),store=b.load(),g=savedGame(store);g.newRun();g.ready(6);const raw=b.entries.get(SAVE_KEY),count=b.writes.length;
    g.command(command);assert.equal(g.campaignSaving,false,command);
    g.setState('playing');g.win();g.setState('run_summary');g.stateTime=1;g.continue();
    assert.equal(b.entries.get(SAVE_KEY),raw,command);assert.equal(b.writes.length,count,command);
  }
  const b=browser(),g=savedGame(b.load());g.newRun();
  for(const command of ['viewconfig','status loss','set end_portal false','set route_outline_opacity .5'])g.command(command);
  assert.equal(g.campaignSaving,true);assert.throws(()=>g.command('level invalid'));assert.equal(g.campaignSaving,true);
});

test('malformed, incompatible and blocked browser storage fail safely and never touch other games or preferences',()=>{
  const b=browser(),g=savedGame(b.load());g.newRun();const valid=b.load().value;
  for(const data of [null,{}, {...valid,schema:99},{...valid,level:51},{...valid,cells:[]},{...valid,cells:[1,1]},{...valid,cells:[125]},
    {...valid,score:NaN},{...valid,runStats:{...valid.runStats,deaths:-1}},{...valid,stage:'ending'}])assert.equal(validateCheckpoint(data),null);
  b.entries.set('other-game','kept');b.entries.set('cube-libre-scores-v1','kept');b.entries.set(SAVE_KEY,'{broken');
  const corrupt=b.load();assert.equal(corrupt.value,null);assert.equal(corrupt.status,'incompatible');assert.equal(b.entries.get(SAVE_KEY),'{broken');
  assert.equal(corrupt.save({}),false);assert.equal(b.entries.get(SAVE_KEY),'{broken');
  corrupt.save(valid);assert.deepEqual(b.load().value,valid);corrupt.save(null);
  assert.equal(b.entries.get('other-game'),'kept');assert.equal(b.entries.get('cube-libre-scores-v1'),'kept');
  const denied=new CheckpointStore(()=>{throw Error('blocked');});assert.equal(denied.status,'unavailable');assert.equal(denied.save(valid),false);assert.deepEqual(denied.value,valid);
  const quota=new CheckpointStore(()=>({getItem:()=>null,setItem(){throw Error('quota');}}));assert.equal(quota.save(valid),false);assert.match(quota.note,/only.*while this page stays open/);
  const untouched=new Game({gameMode:50});untouched.score=10;assert.equal(untouched.resumeCheckpoint({schema:99}),false);assert.equal(untouched.score,10);assert.equal(untouched.state,'title');
});

test('the actual white welcome UI sequences its lines, holds, fades, and ignores early continue and pause time',()=>{
  const b=browser(),g=savedGame(b.load());g.newRun();g.ready(6);const r=new Game({gameMode:50});r.resumeCheckpoint(b.load().value);
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("    } else if(s==='resume_intro') {"),end=source.indexOf('    } else if(phase)',start);
  const code=source.slice(start,end).replace('    } else if','if')+'}';
  const nodes=Object.fromEntries(['card','card-title','card-subtitle','card-detail'].map(id=>[id,{style:{}}]));
  const ui=()=>vm.runInNewContext(code,{s:r.state,game:r,RESUME_TIMING,smooth,$:id=>nodes[id]});
  for(const [time,main,subtitle] of [[0,0,0],[1,1,0],[1.5,1,0],[2.25,1,.5],[3,1,1],[4.5,1,1],[5.25,.5,1]]) {
    r.stateTime=time;ui();assert.ok(Math.abs(Number(nodes.card.style.opacity)-main)<1e-9);assert.ok(Math.abs(Number(nodes['card-subtitle'].style.opacity)-subtitle)<1e-9);
    assert.equal(nodes['card-title'].textContent,'Continuing from level 6 ...');assert.equal(nodes['card-subtitle'].textContent,'Welcome back.');r.continue();assert.equal(r.state,'resume_intro');
  }
  for(const flag of ['paused','help']) {r[flag]=true;r.tick(10);assert.equal(r.stateTime,5.25);r[flag]=false;}
  r.tick(.76);assert.equal(r.state,'change_2_intro');
});

test('title Continue starts on touch/controller without awaiting audio, while New run requires a deliberate replacement choice',async()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const b=browser(),store=b.load(),original=savedGame(store);original.newRun();original.ready(6);
  for(const mobile of [true,false]) {
    const game=new Game({saveCheckpoint:d=>store.save(d)}),nodes={start:{}},ctx={game,campaignStore:store,$:id=>nodes[id],controllerAction:false,controllerAudioPending:false,loadingStart:false,audioProgress:'',audioWarning:'',
      mobile:{enabled:mobile},audio:{muted:false,unlock:()=>new Promise(()=>{})},clearInput(){},focusGame(){},syncAudio(){},closeModal(){},modal(kind,title,body,actions){ctx.actions=actions;}};
    vm.createContext(ctx);const start=source.indexOf('  async function start('),end=source.indexOf('  function unlockControllerAudio()',start);vm.runInContext(source.slice(start,end),ctx);
    await ctx.startOrContinue({controller:!mobile});assert.equal(game.state,'resume_intro');assert.equal(game.level,6);assert.equal(game.gameMode,50);assert.equal(nodes.start.disabled,false);
    game.title();ctx.requestNewRun();assert.equal(game.state,'title');assert.equal(store.value.level,6);
    ctx.actions[0][1]();assert.equal(store.value.level,6,'Cancelling keeps the saved run');
    // Use muted audio so a deliberate desktop restart is also synchronous.
    ctx.audio.muted=true;ctx.actions[1][1]();assert.equal(game.level,1);assert.equal(store.value.level,1);assert.equal(game.state,'opening_intro');assert.equal(game.gameMode,20);assert.equal(store.value.gameMode,20);
    original.ready(6);
  }
});

test('title text and cube logo both start or resume, while repeats and blocked activations are ignored',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  for(const touch of [true,false])for(const saved of [true,false])for(const target of ['start','title-logo']) {
    const b=browser(),store=b.load();
    if(saved){const original=savedGame(store);original.newRun();original.ready(6);}
    const game=new Game({saveCheckpoint:data=>store.save(data)}),nodes={};
    for(const id of ['start','title-logo','new-run','next','modal','console','start-label','save-note'])nodes[id]={open:false,setAttribute(k,v){this[k]=v;}};
    const ctx={game,campaignStore:store,$:id=>nodes[id],controllerAction:false,controllerAudioPending:false,loadingStart:false,audioProgress:'',audioWarning:'',connected:false,
      mobile:{enabled:touch},audio:{muted:true},clearInput(){},focusGame(){},syncAudio(){},dots(text){ctx.prompt=text;}};
    vm.createContext(ctx);
    vm.runInContext(source.slice(source.indexOf('  async function start('),source.indexOf('  function unlockControllerAudio()')),ctx);
    vm.runInContext(source.slice(source.indexOf("  $('start').onclick="),source.indexOf("  $('settings').onclick=")),ctx);
    assert.equal(nodes.start.onclick,nodes['title-logo'].onclick);
    vm.runInContext(source.slice(source.indexOf('      const resume=!!campaignStore.value'),source.indexOf("      $('title-stats').textContent=")),ctx);
    assert.equal(ctx.prompt,touch?saved?'TAP TO CONTINUE':'TAP TO START':saved?'SPACE / ENTER = CONTINUE':'SPACE / ENTER = NEW RUN');
    assert.equal(nodes['title-logo'].hidden,false);assert.match(nodes['title-logo']['aria-label'],saved?/Continue from level 6/:/Start a new run/);
    const snapshot=()=>JSON.stringify({state:game.state,level:game.level,save:store.value});
    const before=snapshot();
    for(const field of ['paused','help']){game[field]=true;nodes[target].onclick();assert.equal(snapshot(),before);game[field]=false;}
    for(const id of ['modal','console']){nodes[id].open=true;nodes[target].onclick();assert.equal(snapshot(),before);nodes[id].open=false;}
    ctx.loadingStart=true;nodes[target].onclick();assert.equal(snapshot(),before);ctx.loadingStart=false;
    nodes[target].onclick();assert.equal(game.state,saved?'resume_intro':'opening_intro');assert.equal(game.level,saved?6:1);
    const started=snapshot();nodes[target].onclick();assert.equal(snapshot(),started,'A repeated title click cannot restart the run or skip its introduction');
    if(saved)assert.equal(store.value.level,6,'Logo Continue does not replace the saved journey');
  }
});
