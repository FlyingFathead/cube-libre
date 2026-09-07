import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {DragStick,MobileControls,TOUCH_RULES,detectMobile,touchEnabled,touchMovement,recoupleStatus,axisHandles,selectPull} from '../../web/js/mobile.mjs';
import {emptyMovement,mergeMovement} from '../../web/js/gamepad.mjs';
import {detailWindow} from '../../web/js/space-view.mjs';

const identity={right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},forward:{x:0,y:0,z:-1}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup({mode=0,detected=true}={}) {
  const nodes=new Map(),document={hidden:false,getElementById(id){
    if(!nodes.has(id)){
      const listeners={},classes=new Set(),captures=new Set();
      nodes.set(id,{dataset:{},style:{},hidden:false,disabled:false,textContent:'',attrs:{},
        classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
        setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){(listeners[k]??=[]).push(fn);},
        fire(k,options={}){const e={pointerId:1,clientX:200,clientY:200,button:0,detail:1,preventDefault(){this.prevented=true;},...options};for(const fn of listeners[k]||[])fn(e);return e;},
        setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);this.fire('lostpointercapture',{pointerId:id});},
        getBoundingClientRect:()=>({left:10,top:20,width:800,height:400})
      });
    }return nodes.get(id);
  }};
  const game=new Game({gameMode:50});game.ready(7);game.setState('playing');game.flags.damage=false;game.flags.suction=false;
  const renderer={resize(){},touchView:()=>({x:190,y:180,radius:15,visible:true,basis:identity})};
  const writes=[],mobile=new MobileControls({document,game,renderer,detected,read:(key)=>key==='cube-libre-touch-helpers-v1'?true:mode,write:(...v)=>writes.push(v),focus(){}});
  mobile.sync();mobile.draw();return {document,game,renderer,writes,mobile,node:id=>document.getElementById(id)};
}

test('automatic touch mode detects Android, iPhone and desktop-identifying iPad; saved overrides take priority',()=>{
  for(const nav of [{userAgent:'Android'},{userAgent:'iPhone'},{userAgent:'iPad'},{userAgent:'Macintosh',maxTouchPoints:5},{userAgentData:{mobile:true}}])assert.equal(detectMobile(nav,()=>({matches:false})),true);
  assert.equal(detectMobile({userAgent:'Macintosh',maxTouchPoints:0},()=>({matches:false})),false);
  assert.equal(detectMobile({userAgent:'Linux'},()=>({matches:true})),true);
  assert.equal(touchEnabled(0,false),false);assert.equal(touchEnabled(1,false),true);assert.equal(touchEnabled(2,true),false);
  const s=setup({mode:2});assert.equal(s.mobile.enabled,false);assert.equal(s.renderer.pixelRatioCap,2);
  s.mobile.setMode(1);assert.equal(s.mobile.enabled,true);assert.equal(s.renderer.pixelRatioCap,TOUCH_RULES.pixelRatio);
  assert.deepEqual(s.writes,[['cube-libre-input-mode-v1',1]]);assert.throws(()=>s.mobile.setMode(3));
  assert.equal(setup({mode:'garbage'}).mobile.mode,0);
});

test('drag starts neutral, scales thrust, anchors the rush ring and uses hysteresis without sticky inputs',()=>{
  const s=new DragStick(),r=TOUCH_RULES.rushRadius;
  assert.equal(s.start(1,100,100),true);assert.equal(s.start(2,0,0),false);assert.deepEqual(s.axes(),{x:0,y:0,rush:false});
  s.move(2,500,500);assert.equal(s.axes().x,0);
  s.move(1,100+TOUCH_RULES.deadzone,100);assert.equal(s.axes().x,0);
  s.move(1,120,90);assert.ok(s.axes().x>0&&s.axes().x<1);assert.ok(s.axes().y>0);
  s.move(1,100+r,100);assert.equal(s.axes().rush,true);near(s.axes().x,1);
  s.move(1,100+r-5,100);assert.equal(s.axes().rush,true);
  s.move(1,100+r-11,100);assert.equal(s.axes().rush,false);assert.equal(s.x,100);assert.equal(s.y,100);
  s.end(2);assert.equal(s.id,1);s.end(1);assert.deepEqual(s.axes(),{x:0,y:0,rush:false});
  s.start(3,100,100);s.move(3,500,80,true);assert.equal(s.axes().x,0);assert.ok(s.axes().y>0);
});

test('view-relative drag and depth remain orthogonal through rotating views and stay within normal speed limits',()=>{
  const scene=new T.Scene(),world=new T.Group();scene.add(world);
  const camera=new T.PerspectiveCamera(45,2,.1,12000);camera.position.set(0,0,48);camera.lookAt(0,0,0);
  const renderer={camera,world,width:800,height:400},g=new Game({gameMode:50});g.ready(1);g.setState('playing');
  for(const angle of [[0,0,0],[.8,1.7,-.4],[Math.PI/2,Math.PI/2,0]]){
    world.rotation.set(...angle);world.position.copy(g.player.origin).multiplyScalar(-1);
    const v=Renderer.prototype.touchView.call(renderer,g),b=v.basis;
    near(b.right.length(),1);near(b.right.dot(b.up),0);near(b.right.dot(b.forward),0);
    const move=touchMovement({x:1,y:0,rush:false},{y:0,rush:false},b);
    const q=new T.Vector3(move.x,move.y,move.z).applyQuaternion(world.quaternion);near(q.x,1);near(q.y,0);near(q.z,0);
    const all=touchMovement({x:1,y:1,rush:true},{y:1,rush:false},b);near(Math.hypot(all.x,all.y,all.z),1);assert.equal(all.rush,true);
  }
  const small=new Game({gameMode:50});small.ready(1);small.setState('playing');small.player.alive=new Set([124]);world.rotation.set(0,0,0);world.position.copy(small.player.origin).multiplyScalar(-1);
  const v=Renderer.prototype.touchView.call(renderer,small);assert.ok(v.visible);assert.ok(v.x>400,'Grab target tracks the surviving piece, not an empty body center');
});

test('actual pointer handlers grab the visible body, preserve two independent fingers and ignore off-target touches',()=>{
  const s=setup(),{mobile,node}=s;
  node('scene').fire('pointerdown',{clientX:10,clientY:20});assert.equal(mobile.move.id,null);
  node('scene').fire('pointerdown');node('scene').fire('pointermove',{clientX:230,clientY:200});assert.ok(mobile.movement().x>0);
  node('touch-depth').fire('pointerdown',{pointerId:2,clientX:740,clientY:260});
  node('touch-depth').fire('pointermove',{pointerId:2,clientX:800,clientY:230});
  assert.ok(mobile.movement().x>0);assert.ok(mobile.movement().z<0);
  mobile.draw();assert.equal(node('touch-ring').attrs.cx,'190','Ring uses the initial pointer position, minus the canvas offset');
  node('scene').fire('pointerup');assert.equal(mobile.movement().x,0);assert.ok(mobile.movement().z<0);
  node('touch-depth').fire('pointercancel',{pointerId:2});assert.deepEqual(mobile.movement(),emptyMovement());
  node('touch-steer').fire('pointerdown',{clientX:80,clientY:300});node('touch-steer').fire('pointermove',{clientX:150,clientY:300});assert.equal(mobile.movement().rush,true);
  node('touch-steer').fire('lostpointercapture');assert.deepEqual(mobile.movement(),emptyMovement());
});

test('pause, visibility, resize, new levels and input-mode changes clear touch without altering momentum or game rules',()=>{
  for(const interrupt of [s=>{s.game.paused=true;},s=>{s.document.hidden=true;},s=>s.mobile.resize(),s=>s.mobile.setMode(2),s=>s.game.setState('level_ready')]){
    const s=setup();s.node('touch-steer').fire('pointerdown');s.node('touch-steer').fire('pointermove',{clientX:260});
    s.game.driftVelocity.x=2;const flags={...s.game.flags};interrupt(s);s.mobile.sync();
    assert.deepEqual(s.mobile.movement(),emptyMovement());assert.equal(s.mobile.move.id,null);assert.equal(s.mobile.captures.size,0);
    assert.equal(s.game.driftVelocity.x,2);assert.deepEqual(s.game.flags,flags);
    s.game.paused=false;s.document.hidden=false;s.game.setState('playing');s.mobile.sync();
    s.node('touch-steer').fire('pointermove',{clientX:280});assert.deepEqual(s.mobile.movement(),emptyMovement(),'Held finger cannot resume after interruption without a new press');
  }
});

test('re-couple button reflects actual loose pieces, heat, quota and active recovery; each press requests only once',()=>{
  const s=setup(),g=s.game;assert.deepEqual(recoupleStatus(g),{enabled:false,text:'NO PIECES'});assert.equal(s.node('touch-c').disabled,true);
  const origin=g.player.origin;g.player.fragments=[{age:0,pos:origin,color:[1,1,1],axis:{x:1,y:0,z:0},angle:0}];
  assert.equal(recoupleStatus(g).enabled,true);g.requests=Array(5).fill(g.t);assert.match(recoupleStatus(g).text,/WAIT/);
  g.requests=[];g.level=15;g.heat=1;assert.equal(recoupleStatus(g).text,'TOO HOT');g.heat=0;
  g.recoupling=[{}];assert.equal(recoupleStatus(g).text,'COUPLING…');g.recoupling=[];
  g.player.fragments[0].age=7.96;assert.equal(recoupleStatus(g).enabled,false);g.player.fragments[0].age=0;
  let count=0;g.requestRecouple=()=>count++;s.mobile.sync();assert.equal(s.node('touch-c').disabled,false);
  s.node('touch-c').fire('pointerdown');s.node('touch-c').fire('pointerdown',{pointerId:2});s.node('touch-c').fire('click');assert.equal(count,1);
  s.node('touch-c').fire('pointerup');s.node('touch-c').fire('pointerdown',{pointerId:3});assert.equal(count,2);
  g.paused=true;s.node('touch-c').fire('click',{detail:0});assert.equal(count,2);
});

test('bonus mode rolls on the floor, hides depth/re-couple and uses the same drag rush threshold',()=>{
  const s=setup();s.game.setState('bonus_playing');s.mobile.sync();
  assert.equal(s.node('touch-depth').hidden,true);assert.equal(s.node('touch-recoup-wrap').hidden,true);
  s.node('touch-steer').fire('pointerdown');s.node('touch-steer').fire('pointermove',{clientX:220,clientY:100});
  const m=s.mobile.movement();assert.ok(m.x>0&&m.z<0);assert.equal(m.y,0);assert.equal(m.rush,true);
  s.node('touch-depth').fire('pointerdown',{pointerId:2});assert.equal(s.mobile.depth.id,null);
});

test('browser input merger feeds analog touch to the real simulation, preserves coast and keeps desktop input functional',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),s=setup();
  const context={game:s.game,keyboard:new Set(),pointers:new Map(),controllerMovement:emptyMovement(),mobile:s.mobile,mergeMovement};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function input()'),source.indexOf("  let dotsSize=")),context);
  s.node('touch-steer').fire('pointerdown');s.node('touch-steer').fire('pointermove',{clientX:245});
  const before=s.game.player.origin.x;for(let i=0;i<60;i++)s.game.move(1/120,context.input());assert.ok(s.game.player.origin.x>before+2);
  s.node('touch-steer').fire('pointerup');const released=s.game.player.origin.x;for(let i=0;i<60;i++)s.game.move(1/120,context.input());
  assert.ok(s.game.player.origin.x>released&&s.game.player.origin.x<released+1.5);
  context.keyboard.add('KeyD');context.controllerMovement.x=1;s.mobile.setMode(2);assert.equal(context.input().x,1);
});

test('orb side grabs select all six axial pulls; the selected world axis stays locked as the camera turns',()=>{
  const s=setup(),{mobile,node}=s;mobile.setHelpers(false);mobile.sync();mobile.draw();
  assert.equal(node('touch-steer').hidden,true);assert.equal(node('touch-depth').hidden,true);
  const view=mobile.view;
  assert.equal(selectPull(view,view.x,view.y).axis,null);
  assert.equal(selectPull(view,view.x+300,view.y).hit,false);
  const handles=axisHandles(view);assert.equal(handles.length,6);
  for(const h of handles){
    const picked=selectPull(view,h.x,h.y);assert.equal(picked.axis.axis,h.axis);assert.equal(picked.axis.sign,h.sign);
    node('scene').fire('pointerdown',{clientX:h.x+10,clientY:h.y+20});
    assert.equal(mobile.pullAxis.axis,h.axis);
    node('scene').fire('pointermove',{clientX:h.x+10+h.dx*70,clientY:h.y+20+h.dy*70});
    const m=mobile.movement();near(m[h.axis],h.sign);assert.equal(m.rush,true);
    for(const axis of ['x','y','z'].filter(a=>a!==h.axis))near(m[axis],0);
    mobile.view={...view,basis:{right:identity.up,up:identity.forward,forward:identity.right}};
    assert.deepEqual(mobile.movement(),m,'Camera rotation cannot silently switch the selected axis');
    node('scene').fire('pointermove',{clientX:h.x+10-h.dx*35,clientY:h.y+20-h.dy*35});assert.equal(Math.sign(mobile.movement()[h.axis]),-h.sign);
    node('scene').fire('pointerup');assert.equal(mobile.pullAxis,null);assert.deepEqual(mobile.movement(),emptyMovement());mobile.view=view;
  }
});

test('mobile entry notice offers both saved input choices; its handlers close the notice without starting a run',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  for(const [index,expected] of [[0,1],[1,2]]){
    const s=setup(),shown=[],ctx={mobileBrowser:true,MOBILE_NOTICE:'Test notice',sessionStorage:{getItem:()=>null,setItem(){}},
      mobile:s.mobile,modal:(...args)=>shown.push(args),closeModal(){ctx.closed=true;}};
    vm.createContext(ctx);const a=source.indexOf('  if(mobileBrowser) {'),b=source.indexOf('  checkUpdates();setInterval',a);vm.runInContext(source.slice(a,b),ctx);
    const [kind,title,body,actions]=shown[0];assert.equal(kind,'mobile');assert.equal(title,'MOBILE BROWSER DETECTED');
    assert.deepEqual(Array.from(actions,a=>a[0]),['TRY MOBILE BETA','USE KEYBOARD / CONTROLLER']);
    actions[index][1]();assert.equal(ctx.closed,true);assert.equal(s.mobile.mode,expected);assert.equal(s.game.state,'playing');
    assert.deepEqual(s.writes.at(-1),['cube-libre-input-mode-v1',expected]);
  }
});

test('touch-only start continues immediately while mobile audio is still downloading or awaiting permission',async()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const game=new Game({gameMode:50}),nodes={start:{}},ctx={game,$:id=>nodes[id],mobile:{enabled:true},controllerAction:false,controllerAudioPending:false,loadingStart:false,audioProgress:'',audioWarning:'',
    audio:{muted:false,failed:[],unlock:()=>new Promise(()=>{})},clearInput(){},focusGame(){},syncAudio(){}};
  vm.createContext(ctx);const a=source.indexOf('  async function start('),b=source.indexOf('  function unlockControllerAudio()',a);vm.runInContext(source.slice(a,b),ctx);
  await ctx.start();assert.equal(game.state,'opening_intro');assert.equal(ctx.loadingStart,false);assert.equal(nodes.start.disabled,false);
  assert.match(ctx.audioWarning,/Sound is loading/);
});

test('mobile console tuning validates values, lists descriptions and keeps status queries free of side effects',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),s=setup();
  const ctx={game:s.game,mobile:s.mobile};vm.createContext(ctx);
  const a=source.indexOf('  game.consoleSettings.touch_helpers='),b=source.indexOf('  async function start',a);vm.runInContext(source.slice(a,b),ctx);
  s.node('touch-steer').fire('pointerdown');s.node('touch-steer').fire('pointermove',{clientX:230});
  for(const key of ['mobile_mode','touch_helpers','touch_rush_radius','touch_deadzone','touch_grab_radius','mobile_pixel_ratio'])for(const alias of ['set','view','status'])assert.match(s.game.command(`${alias} ${key}`),/Status for/);
  assert.notEqual(s.mobile.move.id,null);assert.equal(s.writes.length,0);
  assert.match(s.game.command('viewconfig'),/touch_rush_radius \| 56 \| Touch rush threshold/);
  for(const bad of ['set mobile_mode 4','set touch_rush_radius 10','set touch_deadzone 25','set mobile_pixel_ratio 3'])assert.throws(()=>s.game.command(bad));
  assert.equal(s.writes.length,0);assert.equal(s.mobile.rules.rushRadius,56);
  s.game.command('set touch_rush_radius 70');assert.equal(s.mobile.rules.rushRadius,70);assert.equal(s.mobile.move.id,null);
  s.game.command('toggle touch_helpers');assert.equal(s.mobile.helpers,false);assert.deepEqual(s.writes.at(-1),['cube-libre-touch-helpers-v1',false]);
  s.game.command('set mobile_mode 2');assert.equal(s.mobile.enabled,false);assert.deepEqual(s.writes.at(-1),['cube-libre-input-mode-v1',2]);
});


test('Panic and Recouple circles work on both touch layouts and desktop with one request per press',()=>{
  for(const mode of [1,2])for(const helpers of [false,true]) {
    const {mobile,game,node}=setup({mode});mobile.setHelpers(helpers);mobile.sync();
    assert.equal(node('game-actions').hidden,false);assert.equal(node('touch-controls').hidden,mode===2||!helpers);assert.equal(node('panic-wrap').hidden,false);
    for(const key of ['panic-key','recouple-key'])assert.equal(node(key).hidden,mode===1);
    assert.equal(node('panic-button').disabled,false);assert.equal(node('touch-c').disabled,true);
    game.player.destroy(0,game.player.origin);mobile.sync();assert.equal(node('touch-c').disabled,false);
    node('touch-c').fire('pointerdown');node('touch-c').fire('click');assert.equal(game.requests.length,1);
    const accepted=game.recoupling;
    node('panic-button').fire('pointerdown',{pointerId:2});node('panic-button').fire('click',{pointerId:2});
    assert.ok(game.panic);assert.equal(game.events.filter(e=>e.name==='panic').length,1);assert.equal(game.recoupling,accepted);
    mobile.sync();assert.equal(node('panic-wrap').hidden,false);assert.equal(node('panic-button').disabled,true);assert.equal(node('touch-c').disabled,true);
    assert.deepEqual(mobile.movement(),emptyMovement());
    for(let i=0;i<335;i++)game.tick(1/120);mobile.sync();
    assert.equal(node('panic-wrap').hidden,false);assert.equal(node('panic-button').disabled,true);
    assert.match(node('panic-status').textContent,/^COOLDOWN \d+ s$/);
    node('panic-button').fire('pointerdown',{pointerId:3});assert.equal(game.events.filter(e=>e.name==='panic').length,1);
    game.command('panic false');mobile.sync();assert.equal(node('panic-wrap').hidden,true);
    game.command('panic true');
    for(const state of ['level_ready','course_materialize','reassembly_flash']) {
      game.setState(state);mobile.sync();assert.equal(node('game-actions').hidden,mode===1);
      assert.equal(node('panic-button').disabled,true);assert.equal(node('touch-c').disabled,true);
    }
    for(const state of ['title','opening_intro','bonus_playing','ascension']) {
      game.setState(state);mobile.sync();assert.equal(node('game-actions').hidden,true);
    }
  }
});

test('mobile drift on levels seven and eight keeps the nearby corridor drawn after the entrance has collapsed',()=>{
  for(const helpers of [false,true])for(const level of [7,8])for(const index of [2,3,5]) {
    const {mobile,game,node,renderer}=setup({mode:1});mobile.setHelpers(helpers);game.ready(level);game.setState('playing');
    const m=game.course.modules[index];
    renderer.touchView=()=>({x:190,y:180,radius:15,visible:true,basis:{right:m.bz,up:m.by,forward:m.bx}});
    for(let i=0;i<=index;i++){game.player.origin=game.course.modules[i].world(0);game.tick(.01);}
    game.tick(1.5);mobile.sync();mobile.draw();assert.equal(game.timedModule,index);assert.ok(game.course.collapsed.has(0));
    node('scene').fire('pointerdown',{clientX:200,clientY:200});
    node('scene').fire('pointermove',{clientX:280,clientY:200});
    let reproduced=false;
    for(let frame=0;frame<360;frame++) {
      game.tick(1/120,mobile.movement());mobile.sync();
      const window=detailWindow(game);
      assert.ok(window.first<=index&&window.last>=index,'The current corridor must stay in the draw range');
      if(game.course.location(game.player.origin).index===0){reproduced=true;break;}
    }
    assert.equal(reproduced,true);assert.equal(game.state,'playing');assert.equal(game.timedModule,index);
  }
});

test('action circles and labels pulse for urgent recovery only while usable, on desktop and both touch layouts',()=>{
  for(const mode of [1,2])for(const helpers of [false,true]) {
    const {mobile,game,node}=setup({mode});mobile.setHelpers(helpers);game.t=.1;
    const warned=id=>node(id).classList.contains('action-alert');
    game.command('panic_show_inactive false');mobile.sync();assert.equal(node('panic-wrap').hidden,true);
    game.outside=true;game.outsideTime=3;mobile.sync();assert.equal(node('panic-wrap').hidden,false);
    assert.equal(warned('panic-wrap'),false);game.heat=1;mobile.sync();assert.equal(warned('panic-wrap'),true);
    game.panicCooldown=.1;mobile.sync();assert.equal(warned('panic-wrap'),false);
    game.panicCooldown=0;game.paused=true;mobile.sync();assert.equal(warned('panic-wrap'),false);
    game.paused=false;game.help=true;mobile.sync();assert.equal(warned('panic-wrap'),false);game.help=false;
    game.outside=false;game.heat=0;game.outsideTime=0;mobile.sync();assert.equal(node('panic-wrap').hidden,true);
    game.command('panic_show_inactive true');game.legTime=10.01;mobile.sync();assert.equal(warned('panic-wrap'),false);
    game.legTime=10;mobile.sync();assert.equal(warned('panic-wrap'),true);
    game.t=.5;mobile.sync();assert.equal(warned('panic-wrap'),false,'Pulse has a cool phase');game.t=.1;
    game.level=1;mobile.sync();assert.equal(warned('panic-wrap'),false,'Untimed legs never warn about a deadline');
    game.level=15;game.legTime=30;game.player.destroy(0,game.player.origin);
    const fragment=game.player.fragments[0];fragment.age=6.25;mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);
    fragment.age=6.26;mobile.sync();assert.equal(warned('touch-recoup-wrap'),true);
    game.heat=1;mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);game.heat=0;
    game.cooldown=.1;mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);game.cooldown=0;
    game.requests=Array(5).fill(game.t);mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);game.requests=[];
    for(const field of ['paused','help']){game[field]=true;mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);game[field]=false;}
    fragment.age=7.95;mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);
    fragment.age=7;game.requestRecouple();mobile.sync();assert.equal(warned('touch-recoup-wrap'),false);
    game.requestPanic();mobile.sync();assert.equal(warned('panic-wrap'),false);assert.equal(warned('touch-recoup-wrap'),false);
  }
});
