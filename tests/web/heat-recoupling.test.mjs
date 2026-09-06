import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,V} from '../../web/js/core.mjs';
import {BALANCE,LEVEL_FEATURES,difficultyForLevel,introductionsForLevel,introductionCard,heatLevelReached,recouplingHeatBlocked} from '../../web/js/difficulty.mjs';

function setup(level=BALANCE.heatStartLevel) {
  const g=new Game({rng:()=>.5});g.ready(level);g.setState('playing');
  g.flags.damage=false;g.flags.suction=false;
  for(let i=0;i<10;i++)g.player.destroy(i,g.player.origin);
  return g;
}

test('the HEAT level enables both penalties; zero removes the level gate independently of heat source',()=>{
  assert.equal(BALANCE.heatMinLevel,15);assert.equal(BALANCE.overheatBlocksRecoupling,true);
  assert.equal(difficultyForLevel(14).heat,false);assert.equal(difficultyForLevel(15).heat,true);
  for(const level of [1,14,15,50])for(const enabled of [true,false])for(const hot of [true,false]) {
    assert.equal(recouplingHeatBlocked(level,hot,enabled),level>=15&&hot&&enabled);
    assert.equal(recouplingHeatBlocked(level,hot,enabled,0),hot&&enabled);
    assert.equal(heatLevelReached(level,0),true);
  }
  const early=setup(14);early.heat=1;early.requestRecouple();assert.ok(early.recoupling.length>0);
  const hot=setup(15);hot.heat=1;hot.outside=false;hot.requestRecouple();
  assert.equal(hot.recoupling.length,0,'The heat state, not a particular boundary hazard, gates requests');
  hot.command('overheat_blocks_recoupling disabled');hot.requestRecouple();assert.ok(hot.recoupling.length>0);
});

test('outside grace permits requests, overheating refuses without spending quota, and cooling permits them again',()=>{
  const grace=setup();grace.player.origin=new V(-18,12,0);
  grace.thermal(grace.difficulty.overheatGraceSeconds-.01);assert.equal(grace.heat,0);
  grace.requestRecouple();assert.ok(grace.recoupling.length>0);
  const g=setup();g.player.origin=new V(-18,12,0);g.thermal(g.difficulty.overheatGraceSeconds+.01);
  assert.ok(g.recouplingBlockedByHeat);const fragments=JSON.stringify(g.player.fragments);
  g.requests=[-50];g.cooldown=.3;g.recoupleTime=.25;
  for(let i=0;i<8;i++)g.requestRecouple();
  assert.deepEqual(g.requests,[-50]);assert.equal(g.cooldown,.3);assert.equal(g.recoupleTime,.25);
  assert.equal(JSON.stringify(g.player.fragments),fragments);assert.equal(g.recoupling.length,0);
  assert.match(g.message,/TOO HOT TO RE-COUPLE/);
  g.player.origin=new V(-18,0,0);g.thermal(.01);assert.equal(g.recouplingBlockedByHeat,false);
  g.requestRecouple();assert.ok(g.recoupling.length>0);assert.equal(g.requests.length,1);
});

test('an accepted request finishes through subsequent heating; paused and bonus states never start one',()=>{
  const g=setup();g.requestRecouple();const expected=g.player.alive.size+g.recoupling.length;
  g.player.origin=new V(-18,12,0);g.thermal(2);
  for(let i=0;i<144;i++)g.tick(1/120,{});
  assert.ok(g.heat>0);assert.equal(g.player.alive.size,expected);assert.equal(g.recoupling.length,0);
  for(const flag of ['paused','help']) {const p=setup();p[flag]=true;p.requestRecouple();assert.equal(p.requests.length,0);}
  const b=setup();b.startBonus('001');b.heat=1;b.requestRecouple();assert.equal(b.recoupling.length,0);
});

test('the ordered milestone schedule drives banners and sequential introductions without consuming the clock',()=>{
  assert.deepEqual(LEVEL_FEATURES.map(f=>[f.level,f.banner]),[
    [3,'SPACE ...'],[5,'TIME ...'],[10,'ENTROPY ...'],[15,'HEAT ...'],[20,'TIME ...'],[35,'TIME ...'],[50,'TIME ...']]);
  assert.deepEqual(introductionsForLevel(3,false),[]);
  for(const feature of LEVEL_FEATURES) {
    assert.ok(feature.summary().length>20);
    const card=introductionCard(feature.state,feature.level);assert.equal(card.title,feature.banner);assert.ok(card.subtitle);
    const g=new Game();g.introduceLevel(feature.level);assert.equal(g.state,feature.state);
    const clock=g.legTime;for(let i=0;i<590;i++)g.tick(1/120);assert.equal(g.state,feature.state);assert.equal(g.legTime,clock);
    for(let i=0;i<12;i++)g.tick(1/120);assert.equal(g.state,'level_ready');
  }
  const heat=introductionCard('heat_intro',15);assert.match(heat.subtitle,/1.4 SECONDS/);
  assert.match(heat.detail,/RE-COUPLING DISABLED WHILE OVERHEATING/);
  assert.match(introductionCard('heat_intro',15,{overheat_blocks_recoupling:false}).detail,/RESTRICTION: OFF/);
});

test('changing the configured heat minimum to zero or a shared milestone moves the actual rules and introductions together',async()=>{
  // Load an isolated copy of the real modules with only the editable minimum changed.
  const base=new URL('../../web/js/',import.meta.url);
  const absoluteImports=source=>source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,base)}'`);
  const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  for(const min of [0,5]) {
    const difficulty=readFileSync(new URL('difficulty.mjs',base),'utf8').replace('heatMinLevel: 15,',`heatMinLevel: ${min},`);
    const configURL=asModule(absoluteImports(difficulty));
    const core=readFileSync(new URL('core.mjs',base),'utf8').replaceAll("from './difficulty.mjs'",`from '${configURL}'`);
    const {Game:ConfiguredGame}=await import(asModule(absoluteImports(core)));
    const g=new ConfiguredGame({rng:()=>.5});
    if(min===0) {
      g.newRun();for(let i=0;i<1110;i++)g.tick(1/120);
      assert.equal(g.level,1);assert.equal(g.state,'heat_intro');
    } else {
      g.introduceLevel(5);assert.equal(g.state,'time_intro');
      for(let i=0;i<601;i++)g.tick(1/120);
      assert.equal(g.state,'heat_intro','Two features at one level get separate banners');
    }
    assert.equal(g.difficulty.overheatGraceSeconds,1.4);g.heat=1;
    assert.equal(g.recouplingBlockedByHeat,true);
    for(let i=0;i<602;i++)g.tick(1/120);
    assert.equal(g.state,'level_ready');assert.equal(g.legTime,g.difficulty.secondsPerLeg);
    g.setState('playing');g.player.destroy(0,g.player.origin);g.heat=1;
    g.requestRecouple();assert.equal(g.requests.length,0);
    g.heat=0;g.requestRecouple();assert.equal(g.requests.length,1);
  }
});
