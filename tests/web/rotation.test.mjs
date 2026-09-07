import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,V,cells,rotate,beginRecouple} from '../../web/js/core.mjs';
import {PLAYER_ROTATION,C} from '../../web/js/config.mjs';
import {rotateQ} from '../../web/js/bonus.mjs';
import {Renderer} from '../../web/js/render.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const nearV=(a,b)=>a.forEach((value,i)=>near(value,b[i]));
function advance(g,seconds,input={}) {for(let i=0;i<Math.round(seconds*120);i++)g.tick(1/120,input);}
function playing() {const g=new Game({gameMode:50,rng:()=>.5});g.ready(1);g.setState('playing');return g;}
const axes=[new V(1,0,0),new V(0,1,0),new V(0,0,1)];
const orient=(point,angles)=>axes.reduce((p,axis,i)=>rotate(p,axis,angles[i]),point);
function capture(g) {
  const cubes=[],r=Object.create(Renderer.prototype);
  r.cubes={cube(pos,color,scale,axis,angle,alpha,wire,outline,quaternion){cubes.push({pos:pos.array(),axis:axis?.array(),angle,quaternion});}};
  r.lines={line(){}};r.player(g);return cubes;
}

test('the surviving collective rotates rigidly about its origin, with matching rendered cells and holes',()=>{
  const g=playing(),p=g.player,origin=p.origin.array();
  for(const i of [0,1,17,74])p.destroy(i,p.origin);
  p.fragments=[];const survivors=[...p.alive];
  for(const angles of [[0,0,0],[37,83,19],[90,90,90],[233,17,359],[0,315,0]]) {
    p.setSpinAngles(...angles);const drawn=capture(g);
    near(Math.hypot(...p.spinQuaternion),1);
    assert.equal(drawn.length,121);assert.deepEqual([...p.alive],survivors);
    drawn.forEach((cube,n)=>{
      const i=survivors[n],offset=orient(V.of(cells[i]).mul(C.CELL_SPACING),angles);
      nearV(p.pos(i).array(),p.origin.add(offset).array());
      nearV(cube.pos,p.pos(i).array());
      for(const axis of axes)nearV(rotateQ(axis.array(),cube.quaternion),orient(axis,angles).array());
      near(p.pos(i).sub(p.origin).length(),V.of(cells[i]).length()*C.CELL_SPACING);
    });
    assert.deepEqual(p.origin.array(),origin);
  }
});

test('all three slow phases start on spawn, freeze for pause/help, wrap smoothly and reset on respawn',()=>{
  const g=new Game({gameMode:50});assert.equal(g.flags.spin,true);assert.deepEqual(PLAYER_ROTATION.degreesPerSecond,{x:3,y:6,z:2});
  g.ready(1);g.setState('course_materialize');advance(g,1);nearV(g.player.spinAngles,[3,6,2]);
  for(const field of ['paused','help']) {g[field]=true;advance(g,2);nearV(g.player.spinAngles,[3,6,2]);g[field]=false;}
  g.ready(1);nearV(g.player.spinAngles,[0,0,0]);g.setState('playing');g.flags.damage=false;
  advance(g,30);nearV(g.player.spinAngles,[90,180,60]);
  advance(g,29);nearV(g.player.spinAngles,[177,354,118]);advance(g,2);nearV(g.player.spinAngles,[183,6,122]);
  g.resetAttempt();nearV(g.player.spinAngles,[0,0,0]);g.setState('reassembly_flash');advance(g,.5);nearV(g.player.spinAngles,[1.5,3,1]);
  g.command('test ending_1');advance(g,1);nearV(g.player.spinAngles,[1.5,3,1]);
});

test('the tumble changes its rotation axis and has no pose jump at angle wraps or vertical orientations',()=>{
  const g=playing(),p=g.player;
  const normals=[];
  for(const seconds of [0,15,35]) {
    p.setSpinAngles(seconds*3,seconds*6,seconds*2);
    const before=p.pos(124).sub(p.origin);g.updatePlayerSpin(.001);
    normals.push(before.cross(p.pos(124).sub(p.origin)).norm());
  }
  assert.ok(normals[0].cross(normals[2]).length()>.1,'The spin does not settle on one diagonal axis');
  for(const angles of [[359.99,359.99,359.99],[44,89.99,67],[81,269.99,142]]) {
    p.setSpinAngles(...angles);const before=p.pos(124);
    g.updatePlayerSpin(1/120);assert.ok(p.pos(124).sub(before).length()<.01);
  }
  const a=playing(),b=playing();
  for(let i=0;i<30;i++)a.updatePlayerSpin(1/30);
  for(let i=0;i<144;i++)b.updatePlayerSpin(1/144);
  nearV(a.player.pos(124).array(),b.player.pos(124).array());
});

test('turning a corner outside the field changes damage and launches debris at that rotated position',()=>{
  const g=playing(),p=g.player,i=cells.findIndex(([x,y,z])=>x===2&&y===0&&z===2);
  g.flags.lasers=false;p.alive=new Set([i]);p.origin=new V(-18,0,4.5);
  g.thermal(.1);assert.equal(g.outside,false);assert.equal(g.damage(),null);
  p.setSpinAngles(0,315,0);const impact=p.pos(i).array();
  g.thermal(.1);assert.equal(g.outside,true);assert.equal(g.damage(),'bounds');
  assert.equal(p.alive.size,0);assert.equal(p.fragments.length,1);
  nearV(p.fragments[0].pos.array(),impact);
  p.setSpinAngles(37,10,19);nearV(p.fragments[0].pos.array(),impact); // Detached debris no longer follows body spin.
});

test('re-coupled pieces meet the moving body position and orientation before attaching',()=>{
  const g=playing(),p=g.player;p.setSpinAngles(37,83,19);p.destroy(0,p.origin);
  g.recoupling=beginRecouple(p,1);assert.equal(g.recoupling.length,1);
  g.recoupleTime=1.18;p.setSpinAngles(43,95,23);
  const target=g.recoupling[0].target,arriving=capture(g).at(-1);
  nearV(arriving.pos,p.pos(target).array());
  for(const axis of axes)nearV(rotateQ(axis.array(),arriving.quaternion),orient(axis,[43,95,23]).array());
  g.tick(1/120);assert.equal(p.alive.size,125);assert.equal(g.recoupling.length,0);
  nearV(p.spinAngles,[43.025,95.05,23+2/120]);nearV(capture(g).at(-1).pos,p.pos(target).array());
});

test('portal entry retains the slow spin without an automatic alignment or a stuck full body',()=>{
  const g=playing();g.flags.damage=false;g.player.setSpinAngles(31,47,23);g.player.origin=g.course.portal.world(17);
  for(let frame=0;frame<120*5&&g.state==='playing';frame++) {
    const previous=g.player.spinAngles;g.tick(1/120,{x:1});
    nearV(g.player.spinAngles,previous.map((angle,i)=>(angle+[3,6,2][i]/120)%360));
  }
  assert.equal(g.state,'portal_warp');assert.equal(g.lastEscape,125);assert.ok(g.player.spinAngles[1]>47);
});

test('bonus intro, impact and edge rolling are identical with normal-level spin enabled or disabled',()=>{
  const on=playing(),off=playing();off.command('spin 0');on.player.setSpinAngles(37,83,19);
  for(const g of [on,off])g.command('test bonus_round_1');
  for(const [seconds,input] of [[5.5,{}],[3.2,{}],[.3,{x:1}],[.8,{z:-1}],[.2,{x:-1}]]) {
    for(const g of [on,off])advance(g,seconds,input);
    assert.equal(on.state,off.state);
    for(const key of ['x','y','z','orientation','bodyCount','timeLeft'])assert.deepEqual(on.bonus[key],off.bonus[key]);
    nearV(on.player.spinAngles,[37,83,19]);nearV(off.player.spinAngles,[0,0,0]);
  }
  assert.equal(on.state,'bonus_playing');assert.notDeepEqual(on.bonus.orientation,[0,0,0,1]);
});

test('console spin accepts booleans and numbers, restores alignment when off, and saves the browser preference',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=playing(),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(key,value){saved.push([key,value]);}});
  for(const [command,expected] of [['spin 0',false],['spin true',true],['set spin false',false],['set spin 1',true],['toggle spin',false]]) {
    if(game.flags.spin)game.player.setSpinAngles(37,83,19);
    elements['console-input'].value=command;elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(game.flags.spin,expected);assert.deepEqual(saved.at(-1),['cube-libre-spin-v1',expected]);
    if(!expected)nearV(game.player.spinAngles,[0,0,0]);
  }
  game.newRun();assert.equal(game.flags.spin,false);
  game.setState('playing');advance(game,1);nearV(game.player.spinAngles,[0,0,0]);
  assert.match(game.command('help'),/shake spin/);
  // Execute the browser's saved-setting read for a fresh instance too.
  const load=source.split('\n').find(line=>line.includes("game.flags.spin=read("));
  const reloaded=new Game({gameMode:50});vm.runInNewContext(load,{game:reloaded,read:key=>saved.findLast(([name])=>name===key)?.[1]});
  assert.equal(reloaded.flags.spin,false);
});
