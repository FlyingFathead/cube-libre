import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game,C,BALANCE,portalMetrics,ASCENSION_TIMING,THANK_YOU_TIMING} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {RouteGuide,detailWindow} from '../../web/js/space-view.mjs';
import {isEndPortal,portalWhiteLightPose,updatePortalWhiteLight} from '../../web/js/portal-light.mjs';

function capture(g) {
  const lines=[],r=Object.create(Renderer.prototype);
  r.lines={line(a,b,color,alpha){lines.push({a,b,color,alpha});},loop(points,color,alpha){points.forEach((p,i)=>this.line(p,points[(i+1)%points.length],color,alpha));}};
  r.portal(g);return lines;
}

test('the final portal is pure white and larger than the corridor; earlier exits retain their colour and capture size',()=>{
  const g=new Game({gameMode:50});g.ready(BALANCE.levelCap);g.setState('playing');
  g.player.origin=g.course.portal.world(-10);const metric=portalMetrics(g.course,g.player);
  const final=capture(g),extent=lines=>Math.max(...lines.flatMap(l=>[l.a,l.b]).map(p=>Math.abs(g.course.portal.local(p).y)));
  assert.ok(final.every(l=>l.color.every(c=>c===1)&&l.alpha<=1));assert.ok(extent(final)>7);
  const pose=portalWhiteLightPose(g);assert.ok(pose.size>14*4&&pose.strength>0);
  g.flags.end_portal=false;const ordinary=capture(g);
  assert.equal(ordinary.length,final.length,'Enlarging the frame adds no line work');
  assert.ok(ordinary.some(l=>l.color[0]!==l.color[1]));assert.ok(extent(ordinary)<7);
  assert.equal(portalWhiteLightPose(g),null);assert.deepEqual(portalMetrics(g.course,g.player),metric);
  g.player.origin=g.course.portal.world(20,8,0);g.flags.end_portal=true;
  assert.equal(portalMetrics(g.course,g.player).ratio,0,'The outer glow is not a new capture area');
  g.ready(49);g.setState('playing');assert.equal(isEndPortal(g),false);assert.ok(capture(g).some(l=>l.color[0]!==l.color[1]));
  g.ready(50);g.startBonus('001');g.setState('bonus_playing');assert.equal(isEndPortal(g),false);
  g.bonus.z=g.bonus.rules.portalZ;assert.equal(portalWhiteLightPose(g).coreSize,undefined);
});

test('final halo and core share the existing texture, reuse their sprites, and disappear throughout the ending',()=>{
  const g=new Game({gameMode:50}),r={world:new T.Group()};g.command('test end_portal');updatePortalWhiteLight(r,g);
  const halo=r.portalWhiteLight,core=r.endPortalCore,map=halo.material.map;
  assert.equal(r.world.children.length,2);assert.equal(core.material.map,map);assert.equal(map.image.data.length,64*64*4);
  assert.equal(core.material.color.getHex(),0xffffff);assert.equal(halo.material.color.getHex(),0xffffff);
  for(const distance of [35,20,10,0]) {g.player.origin=g.course.portal.world(20-distance);updatePortalWhiteLight(r,g);assert.equal(r.endPortalCore,core);}
  const guide=new RouteGuide(r.world,g.course);guide.update(g,detailWindow(g),false);
  assert.equal(guide.marker.material.color.getHex(),0xffffff);assert.equal(guide.marker.material.size,11);
  g.flags.end_portal=false;updatePortalWhiteLight(r,g);guide.update(g,detailWindow(g),false);
  assert.equal(core.visible,false);assert.equal(guide.marker.material.size,7);
  g.flags.end_portal=true;g.flags.portal_white_light=false;updatePortalWhiteLight(r,g);assert.equal(halo.visible,false);assert.equal(core.visible,false);
  g.flags.portal_white_light=true;
  for(const state of ['title','reassembly','bonus_result','ascension','ascension_white','ascension_title','thank_you_note','run_summary']) {
    g.setState(state);updatePortalWhiteLight(r,g);assert.equal(halo.visible,false,state);assert.equal(core.visible,false,state);
  }
  g.setState('playing');updatePortalWhiteLight(r,g);assert.equal(core.visible,true);assert.equal(r.world.children.length,3);
  guide.dispose();
});

test('test end_portal starts on leg 50 and real movement enters the full ending without changing records or score',()=>{
  for(const fps of [30,60,120]) {
    const saved=[],g=new Game({gameMode:50,rng:()=>.5,stats:{highest_level:6,best_score:1600,best_escape:70},save:s=>saved.push(s)});
    g.score=900;g.completedLevel=5;g.lastEscape=20;g.runStats.levelsCleared=5;
    const stats={...g.stats},run={...g.runStats};g.help=true;g.paused=true;g.autoLocateMinLevel=1000;
    g.command('test end_portal');assert.equal(g.state,'playing');assert.equal(g.level,50);assert.equal(g.course.location(g.player.origin).index,49);
    assert.equal(g.timedModule,49);assert.equal(g.legTime,10);assert.equal(g.player.alive.size,125);assert.equal(g.autoLocate,true);
    assert.equal(g.course.collapsedSectionAt(g.player.origin),-1);assert.equal(g.course.activeLasers(g.player.origin,g.t).length,5);
    assert.equal(g.help,false);assert.equal(g.paused,false);
    const start=g.player.origin.array();g.paused=true;g.tick(2,{z:1});assert.deepEqual(g.player.origin.array(),start);assert.equal(g.legTime,10);g.paused=false;
    for(let i=0;i<fps*8&&g.state==='playing';i++){const {x,y,z}=g.course.portal.bx;g.tick(1/fps,{x,y,z});}
    assert.equal(g.state,'ascension');assert.ok(g.player.alive.size>0);assert.equal(g.runSummary.finalLevel,50);
    assert.deepEqual(g.stats,stats);assert.deepEqual(g.runStats,run);assert.equal(g.score,900);assert.equal(saved.length,0);
    g.tick(ASCENSION_TIMING.flySeconds);assert.equal(g.state,'ascension_white');
    g.tick(ASCENSION_TIMING.whiteHoldSeconds);assert.equal(g.state,'ascension_title');
    g.tick(ASCENSION_TIMING.thankYouStarts);assert.equal(g.state,'thank_you_note');
    g.continue();assert.equal(g.state,'thank_you_note');g.tick(THANK_YOU_TIMING.continueAfter);g.continue();assert.equal(g.state,'run_summary');
    g.tick(1);g.continue();assert.equal(g.state,'title');assert.equal(g.endPortalPreview,false);
  }
});

test('preview death and manual retry return to the final gap; new runs restore normal progression and scoring',()=>{
  const g=new Game({gameMode:50});g.command('test end_portal');const start=g.player.origin.array();
  g.legTime=.001;g.tick(.02);assert.equal(g.state,'death_dissolve');g.tick(.49);g.tick(3.76);g.tick(1.11);
  assert.equal(g.state,'playing');assert.deepEqual(g.player.origin.array(),start);assert.equal(g.timedModule,49);assert.equal(g.runStats.deaths,0);
  g.command('restart');assert.equal(g.state,'playing');assert.deepEqual(g.player.origin.array(),start);assert.equal(g.stats.highest_level,1);
  g.newRun();assert.equal(g.endPortalPreview,false);assert.equal(g.level,1);g.setState('playing');g.win();assert.equal(g.score,12500);assert.equal(g.runStats.levelsCleared,1);
});

test('the actual browser console launches the portal test unpaused and persists only explicit visual changes',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game({gameMode:50}),nodes={'console-form':{},'console-input':{}},writes=[];let closed=0;
  vm.runInNewContext(source.slice(start,end),{$:id=>nodes[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},focusGame(){},closeConsole(){closed++;},audio:{muted:true},write(k,v){writes.push([k,v]);}});
  const submit=value=>{nodes['console-input'].value=value;nodes['console-form'].onsubmit({preventDefault(){}});};
  submit('end_portal false');assert.deepEqual(writes.at(-1),['cube-libre-end-portal-v1',false]);
  submit('end_portal true');const before=writes.length;
  for(const cmd of ['status end_portal','view end_portal','set end_portal','viewconfig'])submit(cmd);
  assert.equal(writes.length,before);submit('test end_portal');assert.equal(closed,1);assert.equal(game.paused,false);assert.equal(game.state,'playing');assert.equal(writes.length,before);
});
