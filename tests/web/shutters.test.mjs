import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,Player,V,Laser,Module,laserTemplates} from '../../web/js/core.mjs';
import {CHANGES,Shutters,createChangeSettings,shutterLoss,shutterGateCount,shutterInterval,shutterStepInterval,CHANGE_NUMBERS} from '../../web/js/changes.mjs';
import {introductionsForLevel,introductionCard} from '../../web/js/difficulty.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function game(level=4) {
  const g=new Game({rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.change_1_random_per_leg=false;g.flags.suction=false;g.flags.spin=false;
  return g;
}
function step(g,seconds) {for(let i=0;i<Math.ceil(seconds*100);i++)g.updateShutters(.01);}
function onGrid(g) {const l=g.course.lasers[0];g.player.origin=l.center;return l;}

test('four CHANGE introductions share editable thresholds, flags, captions and previews',()=>{
  const g=game(3);assert.equal(g.flags.change_1,true);
  assert.equal(g.shutterState(g.course.lasers[0]),null);
  for(const [id,level] of [['change_1',4],['change_2',6],['change_3',7],['change_4',8]]) {
    assert.deepEqual(introductionsForLevel(level),[`${id}_intro`]);
    const card=introductionCard(`${id}_intro`,level);
    assert.equal(card.title,'CHANGE ...');assert.equal(card.subtitle,CHANGES[id].description);
    if(id!=='change_1')assert.match(card.detail,/2 SECONDS BETWEEN ZAPS/);
    g.command(`test ${id}`);assert.equal(g.state,`${id}_intro`);assert.equal(g.level,level);
    const clock=g.legTime;for(let n=0;n<590;n++)g.tick(1/120);assert.equal(g.legTime,clock);
    g.tick(.1);assert.equal(g.state,'level_ready');
    assert.equal(g.command(`toggle ${id}`),`${id} set to false`);
    assert.deepEqual(introductionsForLevel(level,true,g.changeSettings,g.flags),[]);
    g.command(`set ${id} on`);
  }
  g.command('set change_1_min_level 5');
  assert.deepEqual(introductionsForLevel(5,true,g.changeSettings),['time_intro','change_1_intro']);
  g.command('set change_2_min_level 5');g.introduceLevel(5);
  for(const expected of ['time_intro','change_1_intro','change_2_intro']) {
    assert.equal(g.state,expected);for(let n=0;n<601;n++)g.tick(1/120);
  }
  assert.equal(g.state,'level_ready');
  g.command('set change_1 off');assert.deepEqual(introductionsForLevel(5,true,g.changeSettings,g.flags),['time_intro']);
  g.command('set change_1_min_level 0');g.command('test change_1');assert.equal(g.level,1);
  g.newRun();for(let n=0;n<1110;n++)g.tick(1/120);assert.equal(g.state,'change_1_intro');
});

test('stage counts, fixed overrides, timing and semitone settings all have validated console access',()=>{
  const g=game(),c=g.changeSettings;
  for(const [level,count] of [[1,0],[3,0],[4,1],[5,1],[6,2],[7,3],[8,4],[22,4],[50,4]])assert.equal(shutterGateCount(level,c),count);
  for(const [key,rule] of Object.entries(CHANGE_NUMBERS)) {
    assert.match(g.command('viewconfig'),new RegExp(key));
    assert.equal(g.command(`set ${key} ${rule.value}`),`${key} set to ${rule.value}`);
    for(const alias of ['view','status','set'])assert.equal(g.command(`${alias} ${key}`),`Status for ${key} is: ${rule.value}`);
  }
  g.command('set change_4 off');assert.equal(shutterGateCount(50,c,5,g.flags),3);
  g.command('set change_3 off');assert.equal(shutterGateCount(50,c,5,g.flags),2);
  g.command('set change_1_gates_per_leg 5');assert.equal(shutterGateCount(4,c,5,g.flags),5);
  g.command('set change_1_gates_per_leg 0');g.command('set change_2_min_level 0');assert.equal(shutterGateCount(4,c,5,g.flags),2);
  const previous={...c};
  for(const cmd of ['set change_1_interval 1','set change_1_step_seconds 1','set change_1_interval NaN','set change_2_min_level 2.5','set change_1_damage_fraction 2','set change_1_closed_seconds -1','set change_1_pitch_2 -13','set change_1_gates_per_leg 1.5','set change_1_interval 5 extra'])assert.throws(()=>g.command(cmd));
  assert.deepEqual(c,previous);
  g.command('set change_1_gate_cooldown 5');near(shutterInterval(c),6.2);near(shutterStepInterval(c),6.2);
  g.command('set change_1_pitch_2 -4.5');near(c.change_1_pitch_2,-4.5);
});

test('sequences use distinct gates at two-second starts, one closed gate globally, then alternate legs',()=>{
  for(const [level,count] of [[4,1],[6,2],[7,3],[8,4],[50,4]])for(const fps of [30,60,120]) {
    const s=new Shutters(()=>.5),c=createChangeSettings(),legs=new Map([[0,5],[1,5]]),events=[];
    s.schedule(legs,level,c,true,true);
    for(let n=0;n<32*fps;n++) {
      s.tick(1/fps);events.push(...s.schedule(legs,level,c,true,true));
      let closed=0;for(const leg of legs.keys())for(let gate=0;gate<5;gate++)closed+=Boolean(s.stateFor(leg,gate)?.closed);
      assert.ok(closed<=1,'Never form a simultaneous wall of gates');
    }
    const closes=events.filter(e=>e.name==='shutter_close'),groups=new Map();
    for(const e of closes) {if(!groups.has(e.sequence))groups.set(e.sequence,[]);groups.get(e.sequence).push(e);}
    const complete=[...groups.values()].filter(seq=>seq.length===count&&seq.at(-1).opensAt<s.time-1e-6);assert.ok(complete.length>=3);
    for(const seq of complete) {
      assert.equal(new Set(seq.map(e=>e.leg)).size,1);assert.equal(new Set(seq.flatMap(e=>e.gates)).size,count);
      seq.forEach((e,i)=>{assert.equal(e.step,i);assert.equal(e.semitones,[0,-3,3,7][i]);assert.equal(e.gates.length,1);
        if(i)near(e.closesAt-seq[i-1].closesAt,2);
        assert.ok(events.some(open=>open.name==='shutter_open'&&open.serial===e.serial&&open.semitones===e.semitones));});
    }
    for(let i=1;i<complete.length;i++) {assert.notEqual(complete[i][0].leg,complete[i-1][0].leg);assert.ok(complete[i][0].closesAt-complete[i-1].at(-1).closesAt>=4-1e-8);}
  }
});

test('four-gate sequences mirror a learnable spatial order and can be switched back to random order',()=>{
  const c=createChangeSettings(),patterns=new Set(),random=new Set();
  for(let seed=0;seed<30;seed++) {
    const s=new Shutters(()=>seed/30),gates=s.selectedGates(0,5,8,c,true);
    assert.ok(['1,4,0,3','3,0,4,1'].includes(gates.join(',')));assert.ok(!gates.includes(2));patterns.add(gates.join(','));
    const free=s.selectedGates(0,5,8,c,true,{change_4_pattern:false});assert.equal(new Set(free).size,4);random.add(free.join(','));
    for(const level of [6,7]) {const order=s.selectedGates(1,5,level,c,true);assert.equal(new Set(order).size,level-4);}
  }
  assert.equal(patterns.size,2);assert.ok(random.size>5);
  const g=game();assert.equal(g.command('toggle change_4_pattern'),'change_4_pattern set to false');
});

test('a lone leg finishes its sequence then waits; disappearing legs abort pending steps with a cooldown',()=>{
  const s=new Shutters(()=>.5),c=createChangeSettings(),legs=new Map([[0,5]]);
  const advance=(seconds,repeat=true)=>{const events=[];for(let i=0;i<seconds*100;i++){s.tick(.01);events.push(...s.schedule(legs,8,c,false,repeat));}return events;};
  s.schedule(legs,8,c,false,true);assert.equal(advance(20).filter(e=>e.name==='shutter_close').length,4);
  assert.equal(s.pulse,null);legs.set(1,5);s.schedule(legs,8,c,false,true);assert.equal(s.pulse.leg,1);
  assert.equal(advance(7).filter(e=>e.name==='shutter_close').length,4);
  s.restart();legs.delete(1);s.schedule(legs,8,c,false,false);assert.ok(advance(21,false).filter(e=>e.name==='shutter_close').length>=8);
  s.restart();s.schedule(legs,8,c,false,true);advance(3.3);const old=s.pulse;
  legs.delete(0);legs.set(1,5);s.schedule(legs,8,c,false,true);
  assert.equal(s.pulse.leg,1);assert.equal(s.pulse.step,0);assert.ok(s.pulse.warnsAt>=old.opensAt+c.change_1_gate_cooldown);
  assert.equal(s.stateFor(0,old.gates[0]),null);
  assert.ok(advance(10).filter(e=>e.name==='shutter_close').every(e=>e.leg===1));
});

test('pause, Help, course materialization and bonus rounds do not advance shutter time',()=>{
  const g=game();g.updateShutters(0);g.shutters.time=3;g.shutters.immunity=1;
  for(const flag of ['paused','help']){g[flag]=true;g.tick(10);g[flag]=false;near(g.shutters.time,3);near(g.shutters.immunity,1);}
  g.ready(7);near(g.shutters.time,0);near(g.shutters.immunity,0);
  g.setState('course_materialize');g.tick(1);near(g.shutters.time,0);
  g.startBonus('001');g.tick(1);near(g.shutters.time,0);
});

test('a closed sheet covers the entire rotating square including beam-free gaps on all route axes',()=>{
  for(const dir of [[1,0,0],[0,1,0],[0,0,1],[-1,0,0]])for(const template of laserTemplates) {
    const l=new Laser(template,new Module(0,new V(),dir),7);
    for(const t of [0,.5,3]) {
      assert.equal(l.hits(l.center,t),false,'Ordinary central aperture is safe');
      assert.equal(l.touchesShutter(l.center,t),true,'The shutter seals that aperture');
      assert.equal(l.touchesShutter(l.center.add(new V(50,50,50)),t),false);
    }
  }
});

test('closure halves once, preserves the last cube and gives shared immunity through reopening',()=>{
  const g=game(),l=onGrid(g);g.flags.change_1_no_repeat_leg=false;
  g.updateShutters(0);step(g,3.21);
  assert.equal(g.player.alive.size,63);assert.equal(g.player.fragments.length,62);assert.ok(g.shutters.immunity>1.47);
  assert.match(g.message,/SHUTTER HIT: -62 CUBES/);assert.ok(g.rotationShock.hits>0);
  g.shutters.immunity=0;step(g,.5);assert.equal(g.player.alive.size,63,'Same closure never bites again even after immunity expires');
  assert.equal(g.shutters.contacts.get(l),0);
  step(g,.4);
  g.player.origin=g.player.origin.add(l.center.sub(g.player.pos([...g.player.alive][0])));
  step(g,3.2);assert.equal(g.player.alive.size,32);assert.equal(g.player.fragments.length,93);
  step(g,.7);assert.equal(g.shutterState(l)?.closed??false,false);
  const before=g.player.alive.size;g.damage();assert.equal(g.player.alive.size,before,'Reopening beams respect shared immunity');
  for(let count=1;count<=125;count++)assert.equal(shutterLoss(count,.5),Math.floor(count/2));
  const last=game();last.player.setCount(1);onGrid(last);last.updateShutters(0);step(last,3.3);assert.equal(last.player.alive.size,1);
});

test('entering an already closed grid hits once; immunity, disabled lasers and hidden grids are honored',()=>{
  for(const mode of ['damage','lasers','change_1','below','unrevealed','normal']) {
    const g=game(mode==='below'?3:4);g.updateShutters(0);step(g,3.3);onGrid(g);
    if(['damage','lasers','change_1'].includes(mode))g.flags[mode]=false;
    if(mode==='unrevealed')g.course.revealed.clear();
    g.updateShutters(.01);assert.equal(g.player.alive.size,mode==='normal'?63:125);
    if(mode==='normal') {g.updateShutters(.01);assert.equal(g.player.alive.size,63);}
  }
});

test('each nearby closure has one local sound; distant or disabled grids never cause a sound storm',()=>{
  const g=game(50);g.events=[];g.updateShutters(0);step(g,3.3);
  assert.equal(g.events.filter(e=>e.name==='shutter_close').length,1);
  step(g,.8);assert.equal(g.events.filter(e=>e.name==='shutter_open').length,1);
  g.flags.change_1=false;g.events=[];step(g,4);assert.equal(g.events.length,0);
  const heard=[],audio=Object.create(GameAudio.prototype);audio.ready=false;audio.sound=name=>heard.push(name);
  audio.update({events:[{name:'shutter_close'},{name:'shutter_open'}]});assert.deepEqual(heard,['shutter_close','shutter_open']);
});

test('rendered shutters fill the complete opening; the warning stays open and distant previews reveal no shutters',()=>{
  const g=game(),l=g.course.lasers[0],r=Object.create(Renderer.prototype),lines=[],sheets=[];
  r.lines={line:(...v)=>lines.push(v),loop:(...v)=>lines.push(v)};r.shutterPanels={add:(...v)=>sheets.push(v)};
  g.updateShutters(0);const warning=g.shutters.stateFor(0,0,3);
  r.laser(l,0,false,1,0,warning);assert.equal(sheets.length,0);
  r.laser(l,0,false,1,0,{closed:true});assert.equal(sheets.length,1);
  for(const p of sheets[0][0]) {const q=l.local(p,0);near(q.x,0);near(Math.abs(q.y),l.half);near(Math.abs(q.z),l.half);}
  r.laser(l,0,true,1,0,{closed:true});assert.equal(sheets.length,1);
});

test('test change_1 closes the browser console and starts the actual banner unpaused',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const g=game(),elements={'console-form':{},'console-input':{}},writes=[];g.paused=true;
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game:g,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},focusGame(){},closeConsole(){},audio:{muted:true},write:(...x)=>writes.push(x)});
  elements['console-input'].value='test change_1';elements['console-form'].onsubmit({preventDefault(){}});
  assert.equal(g.state,'change_1_intro');assert.equal(g.paused,false);assert.equal(g.level,4);
});

test('the audio adapter carries step pitches to reusable buffers, including matching reopening sounds',()=>{
  const g=game(8);g.updateShutters(0);step(g,10.1);
  const zaps=g.events.filter(e=>e.name.startsWith('shutter_'));
  assert.deepEqual(zaps.filter(e=>e.name==='shutter_close').map(e=>e.semitones),[0,-3,3,7]);
  assert.deepEqual(zaps.filter(e=>e.name==='shutter_open').map(e=>e.semitones),[0,-3,3,7]);
  const heard=[],adapter=Object.create(GameAudio.prototype);adapter.ready=false;adapter.sound=(...args)=>heard.push(args);
  adapter.update({events:[...zaps]});assert.deepEqual(heard.map(args=>args[4]),zaps.map(e=>e.semitones));
  const audio=Object.create(GameAudio.prototype),sources=[],buffer={duration:.6};
  Object.assign(audio,{ready:true,buffers:new Map([['shutter_close',buffer],['shutter_open',buffer]]),
    manifest:{shutter_close:{duration:.6},shutter_open:{duration:.6}},channels:new Map(),last:new Map(),master:{},
    ctx:{currentTime:0,createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){},stop(){}};sources.push(s);return s;},
      createGain(){return {gain:{setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}};}}});
  for(const semitones of [0,-3,3,7]) {
    audio.ctx.currentTime+=2;audio.sound('shutter_close',undefined,'shutter_close',false,semitones);
    assert.equal(sources.at(-1).buffer,buffer);near(sources.at(-1).playbackRate.value,2**(semitones/12));
  }
  audio.ctx.currentTime+=2;audio.sound('shutter_open');near(sources.at(-1).playbackRate.value,1);
});

test('all numbered preview commands unpause the browser and saved stage flags keep status reads inert',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const g=game(),elements={'console-form':{},'console-input':{}},writes=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game:g,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},focusGame(){},closeConsole(){},audio:{muted:true},write:(...x)=>writes.push(x)});
  const submit=value=>{elements['console-input'].value=value;elements['console-form'].onsubmit({preventDefault(){}});};
  for(const [id,level] of [['change_2',6],['change_3',7],['change_4',8]]) {
    g.paused=true;g.help=true;submit(`test ${id}`);assert.equal(g.state,`${id}_intro`);assert.equal(g.level,level);
    assert.equal(g.paused,false);assert.equal(g.help,false);
    submit(`set ${id} false`);assert.deepEqual(writes.at(-1),[`cube-libre-${id.replaceAll('_','-')}-v1`,false]);
    const count=writes.length;submit(`status ${id}`);assert.equal(writes.length,count);
  }
  submit('set change_4_pattern false');assert.deepEqual(writes.at(-1),['cube-libre-change-4-pattern-v1',false]);
  const line=source.split('\n').find(line=>line.includes("for(const key of ['change_2'"));
  const fresh=game();vm.runInNewContext(line,{game:fresh,read:()=>false});
  for(const key of ['change_2','change_3','change_4','change_4_pattern'])assert.equal(fresh.flags[key],false);
});

test('zero warnings, five-step overrides and extended rest keep gates sequential and every pitch defined',()=>{
  for(const settings of [
    {...createChangeSettings(),change_1_gates_per_leg:5,change_1_warning_seconds:0,change_1_step_seconds:1},
    {...createChangeSettings(),change_1_gate_cooldown:5},
  ]) {
    const s=new Shutters(()=>.5),legs=new Map([[0,5]]),closes=[];s.schedule(legs,8,settings,false,false);
    for(let n=0;n<4000;n++) {
      s.tick(.01);closes.push(...s.schedule(legs,8,settings,false,false).filter(e=>e.name==='shutter_close'));
      assert.ok(Array.from({length:5},(_,i)=>s.stateFor(0,i)?.closed?1:0).reduce((a,b)=>a+b,0)<=1);
    }
    const first=closes.filter(e=>e.sequence===0);
    assert.equal(first.length,settings.change_1_gates_per_leg||4);assert.equal(new Set(first.flatMap(e=>e.gates)).size,first.length);
    first.forEach((e,i)=>{assert.ok(Number.isFinite(e.semitones));if(i){near(e.closesAt-first[i-1].closesAt,shutterStepInterval(settings));assert.ok(e.warnsAt-first[i-1].opensAt>=settings.change_1_gate_cooldown-1e-8);}});
  }
});
