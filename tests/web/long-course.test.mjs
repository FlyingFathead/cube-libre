import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game,Course,V,clamp} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {detailWindow,createInfiniteStarfield,positionInfiniteStarfield} from '../../web/js/space-view.mjs';

function captureCourse() {
  const r=Object.create(Renderer.prototype),lasers=[];let lines=0;
  r.world=new T.Group();r.lines={
    line(a,b,color,alpha=1){if(alpha>.002){assert.ok([...a.array(),...b.array()].every(Number.isFinite));lines++;}},
    loop(points,color,alpha){points.forEach((p,i)=>this.line(p,points[(i+1)%points.length],color,alpha));},
  };
  r.laser=(l,...args)=>{lasers.push(l.module.index);Renderer.prototype.laser.call(r,l,...args);};
  return {r,lasers,count:()=>lines,reset(){lines=0;lasers.length=0;}};
}

test('play outlines cover three upcoming legs with independent tuning and no extra hazard reveals or buffer allocation',()=>{
  for(const level of [4,5,50]) {
    const g=new Game({gameMode:50});g.ready(level);g.setState('playing');const cap=captureCourse();
    let geometry;
    for(const index of [0,1,level-2,level-1]) {
      g.player.origin=g.course.modules[index].world(0);g.course.update(g.player.origin,g.t,()=>{});
      const reveals=[...g.course.revealed],active=g.course.activeLasers(g.player.origin,g.t),window=detailWindow(g);
      cap.reset();cap.r.course(g);const guide=cap.r.routeGuide;
      geometry??=guide.lines.geometry;assert.equal(guide.lines.geometry,geometry);
      assert.deepEqual(geometry.drawRange,{start:(index+1)*8,count:Math.min(3,level-index-1)*8});
      assert.ok(geometry.drawRange.count/2<=12,'At most twelve simple line segments');
      assert.deepEqual([...g.course.revealed],reveals);assert.deepEqual(g.course.activeLasers(g.player.origin,g.t),active);
      assert.ok(cap.lasers.every(i=>i<=window.last));
      g.command('set route_outline off');cap.r.course(g);assert.equal(guide.lines.visible,false);
      g.command('set route_outline on');
    }
    g.player.origin=g.course.modules[0].world(0);
    for(const [key,value] of [['route_outline_ahead_legs',1],['route_outline_fade_after_legs',0],['route_outline_opacity',.7],['route_outline_far_opacity',.1]])g.command(`set ${key} ${value}`);
    cap.r.course(g);const u=cap.r.routeGuide.lines.material.uniforms;
    assert.equal(u.opacity.value,.7);assert.equal(u.routeCount.value,1);assert.equal(u.routeFadeAfter.value,0);assert.equal(u.routeFarOpacity.value,.1);
    assert.equal(cap.r.routeGuide.lines.geometry,geometry);
    g.setState('course_materialize');g.stateTime=3;cap.r.course(g,true);
    assert.equal(u.previewMode.value,1);assert.equal(u.previewCount.value,level);assert.equal(u.farOpacity.value,.12);
    assert.equal(g.previewSettings.preview_opacity,.24,'Gameplay tuning leaves the overview alone');
    g.command('route_outline_ahead_legs 0');g.setState('playing');cap.r.course(g);assert.equal(cap.r.routeGuide.lines.visible,false);
    for(const command of ['route_outline_ahead_legs 1.5','route_outline_opacity 2','route_outline_far_opacity -1','route_outline_fade_after_legs NaN'])assert.throws(()=>g.command(command));
    cap.r.routeGuide.dispose();
  }
});

test('every level adds one leg through 50 while X, Z and Y are introduced in order',()=>{
  for(const route3d of [true,false])for(let level=1;level<=50;level++) {
    const c=new Course(level,route3d);assert.equal(c.modules.length,level);assert.equal(c.lasers.length,level*5);
    assert.deepEqual(c.modules[0].bx.array(),[1,0,0]);
    if(level>=2)assert.deepEqual(c.modules[1].bx.array(),[0,0,1]);
    if(level>=3&&route3d)assert.deepEqual(c.modules[2].bx.array(),[0,1,0]);
    if(!route3d)assert.ok(c.modules.every(m=>m.bx.y===0));
    assert.equal(new Set(c.modules.map(m=>m.start.array().join(','))).size,level);
    assert.equal(c.portal.index,level-1);
    for(let i=1;i<level;i++)assert.deepEqual(c.modules[i].start.array(),c.modules[i-1].end().array());
  }
});

test('spatial collision queries match a full route scan at walls, seams and turns on 50-leg routes',()=>{
  for(const route3d of [true,false]) {
    const c=new Course(50,route3d);
    const bruteJoint=(p,pad)=>c.joints.findIndex(j=>p.sub(j.center).array().every(v=>Math.abs(v)<=7+pad));
    const bruteInside=(p,pad)=>c.modules.some(m=>{const l=m.local(p),[a,b]=c.span(m,pad);return l.x>=a&&l.x<=b&&Math.abs(l.y)<=7+pad&&Math.abs(l.z)<=7+pad;})||bruteJoint(p,pad)>=0;
    const bruteLocation=p=>{
      let index=0,x=-23,score=-Infinity;
      for(const m of c.modules) {const l=m.local(p);if(Math.abs(l.z)>14||Math.abs(l.y)>14||l.x<-30||l.x>30)continue;
        const lx=clamp(l.x,-23,23),s=m.index*1000+lx;if(s>score){index=m.index;x=lx;score=s;}}
      return {index,x};
    };
    for(const m of c.modules)for(const x of [-30,-23,-16,0,16,23,30])for(const y of [-7.25,0,7.25]) {
      const p=m.world(x,y,7);
      assert.deepEqual(c.location(p),bruteLocation(p));
      for(const pad of [0,.25,1.2,4]) {
        assert.equal(c.inside(p,pad),bruteInside(p,pad));assert.equal(c.jointAt(p,pad),bruteJoint(p,pad));
      }
      assert.ok(c.nearby(p).modules.length<=6,'Broad phase stays local rather than scanning all 50 legs');
    }
  }
});

test('the overview contains only cached ghost outlines and the exit, while gameplay bounds detail to nearby legs',()=>{
  const g=new Game({gameMode:50});g.ready(50);g.setState('course_materialize');const cap=captureCourse();
  let geometry;
  for(const culling of [true,false])for(const time of [.2,3.8,5,6.99]) {
    g.flags.culling=culling;g.stateTime=time;cap.reset();cap.r.course(g,true);
    assert.equal(cap.lasers.length,0,'No red laser grids in any overview frame');
    if(time/7<.78)assert.equal(cap.count(),0,'Only the coarse outline during the wide view');
    else assert.ok(cap.r.routeGuide.lines.material.uniforms.opacity.value<.1,'Ghost route fades while nearby blue corridors appear');
    assert.equal(cap.r.routeGuide.lines.visible,true);assert.equal(cap.r.routeGuide.marker.visible,true);
    geometry??=cap.r.routeGuide.lines.geometry;assert.equal(cap.r.routeGuide.lines.geometry,geometry);
  }
  assert.equal(geometry.getAttribute('position').count,8*50);
  g.flags.culling=true;g.setState('playing');g.t=5;
  for(const index of [0,10,25,48,49]) {
    g.player.origin=g.course.modules[index].world(0);g.course.update(g.player.origin,0,()=>{});
    cap.reset();cap.r.course(g);const window=detailWindow(g);
    assert.ok(window.last-window.first+1<=3);assert.ok(cap.lasers.length<=15);
    assert.ok(cap.count()<3500);assert.equal(cap.r.routeGuide.lines.visible,index<49);
    assert.equal(cap.r.routeGuide.marker.visible,true,'The exit remains a distant point without revealing the route');
    assert.ok(g.course.activeLasers(g.player.origin,g.t).length<=20);
  }
  g.flags.culling=false;g.ready(50);g.setState('playing');cap.reset();cap.r.course(g);assert.equal(cap.lasers.length,250);
  cap.r.routeGuide.dispose();assert.equal(cap.r.world.children.length,0);
});

test('the previous corridor collapses once after clearing its junction, with sound, culling and sealed backtracking',()=>{
  const g=new Game({gameMode:50});g.ready(50);g.setState('playing');g.flags.damage=false;g.events=[];
  for(const x of [-23,-16]) {
    g.player.origin=g.course.modules[1].world(x);g.tick(1/120);assert.equal(g.course.collapsed.has(0),false);
    assert.equal(g.state,'playing','Reaching the turn must not collapse the junction under the player');
  }
  g.player.origin=g.course.modules[1].world(-12);g.tick(1/120);
  assert.equal(g.course.collapsed.has(0),true);assert.equal(g.state,'playing');
  assert.equal(g.events.filter(e=>e.name==='collapse').length,1);assert.ok(g.particles.length>0);
  for(let i=0;i<180;i++)g.tick(1/120);
  assert.equal(g.events.filter(e=>e.name==='collapse').length,1);
  assert.ok(g.course.activeLasers(g.player.origin,g.t).every(l=>l.module.index!==0));
  g.player.origin=g.course.modules[0].world(0);g.tick(1/120);assert.equal(g.state,'death_dissolve');
});

test('the complete 50-leg overview and its portal fit inside the camera for wide and narrow screens',()=>{
  for(const route3d of [true,false])for(const aspect of [16/9,4/3,9/16]) {
    const g=new Game({gameMode:50});g.flags.route3d=route3d;g.ready(50);g.setState('course_materialize');g.stateTime=4.8;g.angles=[34,98,43];
    const cap=captureCourse(),r=cap.r,noop=()=>{};
    r.scene=new T.Scene();r.rotator=new T.Group();r.rotator.add(r.world);r.scene.add(r.rotator);
    r.camera=new T.PerspectiveCamera(45,aspect,.1,12000);r.stars=createInfiniteStarfield(r.scene);
    r.lines.reset=noop;r.lines.finish=noop;r.cubes={reset:noop,cube:noop,finish:noop};
    r.gl={setClearColor:noop,render:noop};r.effects=noop;
    r.render(g);r.scene.updateMatrixWorld(true);r.camera.updateMatrixWorld();
    const b=g.course.bounds,points=[g.course.portal.world(20).array()];
    for(const x of [b[0],b[1]])for(const y of [b[2],b[3]])for(const z of [b[4],b[5]])points.push([x,y,z]);
    for(const p of points) {
      const v=new T.Vector3(...p).applyMatrix4(r.world.matrixWorld).project(r.camera);
      assert.ok(Math.abs(v.x)<.96&&Math.abs(v.y)<.96&&v.z<1,`Whole route framed at aspect ${aspect}`);
    }
  }
});

test('the fixed starfield survives arbitrary map travel and overview zoom without reallocating',()=>{
  const scene=new T.Scene(),stars=createInfiniteStarfield(scene),geometry=stars.geometry;
  assert.equal(geometry.getAttribute('position').count,1600);
  const rotation=new T.Euler(.3,.5,.1),camera=new T.PerspectiveCamera(45,16/9,.1,12000);
  let reference;
  for(const origin of [[0,0,48],[760,736,1200],[-4200,2700,3800]]) {
    camera.position.set(...origin);camera.lookAt(origin[0],origin[1],origin[2]-1);camera.updateMatrixWorld();
    positionInfiniteStarfield(stars,camera,rotation);scene.updateMatrixWorld(true);
    const projected=[];
    for(let i=0;i<1600;i++) {
      const p=new T.Vector3().fromBufferAttribute(geometry.getAttribute('position'),i).applyMatrix4(stars.matrixWorld).project(camera);
      if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1)projected.push([i,p.x,p.y]);
    }
    assert.ok(projected.length>30);
    if(reference) {assert.equal(projected.length,reference.length);projected.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-reference[i][k])<1e-7)));}
    reference=projected;assert.equal(stars.geometry,geometry);assert.equal(scene.children.length,1);
  }
});

test('culling boolean/number console settings persist and leave nearby collision rules active',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game({gameMode:50}),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(key,value){saved.push([key,value]);}});
  assert.equal(game.flags.culling,true);game.ready(50);
  for(const [command,expected] of [['culling false',false],['culling true',true],['set culling 0',false],['set culling 1',true]]) {
    const active=game.course.activeLasers(game.player.origin,game.t);
    elements['console-input'].value=command;elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(game.flags.culling,expected);assert.deepEqual(saved.at(-1),['cube-libre-culling-v1',expected]);
    assert.deepEqual(game.course.activeLasers(game.player.origin,game.t),active);
  }
  game.command('culling 0');game.newRun();assert.equal(game.flags.culling,false);
  const fresh=new Game({gameMode:50}),load=source.split('\n').find(line=>line.includes('game.flags.culling=read('));
  vm.runInNewContext(load,{game:fresh,read:()=>false});assert.equal(fresh.flags.culling,false);
});


test('minimal preview caps draw work, fades after configurable legs, and reuses geometry when tuned',()=>{
  const g=new Game({gameMode:50});g.ready(50);g.setState('course_materialize');g.stateTime=4;
  const cap=captureCourse();cap.r.course(g,true);const guide=cap.r.routeGuide,geo=guide.lines.geometry,u=guide.lines.material.uniforms;
  assert.equal(geo.attributes.position.count,400);assert.equal(geo.drawRange.count,400);
  assert.equal(u.fadeAfter.value,2);assert.equal(u.farOpacity.value,.12);assert.equal(u.previewCount.value,50);
  const position=geo.attributes.position,route=geo.attributes.routePosition;
  for(let i=0;i<400;i++) {const leg=Math.floor(i/8),p=g.course.modules[leg].local(new V(position.getX(i),position.getY(i),position.getZ(i)));
    assert.equal(Math.abs(p.y),7);assert.equal(Math.abs(p.z),7);assert.equal(route.getX(i),leg+i%2);}
  for(const key of ['preview_max_legs','preview_fade_after_legs','preview_opacity','preview_far_opacity'])assert.match(g.command('viewconfig'),new RegExp(key));
  g.command('set preview_max_legs 12');g.command('set preview_fade_after_legs 4');g.command('set preview_opacity 0.4');g.command('set preview_far_opacity 0.05');cap.r.course(g,true);
  assert.equal(guide.lines.geometry,geo);assert.equal(geo.drawRange.count,96);assert.equal(u.fadeAfter.value,4);assert.equal(u.farOpacity.value,.05);
  for(const cmd of ['set preview_max_legs -1','set preview_fade_after_legs 1.5','set preview_opacity 2','set preview_far_opacity NaN'])assert.throws(()=>g.command(cmd));
  g.command('toggle preview_outline');cap.r.course(g,true);assert.equal(guide.lines.visible,false);assert.equal(guide.marker.visible,true);
  g.command('toggle preview_outline');g.command('set preview_max_legs 0');cap.r.course(g,true);assert.equal(geo.drawRange.count,0);assert.equal(guide.lines.visible,false);
  assert.equal(cap.lasers.length,0);guide.dispose();
});
