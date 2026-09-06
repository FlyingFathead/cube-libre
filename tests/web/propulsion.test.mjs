import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,V} from '../../web/js/core.mjs';
import {PLAYER_PROPULSION as P} from '../../web/js/config.mjs';

const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function free() {
  const g=new Game({rng:()=>.5});g.ready(1);g.setState('playing');
  g.flags.suction=false;g.flags.noclip=true;g.flags.damage=false;
  return g;
}

test('thrust accelerates to the original speeds, coasts a bounded distance, and countersteers quickly',()=>{
  for(const rush of [false,true]) {
    const g=free(),speed=P.speed*(rush?P.rushMultiplier:1),x=g.player.origin.x;
    g.move(.1,{x:1,rush});
    assert.ok(g.player.origin.x>x&&g.player.origin.x<x+speed*.1);
    assert.ok(g.driftVelocity.x>0&&g.driftVelocity.x<speed);
    g.move(5,{x:1,rush});near(g.driftVelocity.x,speed);
    const coast=free();coast.driftVelocity=new V(speed,0,0);const start=coast.player.origin.x;
    coast.move(5,{});near(coast.player.origin.x-start,speed*P.coastResponseSeconds,1e-8);
    assert.ok(coast.driftVelocity.x<1e-8);
    const release=free();release.driftVelocity=new V(speed,0,0);release.move(.08,{});
    g.move(.08,{x:-1,rush});
    assert.ok(g.driftVelocity.x<0,'Opposite input reverses thrust in under a tenth of a second');
    assert.ok(release.driftVelocity.x>0,'Releasing coasts instead of reversing');
  }
});

test('integrated thrust, reversal, rush changes and diagonal coasting agree across frame rates',()=>{
  const sequence=[[.4,{x:1,y:-1,z:1}],[.23,{x:-1,y:1,z:-1,rush:true}],[.31,{x:-1,y:1,z:0}],[.73,{}]];
  const run=step=>{
    const g=free();
    for(const [seconds,input] of sequence)for(let t=0;t<seconds-1e-12;) {
      const dt=Math.min(step,seconds-t);g.move(dt,input);t+=dt;
    }
    return [...g.player.origin.array(),...g.driftVelocity.array()];
  };
  const reference=run(1/240);
  for(const step of [1/30,1/60,1/120,1])run(step).forEach((n,i)=>near(n,reference[i]));
});

test('status preserves momentum; disabling, teleporting and rebuilding clear it',()=>{
  const g=free();g.move(.2,{x:1});const velocity=g.driftVelocity.x;
  for(const alias of ['set','view','status'])g.command(`${alias} microgravity`);
  near(g.driftVelocity.x,velocity);
  g.command('microgravity off');near(g.driftVelocity.length(),0);
  const start=g.player.origin.array();g.move(.5,{x:1,y:-1,z:1,rush:true});
  g.player.origin.array().forEach((n,i)=>near(n-start[i],[7.8,-7.8,7.8][i]));
  const stopped=g.player.origin.array();g.move(.5,{});assert.deepEqual(g.player.origin.array(),stopped);
  for(const reset of [()=>g.command('portal'),()=>g.command('restart'),()=>g.newRun()]) {
    g.command('microgravity on');g.move(.2,{x:1});assert.ok(g.driftVelocity.length()>0);
    reset();near(g.driftVelocity.length(),0);
  }
  g.command('microgravity off');g.newRun();assert.equal(g.flags.microgravity,false);
});

test('pause and help freeze drift; course clamps discard outward velocity; idle has no spontaneous force',()=>{
  const g=free();const idle=g.player.origin.array();g.move(10,{});
  assert.deepEqual(g.player.origin.array(),idle);
  g.move(.1,{x:1});
  for(const flag of ['paused','help']) {
    const position=g.player.origin.array(),velocity=g.driftVelocity.array(),time=g.t;
    g[flag]=true;g.tick(.1,{x:1});g[flag]=false;
    assert.deepEqual(g.player.origin.array(),position);assert.deepEqual(g.driftVelocity.array(),velocity);near(g.t,time);
  }
  g.flags.noclip=false;g.player.origin.x=g.course.bounds[1]+5;
  g.driftVelocity.x=6;g.move(.1,{});near(g.player.origin.x,g.course.bounds[1]+5);near(g.driftVelocity.x,0);
});

test('bonus rolling and previews stay independent of normal-level propulsion',()=>{
  const make=on=>{const g=free();g.flags.microgravity=on;g.startBonus('001');return g;};
  const a=make(true),b=make(false),origin=a.player.origin.array();
  for(let i=0;i<12*120;i++) {
    const input={x:i%100<50?1:-1,y:1,rush:i%30<15};a.tick(1/120,input);b.tick(1/120,input);
  }
  assert.equal(a.state,b.state);assert.deepEqual(a.bonus,b.bonus);
  assert.deepEqual(a.player.origin.array(),origin);
  for(const state of ['level_ready','course_materialize','ascension']) {
    const g=free();if(state==='ascension')g.beginAscension();else g.setState(state);
    const p=g.player.origin.array();g.driftVelocity=new V(6,0,0);g.tick(1/120,{x:1});
    assert.deepEqual(g.player.origin.array(),p);
  }
});
