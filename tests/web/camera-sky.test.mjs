import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../../web/vendor/three.module.min.js';
import {Game,V} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {createInfiniteStarfield,setStarPattern,positionInfiniteStarfield} from '../../web/js/space-view.mjs';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function scene(aspect=16/9) {
  const r=Object.create(Renderer.prototype),noop=()=>{};
  Object.assign(r,{scene:new T.Scene(),world:new T.Group(),rotator:new T.Group(),camera:new T.PerspectiveCamera(45,aspect,.1,12000),
    lines:{reset:noop,finish:noop},cubes:{reset:noop,finish:noop},gl:{setClearColor:noop,render:noop},
    effects:noop,course:noop,player:noop,portal:noop});
  r.scene.add(r.rotator);r.rotator.add(r.world);r.stars=createInfiniteStarfield(r.scene);return r;
}
function project(r,p) {r.scene.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);return new T.Vector3(...p.array()).applyMatrix4(r.world.matrixWorld).project(r.camera);}

test('auto-location starts at level one, follows the cube through motion, and retains the introductory overview',()=>{
  for(const aspect of [16/9,8/9,1.5])for(const level of [1,2,3,7,50]) {
    const g=new Game({rng:()=>.5}),r=scene(aspect);g.ready(level);g.setState('playing');g.flags.shake=false;
    assert.equal(g.autoLocateMinLevel,0);assert.equal(g.autoLocate,true);
    for(const origin of [new V(-18,0,0),g.course.portal.world(10),new V(150,-20,90)]) {
      g.player.origin=origin;g.angles=[29,93,18];r.render(g);const p=project(r,origin);near(p.x,0);near(p.y,0);
    }
    g.ready(level);g.setState('course_materialize');g.stateTime=4;r.render(g);
    const overview=project(r,g.course.center);assert.ok(Number.isFinite(overview.x)&&Number.isFinite(overview.y));
    g.stateTime=7;r.render(g);const settled=project(r,g.player.origin);near(settled.x,0);near(settled.y,0);
  }
});

test('auto-location minimum can restore the previous level-three rule without changing SPACE or culling',()=>{
  const g=new Game(),r=scene();g.ready(1);g.setState('playing');g.flags.shake=false;
  assert.equal(g.command('set auto_locate_min_level 3'),'auto_locate_min_level set to 3');
  assert.equal(g.autoLocate,false);r.render(g);assert.ok(Math.abs(project(r,g.player.origin).x)>.05);
  g.command('set locate true');r.render(g);near(project(r,g.player.origin).x,0);
  g.command('set locate false');g.ready(3);assert.equal(g.autoLocate,true);assert.equal(g.course.modules.length,3);
  for(const cmd of ['status','view','set'])assert.equal(g.command(`${cmd} auto_locate_min_level`),'Status for auto_locate_min_level is: 3');
  assert.throws(()=>g.command('toggle auto_locate_min_level'),/cannot be toggled/);
  assert.throws(()=>g.command('set auto_locate_min_level -1'));
  g.command('set auto_locate_min_level 0');g.ready(1);assert.equal(g.autoLocate,true);
});

test('pattern one exactly preserves the old spiral; pattern two has random spacing, sizes and gentle hues',()=>{
  const parent=new T.Group(),stars=createInfiniteStarfield(parent,1),pos=stars.geometry.attributes.position.array,col=stars.geometry.attributes.color.array;
  const expected=[],colors=[];
  for(let i=0;i<1600;i++) {
    const y=1-2*(i+.5)/1600,r=Math.sqrt(1-y*y),a=i*2.399963229728653,b=.45+.55*((i*67%101)/100);
    expected.push(Math.cos(a)*r*1000,y*1000,Math.sin(a)*r*1000);colors.push(b,b,b);
  }
  assert.deepEqual(pos,new Float32Array(expected));assert.deepEqual(col,new Float32Array(colors));
  const geometry=stars.geometry;setStarPattern(stars,2);assert.equal(stars.geometry,geometry);
  assert.notDeepEqual(pos,new Float32Array(expected));assert.equal(pos.length,4800);
  const sortedY=Array.from({length:1600},(_,i)=>pos[i*3+1]).sort((a,b)=>a-b),gaps=sortedY.slice(1).map((y,i)=>y-sortedY[i]);
  assert.ok(Math.max(...gaps)>4);assert.ok(Math.min(...gaps)<.05);
  assert.ok(Array.from(col).some((v,i)=>i%3===0&&v!==col[i+2]));
  const sizes=stars.geometry.attributes.starScale.array;assert.ok(Math.max(...sizes)>1.8&&Math.min(...sizes)<.7);
  const shader={vertexShader:T.ShaderLib.points.vertexShader};stars.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/gl_PointSize = size \* starScale;/);
  setStarPattern(stars,1);assert.deepEqual(pos,new Float32Array(expected));assert.deepEqual(col,new Float32Array(colors));
});

test('sky switches reuse buffers, zero hides the stars, and camera travel preserves the selected pattern',()=>{
  const r=scene(),g=new Game();g.ready(1);g.setState('playing');
  const geometry=r.stars.geometry,positions=geometry.attributes.position.array;
  for(const pattern of [0,1,2,0,2]) {
    g.command(`set star_pattern ${pattern}`);r.render(g);assert.equal(r.stars.visible,pattern!==0);
    assert.equal(r.stars.geometry,geometry);assert.equal(geometry.attributes.position.array,positions);
    const snapshot=positions.slice();
    for(const p of [[0,0,0],[5000,-9000,4000]]) {
      r.camera.position.set(...p);positionInfiniteStarfield(r.stars,r.camera,r.rotator.rotation);
      assert.deepEqual(r.stars.position.toArray(),p);assert.deepEqual(positions,snapshot);
    }
  }
  for(const value of [-1,3,1.5,'nope'])assert.throws(()=>g.command(`set star_pattern ${value}`));
  assert.equal(g.command('view star_pattern'),'Status for star_pattern is: 2');
  assert.throws(()=>g.command('toggle star_pattern'),/cannot be toggled/);
});

test('star selection saves only through console changes; reading status never writes preferences',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),a=source.indexOf("$('console-form').onsubmit="),b=source.indexOf("  $('console-input').addEventListener",a);
  const game=new Game(),elements={'console-form':{},'console-input':{}},saved=[];
  vm.runInNewContext(source.slice(a,b),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write:(...v)=>saved.push(v)});
  const submit=text=>{elements['console-input'].value=text;elements['console-form'].onsubmit({preventDefault(){}});};
  submit('set star_pattern 1');assert.deepEqual(saved.at(-1),['cube-libre-star-pattern-v1',1]);
  const writes=saved.length;submit('status star_pattern');submit('view star_pattern');submit('set star_pattern');assert.equal(saved.length,writes);
  const load=source.slice(source.indexOf('  const savedStarPattern='),source.indexOf('  const renderer=')),fresh=new Game();
  vm.runInNewContext(load,{game:fresh,read:()=>1});assert.equal(fresh.starPattern,1);
  assert.ok(!source.slice(source.indexOf('  function help()'),source.indexOf('  function menu()')).includes('star_pattern'));
});
