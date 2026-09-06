import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,Player,V,Laser,Module,laserTemplates} from '../../web/js/core.mjs';
import {CHANGES,Shutters,createChangeSettings,shutterLoss} from '../../web/js/changes.mjs';
import {introductionsForLevel,introductionCard} from '../../web/js/difficulty.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function game(level=7) {
  const g=new Game({rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.change_1_random_per_leg=false;g.flags.suction=false;g.flags.spin=false;
  return g;
}
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
  g.command('set change_1_min_level 0');g.ready(1);g.setState('playing');assert.ok(g.shutterState(g.course.lasers[0]));
  g.command('set change_1 off');assert.equal(g.shutterState(g.course.lasers[0]),null);
  assert.deepEqual(introductionsForLevel(1,true,g.changeSettings,g.flags),[]);
  g.command('test change_1');assert.equal(g.state,'change_1_intro');assert.equal(g.level,1);assert.equal(g.flags.change_1,true);
  g.newRun();for(let i=0;i<1110;i++)g.tick(1/120);assert.equal(g.state,'change_1_intro');
});

test('four-second cycles warn, close, reopen and freeze; offsets differ by leg and synchronize when disabled',()=>{
  const s=new Shutters(()=>.5),c=createChangeSettings();
  assert.equal(s.phase(0,c,false,2.79).warning,false);
  assert.equal(s.phase(0,c,false,3).warning,true);
  assert.equal(s.phase(0,c,false,3.2).closed,true);
  assert.equal(s.phase(0,c,false,3.99).closed,true);
  assert.equal(s.phase(0,c,false,4).closed,false);
  const offsets=Array.from({length:50},(_,i)=>s.phase(i,c,true).untilChange);
  assert.equal(new Set(offsets).size,50);assert.ok(offsets.every(x=>x>=.4&&x<=3.2));
  for(let i=0;i<50;i++)near(s.phase(i,c,false).untilChange,3.2);
  const g=game();g.shutters.time=3;g.shutters.immunity=1;
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

test('closure contact halves once, spawns recoverable debris, and gives shared grid immunity through reopening',()=>{
  const g=game(),l=onGrid(g);g.shutters.time=3.19;g.updateShutters(.02);
  assert.equal(g.player.alive.size,63);assert.equal(g.player.fragments.length,62);near(g.shutters.immunity,1.5);
  assert.match(g.message,/SHUTTER HIT: -62 CUBES/);assert.ok(g.rotationShock.hits>0);
  for(let i=0;i<60;i++)g.updateShutters(.01);
  assert.equal(g.player.alive.size,63);assert.equal(g.shutters.contacts.get(l),0);
  g.changeSettings.change_1_closed_seconds=2;g.shutters.time=2.5;g.shutters.immunity=0;g.updateShutters(.01);
  assert.equal(g.player.alive.size,63,'The same closure cannot bite again after cooldown ends');
  g.changeSettings.change_1_closed_seconds=.8;
  g.player.origin=g.player.origin.add(l.center.sub(g.player.pos([...g.player.alive][0])));
  g.shutters.time=7.19;g.updateShutters(.02);
  assert.equal(g.player.alive.size,32);assert.equal(g.player.fragments.length,93);
  g.shutters.time=7.99;g.updateShutters(.02);assert.equal(g.shutterState(l).closed,false);
  const before=g.player.alive.size;g.damage();assert.equal(g.player.alive.size,before,'Reopening beams respect shutter immunity');
  for(let count=1;count<=125;count++)assert.equal(shutterLoss(count,.5),Math.floor(count/2));
  const last=game();last.player.setCount(1);onGrid(last);last.shutters.time=3.2;last.updateShutters(.01);
  assert.equal(last.player.alive.size,1);
});

test('entering an already closed grid hits once; debug immunity, disabled lasers, hidden grids and minimum levels are honored',()=>{
  for(const mode of ['damage','lasers','change_1','below','unrevealed','normal']) {
    const g=game(mode==='below'?6:7),l=onGrid(g);g.shutters.time=3.5;
    if(['damage','lasers','change_1'].includes(mode))g.flags[mode]=false;
    if(mode==='unrevealed')g.course.revealed.clear();
    g.updateShutters(.01);assert.equal(g.player.alive.size,mode==='normal'?63:125);
    if(mode==='normal') {
      const duplicate=new Laser(laserTemplates[0],g.course.modules[0],7);g.course.moduleLasers[0].push(duplicate);
      g.updateShutters(.01);assert.equal(g.player.alive.size,63,'Another overlapping grid cannot compound damage during immunity');
    }
  }
});

test('closure and opening emit one local sound per leg, never a sound storm from distant course grids',()=>{
  const g=game(50);g.events=[];g.shutters.time=3.19;g.updateShutters(.02);
  assert.equal(g.events.filter(e=>e.name==='shutter_close').length,1);
  g.shutters.time=3.99;g.updateShutters(.02);
  assert.equal(g.events.filter(e=>e.name==='shutter_open').length,1);
  g.flags.change_1=false;g.events=[];g.shutters.time=7.19;g.updateShutters(.02);assert.equal(g.events.length,0);
  const heard=[],audio=Object.create(GameAudio.prototype);audio.ready=false;audio.sound=name=>heard.push(name);
  audio.update({events:[{name:'shutter_close'},{name:'shutter_open'}]});assert.deepEqual(heard,['shutter_close','shutter_open']);
});

test('rendered shutters fill the complete opening; the warning stays open and distant previews reveal no shutters',()=>{
  const g=game(),l=g.course.lasers[0],r=Object.create(Renderer.prototype),lines=[],sheets=[];
  r.lines={line:(...v)=>lines.push(v),loop:(...v)=>lines.push(v)};r.shutterPanels={add:(...v)=>sheets.push(v)};
  const warning=g.shutters.phase(0,g.changeSettings,false,3);
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
