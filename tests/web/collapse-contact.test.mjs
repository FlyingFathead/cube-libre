import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,Course} from '../../web/js/core.mjs';

function playing(level=6) {
  const g=new Game({gameMode:50,rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.lasers=false;g.flags.suction=false;
  return g;
}

test('level-six side drift does not erase surviving cubes when the route hint falls back to leg one',()=>{
  for(const microgravity of [false,true])for(const fps of [30,60,120]) {
    const g=playing();g.flags.microgravity=microgravity;
    g.player.origin=g.course.modules[1].world(0);g.tick(1/fps);
    assert.ok(g.course.collapsed.has(0));assert.equal(g.timedModule,1);
    let missedRoute=false;
    for(let frame=0;frame<Math.ceil(1.2*fps);frame++) {
      g.tick(1/fps,{y:1,rush:true});
      if(g.course.location(g.player.origin).index===0)missedRoute=true;
      assert.equal(g.state,'playing',`False collapse death at ${fps} FPS, microgravity ${microgravity}`);
    }
    assert.ok(missedRoute,'Cross the actual 14-unit lookup boundary');
    assert.ok(g.player.alive.size>100&&g.player.alive.size<125,'Ordinary boundary shaving still applies');
    assert.ok(g.legTime>28&&g.legTime<29);assert.equal(g.timedModule,1);
    for(let frame=0;frame<Math.ceil(1.4*fps);frame++)g.tick(1/fps,{y:-1,rush:true});
    assert.equal(g.state,'playing');assert.ok(g.player.alive.size>90);
    assert.equal(g.course.location(g.player.origin).index,1);
    assert.ok(g.legTime<28,'Returning to this leg must not reset its clock');
  }
});

test('being near a sealed leg outside its physical walls causes ordinary damage, not whole-body collapse',()=>{
  const g=playing();g.player.origin=g.course.modules[1].world(0);g.tick(1/120);
  g.player.origin=g.course.modules[0].world(0,10,0);
  assert.equal(g.course.location(g.player.origin).index,0);
  assert.equal(g.course.inside(g.player.origin),false);
  g.damageTimer=0;g.tick(1/120);
  assert.equal(g.state,'playing');assert.equal(g.player.alive.size,123);
});

test('collapse contact matches physical corridor and joint volumes throughout fifty-leg routes',()=>{
  for(const route3d of [true,false]) {
    const c=new Course(50,route3d);
    for(const m of c.modules) {
      c.collapsed.clear();c.collapsed.set(m.index,0);
      const pad=.46,[a,b]=c.span(m,pad);
      const expected=p=>{
        const l=m.local(p),j=c.joints[m.index];
        const pipe=l.x>=a&&l.x<=b&&Math.abs(l.y)<=7+pad&&Math.abs(l.z)<=7+pad;
        const joint=j&&p.sub(j.center).array().every(v=>Math.abs(v)<=7+pad);
        return pipe||joint?m.index:-1;
      };
      for(const x of [-31,-23,-16,0,16,23,31])for(const y of [0,7.45,7.47,10,14.1,40]) {
        const p=m.world(x,y,0);assert.equal(c.collapsedSectionAt(p),expected(p));
      }
    }
  }
});

test('forward turns remain safe; real sealed-pipe and sealed-joint returns and timeouts still end the attempt',()=>{
  const g=playing();g.flags.damage=false;g.flags.microgravity=false;
  const m=g.course.modules[1];g.player.origin=m.start;
  for(let frame=0;frame<120;frame++) {
    const [x,y,z]=m.bx.array();g.tick(1/120,{x,y,z,rush:true});
    assert.equal(g.state,'playing');
  }
  assert.ok(g.course.collapsed.has(0));
  for(const position of ['pipe','joint','timeout']) {
    const h=playing();h.flags.damage=false;
    h.player.origin=h.course.modules[1].world(0);h.tick(1/120);
    if(position==='pipe')h.player.origin=h.course.modules[0].world(0);
    else if(position==='joint')h.player.origin=h.course.joints[0].center;
    else h.legTime=.001;
    h.tick(1/120);assert.equal(h.state,'death_dissolve');assert.equal(h.runStats.deaths,1);
  }
});
