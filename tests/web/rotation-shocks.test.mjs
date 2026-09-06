import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,V,cells,portalMetrics,beginRecouple} from '../../web/js/core.mjs';
import {C,VISUAL_EFFECTS} from '../../web/js/config.mjs';
import {rotateQ} from '../../web/js/bonus.mjs';
import {Renderer} from '../../web/js/render.mjs';

const nearV=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
function playing() {const g=new Game({rng:()=>.5});g.ready(1);g.setState('playing');return g;}
function capture(g) {
  const cubes=[],r=Object.create(Renderer.prototype);
  r.cubes={cube(pos,color,scale,axis,angle,alpha,wire,outline,quaternion){cubes.push({pos:pos.array(),quaternion});}};
  r.lines={line(){}};r.player(g);return cubes;
}

test('real laser and boundary hits kick the whole visible body without extra physical damage',()=>{
  for(const type of ['laser','bounds']) {
    const on=playing(),off=playing();off.command('rotation_shocks disabled');
    for(const g of [on,off]) {
      g.flags.shake=false;g.t=.123;g.player.setSpinAngles(11,23,37);
      if(type==='laser')g.player.origin=g.course.lasers[0].center.add(new V(0,5,0));
      else {g.flags.lasers=false;g.player.origin=new V(-18,8,0);}
      assert.equal(g.damage(),type);g.updateRotationShock(.1);
    }
    assert.equal(on.rotationShock.hits,1);assert.ok(on.rotationShock.angle.length()>15);
    assert.equal(off.rotationShock.angle.length(),0);
    assert.deepEqual(on.player.fragments,off.player.fragments);assert.deepEqual([...on.player.alive],[...off.player.alive]);
    assert.deepEqual(portalMetrics(on.course,on.player),portalMetrics(off.course,off.player));
    const physical=[...on.player.alive].map(i=>on.player.pos(i).array()),drawn=capture(on);
    assert.notDeepEqual(drawn.slice(0,physical.length).map(c=>c.pos),physical);
    [...on.player.alive].forEach((i,n)=>{
      const offset=rotateQ(cells[i].map(v=>v*C.CELL_SPACING),drawn[n].quaternion);
      nearV(drawn[n].pos,on.player.origin.add(V.of(offset)).array());
    });
    assert.deepEqual([...on.player.alive].map(i=>on.player.pos(i).array()),physical);
    on.recoupling=beginRecouple(on.player,1);on.recoupleTime=1.18;
    const arriving=capture(on).at(-1),offset=rotateQ(cells[on.recoupling.at(-1).target].map(v=>v*C.CELL_SPACING),arriving.quaternion);
    nearV(arriving.pos,on.player.origin.add(V.of(offset)).array());
  }
});

test('recoil is bounded under repeated hits, frame-rate independent and settles to rest',()=>{
  const a=playing(),b=playing();
  for(const g of [a,b])g.kickRotation(g.player.origin.add(new V(2,3,1)));
  for(let n=0;n<15;n++)a.updateRotationShock(1/30);
  for(let n=0;n<72;n++)b.updateRotationShock(1/144);
  nearV(a.rotationShock.angle.array(),b.rotationShock.angle.array());nearV(a.rotationShock.velocity.array(),b.rotationShock.velocity.array());
  const g=playing();
  for(let n=0;n<400;n++) {
    g.kickRotation(g.player.origin.add(new V(2,3,1)));g.updateRotationShock(1/120);
    assert.ok(g.rotationShock.angle.length()<=VISUAL_EFFECTS.impactMaxAngle+1e-8);
    assert.ok(g.rotationShock.velocity.length()<=VISUAL_EFFECTS.impactMaxSpeed+1e-8);
  }
  for(let n=0;n<600;n++)g.updateRotationShock(1/120);
  assert.equal(g.rotationShock.angle.length(),0);assert.equal(g.rotationShock.velocity.length(),0);
});

test('shocks work with slow spin off, freeze when paused, reset on spawn and leave bonus rolling alone',()=>{
  const g=playing();assert.equal(g.flags.rotation_shocks,true);g.command('spin off');
  g.kickRotation(g.player.origin.add(new V(2,3,1)));g.updateRotationShock(.1);
  const shown=capture(g),pose=g.rotationShock.angle.array();
  assert.ok(g.rotationShock.angle.length()>0);assert.deepEqual(g.player.spinAngles,[0,0,0]);
  for(const flag of ['paused','help']) {g[flag]=true;g.tick(1);assert.deepEqual(capture(g),shown);g[flag]=false;}
  const off=playing();off.command('rotation_shocks false');
  for(const game of [g,off])game.command('test bonus_round_1');
  for(let n=0;n<120*10;n++)for(const game of [g,off])game.tick(1/120,{x:1});
  assert.equal(g.state,'bonus_playing');assert.deepEqual(g.bonus.orientation,off.bonus.orientation);
  assert.deepEqual([g.bonus.x,g.bonus.y,g.bonus.z],[off.bonus.x,off.bonus.y,off.bonus.z]);
  assert.deepEqual(g.rotationShock.angle.array(),pose);
  g.ready(1);assert.equal(g.rotationShock.hits,0);assert.equal(g.rotationShock.angle.length(),0);
  g.command('rotation_shocks false');g.kickRotation(g.player.origin);assert.equal(g.rotationShock.velocity.length(),0);
});
