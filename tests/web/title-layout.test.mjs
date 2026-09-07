import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../../web/vendor/three.module.min.js';
import {Game} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {titleSafeArea,observeTitleLayout} from '../../web/js/title-layout.mjs';

const titleCells=JSON.parse(readFileSync(new URL('../../web/assets/title-cells.json',import.meta.url)));
function capture(width,height) {
  const r=Object.create(Renderer.prototype),drawn=[],noop=()=>{};
  const stars=new T.Group();stars.material={color:{setHex:noop}};
  Object.assign(r,{width,height,titleCells,world:new T.Group(),rotator:new T.Group(),stars,
    camera:new T.PerspectiveCamera(45,width/height,.1,12000),lines:{reset:noop,finish:noop},
    cubes:{reset(){drawn.length=0;},cube(pos,color,scale,axis,angle){drawn.push({pos,scale,axis,angle});},finish:noop},
    gl:{setClearColor:noop,render:noop},effects:noop});
  r.rotator.add(r.world);return {r,drawn};
}

test('all animated title cubes fit between measured overlays in full, half-width and zoomed windows',()=>{
  // CSS pixel sizes cover the reported half-screen Firefox view at 100/120/200%.
  const layouts=[[1920,1080,90,790],[960,1080,90,780],[770,900,70,635],[480,560,50,295],[960,500,45,240],[390,750,75,430]];
  for(const [width,height,startBottom,infoTop] of layouts) {
    const {r,drawn}=capture(width,height),g=new Game({gameMode:50});
    r.titleArea=titleSafeArea({top:44,width,height},{bottom:44+startBottom},{top:44+infoTop});
    const a=r.titleArea;
    assert.ok(a.y>startBottom&&a.y+a.height<infoTop);
    for(const time of [0,1,3,7,13,31,59,87,121]) {
      g.t=time;r.render(g);r.rotator.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);
      assert.equal(drawn.length,titleCells.length);
      const project=p=>{p.project(r.camera);return [(p.x+1)*width/2,(1-p.y)*height/2];};
      const center=project(new T.Vector3());
      assert.ok(Math.abs(center[0]-(a.x+a.width/2))<1e-7);
      assert.ok(Math.abs(center[1]-(a.y+a.height/2))<1e-7);
      for(const cell of drawn) {
        const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(...cell.axis.norm().array()),cell.angle*Math.PI/180);
        for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
          const p=new T.Vector3(x,y,z).multiplyScalar(.46*cell.scale).applyQuaternion(q).add(new T.Vector3(...cell.pos.array())).applyMatrix4(r.world.matrixWorld);
          const [px,py]=project(p);
          assert.ok(px>=a.x&&px<=a.x+a.width&&py>=a.y&&py<=a.y+a.height,`Clipped cube at ${width}×${height}, time ${time}: ${px},${py}`);
        }
      }
    }
  }
});

test('title layout remeasures wrapping, resize and menu entry without layout reads every frame',()=>{
  let callback,reads=0,top=620;
  const observed=[];
  class Observer {constructor(cb){callback=cb;}observe(el){observed.push(el);}}
  const canvas={clientWidth:770,clientHeight:900,getBoundingClientRect(){reads++;return {top:44,width:this.clientWidth,height:this.clientHeight};}};
  const start={getBoundingClientRect(){return {bottom:114};}},info={getBoundingClientRect(){return {top};}},title={hidden:false};
  const renderer={resize(){this.width=canvas.clientWidth;this.height=canvas.clientHeight;}},logo={style:{}};
  const layout=observeTitleLayout(renderer,{canvas,start,info,title,logo},Observer);
  assert.deepEqual(observed,[canvas,start,info]);layout.update();const first={...renderer.titleArea};
  assert.deepEqual(logo.style,{left:`${first.x}px`,top:`${first.y}px`,width:`${first.width}px`,height:`${first.height}px`,visibility:'visible'});
  for(let n=0;n<120;n++)layout.update();assert.equal(reads,1);
  top=550;callback();layout.update();assert.ok(renderer.titleArea.height<first.height);assert.equal(reads,2);
  assert.equal(logo.style.height,`${renderer.titleArea.height}px`);
  canvas.clientWidth=960;layout.invalidate();layout.update();assert.equal(renderer.width,960);
  title.hidden=true;layout.update();top=700;title.hidden=false;layout.update();assert.ok(renderer.titleArea.height>first.height);
  top=80;callback();layout.update();assert.equal(renderer.titleArea.height,0,'Do not overlap the controls when there is no available area');
  assert.equal(logo.style.visibility,'hidden');
});

test('title camera offsets are cleared before gameplay and ending scenes, while geometry bounds are reused',()=>{
  const {r,drawn}=capture(770,900),g=new Game({gameMode:50});
  r.titleArea={x:16,y:80,width:738,height:500};r.render(g);
  const bounds=r.titleFrame;assert.equal(r.camera.view.enabled,true);
  g.newRun();r.render(g);assert.equal(r.camera.view.enabled,false);
  g.setState('ascension_white');r.render(g);assert.equal(r.camera.view.enabled,false);
  g.title();r.titleArea.height=360;r.render(g);assert.equal(r.titleFrame,bounds);assert.equal(r.camera.view.enabled,true);
  r.titleArea.height=0;r.render(g);assert.equal(drawn.length,0);assert.ok(Number.isFinite(r.camera.position.z));
});

test('the reassembly caption stays below the final cube across window shapes and rotating views',()=>{
  for(const [width,height] of [[1920,1080],[960,1080],[770,900],[960,500],[480,560]]) {
    const {r,drawn}=capture(width,height),g=new Game({gameMode:50});
    // First visit the title to ensure its shifted camera cannot displace the caption.
    r.titleArea={x:16,y:80,width:width-32,height:height*.5};r.render(g);
    g.die();g.setState('reassembly');g.stateTime=3.74;
    for(const angles of [[0,0,0],[28,57,18],[131,239,81]]) {
      g.angles=angles;r.render(g);r.rotator.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);
      const caption=r.reassemblyLabel;assert.ok(caption&&Number.isFinite(caption.y));
      assert.ok(Math.abs(caption.x-width/2)<1e-7);
      assert.ok(caption.y<height-85,'Room for the caption above the toolbar');
      for(const cell of drawn) {
        const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(...cell.axis.norm().array()),cell.angle*Math.PI/180);
        for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
          const p=new T.Vector3(x,y,z).multiplyScalar(.46*cell.scale).applyQuaternion(q).add(new T.Vector3(...cell.pos.array())).applyMatrix4(r.world.matrixWorld).project(r.camera);
          assert.ok((1-p.y)*height/2+9<caption.y,'The text starts beneath the cube, including its rotating cell corners');
        }
      }
    }
    g.title();r.render(g);assert.equal(r.reassemblyLabel,null);
  }
});
