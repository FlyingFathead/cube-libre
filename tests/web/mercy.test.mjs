import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,V,rotate} from '../../web/js/core.mjs';
import {MERCY_NUMBERS} from '../../web/js/mercy.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function game(count=24,level=1,mode=20) {
  const g=new Game({gameMode:mode,rng:()=>.5});g.ready(level);g.setState('playing');
  Object.assign(g.flags,{lasers:false,suction:false,portal:false,spin:false,microgravity:false});
  g.player.setCount(count);g.damageTimer=999;return g;
}
function advance(g,seconds,fps=120) {
  const steps=Math.ceil(seconds*fps);for(let i=0;i<steps;i++)g.tick(seconds/steps);
}
function outside(g) {g.player.origin=new V(-18,12,0);}
function safe(g) {g.player.origin=new V(-18,0,0);}
function burst(g) {
  outside(g);g.damage();advance(g,.16);g.damage();
  assert.equal(g.mercyActive,true);return g;
}

test('rapid boundary damage grants 1.5 seconds at twenty cubes, then ordinary hits resume without an immunity loop',()=>{
  for(const mode of [20,50])for(const fps of [30,60,120]) {
    const g=game(24,1,mode);outside(g);g.damageTimer=0;
    g.tick(1/fps);assert.equal(g.player.alive.size,22);assert.equal(g.mercyActive,false);
    for(let i=0;i<fps&&!g.mercyActive;i++)g.tick(1/fps);
    assert.equal(g.mercyActive,true);assert.equal(g.player.alive.size,20);
    const until=g.mercy.until;near(until-g.mercy.time,1.5);near(g.mercy.readyAt-until,15);
    const body=[...g.player.alive],fragments=g.player.fragments.length;
    while(g.mercy.time+1/fps<until-1e-8) {
      g.tick(1/fps);assert.deepEqual([...g.player.alive],body);assert.equal(g.player.fragments.length,fragments);
      near(g.mercy.until,until);
    }
    for(let i=0;i<fps*3&&g.state==='playing';i++)g.tick(1/fps);
    assert.equal(g.state,'death_dissolve','Remaining in the field still kills after grace expires');
    assert.equal(g.runStats.deaths,1);near(g.mercy.until,until);
  }
});

test('low count, a single hit and spaced hits do not qualify; both burst timing and cube threshold are configurable',()=>{
  const g=game(20);safe(g);advance(g,1);assert.equal(g.mercyActive,false);
  outside(g);g.damage();assert.equal(g.player.alive.size,18);assert.equal(g.mercyActive,false,'Two cells lost in one hit are not two hits');
  safe(g);advance(g,.51);outside(g);g.damage();assert.equal(g.player.alive.size,16);assert.equal(g.mercyActive,false);
  advance(g,.16);g.damage();assert.equal(g.player.alive.size,14);assert.equal(g.mercyActive,true);
  const high=game(30);outside(high);high.damage();advance(high,.16);high.damage();assert.equal(high.player.alive.size,26);assert.equal(high.mercyActive,false);
  const tuned=game(16);tuned.command('set mercy_cube_threshold 10');tuned.command('set mercy_damage_window_seconds .1');
  outside(tuned);tuned.damage();advance(tuned,.16);tuned.damage();assert.equal(tuned.player.alive.size,12);assert.equal(tuned.mercyActive,false);
  advance(tuned,.05);tuned.damage();assert.equal(tuned.player.alive.size,10);assert.equal(tuned.mercyActive,true);
  for(const command of ['set mercy_mode off','set mercy_seconds 0']) {
    const disabled=game();disabled.command(command);outside(disabled);disabled.damage();advance(disabled,.16);disabled.damage();
    assert.equal(disabled.player.alive.size,20);assert.equal(disabled.mercyActive,false);
  }
});

test('an otherwise fatal second hit preserves the last existing cube once, without restoring or duplicating cells',()=>{
  const g=game(3);outside(g);g.damage();assert.equal(g.player.alive.size,1);
  const last=[...g.player.alive];advance(g,.16);g.events=[];
  assert.equal(g.damage(),null);assert.equal(g.mercyActive,true);assert.deepEqual([...g.player.alive],last);
  assert.equal(g.player.fragments.length,2);assert.equal(g.events.length,0);
  advance(g,1.49);assert.equal(g.damage(),null);assert.deepEqual([...g.player.alive],last);
  advance(g,.02);assert.equal(g.damage(),'bounds');assert.equal(g.player.alive.size,0);assert.equal(g.player.fragments.length,3);
  const isolated=game(1);outside(isolated);isolated.damage();assert.equal(isolated.player.alive.size,0);assert.equal(isolated.mercyActive,false);
});

test('laser, shutter and overheated boundary hits share mercy, and a blocked shutter contact cannot bite later in its closure',()=>{
  const g=game(42,4);g.flags.lasers=true;g.flags.change_1_random_per_leg=false;
  for(const [key,value] of [['change_1_interval',12],['change_1_step_seconds',12],['change_1_closed_seconds',10]])g.command(`set ${key} ${value}`);
  g.flags.damage=false;advance(g,3.21);g.flags.damage=true;
  const grid=g.course.lasers[0];assert.equal(g.shutterState(grid).closed,true);
  outside(g);assert.equal(g.damage(),'bounds');assert.equal(g.player.alive.size,40);
  g.player.origin=grid.center;g.updateShutters(.01);
  assert.equal(g.player.alive.size,20);assert.equal(g.mercyActive,true,'A boundary hit and shutter hit form a real burst');
  outside(g);g.heat=1;assert.equal(g.damage(),null);assert.equal(g.player.alive.size,20);

  const laser=burst(game());laser.flags.lasers=true;
  const l=laser.course.lasers[0],cell=[...laser.player.alive][0];
  const offset=rotate(new V(0,5,0),l.axis,l.angle(laser.t));
  const contact=l.center.add(l.module.bx.mul(offset.x)).add(l.module.by.mul(offset.y)).add(l.module.bz.mul(offset.z));
  laser.player.origin=laser.player.origin.add(contact.sub(laser.player.pos(cell)));
  assert.equal(l.hits(laser.player.pos(cell),laser.t),true);
  assert.equal(laser.damage(),null);assert.equal(laser.player.alive.size,20);
  laser.command('set mercy_mode off');assert.equal(laser.damage(),'laser');assert.equal(laser.player.alive.size,18);

  const blocked=game(24,4);blocked.flags.lasers=true;blocked.flags.change_1_random_per_leg=false;
  for(const [key,value] of [['change_1_interval',12],['change_1_step_seconds',12],['change_1_closed_seconds',10]])blocked.command(`set ${key} ${value}`);
  blocked.flags.damage=false;advance(blocked,3.21);blocked.flags.damage=true;
  burst(blocked);const closed=blocked.course.lasers[0];blocked.player.origin=closed.center;
  blocked.updateShutters(0);assert.equal(blocked.shutters.contacts.get(closed),blocked.shutterState(closed).cycle);
  advance(blocked,1.51);assert.equal(blocked.mercyActive,false);assert.equal(blocked.player.alive.size,20);
  assert.equal(blocked.shutterState(closed).closed,true);blocked.updateShutters(.01);assert.equal(blocked.player.alive.size,20);
});

test('cooldown lasts fifteen seconds after protection, survives toggles and needs a new burst before it can trigger again',()=>{
  const g=burst(game());safe(g);const until=g.mercy.until,ready=g.mercy.readyAt;
  g.command('set mercy_mode off');g.command('set mercy_mode on');assert.equal(g.mercyActive,false);assert.equal(g.mercy.readyAt,ready);
  outside(g);g.damage();advance(g,.16);g.damage();assert.equal(g.mercyActive,false);
  safe(g);advance(g,until-g.mercy.time+14.9);outside(g);g.damage();assert.equal(g.mercyActive,false);
  safe(g);advance(g,.11);outside(g);g.damage();assert.equal(g.mercyActive,true);near(g.mercy.until-g.mercy.time,1.5);
  const idle=burst(game());safe(idle);advance(idle,17);assert.equal(idle.mercyActive,false);
  outside(idle);idle.damage();assert.equal(idle.mercyActive,false,'Time spent waiting is not a damage burst');
  advance(idle,.16);idle.damage();assert.equal(idle.mercyActive,true);
});

test('mercy clocks freeze for pause, Help, setup and Panic; new attempts reset them and checkpoints contain no live protection',()=>{
  const g=burst(game());const snapshot=()=>JSON.stringify(g.mercy),active=snapshot();
  for(const flag of ['paused','help']) {g[flag]=true;g.tick(30);assert.equal(snapshot(),active);g[flag]=false;}
  g.setState('course_materialize');g.tick(.5);assert.equal(snapshot(),active);g.setState('playing');
  assert.equal(g.requestPanic(),true);advance(g,2.75);g.tick(.001);assert.equal(g.panic,null);assert.equal(snapshot(),active);
  advance(g,.1);near(g.mercy.time,JSON.parse(active).time+.1);
  let saved;g.saveCheckpoint=value=>{saved=value;};g.campaignSaving=true;g.checkpoint();
  assert.ok(saved);assert.equal('mercy' in saved,false);assert.deepEqual(saved.cells,[...g.entryCells]);
  const resumed=game();resumed.resumeCheckpoint(saved);resumed.restoreCheckpoint();
  assert.equal(resumed.mercy.active,false);assert.equal(resumed.mercy.readyAt,0);
  g.retry();assert.equal(g.mercy.active,false);assert.equal(g.mercy.readyAt,0);assert.equal(g.mercy.lastHit,null);
  const bonus=burst(game());const before=JSON.stringify(bonus.mercy);bonus.startBonus('001');advance(bonus,.5);
  assert.equal(JSON.stringify(bonus.mercy),before);assert.equal(bonus.state,'bonus_intro');
});

test('grace leaves recovery loss, rejected debris, heat restrictions and leg deaths intact, with no queued damage after escape',()=>{
  const g=burst(game(24,10));assert.equal(g.player.fragments.length,4);g.requestRecouple();
  assert.equal(g.recoupling.length,2);assert.equal(g.recoverableFragments.length,0);
  assert.equal(g.player.fragments.filter(f=>f.lostAge!==undefined).length,2);
  safe(g);advance(g,1.2);assert.equal(g.player.alive.size,22);assert.equal(g.recoupling.length,0);
  advance(g,1);assert.equal(g.player.alive.size,22,'Blocked damage is discarded, not applied after returning to safety');
  g.requestRecouple();assert.equal(g.recoupling.length,0);assert.equal(g.requests.length,1);
  const hot=burst(game(24,15));hot.heat=1;hot.requestRecouple();assert.equal(hot.requests.length,0);
  assert.match(hot.message,/TOO HOT/);assert.equal(hot.mercyActive,true);
  for(const reason of ['timer','sealed']) {
    const h=burst(game(24,6));assert.equal(h.mercyActive,true);
    if(reason==='timer'){safe(h);h.legTime=.001;}
    else {h.course.collapsed.set(0,h.t);h.player.origin=h.course.modules[0].world(0);}
    h.tick(1/120);assert.equal(h.state,'death_dissolve');assert.equal(h.player.alive.size,0);
  }
});

test('mercy console settings validate and list their values without advancing, refilling or persisting the live grace',()=>{
  const g=burst(game());const snapshot=()=>JSON.stringify({mercy:g.mercy,body:[...g.player.alive],flags:g.flags,settings:g.mercySettings});
  const before=snapshot();let saves=0;g.save=g.saveCheckpoint=()=>{saves++;};
  for(const cmd of ['viewconfig','showconfig','showvars','viewvars','listvars','listconfig']) {
    const listing=g.command(cmd);assert.match(listing,/mercy_mode \| true \| Critical damage grace/);
    for(const key of Object.keys(MERCY_NUMBERS))assert.ok(listing.includes(`${key} | ${g.mercySettings[key]} |`));
  }
  for(const key of ['mercy_mode',...Object.keys(MERCY_NUMBERS)])for(const alias of ['set','get','view','status'])g.command(`${alias} ${key}`);
  assert.equal(snapshot(),before);
  for(const command of ['set mercy_cube_threshold 0','set mercy_cube_threshold 2.5','set mercy_cube_threshold 126',
    'set mercy_seconds -1','set mercy_seconds 11','set mercy_seconds NaN','set mercy_damage_window_seconds 6','set mercy_cooldown_seconds 301',
    'set mercy_mode banana','set mercy_seconds 1 extra'])assert.throws(()=>g.command(command));
  assert.equal(snapshot(),before);
  const until=g.mercy.until,ready=g.mercy.readyAt;
  g.command('mercy_seconds 2');g.command('set mercy_cooldown_seconds 8');
  assert.equal(g.mercy.until,until);assert.equal(g.mercy.readyAt,ready,'Tuning affects the next trigger');
  g.command('set mercy_mode false');assert.equal(g.mercyActive,false);assert.equal(g.mercy.readyAt,ready);
  for(const value of ['true','on','1']){g.command(`set mercy_mode ${value}`);assert.equal(g.flags.mercy_mode,true);}
  for(const value of ['false','off','0']){g.command(`set mercy_mode ${value}`);assert.equal(g.flags.mercy_mode,false);}
  assert.equal(saves,0);assert.equal(new Game().flags.mercy_mode,true);
});
