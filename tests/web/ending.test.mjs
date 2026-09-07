import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game,ASCENSION_TIMING,THANK_YOU_TIMING,thankYouOpacity,smooth} from '../../web/js/core.mjs';
import {AscensionScene,ascensionPose,ASCENSION_STAGE} from '../../web/js/ending.mjs';
import {Renderer} from '../../web/js/render.mjs';

test('the fully visible ascension title holds alone for two seconds before the subtitle, then fades into the thank-you sequence',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("    $('ending').hidden="),end=source.indexOf("    if(s==='run_summary'&&",start);
  assert.ok(start>=0&&end>start);
  const game=new Game(),elements=Object.fromEntries(['ending','ascension-copy','thank-you-copy','run-summary','ending-next','ascension-title','ascension-subtitle'].map(id=>[id,{style:{}}]));
  game.command('test ending_1');game.setState('ascension_title');
  const ui=()=>vm.runInNewContext(source.slice(start,end),{s:game.state,game,ASCENSION_TIMING,THANK_YOU_TIMING,thankYouOpacity,smooth,$:id=>elements[id]});
  const title=()=>Number(elements['ascension-title'].style.opacity),subtitle=()=>Number(elements['ascension-subtitle'].style.opacity);
  const noSkip=()=>{assert.equal(elements['ending-next'].hidden,true);game.continue();assert.equal(game.state,'ascension_title');};
  ui();assert.equal(title(),0);assert.equal(subtitle(),0);noSkip();
  game.tick(ASCENSION_TIMING.titleFadeSeconds);ui();assert.equal(title(),1);assert.equal(subtitle(),0);noSkip();
  game.tick(1.99);ui();assert.equal(title(),1);assert.equal(subtitle(),0);noSkip();
  game.paused=true;game.tick(10);ui();assert.equal(subtitle(),0);game.paused=false;
  game.tick(.02);ui();assert.ok(subtitle()>0&&subtitle()<.01);noSkip();
  game.tick(ASCENSION_TIMING.subtitleFadeSeconds-.01);ui();assert.equal(title(),1);assert.ok(subtitle()>.999);noSkip();
  game.tick(.21);ui();assert.equal(subtitle(),1);noSkip();
  game.stateTime=ASCENSION_TIMING.titleFadeOutStarts;ui();assert.equal(title(),1);
  game.tick(1.5);ui();assert.ok(title()>.49&&title()<.51);noSkip();
  game.tick(1.51);ui();assert.equal(game.state,'thank_you_note');assert.equal(elements['ascension-copy'].hidden,true);
  assert.equal(Number(elements['thank-you-copy'].style.opacity),0);game.continue();assert.equal(game.state,'thank_you_note');
  for(const [time,opacity] of [[3.99,0],[4,0],[6,.5],[8,1],[12.99,1],[16.5,.5],[20,0],[21.99,0]]) {
    game.stateTime=time;ui();assert.ok(Math.abs(Number(elements['thank-you-copy'].style.opacity)-opacity)<1e-6);
    assert.equal(elements['ending-next'].hidden,true);game.continue();assert.equal(game.state,'thank_you_note');
  }
  for(const flag of ['paused','help']) {game[flag]=true;game.tick(10);assert.equal(game.stateTime,21.99);game[flag]=false;}
  game.tick(.02);ui();assert.equal(elements['ending-next'].hidden,false);game.continue();assert.equal(game.state,'run_summary');
  game.continue();assert.equal(game.state,'run_summary','The stats still require their own separate input');
});

test('the ending uses a broad blue floor grid and one reusable starfield buffer above it',()=>{
  const world=new T.Group(),scene=new AscensionScene(world);
  assert.equal(scene.group.children.length,4);
  assert.equal(scene.grid.position.y,ASCENSION_STAGE.floorY);
  const color=scene.grid.geometry.getAttribute('color');assert.ok(color.getZ(0)>color.getX(0));
  const stars=scene.stars.geometry.getAttribute('position');assert.equal(stars.count,ASCENSION_STAGE.starCount);
  for(let i=0;i<stars.count;i++)assert.ok(stars.getY(i)>ASCENSION_STAGE.floorY);
  assert.equal(scene.spark.geometry.getAttribute('position').count,1);
  const grid=scene.grid.geometry,sky=scene.stars.geometry;
  for(const time of [0,3,6.8,9.9,0])scene.update(ascensionPose(time));
  assert.equal(scene.grid.geometry,grid);assert.equal(scene.stars.geometry,sky);
  assert.equal(scene.group.children.length,4,'Replaying creates no additional scene objects');
});

test('the cube rises from the grid, stays framed, and becomes a star before any white fade',()=>{
  const start=ascensionPose(0),starTime=ASCENSION_TIMING.starStarts+ASCENSION_TIMING.starSeconds;
  assert.ok(Math.abs(start.position.y-.46*start.scale-ASCENSION_STAGE.floorY)<1e-8);
  assert.equal(start.white,0);assert.equal(start.starOpacity,0);
  const merged=ascensionPose(starTime+.2);
  assert.equal(merged.scale,0);assert.equal(merged.starOpacity,1);assert.equal(merged.white,0);
  assert.ok(merged.position.y>start.position.y+40);assert.ok(merged.position.z<-100);
  assert.ok(ASCENSION_TIMING.fadeStarts-starTime>=1,'Hold the completed star transformation visibly before fading');
  assert.equal(ascensionPose(ASCENSION_TIMING.flySeconds).white,1);
  for(const aspect of [16/9,4/3,9/16]) {
    let previousY=-Infinity;
    for(const time of [0,.6,1.5,3,4.5,5.8,6.5,7.5]) {
      const pose=ascensionPose(time,aspect),camera=new T.PerspectiveCamera(45,aspect,.1,1500);
      camera.position.set(...pose.camera.array());camera.lookAt(...pose.target.array());camera.updateMatrixWorld();
      const projected=new T.Vector3(...pose.position.array()).project(camera);
      assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&projected.z<1,`Cube/star framed at ${time}s, aspect ${aspect}`);
      assert.ok(pose.position.y>=previousY);previousY=pose.position.y;
    }
  }
});

test('ending_1 renders one white cube, then just its star, freezes on pause, and hides the stage for white/text',()=>{
  const g=new Game(),drawn=[],r=Object.create(Renderer.prototype),noop=()=>{};
  Object.assign(r,{world:new T.Group(),rotator:new T.Group(),camera:new T.PerspectiveCamera(45,16/9,.1,1500),
    stars:{material:{color:{setHex:noop}}},lines:{reset:noop,finish:noop},
    cubes:{reset(){drawn.length=0;},cube(pos,color,scale){drawn.push({pos:pos.array(),color,scale});},finish:noop},
    gl:{setClearColor:noop,render:noop},effects:noop});
  g.command('test ending_1');r.render(g);assert.equal(drawn.length,1);assert.deepEqual(drawn[0].color,[1,1,1]);
  assert.equal(r.ascensionScene.group.visible,true);assert.equal(r.stars.visible,false);
  g.tick(3);r.render(g);const before=structuredClone(drawn);
  g.paused=true;g.tick(4);r.render(g);assert.deepEqual(drawn,before);g.paused=false;
  g.tick(3.8);r.render(g);assert.equal(drawn.length,0);assert.equal(r.ascensionScene.spark.visible,true);
  assert.equal(ascensionPose(g.stateTime).white,0);
  for(const state of ['ascension_white','ascension_title','thank_you_note','run_summary']) {
    g.setState(state);r.render(g);assert.equal(r.ascensionScene.group.visible,false);assert.equal(drawn.length,0);
  }
});
