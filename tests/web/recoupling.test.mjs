import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,V} from '../../web/js/core.mjs';
import {RECOUPLING} from '../../web/js/recoupling.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';

test('failed recovery pieces grey, fall, turn to dark wireframes and fade without remaining eligible',()=>{
  const game=new Game({rng:()=>.5});game.ready(4);game.setState('playing');game.flags.damage=false;game.flags.suction=false;
  for(let i=0;i<10;i++)game.player.destroy(i,game.player.origin);
  game.requestRecouple();assert.equal(game.recoupling.length,9);assert.equal(game.recoverableFragments.length,0);
  const rejected=game.player.fragments[0],first=rejected.pos.array(),velocity=rejected.vel.y;
  const renderer=Object.create(Renderer.prototype);renderer.lines={line(){}};
  const draw=()=>{const cubes=[];renderer.cubes={cube(pos,color,scale,axis,angle,alpha,wire){if(pos===rejected.pos)cubes.push({color,alpha,wire});}};renderer.player(game);return cubes[0];};
  const grey=draw();assert.deepEqual(grey.color,[.55,.55,.55]);assert.equal(grey.wire,false);
  for(const flag of ['paused','help']){game[flag]=true;game.tick(5);assert.deepEqual(rejected.pos.array(),first);assert.equal(rejected.lostAge,0);game[flag]=false;}
  for(let i=0;i<48;i++)game.tick(1/120);
  const wire=draw();assert.equal(wire.wire,true);assert.ok(wire.color[0]<grey.color[0]);assert.ok(wire.alpha<grey.alpha);
  assert.notDeepEqual(rejected.pos.array(),first);assert.ok(rejected.vel.y<velocity);
  assert.equal(game.recoverableFragments.length,0);
  for(let i=0;i<120;i++)game.tick(1/120);
  assert.equal(game.player.fragments.length,0);assert.equal(game.player.alive.size,124);
  game.requestRecouple();assert.equal(game.recoupling.length,0);assert.equal(game.requests.length,1);
});

test('cooldown rejection gives bounded audio feedback without touching quota, recovery or the timer buzzer channel',()=>{
  const game=new Game({rng:()=>.5});game.ready(4);game.setState('playing');game.player.destroy(0,game.player.origin);
  for(let i=0;i<5;i++)game.requestRecouple();const pending=game.recoupling;
  game.events=[];for(let i=0;i<20;i++)game.requestRecouple();
  assert.equal(game.requests.length,5);assert.equal(game.recoupling,pending);assert.equal(game.recoupleWait,10);
  assert.deepEqual(game.events.map(e=>e.name),['recouple_denied']);
  const heard=[],adapter=Object.create(GameAudio.prototype);adapter.ready=false;adapter.sound=(...args)=>heard.push(args);
  adapter.update(game);assert.deepEqual(heard,[['time_buzzer',.32,'recouple_denied',false,-5]]);
  const sources=[],audio=Object.create(GameAudio.prototype),parameter=()=>({value:1,cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){}});
  Object.assign(audio,{ready:true,channels:new Map(),last:new Map(),buffers:new Map([['time_buzzer',{duration:.68}]]),manifest:{time_buzzer:{duration:.68}},master:{},ctx:{currentTime:10,
    createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createBufferSource:()=>{const source={playbackRate:parameter(),connect(){},disconnect(){},start(){},stop(){}};sources.push(source);return source;}}});
  audio.sound('time_buzzer');audio.sound(...heard[0]);assert.equal(sources.length,2);
  assert.equal(audio.channels.size,2);audio.sound(...heard[0]);assert.equal(sources.length,2);
  for(const flag of ['paused','help']){game[flag]=true;game.tick(20);game.requestRecouple();assert.equal(game.recoupleWait,10);assert.equal(game.recoupleDeniedTime,RECOUPLING.deniedSeconds);assert.equal(game.events.length,0);game[flag]=false;}
  game.t+=10;assert.equal(game.recoupleWait,0);
});
