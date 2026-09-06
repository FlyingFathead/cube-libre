import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,Player,V,Laser,Module,laserTemplates} from '../../web/js/core.mjs';
import {CHANGES,Shutters,createChangeSettings,shutterLoss,shutterGateCount,shutterInterval,CHANGE_NUMBERS} from '../../web/js/changes.mjs';
import {introductionsForLevel,introductionCard} from '../../web/js/difficulty.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function game(level=7) {
  const g=new Game({rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.change_1_random_per_leg=false;g.flags.suction=false;g.flags.spin=false;
  return g;
}
function step(g,seconds) {for(let i=0;i<Math.ceil(seconds*100);i++)g.updateShutters(.01);}
function onGrid(g) {const l=g.course.lasers[0];g.player.origin=l.center;return l;}

test('CHANGE 1 uses its configurable level, ordered banner and uniform boolean/numeric console controls',()=>{
  const g=game(6);assert.equal(g.flags.change_1,true);
  assert.equal(g.shutterState(g.course.lasers[0]),null);
  assert.deepEqual(introductionsForLevel(7),['change_1_intro']);
  assert.deepEqual(introductionCard('change_1_intro',7),{title:'CHANGE ...',subtitle:CHANGES.change_1.description,detail:CHANGES.change_1.detail});
  g.command('set change_1_min_level 5');
  assert.deepEqual(introductionsForLevel(5,true,g.changeSettings),['time_intro','change_1_intro']);
  for(const [name,value] of [['change_1_interval',5],['change_1_closed_seconds',1.2],['change_1_warning_seconds',.5],['change_1_damage_fraction',.4],['change_1_damage_cooldown',2.5]]) {
    assert.equal(g.command(`set ${name} ${value}`),`${name} set to ${value}`);
    for(const alias of ['set','view','status'])assert.equal(g.command(`${alias} ${name}`),`Status for ${name} is: ${value}`);
    assert.throws(()=>g.command(`toggle ${name}`),/cannot be toggled/);
    assert.throws(()=>g.command(`set ${name} on`),/cannot be toggled/);
  }
  const previous={...g.changeSettings};
  for(const cmd of ['set change_1_interval 1','set change_1_interval NaN','set change_1_min_level 2.5','set change_1_damage_fraction 2','set change_1_closed_seconds -1','set change_1_interval 5 extra'])assert.throws(()=>g.command(cmd));
  assert.deepEqual(g.changeSettings,previous);
  g.command('set change_1_min_level 0');g.ready(1);g.setState('playing');g.updateShutters(0);assert.ok(g.shutterState(g.course.lasers[0]));
  g.command('set change_1 off');assert.equal(g.shutterState(g.course.lasers[0]),null);
  assert.deepEqual(introductionsForLevel(1,true,g.changeSettings,g.flags),[]);
  g.command('test change_1');assert.equal(g.state,'change_1_intro');assert.equal(g.level,1);assert.equal(g.flags.change_1,true);
  g.newRun();for(let i=0;i<1110;i++)g.tick(1/120);assert.equal(g.state,'change_1_intro');
});

test('counts ramp gently, overrides and all tuning values have validated console access',()=>{
  const g=game(),c=g.changeSettings;
  for(const [level,count] of [[1,0],[6,0],[7,1],[21,1],[22,2],[35,2],[36,3],[49,3],[50,4]])assert.equal(shutterGateCount(level,c),count);
  for(const [key,rule] of Object.entries(CHANGE_NUMBERS)) {
    assert.match(g.command(`viewconfig`),new RegExp(key));
    assert.equal(g.command(`set ${key} ${rule.value}`),`${key} set to ${rule.value}`);
    for(const alias of ['view','status','set'])assert.equal(g.command(`${alias} ${key}`),`Status for ${key} is: ${rule.value}`);
  }
  g.command('set change_1_gates_per_leg 2');assert.equal(shutterGateCount(7,c),2);assert.equal(shutterGateCount(50,c),2);
  g.command('set change_1_gates_per_leg 0');g.command('set change_1_ramp_end_level 10');assert.equal(shutterGateCount(10,c),4);
  const snapshot={...c};for(const cmd of ['set change_1_max_simultaneous 0','set change_1_start_gates 5','set change_1_ramp_end_level 6','set change_1_gates_per_leg 1.5'])assert.throws(()=>g.command(cmd));
  assert.deepEqual(c,snapshot);g.command('set change_1_gate_cooldown 5');near(shutterInterval(c),6.2);
  assert.equal(g.command('toggle change_1_no_repeat_leg'),'change_1_no_repeat_leg set to false');
  assert.equal(g.command('status change_1_no_repeat_leg'),'Status for change_1_no_repeat_leg is: Disabled');
});

test('one global pulse warns, closes at most two gates, alternates revealed legs and keeps an open cooldown',()=>{
  const s=new Shutters(()=>.5),c=createChangeSettings(),legs=new Map([[0,5],[1,5],[2,5]]),closed=[],opened=[];
  s.schedule(legs,50,c,true,true);
  const first=s.pulse;near(first.warnsAt,2.8);near(first.closesAt,3.2);near(first.opensAt,4);
  assert.equal(s.stateFor(first.leg,first.gates[0],3).warning,true);
  assert.equal(s.stateFor(first.leg,first.gates[0],3).closed,false);
  for(let i=0;i<3200;i++) {
    s.tick(.01);for(const event of s.schedule(legs,50,c,true,true))(event.name==='shutter_close'?closed:opened).push(event);
    const active=[...legs.keys()].flatMap(leg=>Array.from({length:5},(_,gate)=>s.stateFor(leg,gate)?.closed?1:0));
    assert.ok(active.reduce((a,b)=>a+b,0)<=2);
  }
  assert.ok(closed.length>=7);
  for(let i=1;i<closed.length;i++) {
    assert.notEqual(closed[i].leg,closed[i-1].leg);
    assert.ok(closed[i].warnsAt-closed[i-1].opensAt>=c.change_1_gate_cooldown-1e-8);
  }
  assert.ok(opened.length>=7);assert.ok(new Set(closed.map(e=>e.gates.join(','))).size>1);
  const pools=Array.from({length:20},(_,i)=>s.selectedGates(i,5,50,c,true).join(','));assert.ok(new Set(pools).size>2);
  assert.deepEqual(s.selectedGates(0,5,7,c,false),[0]);
  c.change_1_max_simultaneous=1;s.restart();s.schedule(legs,50,c);assert.equal(s.pulse.gates.length,1);
});

test('a lone leg waits after its zap; disabling no-repeat permits another; hidden legs preserve the rest budget',()=>{
  const s=new Shutters(()=>.5),c=createChangeSettings(),legs=new Map([[0,5]]);
  const advance=(n,repeat=true)=>{const events=[];for(let i=0;i<n*100;i++){s.tick(.01);events.push(...s.schedule(legs,50,c,false,repeat));}return events;};
  s.schedule(legs,50,c,false,true);
  assert.equal(advance(20).filter(e=>e.name==='shutter_close').length,1);assert.equal(s.pulse,null);
  legs.set(1,5);s.schedule(legs,50,c,false,true);assert.equal(s.pulse.leg,1);near(s.pulse.warnsAt,s.time);
  assert.ok(advance(8).filter(e=>e.name==='shutter_close').every((e,i)=>e.leg===(i%2?0:1)));
  s.restart();legs.delete(1);s.schedule(legs,50,c,false,false);
  assert.ok(advance(13,false).filter(e=>e.name==='shutter_close').length>=3);
  s.restart();s.schedule(legs,50,c,false,false);advance(3.3,false);const canceled=s.pulse;
  legs.delete(0);legs.set(1,5);s.schedule(legs,50,c,false,true);
  assert.equal(s.pulse.leg,1);assert.ok(s.pulse.warnsAt>=canceled.opensAt+c.change_1_gate_cooldown);
  assert.equal(s.stateFor(0,0),null);
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
    const g=game(mode==='below'?6:7);g.updateShutters(0);step(g,3.3);onGrid(g);
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
  assert.equal(g.state,'change_1_intro');assert.equal(g.paused,false);assert.equal(g.level,7);
});
