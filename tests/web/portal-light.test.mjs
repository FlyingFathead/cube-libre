import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game,portalMetrics} from '../../web/js/core.mjs';
import {portalWhiteLightPose,updatePortalWhiteLight} from '../../web/js/portal-light.mjs';

test('portal white light grows with proximity in normal and bonus modes and does not alter absorption',()=>{
  const g=new Game();g.ready(1);g.setState('playing');assert.equal(g.flags.portal_white_light,true);
  let previous=0;
  for(const distance of [30,20,12,5,0]) {
    g.player.origin=g.course.portal.world(20-distance);
    const before=portalMetrics(g.course,g.player),pose=portalWhiteLightPose(g),strength=pose?.strength||0;
    assert.ok(strength>=previous);previous=strength;assert.deepEqual(portalMetrics(g.course,g.player),before);
  }
  assert.equal(previous,1);g.command('portal_white_light false');assert.equal(portalWhiteLightPose(g),null);
  g.command('portal_white_light true');g.startBonus('001');g.setState('bonus_playing');
  g.bonus.x=0;g.bonus.z=g.bonus.rules.portalZ+30;assert.equal(portalWhiteLightPose(g),null);
  g.bonus.z=g.bonus.rules.portalZ+10;const distant=portalWhiteLightPose(g);
  g.bonus.z=g.bonus.rules.portalZ;assert.ok(portalWhiteLightPose(g).strength>distant.strength);
});

test('the halo reuses one small texture and sprite and hides on disable and non-portal scenes',()=>{
  const g=new Game(),renderer={world:new T.Group()};g.ready(1);g.setState('playing');
  g.player.origin=g.course.portal.world(19);updatePortalWhiteLight(renderer,g);
  const light=renderer.portalWhiteLight,map=light.material.map;
  assert.equal(renderer.world.children.length,1);assert.equal(map.image.data.length,64*64*4);
  assert.equal(light.material.depthWrite,false);assert.equal(light.material.blending,T.AdditiveBlending);
  const before=light.material.opacity;g.player.origin=g.course.portal.world(5);updatePortalWhiteLight(renderer,g);
  assert.ok(light.material.opacity<before);assert.equal(renderer.portalWhiteLight,light);assert.equal(light.material.map,map);
  for(const state of ['title','ascension','ascension_white','bonus_result']) {
    g.setState(state);updatePortalWhiteLight(renderer,g);assert.equal(light.visible,false);
  }
  g.setState('playing');updatePortalWhiteLight(renderer,g);assert.equal(light.visible,true);
  g.command('portal_white_light 0');updatePortalWhiteLight(renderer,g);assert.equal(light.visible,false);
  g.command('portal_white_light 1');updatePortalWhiteLight(renderer,g);assert.equal(renderer.world.children.length,1);
});

test('portal_white_light console changes persist and set level aliases the existing level command',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game(),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(key,value){saved.push([key,value]);}});
  for(const [command,expected] of [['portal_white_light false',false],['portal_white_light true',true],['set portal_white_light 0',false],['set portal_white_light 1',true]]) {
    elements['console-input'].value=command;elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(game.flags.portal_white_light,expected);assert.deepEqual(saved.at(-1),['cube-libre-portal-white-light-v1',expected]);
  }
  game.command('portal_white_light false');game.newRun();assert.equal(game.flags.portal_white_light,false);
  const reloaded=new Game(),load=source.split('\n').find(line=>line.includes('game.flags.portal_white_light=read('));
  vm.runInNewContext(load,{game:reloaded,read:()=>false});assert.equal(reloaded.flags.portal_white_light,false);
  for(const level of [1,20,50,999,-5]) {
    const direct=new Game(),alias=new Game();direct.score=alias.score=1234;
    assert.equal(alias.command(`set level ${level}`),direct.command(`level ${level}`));
    for(const key of ['level','state','score','legTime'])assert.equal(alias[key],direct[key]);
    assert.deepEqual(alias.player.spinAngles,[0,0,0]);assert.equal(alias.player.alive.size,125);
  }
  assert.equal(game.command('set level'),`Status for level is: ${game.level}`);
  assert.throws(()=>game.command('set level nope'),/Expected a number/);
});
