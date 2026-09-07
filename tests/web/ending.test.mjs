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

test('the white arrival carries faint monochrome ocean contours, clears before the scene and leaves the saved survivor body untouched',()=>{
  for(const gameMode of [20,50])for(const aspect of [9/16,16/9]) {
    const g=new Game({gameMode}),drawn=[],lines=[],r=Object.create(Renderer.prototype),noop=()=>{};let clear;
    const effects={clearRect(){this.fills=[];this.paths=[];},fillRect(){this.fills.push(this.fillStyle);},fills:[],paths:[],save:noop,restore:noop,
      beginPath(){this.points=[];},moveTo(x,y){this.points.push([x,y]);},lineTo(x,y){this.points.push([x,y]);},stroke(){this.paths.push({points:this.points,color:this.strokeStyle,width:this.lineWidth});}};
    Object.assign(r,{width:600*aspect,height:600,ctx:effects,world:new T.Group(),rotator:new T.Group(),camera:new T.PerspectiveCamera(45,aspect,.1,1500),
      stars:{material:{color:{setHex:noop}}},lines:{reset(){lines.length=0;},finish:noop,line(a,b,color,alpha){lines.push({a:a.array(),b:b.array(),color,alpha});}},
      cubes:{reset(){drawn.length=0;},cube(pos,color,scale){drawn.push({pos:pos.array(),color,scale});},finish:noop},
      gl:{setClearColor:c=>{clear=c;},render:noop}});
    g.ready(g.levelCap,{survivors:[0,62,124]});g.setState('playing');g.win();const survivors=[...g.player.alive],score=g.score;
    assert.equal(ASCENSION_TIMING.arrivalSeconds,3.3,'Keep the previous arrival duration');
    const arrival=()=>{r.render(g);assert.equal(clear,0xffffff);assert.equal(drawn.length,0);assert.equal(lines.length,0);assert.equal(r.ascensionScene.group.visible,false);assert.equal(r.stars.visible,false);assert.equal(effects.fills.length,0);};
    let early,peak;
    for(const time of [0,.1,1.5,2.6,2.8,3,3.2,3.299]) {
      g.stateTime=time;arrival();
      assert.equal(effects.paths.length,time>0&&time<2.8?4:0);
      for(const path of effects.paths) {
        assert.match(path.color,/^rgba\(0,0,0,/);assert.ok(Number(path.color.slice(11,-1))<=.14);
        assert.ok(path.width<=1.5);assert.ok(path.points.length<=65);assert.ok(path.points.flat().every(Number.isFinite));
      }
      if(time===.1)early=structuredClone(effects.paths);
      if(time===1.5)peak=structuredClone(effects.paths);
      if(time===2.6)assert.ok(effects.paths.at(-1).points.every(p=>p[1]>r.height),'The wave sweeps past the bottom of the view');
    }
    assert.ok(peak[0].points.at(-1)[0]-peak[0].points[0][0]>early[0].points.at(-1)[0]-early[0].points[0][0],'The horizon opens across the view');
    g.stateTime=1.5;arrival();const frozen=structuredClone(effects.paths);
    for(const flag of ['paused','help']) {g[flag]=true;g.tick(10);arrival();assert.equal(g.stateTime,1.5);assert.deepEqual(effects.paths,frozen);g[flag]=false;}
    g.stateTime=3.299;arrival();
    g.continue();assert.equal(g.stateTime,3.299);assert.equal(g.state,'ascension');
    g.stateTime=ASCENSION_TIMING.arrivalSeconds+.06;r.render(g);assert.equal(r.ascensionScene.group.visible,true);assert.equal(drawn.length,1);assert.ok(Math.abs(ascensionPose(g.stateTime).white-.5)<1e-8);
    g.stateTime=ASCENSION_TIMING.sceneStarts;r.render(g);assert.equal(ascensionPose(g.stateTime).white,0);assert.equal(drawn.length,1);
    assert.equal(effects.paths.length,0,'No ocean contours remain over the ascension scene');
    const starAt=ASCENSION_TIMING.starStarts+ASCENSION_TIMING.starSeconds;
    assert.ok(Math.abs(ASCENSION_TIMING.fadeStarts-starAt-5.7)<1e-8);
    for(const extra of [.1,1.2,2.5,3.19,4,5.69]) {g.stateTime=starAt+extra;r.render(g);assert.equal(drawn.length,0);assert.equal(r.ascensionScene.spark.visible,true);assert.equal(r.ascensionScene.group.visible,true);assert.ok(r.ascensionScene.grid.material.uniforms.opacity.value>0);assert.equal(ascensionPose(g.stateTime).white,0);}
    g.stateTime=ASCENSION_TIMING.fadeStarts+.1;r.render(g);assert.ok(ascensionPose(g.stateTime).white>0);
    assert.deepEqual([...g.player.alive],survivors);assert.equal(g.score,score);
  }
});

function audioFixture(GameAudio,ready=true) {
  const audio=Object.create(GameAudio.prototype),sources=[],masterValues=[];
  const parameter=()=>({value:1,cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){}});
  Object.assign(audio,{ready,muted:false,channels:new Map(),last:new Map(),buffers:new Map([['arrival_water',{duration:3.3}]]),
    manifest:{arrival_water:{duration:3.3}},master:{gain:{setTargetAtTime(value){masterValues.push(value);}}},
    ctx:{currentTime:25,state:'running',suspend(){this.state='suspended';return Promise.resolve();},resume(){this.state='running';return Promise.resolve();},
      createGain(){return {gain:parameter(),connect(){},disconnect(){}};},
      createBufferSource(){const source={playbackRate:parameter(),connect(){},disconnect(){},start(...args){this.started=args;},stop(time){this.stopped=time;}};sources.push(source);return source;}}});
  return {audio,sources,masterValues};
}

test('arrival replaces gameplay tails with one water sweep, keeps it through pause and ends it before the starfield',async()=>{
  const {GameAudio}=await import('../../web/js/audio.mjs');
  for(const gameMode of [20,50]) {
    const g=new Game({gameMode});g.command('test end_portal');g.emit('shutter_close');g.win();assert.deepEqual(g.events.map(e=>e.name),['stop']);
    const {audio,sources}=audioFixture(GameAudio),stopped=[];
    for(const name of ['portal_wou','ambient','gamelan','portal'])audio.channels.set(name,{source:{stop(t){stopped.push([name,t]);}},gain:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}}});
    g.stateTime=.05;g.emit('portal');g.emit('shutter_open');audio.update(g);
    assert.deepEqual(stopped.map(x=>x[1]),[25,25,25,25]);assert.equal(sources.length,1);assert.deepEqual(sources[0].started,[0,.05]);
    assert.deepEqual([...audio.channels.keys()],['arrival_water']);assert.equal(g.events.length,0);assert.equal(sources[0].loop,false);
    const cue=sources[0];g.tick(1);audio.update(g);assert.equal(sources.length,1);assert.equal(cue.stopped,undefined);
    for(const flag of ['paused','help']) {
      const time=g.stateTime;g[flag]=true;audio.pause(true);g.tick(5);audio.update(g);
      assert.equal(g.stateTime,time);assert.equal(audio.ctx.state,'suspended');assert.equal(sources.length,1);
      g[flag]=false;audio.pause(false);assert.equal(audio.ctx.state,'running');
    }
    g.stateTime=ASCENSION_TIMING.arrivalSeconds;audio.update(g);assert.equal(cue.stopped,25);assert.equal(audio.channels.size,0);
    g.command('test ending_1');audio.update(g);assert.equal(sources.length,2,'The next preview gets its own wash');
    g.command('test ending_1');audio.update(g);assert.equal(sources.length,3,'Restarting the same preview is a fresh arrival');assert.equal(sources[1].stopped,25);
    g.title();audio.update(g);assert.equal(sources[2].stopped,25);assert.equal(audio.channels.size,0);
  }
});

test('arrival wash respects mute and never replays after late loading or audio unlock',async()=>{
  const {GameAudio}=await import('../../web/js/audio.mjs');
  const g=new Game();g.command('test ending_1');const {audio,sources,masterValues}=audioFixture(GameAudio,false);
  audio.update(g);assert.equal(sources.length,0);audio.ready=true;g.tick(1);audio.update(g);assert.equal(sources.length,0);
  g.stateTime=ASCENSION_TIMING.arrivalSeconds;audio.update(g);assert.equal(sources.length,0);
  audio.mute(true);g.command('test ending_1');audio.update(g);assert.deepEqual(masterValues,[0]);assert.equal(audio.muted,true);
  g.tick(1);audio.update(g);assert.deepEqual(masterValues,[0],'The arrival never overrides the mute setting');
  audio.mute(false);assert.deepEqual(masterValues,[0,.85]);
  g.command('test ending_1');g.stateTime=1.25;audio.update(g);assert.deepEqual(sources.at(-1).started,[0,1.25],'A delayed first frame starts at the matching audio offset');
});
