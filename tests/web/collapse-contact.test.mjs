import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,Course} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

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

test('sealed contact shows a blue zap and its cause once in every route direction, while timeout and open re-entry stay distinct',()=>{
  for(const mode of [20,50])for(let index=0;index<8;index++) {
    const g=new Game({gameMode:mode,rng:()=>.5});g.ready(8);g.setState('playing');g.flags.damage=false;g.flags.suction=false;
    const m=g.course.modules[index];g.course.collapsed.set(index,g.t);g.player.origin=m.world(0);g.events=[];
    g.tick(1/120);assert.equal(g.state,'death_dissolve');assert.equal(g.player.alive.size,0);
    assert.equal(g.sealedZap.module,m);assert.deepEqual(g.sealedZap.center,g.player.origin);
    assert.equal(g.message,'SEALED CORRIDOR · LETHAL GRID');assert.equal(g.events.filter(e=>e.name==='sealed_zap').length,1);
    assert.equal(g.events.some(e=>e.name==='death'),false);assert.equal(g.runStats.deaths,1);
    g.events=[];g.tick(.48);assert.equal(g.state,'death_dissolve','Allow time to see the grid before whiteout');
    for(const flag of ['paused','help']) {g[flag]=true;const time=g.stateTime;g.tick(10);assert.equal(g.stateTime,time);g[flag]=false;}
    g.tick(.28);assert.equal(g.state,'reassembly');assert.equal(g.events.some(e=>e.name==='sealed_zap'),false);
    g.retry();assert.equal(g.sealedZap,null);assert.equal(g.deathDissolveSeconds,.48);
  }
  const timer=playing();timer.legTime=.001;timer.events=[];timer.tick(1/120);
  assert.equal(timer.sealedZap,null);assert.equal(timer.events.some(e=>e.name==='sealed_zap'),false);assert.equal(timer.deathDissolveSeconds,.48);
  const open=playing();open.player.origin=open.course.modules[1].world(0);open.tick(1/120);
  open.player.origin=open.course.modules[1].world(0,12,0);open.tick(1/120);
  open.player.origin=open.course.modules[1].world(0);open.tick(1/120);
  assert.equal(open.state,'playing');assert.equal(open.sealedZap,null);
});

test('the sealed grid draws bright crossed beams at contact, freezes on pause and clears for reassembly; the browser displays its cause',()=>{
  const r=Object.create(Renderer.prototype),lines=[],panels=[];
  r.lines={line:(a,b,color,alpha)=>lines.push({a,b,color,alpha})};
  r.shutterPanels={add:(corners,color,alpha)=>panels.push({corners,color,alpha})};
  const draw=g=>{lines.length=0;panels.length=0;r.sealedCorridorZap(g);return JSON.stringify({lines,panels});};
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const ui=source.slice(source.indexOf('    const sealedDeath='),source.indexOf('    const fragments=game.recoverableFragments'));
  for(const index of [0,1,2,3]) {
    const g=playing(8),m=g.course.modules[index];g.course.collapsed.set(index,g.t);g.player.origin=m.world(0);g.tick(1/120);
    const first=draw(g);assert.equal(lines.length,66);assert.equal(panels.length,69);
    assert.ok(lines.every(l=>l.color[2]===1&&l.color[0]<l.color[2]&&l.alpha===1));
    assert.ok(panels.every(p=>p.color[2]===1&&p.color[0]<.1&&p.alpha>0));
    assert.ok(panels.flatMap(p=>p.corners).every(p=>p.sub(g.sealedZap.center).array().every(n=>Number.isFinite(n)&&Math.abs(n)<=7.6)));
    const notice={textContent:'',classList:{toggle(name,on){notice[name]=on;}}};
    const update=()=>vm.runInNewContext(ui,{game:g,s:g.state,playing:g.state==='playing',preview:false,$:()=>notice});
    update();assert.equal(notice.textContent,'SEALED CORRIDOR · LETHAL GRID');assert.equal(notice['sealed-death'],true);
    for(const flag of ['paused','help']) {g[flag]=true;g.tick(5);assert.equal(draw(g),first);g[flag]=false;}
    g.tick(.35);draw(g);assert.ok(lines[0].alpha>0&&lines[0].alpha<1);
    g.tick(.41);draw(g);assert.equal(lines.length,0);assert.equal(panels.length,0);update();assert.equal(notice['sealed-death'],true);
    g.tick(1);update();assert.equal(notice.textContent,'');assert.equal(notice['sealed-death'],false);
  }
});

test('sealed death has one distinct buzz which is not swallowed by a preceding shutter sound or replayed later',()=>{
  const g=playing();g.course.collapsed.set(0,g.t);g.player.origin=g.course.modules[0].world(0);g.events=[];g.tick(1/120);
  const heard=[],stops=[],adapter=Object.create(GameAudio.prototype);
  Object.assign(adapter,{ready:false,sound:(...args)=>heard.push(args),stopAll:fade=>stops.push(fade)});
  adapter.update(g);assert.deepEqual(heard,[['shutter_close',.9,'sealed_zap',false,-5]]);assert.deepEqual(stops,[.015]);
  adapter.update(g);assert.equal(heard.length,1);
  const sources=[],audio=Object.create(GameAudio.prototype),param=()=>({value:1,cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){}});
  Object.assign(audio,{ready:true,channels:new Map(),last:new Map(),buffers:new Map([['shutter_close',{duration:.56}]]),manifest:{shutter_close:{duration:.56}},master:{},ctx:{currentTime:10,
    createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBufferSource:()=>{const source={playbackRate:param(),connect(){},disconnect(){},start(){},stop(){}};sources.push(source);return source;}}});
  audio.sound('shutter_close');audio.sound(...heard[0]);assert.equal(sources.length,2);assert.ok(audio.channels.has('sealed_zap'));
  assert.equal(sources[1].playbackRate.value,2**(-5/12));
});
