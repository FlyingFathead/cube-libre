import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,V,C} from '../../web/js/core.mjs';
import {PANIC,panicStatus,reachedLeg} from '../../web/js/panic.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
import {validateCheckpoint} from '../../web/js/save-game.mjs';

const duration=PANIC.pullSeconds+PANIC.holdSeconds+PANIC.openSeconds;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function advance(g,seconds,input={}) {for(let i=0;i<Math.round(seconds*120);i++)g.tick(1/120,input);}
function setup(mode=20,level=7) {
  const g=new Game({gameMode:mode,rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.suction=false;return g;
}

test('Panic works inside, can hide until the outside delay, and warns immediately on overheating',()=>{
  const g=setup();assert.equal(panicStatus(g).visible,true);assert.equal(panicStatus(g).enabled,true);
  g.command('panic_show_inactive false');assert.equal(panicStatus(g).visible,false);
  assert.equal(panicStatus(g).enabled,true,'Hidden preference does not disable keyboard/controller rescue');
  assert.equal(g.panicOutsideSeconds,3);g.command('panic_outside_seconds 1.5');
  g.player.origin=new V(-18,12,0);g.thermal(1.4);assert.equal(panicStatus(g).visible,false);
  g.thermal(.2);assert.equal(panicStatus(g).visible,true);assert.equal(panicStatus(g).warning,false);
  g.command('panic_outside_seconds 30');assert.equal(panicStatus(g).visible,false);
  g.thermal(5);assert.equal(panicStatus(g).visible,true);assert.equal(panicStatus(g).warning,true);
  g.player.origin=V.of(C.START_ORIGIN);g.thermal(.01);assert.equal(panicStatus(g).visible,false);
  g.command('panic false');assert.equal(g.requestPanic(),false);
  g.command('panic true');g.player.alive.clear();assert.equal(g.requestPanic(),false);
});

test('rescue checkpoints follow physical reached legs across both routes and never follow a space-location fallback',()=>{
  for(const mode of [20,50]) {
    const g=setup(mode,mode);
    for(const m of g.course.modules) {
      g.player.origin=m.world(-8);g.trackPanicLeg();assert.equal(g.panicLeg,m.index);
      assert.equal(reachedLeg(g.course,g.player.origin),m.index);
    }
    const saved=g.panicLeg;
    g.player.origin=new V(10000,10000,10000);assert.equal(g.course.location(g.player.origin).index,0);
    g.trackPanicLeg();assert.equal(g.panicLeg,saved);
    // A point beside a future leg is only a visibility hint, never a checkpoint.
    const future=g.course.modules[5];g.panicLeg=2;g.player.origin=future.world(0,12,0);
    assert.ok(g.course.location(g.player.origin).index>=5);g.trackPanicLeg();assert.equal(g.panicLeg,2);
    g.course.update(g.player.origin,g.t,()=>{});assert.equal(g.course.collapsed.size,0,'Drifting beside an unreached future leg cannot seal the rescue destination');
  }
});

test('white tractor pull returns the exact survivor shape to every leg start, opens safely, and keeps old pipes sealed',()=>{
  for(const mode of [20,50]) {
    const g=setup(mode,mode);
    for(const m of g.course.modules) {
      g.resetAttempt();g.setState('playing');
      for(const i of [0,4,20,87])g.player.alive.delete(i);
      g.player.setSpinAngles(36,82,143);
      g.player.origin=m.world(0);g.trackPanicLeg();
      for(let i=0;i<m.index;i++)g.course.collapsed.set(i,g.t-4);
      g.player.origin=m.world(0,12,0);g.driftVelocity=new V(3,8,2);g.heat=1;g.outside=true;
      const shape=[...g.player.alive],pose=[...g.player.spinAngles],history=[...g.course.collapsed],score=g.score,from=g.player.origin;
      g.legTime=.01;assert.equal(g.requestPanic(),true);assert.equal(g.message,'PANIC RECOVERY REQUESTED');
      const center=m.index?m.start:V.of(C.START_ORIGIN);
      g.tick(PANIC.pullSeconds/2,{x:1,y:1,z:1,rush:true});
      assert.ok(g.player.origin.sub(center).length()<from.sub(center).length());
      assert.ok(g.player.origin.sub(center).length()>0,'Recall travels through the live scene');
      assert.deepEqual([...g.player.alive],shape);near(g.legTime,g.difficulty.secondsPerLeg);
      advance(g,duration-PANIC.pullSeconds/2+.01);
      assert.equal(g.panic,null);assert.equal(g.state,'playing');assert.ok(g.course.rescueChamber,'The opened prison remains visible until departure');
      assert.deepEqual([...g.player.alive],shape);assert.deepEqual(g.player.spinAngles,pose);
      assert.deepEqual(g.player.origin.array(),center.array());assert.deepEqual(g.driftVelocity.array(),[0,0,0]);
      assert.equal(g.score,score);assert.deepEqual([...g.course.collapsed],history);
      assert.equal(g.course.collapsedSectionAt(g.player.origin),-1);
      const clock=g.legTime;g.tick(1/120);assert.ok(g.legTime<clock);assert.equal(g.state,'playing');
      if(m.index) {
        const previous=g.course.modules[m.index-1];
        assert.equal(g.course.collapsedSectionAt(previous.world(12)),m.index-1,'Old pipe stays lethal');
        g.player.origin=m.world(-10);g.trackPanicLeg();assert.equal(g.course.rescueJoint,-1);
        assert.equal(g.course.collapsedSectionAt(m.start),m.index-1,'Chamber closes after forward departure');
      }
    }
  }
});

test('Panic recovers only existing fragments using normal lossy yield and quota, and does not duplicate pending recovery',()=>{
  for(const mode of [20,50])for(const pending of [false,true])for(const exhausted of [false,true]) {
    const g=setup(mode,mode),control=setup(mode,mode);
    for(const game of [g,control]) {
      for(let i=0;i<25;i++)game.player.destroy(i,game.player.origin);
      game.player.fragments[0].age=8;
      if(exhausted)game.requests=[game.t,game.t,game.t,game.t,game.t];
      if(pending)game.requestRecouple();
    }
    if(!pending)control.requestRecouple();
    control.tickRecouple(1.2);
    g.heat=1;g.outside=true;assert.equal(g.requestPanic(),true);
    advance(g,duration+.02);
    assert.deepEqual([...g.player.alive],[...control.player.alive]);
    assert.equal(g.runStats.recoupledCubes,control.runStats.recoupledCubes);
    assert.equal(g.requests.length,control.requests.length);
    assert.ok(g.player.alive.size<125,'No full-body rebuild or expired-fragment recovery');
  }
});

test('cooldown counts whole seconds, freezes with pause/Help, survives toggles and cannot be bypassed by repeated presses',()=>{
  const g=setup(20,1);assert.equal(g.requestPanic(),true);assert.equal(g.panicCooldown,30);
  const capture=()=>JSON.stringify({t:g.t,panic:g.panic,clock:g.legTime,cooldown:g.panicCooldown,player:g.player.origin});
  for(const field of ['paused','help']) {g[field]=true;const before=capture();g.tick(10);assert.equal(capture(),before);g[field]=false;}
  assert.equal(g.requestPanic(),false);advance(g,duration+.02);
  const seconds=Math.ceil(g.panicCooldown);assert.equal(panicStatus(g).text,`COOLDOWN ${seconds} s`);
  assert.equal(panicStatus(g).enabled,false);assert.equal(g.requestPanic(),false);
  const remaining=g.panicCooldown;g.command('panic false');g.command('panic true');near(g.panicCooldown,remaining);
  g.tick(remaining-.1);assert.equal(panicStatus(g).text,'COOLDOWN 1 s');
  g.tick(.11);assert.equal(panicStatus(g).enabled,true);assert.equal(g.requestPanic(),true);
  for(const state of ['bonus_playing','course_materialize','death_dissolve','ascension','title']) {
    g.setState(state);assert.equal(g.panic,null);assert.equal(g.course.rescueChamber,null);assert.equal(g.requestPanic(),false);assert.equal(panicStatus(g).visible,false);
  }
  g.retry();assert.equal(g.panic,null);assert.equal(g.panicCooldown,0);assert.equal(g.course.rescueJoint,-1);
});

test('rendered prison fits all route axes, opens only its forward bars and draws the white recall beam',()=>{
  const g=setup(50,50),r=Object.create(Renderer.prototype);let drawn=[];
  r.lines={line:(a,b,color,alpha)=>drawn.push({a,b,color,alpha})};
  const dirs=new Set();
  for(const m of g.course.modules) {
    if(dirs.has(m.bx.array().join()))continue;dirs.add(m.bx.array().join());
    g.resetAttempt();g.panicLeg=m.index;g.player.origin=m.world(0,12,0);g.requestPanic();
    drawn=[];r.panicPrison(g);const closed=drawn;
    assert.ok(closed.some(line=>line.color.every(c=>c===1)),'White tractor beam is present');
    for(const line of closed)assert.ok([...line.a.array(),...line.b.array(),line.alpha].every(Number.isFinite));
    g.panic.time=PANIC.pullSeconds+PANIC.holdSeconds+PANIC.openSeconds;
    drawn=[];r.panicPrison(g);
    const forward=drawn.filter(({a,b})=>nearPlane(a)&&nearPlane(b));
    function nearPlane(p){return Math.abs(p.sub(g.panic.center).dot(m.bx)-6)<1e-7;}
    assert.ok(forward.every(({a,b})=>a.sub(b).length()===0||Math.abs(a.sub(g.panic.center).dot(m.by))===6||Math.abs(a.sub(g.panic.center).dot(m.bz))===6),'Forward face has no blocking bars after opening');
  }
  assert.ok(dirs.size>=3);
});

test('Panic browser preferences restore and save through console without replacing campaign checkpoints',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),game=setup(),nodes={'console-form':{},'console-input':{},'console-log':{}},writes=[];
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  vm.runInNewContext(source.slice(start,end),{$:id=>nodes[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write:(...v)=>writes.push(v)});
  const submit=value=>{nodes['console-input'].value=value;nodes['console-form'].onsubmit({preventDefault(){}});};
  for(const key of ['panic','panic_show_inactive']) {
    submit(`set ${key} false`);assert.equal(game.flags[key],false);assert.equal(writes.at(-1)[1],false);
    const before=writes.length;submit(`status ${key}`);assert.equal(writes.length,before);
  }
  const a=source.indexOf('  game.flags.panic_show_inactive='),b=source.indexOf('  game.flags.shake=',a);
  const restored=setup();vm.runInNewContext(source.slice(a,b),{game:restored,read:()=>false});
  assert.equal(restored.flags.panic,false);assert.equal(restored.flags.panic_show_inactive,false);
  for(const key of ['panic_outside_seconds','panic_cooldown_seconds']) {
    const value=game.command(`get ${key}`);for(const bad of ['-1','NaN','off','9999'])assert.throws(()=>game.command(`set ${key} ${bad}`));
    assert.equal(game.command(`get ${key}`),value);
  }
  const saves=[];game.saveCheckpoint=value=>saves.push(value);game.newRun();game.setState('playing');const count=saves.length;
  game.flags.panic=true;game.requestPanic();advance(game,duration+.01);assert.equal(saves.length,count);
});

test('optional Panic penalty defaults off, charges once per accepted use, compounds and leaves all-time records alone',()=>{
  for(const mode of [20,50]) {
    const g=setup(mode,1);g.score=1000;g.stats.best_score=50000;
    const records=JSON.stringify(g.modeRecords);
    assert.equal(g.flags.panic_penalty,false);assert.equal(g.panicScorePenaltyPercent,5);
    assert.equal(g.requestPanic(),true);assert.equal(g.score,1000);assert.equal(g.message,'PANIC RECOVERY REQUESTED');
    advance(g,duration+.02);g.panicCooldown=0;
    g.command('set panic_penalty on');assert.equal(g.requestPanic(),true);
    assert.equal(g.score,950);assert.match(g.message,/SCORE -50 \(5%\)/);
    assert.equal(g.requestPanic(),false);assert.equal(g.score,950);
    advance(g,duration+.02);assert.equal(g.requestPanic(),false);assert.equal(g.score,950);
    g.panicCooldown=0;assert.equal(g.requestPanic(),true);assert.equal(g.score,902,'47.5 points rounds to 48');
    advance(g,duration+.02);g.panicCooldown=0;
    for(const field of ['paused','help']) {g[field]=true;assert.equal(g.requestPanic(),false);assert.equal(g.score,902);g[field]=false;}
    g.flags.panic=false;assert.equal(g.requestPanic(),false);assert.equal(g.score,902);g.flags.panic=true;
    for(const state of ['title','bonus_playing','course_materialize','death_dissolve','ascension']) {
      g.setState(state);assert.equal(g.requestPanic(),false);assert.equal(g.score,902);
    }
    g.setState('playing');g.command('set panic_penalty off');assert.equal(g.requestPanic(),true);assert.equal(g.score,902);
    assert.equal(JSON.stringify(g.modeRecords),records);
  }
});

test('Panic penalty console tuning is inert until rescue and saves deductions with the existing entrance checkpoint',()=>{
  const saves=[],g=new Game({rng:()=>.5,saveCheckpoint:data=>saves.push(structuredClone(data))});
  g.newRun();g.ready(17,{survivors:[0,1,2,3,4]});g.setState('playing');g.score=1000;g.checkpoint();
  const entry=saves.at(-1),count=saves.length;
  g.command('set panic_score_penalty_percent 2.5');g.command('set panic_penalty true');
  for(const key of ['panic_penalty','panic_score_penalty_percent'])for(const verb of ['get','view','status'])g.command(`${verb} ${key}`);
  assert.match(g.command('viewconfig'),/panic_score_penalty_percent \| 2.5/);
  assert.equal(saves.length,count);assert.equal(g.score,1000);
  for(const value of ['-1','101','NaN','Infinity','off'])assert.throws(()=>g.command(`set panic_score_penalty_percent ${value}`));
  assert.equal(g.panicScorePenaltyPercent,2.5);
  g.player.alive.delete(4);g.requestPanic();assert.equal(g.score,975);assert.equal(saves.length,count+1);
  const saved=saves.at(-1);assert.ok(validateCheckpoint(saved));
  assert.deepEqual(saved,{...entry,score:975});assert.deepEqual([...g.player.alive],[0,1,2,3]);
  g.command('set panic_score_penalty_percent 50');g.tick(PANIC.pullSeconds+.01);
  assert.match(g.message,/SCORE -25 \(2.5%\)/,'An in-progress recall retains the cost actually charged');
  const restored=new Game();assert.equal(restored.resumeCheckpoint(saved),true);restored.restoreCheckpoint();
  assert.equal(restored.score,975);assert.deepEqual([...restored.player.alive],entry.cells);
  g.retry();assert.equal(g.score,975);g.setState('playing');g.command('set panic_score_penalty_percent 0');
  g.requestPanic();assert.equal(g.score,975);advance(g,duration+.02);g.panicCooldown=0;
  g.command('set panic_score_penalty_percent 100');g.requestPanic();assert.equal(g.score,0);
  advance(g,duration+.02);g.panicCooldown=0;g.requestPanic();assert.equal(g.score,0,'Score cannot become negative');
  g.score=1000;g.command('test end_portal');const previewCount=saves.length;
  g.requestPanic();assert.equal(saves.length,previewCount,'Preview cannot rewrite a campaign save');
});

test('Panic sound is emitted once and drops timer sirens through the live rescue',()=>{
  const g=setup();g.events=[];g.legTime=.1;g.requestPanic();g.requestPanic();
  const played=[],stopped=[],audio=Object.create(GameAudio.prototype);audio.ready=true;
  audio.sound=(...v)=>played.push(v);audio.stop=name=>stopped.push(name);audio.stopAll=()=>{};
  audio.update(g);audio.update(g);assert.equal(played.filter(v=>v[0]==='panic').length,1);
  assert.ok(!played.some(v=>['time_siren','time_buzzer','time_tick'].includes(v[0])));
  assert.ok(stopped.includes('time_siren'));
});


test('V activates the actual keyboard recall once and respects modifiers, dialogs, pause and disabled Panic',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),game=setup(),events={},nodes={modal:{open:false},console:{open:false}};
  const a=source.indexOf('  const keyCodes='),b=source.indexOf("  window.addEventListener('keyup'",a);
  let clears=0;
  vm.runInNewContext(source.slice(a,b),{game,window:{addEventListener:(name,fn)=>events[name]=fn},$:id=>nodes[id],keyboard:new Set(),modalKind:null,clearInput(){clears++;}});
  const press=extra=>events.keydown({code:'KeyV',repeat:false,ctrlKey:false,altKey:false,metaKey:false,preventDefault(){},...extra});
  for(const extra of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true}])press(extra);
  assert.equal(game.panic,null);press();assert.ok(game.panic);assert.equal(clears,1);
  press({repeat:true});press();assert.equal(clears,1);
  game.resetAttempt();nodes.modal.open=true;press();assert.equal(game.panic,null);
  nodes.modal.open=false;nodes.console.open=true;press();assert.equal(game.panic,null);
  nodes.console.open=false;game.paused=true;press();assert.equal(game.panic,null);
  game.paused=false;game.flags.panic=false;press();assert.equal(game.panic,null);
});
