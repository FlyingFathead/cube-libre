import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game} from '../../web/js/core.mjs';
import {PickingUpThePieces,scheduledBonus,createBonus,rotateQ,recoveredShape,PIECES_RULES,BONUS_SCHEDULE,bonusHeat} from '../../web/js/bonus.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function advance(g,seconds,input={}) {for(let i=0;i<Math.ceil(seconds*120);i++)g.tick(1/120,input);}
function playable(preview=false) {const g=new Game({gameMode:50,rng:()=>.5});g.startBonus('001',{preview});advance(g,8.7);assert.equal(g.state,'bonus_playing');return g;}

test('bonus registry and schedule start after 5, recur every five, and preserve the cap ending',()=>{
  const scheduled=[];for(let n=1;n<=55;n++)if(scheduledBonus(n,50))scheduled.push(n);
  assert.deepEqual(scheduled,[5,10,15,20,25,30,35,40,45]);
  assert.equal(createBonus('001').name,'PICKING UP THE PIECES');
  assert.throws(()=>createBonus('002'),/Unknown bonus type/);
  const custom={firstLevel:3,interval:4,types:['001','002']};
  assert.equal(scheduledBonus(7,50,custom),'002');
});

test('intro and crash freeze the bonus clock; impact emits once; pause and help freeze play',()=>{
  const g=new Game({gameMode:50});g.startBonus('001');advance(g,4.9);near(g.bonus.timeLeft,45);assert.equal(g.state,'bonus_intro');
  advance(g,.2);assert.equal(g.state,'bonus_smash');near(g.bonus.timeLeft,45);
  advance(g,3.3);assert.equal(g.state,'bonus_smash');near(g.bonus.timeLeft,45);
  assert.equal(g.events.filter(e=>e.name==='crash').length,1);
  advance(g,.3);assert.equal(g.state,'bonus_playing');assert.ok(g.bonus.timeLeft>44.8);
  for(const field of ['paused','help']) {g[field]=true;const before=g.bonus.timeLeft;advance(g,5,{z:-1});near(g.bonus.timeLeft,before);g[field]=false;}
});

test('the cube tips around an edge and accumulates real orientation without floor penetration',()=>{
  const b=new PickingUpThePieces();b.pieces=[];
  const startX=b.x,width=.92;
  b.update(width/PIECES_RULES.speed/2,{x:1});
  near(b.x,startX+width/2);near(b.y,Math.sqrt(2)*.46);
  const up=rotateQ([0,1,0],b.orientation);near(up[0],Math.SQRT1_2);near(up[1],Math.SQRT1_2);
  b.update(width/PIECES_RULES.speed/2,{x:1});near(b.x,startX+width);near(b.y,.46);
  for(let i=0;i<60;i++)b.update(1/120,{z:-1});
  near(Math.hypot(...b.orientation),1);assert.ok(b.z<12);assert.ok(b.y>=.46-1e-6);
});

test('collecting attaches each piece once and every assembled body remains connected',()=>{
  const b=new PickingUpThePieces();b.pieces=[{id:0,x:0,z:12,collected:false},{id:1,x:1,z:12,collected:false}];
  assert.equal(b.update(.01).picked,2);assert.equal(b.collected,2);assert.equal(b.bodyCount,3);assert.equal(b.potentialScore,200);
  assert.equal(b.update(.01).picked,0);assert.equal(b.collected,2);
  for(let count=1;count<=125;count++) {
    const shape=recoveredShape(count);assert.equal(shape.length,count);
    const visited=new Set([0]);let changed=true;
    while(changed){changed=false;for(let i=0;i<count;i++)if(!visited.has(i)&&[...visited].some(j=>shape[i].reduce((d,v,k)=>d+Math.abs(v-shape[j][k]),0)===1)){visited.add(i);changed=true;}}
    assert.equal(visited.size,count);
  }
});

test('every starting body size can roll up the ramp and clear the portal before the deadline',()=>{
  for(const count of [1,2,8,9,27,64,100,125]) {
    const b=new PickingUpThePieces();b.pieces=[];b.collected=count-1;b.bodyCount=count;
    for(let i=0;i<120*20&&!b.result;i++)b.update(1/120,{z:-1});
    assert.equal(b.result,'escaped',`Body size ${count} can escape`);assert.ok(b.timeLeft>25);
    for(const cell of recoveredShape(b.bodyCount))for(const x of [-.46,.46])for(const y of [-.46,.46])for(const z of [-.46,.46]) {
      const v=rotateQ([cell[0]+x,cell[1]+y,cell[2]+z],b.orientation);
      assert.ok(b.y+v[1]>=b.ground(b.x+v[0],b.z+v[2])-1e-6,'Every cube stays above the ramp and landing');
    }
    assert.ok(b.z<=b.rules.portalZ);
  }
  const b=new PickingUpThePieces({rng:()=>.5});
  for(let i=0;i<120*20&&!b.result;i++)b.update(1/120,{z:-1});
  assert.equal(b.result,'escaped');assert.ok(b.collected>0);assert.ok(b.timeLeft>25);
});

test('solid floor edges and ramp sides stop movement without killing the player',()=>{
  const b=new PickingUpThePieces();b.pieces=[];
  for(let i=0;i<120*5;i++)b.update(1/120,{x:1,rush:true});
  assert.ok(b.x<=24-.72);assert.equal(b.result,null);
  for(let i=0;i<120*5;i++)b.update(1/120,{z:-1,rush:true});
  assert.ok(b.z>=b.rules.floorFarZ+.72);assert.equal(b.result,null);
  assert.equal(b.ground(0,-14),0);assert.equal(b.ground(0,-20),3);assert.equal(b.ground(0,-26),6);
});

test('a scheduled bonus banks score only on escape, once, then advances without replaying the bonus',()=>{
  const g=new Game({gameMode:50,rng:()=>.5});g.ready(10);g.setState('playing');g.player.setCount(50);g.win();
  assert.equal(g.score,5000);advance(g,8);assert.equal(g.state,'bonus_intro');assert.equal(g.level,10);
  advance(g,8.7);advance(g,15,{z:-1});assert.equal(g.state,'bonus_result');
  const bonus=g.bonus.potentialScore;assert.ok(bonus>0);assert.equal(g.score,5000+bonus);
  assert.equal(g.runStats.bonusScore,bonus);assert.equal(g.runStats.bonusRounds,1);
  advance(g,10);assert.equal(g.score,5000+bonus);
  g.continue();assert.equal(g.state,'level_ready');assert.equal(g.level,11);g.continue();assert.equal(g.level,11);
  g.newRun();assert.equal(g.bonusesPlayedAfter.size,0);assert.equal(g.runStats.bonusScore,0);
});

test('deadline forfeits only the bonus and prevents movement or pickups afterward',()=>{
  const g=playable();g.level=15;g.completedLevel=15;g.bonusesPlayedAfter.add(15);g.score=9000;
  g.bonus.update(.01);g.bonus.timeLeft=.001;const z=g.bonus.z;
  g.tick(1/120,{z:-1});assert.equal(g.state,'bonus_escape');assert.equal(g.bonus.result,'timeout');near(g.bonus.timeLeft,0);
  const count=g.bonus.collected;g.bonus.update(100,{z:-1});assert.equal(g.bonus.collected,count);assert.ok(Math.abs(g.bonus.z-z)<.02);
  assert.equal(g.score,9000);assert.equal(g.runStats.bonusScore,0);
  advance(g,3);g.continue();assert.equal(g.level,16);assert.equal(g.state,'level_ready');
});

test('bonus tests lead to the next active level, preserve earned points and never award test points',()=>{
  const g=new Game({gameMode:50,rng:()=>.5});g.ready(23);g.setState('playing');g.score=4200;
  const run={...g.runStats},stats={...g.stats};
  g.command('test bonus_round_1');advance(g,8.7);advance(g,12,{z:-1});assert.equal(g.state,'bonus_result');
  assert.equal(g.score,4200);assert.deepEqual(g.stats,stats);assert.deepEqual(g.runStats,run);
  g.continue();assert.equal(g.state,'level_ready');assert.equal(g.level,24);assert.equal(g.score,4200);
  assert.equal(g.player.alive.size,125);assert.equal(g.previewReturn,null);
  assert.throws(()=>g.command('bonus 999'),/Unknown bonus/);assert.equal(g.state,'level_ready');
});

test('menu tests fall back to the configured first bonus level, including after an old completed run',()=>{
  for(const previousLevel of [1,23,50]) {
    const g=new Game({gameMode:50});g.level=previousLevel;g.command('test bonus_round_1');
    assert.equal(g.previewReturn.nextLevel,BONUS_SCHEDULE.firstLevel);
    g.command('test bonus_round_1');assert.equal(g.previewReturn.nextLevel,BONUS_SCHEDULE.firstLevel);
    g.setState('bonus_result');g.stateTime=1;g.continue();
    assert.equal(g.level,BONUS_SCHEDULE.firstLevel);assert.equal(g.state,'time_intro');
  }
  const missing=new Game({gameMode:50});missing.setState('playing');delete missing.level;missing.command('test bonus_round_1');
  assert.equal(missing.previewReturn.nextLevel,BONUS_SCHEDULE.firstLevel);
  const g=new Game({gameMode:50});g.ready(50);g.command('test bonus_round_1');
  assert.equal(g.previewReturn.nextLevel,50,'Tests cannot create a level beyond the campaign cap');
});

test('preview aliases close the actual console submit handler and remain unpaused',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  for(const command of ['view_end_anim_v1','test ending_1','test bonus_round_1','bonus 001','view_bonus_001']) {
    const game=new Game({gameMode:50}),elements={'console-form':{},'console-input':{value:command},'console-log':{}},output=[];
    game.paused=true;let closed=0;
    vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,audio:{muted:true},history:[],historyIndex:0,log:[],consoleLog:v=>output.push(v),closeConsole(){closed++;},syncAudio(){},focusGame(){}});
    elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(closed,1,command);assert.equal(game.paused,false,command);
    assert.equal(game.state,command.includes('ending')||command==='view_end_anim_v1'?'ascension':'bonus_intro');
  }
});

test('bonus scene uses solid slabs, a ramp, finite geometry and one miniature player after impact',async()=>{
  const {Renderer}=await import('../../web/js/render.mjs');const T=await import('../../web/vendor/three.module.min.js');
  const r=Object.create(Renderer.prototype);r.world=new T.Group();r.createBonusArena();
  assert.equal(r.bonusArena.children.length,4);assert.ok(r.bonusArena.children.every(o=>o.isMesh));
  r.camera=new T.PerspectiveCamera(45,16/9,.1,1500);
  let cubeCount=0;
  const finite=p=>assert.ok([p.x,p.y,p.z].every(Number.isFinite));
  r.lines={line(a,b){finite(a);finite(b);},loop(ps){ps.forEach(finite);}};
  r.cubes={cube(p){finite(p);cubeCount++;}};
  const g=new Game({gameMode:50,rng:()=>.5});g.startBonus('001');
  for(const [state,time] of [['bonus_smash',.1],['bonus_smash',1.4],['bonus_smash',3.59],['bonus_playing',1]]) {
    g.setState(state);g.stateTime=time;cubeCount=0;r.bonus(g);assert.equal(cubeCount,147);finite(r.camera.position);
  }
  const b=g.bonus;b.bodyCount=125;b.collected=124;b.pieces=[];b.x=0;b.z=-28;b.y=b.supportHeight();r.bonus(g);
  assert.ok(r.camera.position.y>b.y);assert.ok(r.camera.position.z>b.z);
});

test('a route with turns gathers a substantial bonus and still leaves time to climb the ramp',()=>{
  const b=new PickingUpThePieces({rng:()=>.5});
  const path=[[18,12],[18,-8],[-18,-8],[-18,14],[0,14],[0,-30]];let target=0;
  for(let i=0;i<120*45&&!b.result;i++) {
    const [x,z]=path[target],dx=x-b.x,dz=z-b.z;
    if(!b.roll&&Math.abs(dx)<b.side&&Math.abs(dz)<b.side&&target<path.length-1)target++;
    b.update(1/120,Math.abs(dx)>b.side*.8?{x:Math.sign(dx)}:{z:Math.sign(dz)});
  }
  assert.equal(b.result,'escaped');assert.ok(b.collected>=50);assert.ok(b.timeLeft>5);
});

test('rolls reaching the portal are not blocked by their landing point beyond the platform edge',()=>{
  for(let count=1;count<=125;count++)for(const start of [-24,-23.5,-23]) {
    const b=new PickingUpThePieces();b.pieces=[];b.collected=count-1;b.bodyCount=count;b.z=start;
    for(let i=0;i<120*3&&!b.result;i++)b.update(1/120,{z:-1});
    assert.equal(b.result,'escaped',`Body ${count}, approach ${start}`);
    assert.ok(b.z>=b.rules.landingEndZ+b.side*.72,'Absorbed before the platform edge');
  }
  const g=playable(true);g.bonus.pieces=[];g.bonus.collected=124;g.bonus.bodyCount=125;g.bonus.z=-24;
  advance(g,4,{z:-1});assert.equal(g.state,'bonus_result');assert.equal(g.bonus.result,'escaped');
  assert.equal(g.score,0);assert.equal(g.bonus.explosion.length,0);
  g.continue();assert.equal(g.level,BONUS_SCHEDULE.firstLevel);assert.equal(g.state,'time_intro');
});

test('bonus heat begins only at five seconds, grows toward zero and freezes with the clock',()=>{
  assert.equal(bonusHeat(5.001),0);assert.ok(bonusHeat(5)>0);
  for(let left=4.9;left>=0;left-=.1)assert.ok(bonusHeat(left)>=bonusHeat(left+.1));
  assert.equal(bonusHeat(0),1);
  const g=playable();g.bonus.timeLeft=5;const heat=bonusHeat(g.bonus.timeLeft),elapsed=g.t;
  g.paused=true;advance(g,10);assert.equal(bonusHeat(g.bonus.timeLeft),heat);near(g.t,elapsed);
  g.paused=false;advance(g,2);assert.ok(bonusHeat(g.bonus.timeLeft)>heat);assert.equal(g.bonus.explosion.length,0);
});

test('timeout explodes the visible body once, freezes during pause and proceeds to its result',()=>{
  for(const count of [1,27,125]) {
    const g=playable(true),b=g.bonus;b.pieces=[];b.bodyCount=count;b.collected=count-1;b.timeLeft=.001;
    g.events=[];g.tick(1/120);assert.equal(g.state,'bonus_escape');assert.equal(b.result,'timeout');
    assert.equal(b.explosion.length,count);assert.equal(g.events.filter(e=>e.name==='death').length,1);
    assert.equal(g.events.filter(e=>e.name==='crash').length,1);assert.equal(g.events.filter(e=>e.name==='collapse').length,1);
    for(const p of b.explosion) {assert.ok(p.vel.length()>0);assert.ok(p.vel.y>0);assert.ok(p.origin.array().every(Number.isFinite));}
    const parts=b.explosion;g.explodeBonus();assert.equal(b.explosion,parts);assert.equal(g.events.filter(e=>e.name==='death').length,1);
    g.paused=true;advance(g,10);assert.equal(g.stateTime,0);g.paused=false;
    advance(g,b.rules.explosionSeconds-.1);assert.equal(g.state,'bonus_escape');
    advance(g,.2);assert.equal(g.state,'bonus_result');assert.equal(g.score,0);
  }
});

test('bonus rendering shakes the hot body, replaces it with outward debris, then fades to white',async()=>{
  const {Renderer}=await import('../../web/js/render.mjs');const T=await import('../../web/vendor/three.module.min.js');
  const r=Object.create(Renderer.prototype),noop=()=>{};let cubes=[];
  r.lines={line:noop,loop:noop};r.cubes={cube(pos,color,scale,axis,angle,alpha){cubes.push({pos,color,scale,alpha});}};
  r.camera=new T.PerspectiveCamera(45,16/9,.1,1500);
  const g=playable(true);g.bonus.pieces=[];g.bonus.pickupFlashes=[];g.bonus.bodyCount=1;g.bonus.collected=0;
  g.bonus.timeLeft=6;r.bonus(g);const cold=cubes.at(-1);
  g.bonus.timeLeft=1;cubes=[];r.bonus(g);const hot=cubes.at(-1);
  assert.notDeepEqual(hot.pos,cold.pos);assert.notDeepEqual(hot.color,cold.color);
  g.bonus.timeLeft=.001;g.tick(1/120);g.stateTime=.5;cubes=[];r.bonus(g);
  assert.equal(cubes.length,23,'Portal motes plus a single disintegrating fragment; no intact body');
  const fragment=cubes.at(-1);assert.ok(fragment.pos.sub(g.bonus.explosion[0].origin).length()>1);
  assert.ok(fragment.scale<1);assert.ok(fragment.alpha<1);
  r.width=800;r.height=600;r.ctx={clearRect:noop,fillRect:noop};
  g.stateTime=.4;r.effects(g);assert.equal(r.ctx.fillStyle,'rgba(255,255,255,0)','Explosion stays visible before the final fade');
  g.stateTime=2;r.effects(g);assert.equal(r.ctx.fillStyle,'rgba(255,255,255,1)');
});
