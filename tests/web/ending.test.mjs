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
  const game=new Game({gameMode:50}),elements=Object.fromEntries(['ending','ascension-copy','thank-you-copy','run-summary','ending-next','ascension-title','ascension-subtitle'].map(id=>[id,{style:{}}]));
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
  const start=ascensionPose(ASCENSION_TIMING.sceneStarts),starTime=ASCENSION_TIMING.starStarts+ASCENSION_TIMING.starSeconds;
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
  const g=new Game({gameMode:50}),drawn=[],r=Object.create(Renderer.prototype),noop=()=>{};
  Object.assign(r,{world:new T.Group(),rotator:new T.Group(),camera:new T.PerspectiveCamera(45,16/9,.1,1500),
    stars:{material:{color:{setHex:noop}}},lines:{reset:noop,finish:noop},
    cubes:{reset(){drawn.length=0;},cube(pos,color,scale){drawn.push({pos:pos.array(),color,scale});},finish:noop},
    gl:{setClearColor:noop,render:noop},effects:noop});
  g.command('test ending_1');g.tick(ASCENSION_TIMING.sceneStarts);r.render(g);assert.equal(drawn.length,1);assert.deepEqual(drawn[0].color,[1,1,1]);
  assert.equal(r.ascensionScene.group.visible,true);assert.equal(r.stars.visible,false);
  g.tick(3);r.render(g);const before=structuredClone(drawn);
  g.paused=true;g.tick(4);r.render(g);assert.deepEqual(drawn,before);g.paused=false;
  g.tick(3.8);r.render(g);assert.equal(drawn.length,0);assert.equal(r.ascensionScene.spark.visible,true);
  assert.equal(ascensionPose(g.stateTime).white,0);
  for(const state of ['ascension_white','ascension_title','thank_you_note','run_summary']) {
    g.setState(state);r.render(g);assert.equal(r.ascensionScene.group.visible,false);assert.equal(drawn.length,0);
  }
});

test('the silent arrival draws one slowly rotating intact outline, flashes once into the scene and leaves the saved survivor body untouched',()=>{
  for(const gameMode of [20,50])for(const aspect of [9/16,16/9]) {
    const g=new Game({gameMode}),drawn=[],lines=[],r=Object.create(Renderer.prototype),noop=()=>{};let clear;
    const effects={clearRect:noop,fillRect(){effects.fills.push(effects.fillStyle);},fills:[]};
    Object.assign(r,{width:900,height:600,ctx:effects,world:new T.Group(),rotator:new T.Group(),camera:new T.PerspectiveCamera(45,aspect,.1,1500),
      stars:{material:{color:{setHex:noop}}},lines:{reset(){lines.length=0;},finish:noop,line(a,b,color,alpha){lines.push({a:a.array(),b:b.array(),color,alpha});}},
      cubes:{reset(){drawn.length=0;},cube(pos,color,scale){drawn.push({pos:pos.array(),color,scale});},finish:noop},
      gl:{setClearColor:c=>{clear=c;},render:noop}});
    g.ready(g.levelCap,{survivors:[0,62,124]});g.setState('playing');g.win();const survivors=[...g.player.alive],score=g.score;
    r.render(g);assert.equal(clear,0xffffff);assert.equal(drawn.length,0);assert.equal(lines.length,12);assert.equal(r.ascensionScene.group.visible,false);assert.equal(r.stars.visible,false);assert.equal(effects.fills.length,0);
    assert.equal(new Set(lines.flatMap(l=>[l.a.join(','),l.b.join(',')])).size,8,'Exactly eight intact corners, no miniature cubes');
    const first=structuredClone(lines);g.tick(2);r.render(g);assert.notDeepEqual(lines,first);assert.equal(lines[0].alpha,.8);
    for(let i=0;i<lines.length;i++)assert.ok(Math.hypot(...lines[i].a.map((v,j)=>v-first[i].a[j]))<.5,'The rotation is deliberately slow');
    r.camera.updateMatrixWorld();for(const l of lines)for(const pos of [l.a,l.b]) {const v=new T.Vector3(...pos).project(r.camera);assert.ok(Math.abs(v.x)<.8&&Math.abs(v.y)<.8);}
    const frozen=structuredClone(lines);g.paused=true;g.tick(10);r.render(g);assert.deepEqual(lines,frozen);g.paused=false;
    g.continue();assert.equal(g.stateTime,2);assert.equal(g.state,'ascension');
    g.stateTime=3.09;r.render(g);assert.ok(Math.abs(lines[0].alpha-.4)<1e-8,'One short fade into a white flash');
    g.stateTime=3.2;r.render(g);assert.equal(lines.length,0);assert.equal(drawn.length,0);assert.equal(clear,0xffffff);
    g.stateTime=ASCENSION_TIMING.arrivalSeconds+.06;r.render(g);assert.equal(r.ascensionScene.group.visible,true);assert.equal(drawn.length,1);assert.ok(Math.abs(ascensionPose(g.stateTime).white-.5)<1e-8);
    g.stateTime=ASCENSION_TIMING.sceneStarts;r.render(g);assert.equal(ascensionPose(g.stateTime).white,0);assert.equal(drawn.length,1);
    const starAt=ASCENSION_TIMING.starStarts+ASCENSION_TIMING.starSeconds;
    assert.ok(Math.abs(ASCENSION_TIMING.fadeStarts-starAt-3.2)<1e-8);
    for(const extra of [.1,1.2,2.5,3.19]) {g.stateTime=starAt+extra;r.render(g);assert.equal(drawn.length,0);assert.equal(r.ascensionScene.spark.visible,true);assert.equal(ascensionPose(g.stateTime).white,0);}
    assert.deepEqual([...g.player.alive],survivors);assert.equal(g.score,score);
  }
});

test('arrival immediately silences live audio and drops queued portal sounds, including previews and late audio unlocks',async()=>{
  const {GameAudio}=await import('../../web/js/audio.mjs');
  for(const gameMode of [20,50]) {
    const g=new Game({gameMode});g.command('test end_portal');g.emit('shutter_close');g.win();assert.deepEqual(g.events.map(e=>e.name),['stop']);
    const stopped=[],played=[],audio=Object.create(GameAudio.prototype);
    audio.channels=new Map(['portal_wou','ambient','gamelan','portal'].map(name=>[name,{source:{stop(t){stopped.push([name,t]);}},gain:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}}}]));
    audio.ctx={currentTime:25};audio.ready=true;audio.sound=(...args)=>played.push(args);
    g.emit('portal');g.emit('shutter_open');audio.update(g);assert.deepEqual(stopped.map(x=>x[1]),[25,25,25,25]);assert.equal(audio.channels.size,0);assert.equal(played.length,0);assert.equal(g.events.length,0);
    g.tick(2);audio.update(g);assert.equal(played.length,0);assert.equal(stopped.length,4);
    g.stateTime=ASCENSION_TIMING.arrivalSeconds;audio.update(g);assert.equal(played.length,0,'Dropped arrival sounds are never replayed');
    g.command('test ending_1');g.emit('portal');audio.update(g);assert.equal(played.length,0);
  }
});
