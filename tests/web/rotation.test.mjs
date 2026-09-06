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
function playing() {const g=new Game({rng:()=>.5});g.ready(1);g.setState('playing');return g;}
function capture(g) {
  const cubes=[],r=Object.create(Renderer.prototype);
  r.cubes={cube(pos,color,scale,axis,angle,alpha,wire,outline,quaternion){cubes.push({pos:pos.array(),axis:axis?.array(),angle,quaternion});}};
  r.lines={line(){}};r.player(g);return cubes;
}

test('the surviving collective rotates rigidly about its origin, with matching rendered cells and holes',()=>{
  const g=playing(),p=g.player,origin=p.origin.array();
  for(const i of [0,1,17,74])p.destroy(i,p.origin);
  p.fragments=[];const survivors=[...p.alive];
  for(const angle of [0,37,90,233,359]) {
    p.setSpinAngle(angle);const drawn=capture(g);
    assert.equal(drawn.length,121);assert.deepEqual([...p.alive],survivors);
    drawn.forEach((cube,n)=>{
      const i=survivors[n],offset=rotate(V.of(cells[i]).mul(C.CELL_SPACING),new V(0,1,0),angle);
      nearV(p.pos(i).array(),p.origin.add(offset).array());
      nearV(cube.pos,p.pos(i).array());assert.deepEqual(cube.axis,[0,1,0]);near(cube.angle,angle);
      near(p.pos(i).sub(p.origin).length(),V.of(cells[i]).length()*C.CELL_SPACING);
    });
    assert.deepEqual(p.origin.array(),origin);
  }
});

test('spin starts during materialization, turns once per minute, freezes for pause/help, and resets on respawn',()=>{
  const g=new Game();assert.equal(g.flags.spin,true);assert.equal(PLAYER_ROTATION.degreesPerSecond,6);
  g.ready(1);g.setState('course_materialize');advance(g,1);near(g.player.spinAngle,6);
  for(const field of ['paused','help']) {g[field]=true;advance(g,2);near(g.player.spinAngle,6);g[field]=false;}
  g.ready(1);near(g.player.spinAngle,0);g.setState('playing');g.flags.damage=false;
  advance(g,30);near(g.player.spinAngle,180);
  advance(g,29);near(g.player.spinAngle,354);advance(g,2);near(g.player.spinAngle,6);
  g.resetAttempt();near(g.player.spinAngle,0);g.setState('reassembly_flash');advance(g,.5);near(g.player.spinAngle,3);
  g.command('test ending_1');advance(g,1);near(g.player.spinAngle,3);
});

test('turning a corner outside the field changes damage and launches debris at that rotated position',()=>{
  const g=playing(),p=g.player,i=cells.findIndex(([x,y,z])=>x===2&&y===0&&z===2);
  g.flags.lasers=false;p.alive=new Set([i]);p.origin=new V(-18,0,4.5);
  g.thermal(.1);assert.equal(g.outside,false);assert.equal(g.damage(),null);
  p.setSpinAngle(315);const impact=p.pos(i).array();
  g.thermal(.1);assert.equal(g.outside,true);assert.equal(g.damage(),'bounds');
  assert.equal(p.alive.size,0);assert.equal(p.fragments.length,1);
  nearV(p.fragments[0].pos.array(),impact);
  p.setSpinAngle(10);nearV(p.fragments[0].pos.array(),impact); // Detached debris no longer follows body spin.
});

test('re-coupled pieces meet the moving body position and orientation before attaching',()=>{
  const g=playing(),p=g.player;p.setSpinAngle(37);p.destroy(0,p.origin);
  g.recoupling=beginRecouple(p,1);assert.equal(g.recoupling.length,1);
  g.recoupleTime=1.18;p.setSpinAngle(83);
  const target=g.recoupling[0].target,arriving=capture(g).at(-1);
  nearV(arriving.pos,p.pos(target).array());
  nearV(rotateQ([1,0,0],arriving.quaternion),rotate(new V(1,0,0),new V(0,1,0),83).array());
  g.tick(1/120);assert.equal(p.alive.size,125);assert.equal(g.recoupling.length,0);
  near(p.spinAngle,83.05);nearV(capture(g).at(-1).pos,p.pos(target).array());
});

test('portal entry retains the slow spin without an automatic alignment or a stuck full body',()=>{
  const g=playing();g.flags.damage=false;g.player.setSpinAngle(47);g.player.origin=g.course.portal.world(17);
  for(let frame=0;frame<120*5&&g.state==='playing';frame++) {
    const previous=g.player.spinAngle;g.tick(1/120,{x:1});near(g.player.spinAngle,(previous+.05)%360);
  }
  assert.equal(g.state,'portal_warp');assert.equal(g.lastEscape,125);assert.ok(g.player.spinAngle>47);
});

test('bonus intro, impact and edge rolling are identical with normal-level spin enabled or disabled',()=>{
  const on=playing(),off=playing();off.command('spin 0');on.player.setSpinAngle(37);
  for(const g of [on,off])g.command('test bonus_round_1');
  for(const [seconds,input] of [[5.5,{}],[3.2,{}],[.3,{x:1}],[.8,{z:-1}],[.2,{x:-1}]]) {
    for(const g of [on,off])advance(g,seconds,input);
    assert.equal(on.state,off.state);
    for(const key of ['x','y','z','orientation','bodyCount','timeLeft'])assert.deepEqual(on.bonus[key],off.bonus[key]);
    near(on.player.spinAngle,37);near(off.player.spinAngle,0);
  }
  assert.equal(on.state,'bonus_playing');assert.notDeepEqual(on.bonus.orientation,[0,0,0,1]);
});

test('console spin accepts booleans and numbers, restores alignment when off, and saves the browser preference',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=playing(),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(key,value){saved.push([key,value]);}});
  for(const [command,expected] of [['spin 0',false],['spin true',true],['set spin false',false],['set spin 1',true],['toggle spin',false]]) {
    if(game.flags.spin)game.player.setSpinAngle(37);
    elements['console-input'].value=command;elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(game.flags.spin,expected);assert.deepEqual(saved.at(-1),['cube-libre-spin-v1',expected]);
    if(!expected)near(game.player.spinAngle,0);
  }
  game.newRun();assert.equal(game.flags.spin,false);
  game.setState('playing');advance(game,1);near(game.player.spinAngle,0);
  assert.match(game.command('help'),/shake spin/);
  // Execute the browser's saved-setting read for a fresh instance too.
  const load=source.split('\n').find(line=>line.includes("game.flags.spin=read("));
  const reloaded=new Game();vm.runInNewContext(load,{game:reloaded,read:key=>saved.findLast(([name])=>name===key)?.[1]});
  assert.equal(reloaded.flags.spin,false);
});
