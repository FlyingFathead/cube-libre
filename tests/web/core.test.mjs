import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,Course,Player,V,cells,recoupleTargets,beginRecouple,portalMetrics,suction,openingLineOpacity,ASCENSION_TIMING} from '../../web/js/core.mjs';
import {difficultyForLevel} from '../../web/js/difficulty.mjs';
const ref=JSON.parse(readFileSync(new URL('./python-reference.json',import.meta.url)));
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const nearVector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const advance=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.tick(1/120,input);};
function playing(level=1){const g=new Game({rng:()=>.5});g.ready(level);advance(g,8.7);assert.equal(g.state,'playing');return g;}
// Preserve comparisons with the seven-leg PyGame snapshot; web progression now
// has its own full-length route checks below and in long-course.test.mjs.
const referenceCourse=(level,route3d=true)=>new Course(level,route3d,{moduleCount:Math.min(7,level)});

test('route geometry, corridor union and joint locations match the Python implementation',()=>{
  for(const r of ref.levels){const c=referenceCourse(r.level,r.route3d);
    assert.deepEqual(c.modules.map(m=>m.bx.array()),r.directions);nearVector(c.bounds,r.bounds);
    for(let i=0;i<r.modules.length;i++){const m=c.modules[i],v=r.modules[i];nearVector(m.start.array(),v.start);nearVector(m.end().array(),v.end);
      assert.deepEqual([m.bx,m.by,m.bz].map(v=>v.array()),v.basis);}
    for(const v of r.inside)assert.equal(c.inside(V.of(v.p),v.pad),v.value,`Level ${r.level} ${v.p} pad ${v.pad}`);
    for(const v of r.locations){const l=c.location(V.of(v.p));nearVector([l.index,l.x],v.value);}
  }
});
test('rotating laser collision and coordinate transforms match Python',()=>{
  const courses=new Map();let hits=0;
  for(const r of ref.lasers){if(!courses.has(r.level))courses.set(r.level,referenceCourse(r.level));
    const l=courses.get(r.level).lasers[r.index];assert.equal(l.hits(V.of(r.p),r.t),r.hit);nearVector(l.local(V.of(r.p),r.t).array(),r.local);hits+=r.hit;}
  assert.ok(hits>100,'Fixtures must include collisions, not only empty space');
});
test('portal commitment, contact charge and suction match Python for small and whole bodies',()=>{
  const courses=new Map();
  for(const r of ref.portals){if(!courses.has(r.level))courses.set(r.level,referenceCourse(r.level));
    const c=courses.get(r.level),p=new Player();p.alive=new Set(cells.map((_,i)=>i).slice(0,r.count));p.origin=V.of(r.origin);
    const m=portalMetrics(c,p);for(const key of ['ratio','charge','overlap'])near(m[key],r.metrics[key]);assert.equal(m.ratio>=.985,r.metrics.reached);
    suction(c,p,1/120);nearVector(p.origin.array(),r.after_suction);
  }
});
test('compact re-coupling target priority matches Python',()=>{
  for(const r of ref.recovery){const p=new Player();p.alive=new Set(r.alive.map(c=>cells.findIndex(v=>v.every((n,i)=>n===c[i]))));
    assert.deepEqual(recoupleTargets(p,125-p.alive.size).map(i=>cells[i]),r.targets);}
});
test('movement is world-relative, rush is 2.6x, and preview time does not consume the leg clock',()=>{
  const g=playing(5);g.flags.damage=false;g.flags.suction=false;
  const before=g.player.origin;advance(g,1,{x:1,y:1,z:1});nearVector(g.player.origin.sub(before).array(),[6,6,6],1e-7);
  const p=g.player.origin;advance(g,1,{x:-1,rush:true});near(g.player.origin.x-p.x,-15.6);
  const intro=new Game();intro.ready(5);advance(intro,8);near(intro.legTime,30);
});
test('a first-level portal traversal scores once, then advances to level two',()=>{
  const g=playing();g.flags.damage=false;advance(g,7,{x:1});assert.ok(['portal_warp','result_overlay'].includes(g.state));
  assert.equal(g.score,12500);assert.equal(g.completedLevel,1);g.setState('result_overlay');g.continue();assert.equal(g.level,2);assert.equal(g.state,'level_ready');
  g.continue();assert.equal(g.level,2);assert.equal(g.score,12500);
});
test('phase cards hold for five seconds before levels 3, 5, 10 and 15',()=>{
  for(const [completed,phase] of [[2,'space_intro'],[4,'time_intro'],[9,'entropy_intro'],[14,'heat_intro']]){
    const g=new Game();g.level=completed;g.completedLevel=completed;g.advance();assert.equal(g.state,phase);advance(g,4.9);assert.equal(g.state,phase);
    advance(g,.2);assert.equal(g.state,'level_ready');assert.equal(g.level,completed+1);
  }
});
test('re-coupling expires, loses fragments, and limits active requests',()=>{
  const g=playing();g.flags.damage=false;
  for(let i=0;i<10;i++)g.player.destroy(i,g.player.origin);
  g.requestRecouple();assert.equal(g.recoupling.length,9);assert.equal(g.player.fragments.length,1);
  for(let i=0;i<5;i++)g.requestRecouple();assert.equal(g.requests.length,5);assert.ok(g.cooldown>0);
  advance(g,1.2);assert.equal(g.player.alive.size,124);advance(g,9);assert.equal(g.player.fragments.length,0);
  const p=new Player(()=>.5);for(let i=0;i<10;i++)p.destroy(i,p.origin);assert.equal(beginRecouple(p,10).length,5);
  const old=new Player();old.destroy(0,old.origin);old.update(8);assert.equal(beginRecouple(old,1).length,0);
});
test('pause and help freeze timers and prevent fragment expiration',()=>{
  for(const flag of ['paused','help']){const g=playing(5);g.player.destroy(0,g.player.origin);g[flag]=true;
    const t=g.t,left=g.legTime;advance(g,20,{x:1});near(g.t,t);near(g.legTime,left);assert.equal(g.player.fragments.length,1);near(g.player.fragments[0].age,0);}
});
test('timeout rebuilds the same level with a fresh body, clock and collapse state',()=>{
  const g=playing(5);g.flags.damage=false;g.legTime=.01;g.score=21000;advance(g,.03);assert.equal(g.state,'death_dissolve');
  advance(g,5.5);assert.equal(g.state,'playing');assert.equal(g.level,5);assert.equal(g.score,21000);assert.equal(g.player.alive.size,125);
  assert.ok(g.legTime>29);assert.equal(g.course.collapsed.size,0);
});
test('revealed hazards arm gradually; old corridors collapse and timed backtracking kills',()=>{
  const g=playing(5);g.flags.damage=false;g.player.origin=g.course.modules[1].start;
  g.tick(1/120);assert.ok(g.course.revealed.has(1));assert.equal(g.course.activeLaser(g.course.lasers[5],g.player.origin,g.t),false);
  advance(g,1.5);assert.equal(g.course.revealProgress(1,g.t),1);
  g.player.origin=g.course.modules[2].world(-15);g.tick(1/120);assert.ok(g.course.collapsed.has(0));near(g.legTime,30);
  g.player.origin=g.course.modules[0].world(-18);g.tick(1/120);assert.equal(g.state,'death_dissolve');
});
test('damage removes cells rather than imposing an unrelated death switch',()=>{
  const g=playing();g.flags.lasers=false;g.player.origin=new V(-18,12,0);const before=g.player.alive.size;
  assert.equal(g.damage(),'bounds');assert.equal(g.player.alive.size,before-2);assert.equal(g.player.fragments.length,2);
  g.flags.damage=false;assert.equal(g.damage(),null);
});
test('debug commands cover original flags, progression and current-level reset',()=>{
  const g=playing();g.command('level 10');assert.equal(g.level,10);g.score=999;g.command('restart');assert.equal(g.score,999);
  g.command('damage off');assert.equal(g.flags.damage,false);g.command('toggle damage');assert.equal(g.flags.damage,true);
  g.command('cubes 1');assert.equal(g.player.alive.size,1);g.command('heal');assert.equal(g.player.alive.size,125);
  g.command('set route3d off');assert.ok(g.course.modules.every(m=>m.bx.y===0));g.command('portal');near(g.course.portal.local(g.player.origin).x,15);
  assert.throws(()=>g.command('level nan'));g.command('newrun');assert.equal(g.level,1);assert.equal(g.score,0);
});

test('new runs play the opening before level one; pause freezes it and retries skip it',()=>{
  const g=new Game({rng:()=>.5});g.newRun();
  assert.equal(g.state,'opening_intro');assert.equal(g.level,1);assert.equal(g.score,0);
  const origin=g.player.origin.array();
  advance(g,2,{x:1,y:1,z:1,rush:true});nearVector(g.player.origin.array(),origin);
  assert.equal(g.legTime,30);assert.equal(g.player.alive.size,125);
  g.paused=true;const t=g.stateTime;advance(g,20);near(g.stateTime,t);
  g.paused=false;g.help=true;advance(g,20);near(g.stateTime,t);g.help=false;
  advance(g,7);assert.equal(g.state,'opening_intro');
  advance(g,.3);assert.equal(g.state,'level_ready');assert.equal(g.openingTransition,true);
  advance(g,1.7);assert.equal(g.state,'course_materialize');
  advance(g,7.1);assert.equal(g.state,'playing');assert.equal(g.level,1);
  g.ready(1);assert.equal(g.state,'level_ready');assert.equal(g.openingTransition,false);
  g.title();g.continue();assert.equal(g.state,'opening_intro');
});

test('opening lines appear in order, hold together, and fade into white together',()=>{
  const lines=t=>[0,1,2].map(i=>openingLineOpacity(t,i));
  assert.deepEqual(lines(0),[0,0,0]);
  const first=lines(1.4);assert.ok(first[0]>0&&first[0]<1);assert.deepEqual(first.slice(1),[0,0]);
  const second=lines(3);assert.equal(second[0],1);assert.ok(second[1]>0&&second[1]<1);assert.equal(second[2],0);
  const third=lines(4.6);assert.deepEqual(third.slice(0,2),[1,1]);assert.ok(third[2]>0&&third[2]<1);
  assert.deepEqual(lines(6),[1,1,1]);
  const fading=lines(7.8);assert.ok(fading[0]>0&&fading[0]<1);near(fading[0],fading[1]);near(fading[1],fading[2]);
  assert.deepEqual(lines(8.5),[0,0,0]);
});

test('time and re-coupling yield tighten gradually after their introductions and stop at level 50',()=>{
  assert.equal(difficultyForLevel(4).timed,false);
  assert.equal(difficultyForLevel(5).timed,true);
  assert.equal(difficultyForLevel(5).secondsPerLeg,30);
  assert.equal(difficultyForLevel(9).recouplingRate,.9);
  assert.equal(difficultyForLevel(10).recouplingRate,.5);
  assert.equal(difficultyForLevel(50).secondsPerLeg,10);
  assert.equal(difficultyForLevel(50).recouplingRate,.01);
  let previous=difficultyForLevel(10);
  for(let level=11;level<=50;level++){
    const next=difficultyForLevel(level);
    assert.ok(next.secondsPerLeg<=previous.secondsPerLeg&&next.secondsPerLeg>=10);
    assert.ok(next.recouplingRate<=previous.recouplingRate&&next.recouplingRate>=.01);
    assert.ok(previous.secondsPerLeg-next.secondsPerLeg<.8,'No sudden timer cliff');
    assert.ok(previous.recouplingRate-next.recouplingRate<=.020000001,'No sudden yield cliff');
    previous=next;
  }
  for(const level of [51,100,1000000])assert.deepEqual(difficultyForLevel(level),difficultyForLevel(50));
});

test('re-coupling uses the level yield per request while keeping remaining pieces and the one-piece minimum',()=>{
  for(const [level,expected] of [[9,90],[10,50],[30,26],[50,1],[100,1]]){
    const p=new Player(()=>.5);for(let i=0;i<100;i++)p.destroy(i,p.origin);
    assert.equal(beginRecouple(p,level).length,expected);
    assert.equal(p.fragments.length,100-expected);
    if(level===50)assert.equal(beginRecouple(p,level).length,1,'Next request gathers about 1% of the remaining 99 pieces');
  }
  const p=new Player(()=>.99);p.destroy(0,p.origin);
  assert.equal(beginRecouple(p,50).length,1);
});

test('scaled time allowance survives preview, forward leg resets, death and retry',()=>{
  for(const level of [10,20,35,50]){
    const g=playing(level),budget=difficultyForLevel(level).secondsPerLeg;g.flags.damage=false;
    assert.ok(g.legTime<=budget&&g.legTime>budget-.1);
    g.legTime=.25;g.player.origin=g.course.modules[2].world(-15);g.tick(1/120);
    near(g.legTime,budget);assert.ok(g.timedModule>=2);
    g.legTime=.001;g.tick(1/120);assert.equal(g.state,'death_dissolve');
    advance(g,5.5);assert.equal(g.state,'playing');assert.equal(g.level,level);
    assert.ok(g.legTime<=budget&&g.legTime>budget-1);
    g.command('restart');near(g.legTime,budget);assert.equal(g.state,'level_ready');
  }
});

test('TIME returns before levels 20, 35 and 50 with the new allowance and no running clock',()=>{
  for(const level of [20,35,50]){
    const g=new Game();g.ready(level-1);g.completedLevel=level-1;g.advance();
    assert.equal(g.state,'time_intro');assert.equal(g.level,level);
    const initial=g.legTime;advance(g,4.9);assert.equal(g.state,'time_intro');near(g.legTime,initial);
    advance(g,.2);assert.equal(g.state,'level_ready');near(g.legTime,difficultyForLevel(level).secondsPerLeg);
  }
  const g=new Game();g.ready(50);g.completedLevel=50;g.advance();
  assert.equal(g.state,'ascension');assert.equal(g.level,50);
});

test('all 50 legs can be traversed with rush, lasers, scarce re-coupling and the ten-second leg clock',()=>{
  const g=playing(50);
  const targets=[...g.course.modules.slice(0,-1).map(m=>m.end()),g.course.portal.world(25)];
  let target=0,minLeft=Infinity;
  for(let frame=0;frame<120*180&&g.state==='playing';frame++){
    const delta=targets[target].sub(g.player.origin),input={rush:true};
    for(const axis of ['x','y','z'])input[axis]=Math.max(-1,Math.min(1,delta[axis]/(15.6/120)));
    if(frame%252===0)g.requestRecouple(); // One legal C request every 2.1 seconds.
    g.tick(1/120,input);minLeft=Math.min(minLeft,g.legTime);
    if(g.player.origin.sub(targets[target]).length()<.03&&target<targets.length-1)target++;
  }
  assert.equal(g.state,'ascension');assert.equal(g.completedLevel,50);
  assert.equal(g.course.modules.length,50);assert.equal(g.timedModule,49);
  assert.ok(g.runStats.recoupledCubes>0);assert.equal(g.course.collapsed.size,49);
  assert.ok(g.player.alive.size>0);assert.ok(minLeft>5,'Rush route leaves maneuvering time on every leg');
});

test('HEAT shortens the out-of-bounds grace period by one second from level 15 onward',()=>{
  assert.equal(difficultyForLevel(14).heat,false);assert.equal(difficultyForLevel(15).heat,true);
  for(const level of [14,15,50]){
    const g=new Game();g.ready(level);const threshold=level<15?2.4:1.4;
    near(g.difficulty.overheatGraceSeconds,threshold);
    g.player.origin=new V(-18,12,0);g.thermal(threshold-.02);assert.equal(g.heat,0);
    g.thermal(.04);assert.ok(g.heat>=.38);
    g.player.origin=new V(-18,0,0);g.thermal(.01);assert.equal(g.outsideTime,0);assert.equal(g.heat,0);
    g.player.origin=new V(-18,12,0);g.thermal(threshold-.02);assert.equal(g.heat,0,'Returning inside renews the grace period');
  }
});

test('clearing the level cap awards score once, holds white, then needs separate inputs for stats and menu',()=>{
  const g=playing(50);g.score=20000;g.runStats.levelsCleared=49;g.runStats.deaths=2;g.runStats.recoupledCubes=7;
  const expected=20000+g.player.alive.size*100;g.win();
  assert.equal(g.state,'ascension');assert.equal(g.score,expected);assert.equal(g.runSummary.levelsCleared,50);
  assert.equal(g.runSummary.deaths,2);assert.equal(g.runSummary.recoupledCubes,7);
  const playTime=g.runSummary.playSeconds;g.win();assert.equal(g.score,expected);
  g.continue();assert.equal(g.state,'ascension');
  g.tick(ASCENSION_TIMING.flySeconds-.1);assert.equal(g.state,'ascension');
  g.paused=true;g.tick(20);near(g.stateTime,ASCENSION_TIMING.flySeconds-.1);g.paused=false;
  g.tick(.11);assert.equal(g.state,'ascension_white');near(g.stateTime,0);
  g.continue();assert.equal(g.state,'ascension_white');
  g.tick(1.99);assert.equal(g.state,'ascension_white');
  g.tick(.02);assert.equal(g.state,'ascension_title');near(g.stateTime,0);
  g.continue();assert.equal(g.state,'ascension_title');
  g.tick(2.4);g.continue();assert.equal(g.state,'run_summary');
  g.continue();assert.equal(g.state,'run_summary','One input must not dismiss both screens');
  g.tick(1);g.continue();assert.equal(g.state,'title');assert.equal(g.level,50);
  near(g.runStats.playSeconds,playTime);assert.equal(g.stats.best_score,expected);
  g.newRun();assert.equal(g.state,'opening_intro');assert.equal(g.score,0);
  assert.deepEqual(g.runStats,{playSeconds:0,deaths:0,recoupledCubes:0,levelsCleared:0,bonusRounds:0,bonusPieces:0,bonusScore:0});
  assert.equal(g.stats.best_score,expected);
  g.ready(999);assert.equal(g.level,50);
});

test('unlisted ending preview starts the cinematic without awarding scores or records',()=>{
  const g=playing(7);g.score=1234;const stats={...g.stats};
  assert.equal(g.command('help').includes('view_end_anim_v1'),false);
  g.command('view_end_anim_v1');assert.equal(g.state,'ascension');
  assert.equal(g.score,1234);assert.deepEqual(g.stats,stats);assert.equal(g.runSummary.score,1234);
  g.tick(2);g.command('view_end_anim_v1');near(g.stateTime,0);
});

test('ascension renders a single cube; the white hold contains no scene geometry',async()=>{
  const {Renderer}=await import('../../web/js/render.mjs');
  const T=await import('../../web/vendor/three.module.min.js');
  let cubes=0,clearColor;
  const noop=()=>{},transform={set:noop,copy:noop,setScalar:noop};
  const r=Object.create(Renderer.prototype);
  Object.assign(r,{lines:{reset:noop,finish:noop},cubes:{reset(){cubes=0;},cube(){cubes++;},finish:noop},
    gl:{setClearColor(c){clearColor=c;},render:noop},stars:{material:{color:{setHex:noop}}},
    world:new T.Group(),rotator:{rotation:transform,scale:transform},camera:{position:transform,aspect:16/9,lookAt:noop},effects:noop});
  const g=new Game();g.command('view_end_anim_v1');r.render(g);assert.equal(cubes,1);
  for(const state of ['ascension_white','ascension_title','run_summary']){
    g.setState(state);r.render(g);assert.equal(cubes,0);assert.equal(clearColor,0xffffff);assert.equal(r.stars.visible,false);
    assert.equal(r.ascensionScene.group.visible,false);
  }
});

test('time-reset notice begins with timed play and each new leg, freezes on pause, and expires',()=>{
  const untimed=playing(4);assert.equal(untimed.timeResetNotice,0);
  const g=playing(5);g.flags.damage=false;
  assert.ok(g.timeResetNotice>1.5);g.paused=true;
  const notice=g.timeResetNotice;advance(g,10);near(g.timeResetNotice,notice);
  g.paused=false;advance(g,2);assert.equal(g.timeResetNotice,0);
  g.player.origin=g.course.modules[2].world(-15);g.tick(1/120);
  near(g.legTime,g.difficulty.secondsPerLeg);near(g.timeResetNotice,1.6);
  g.legTime=.001;g.tick(1/120);advance(g,5.5);
  assert.equal(g.state,'playing');assert.ok(g.timeResetNotice>1);
});
