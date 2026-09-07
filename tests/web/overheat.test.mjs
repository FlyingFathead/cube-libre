import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,V,portalMetrics} from '../../web/js/core.mjs';
import {Renderer} from '../../web/js/render.mjs';

function capturePlayer(g) {
  const cubes=[],r=Object.create(Renderer.prototype);
  r.cubes={cube(pos,color){cubes.push({pos:pos.array(),color});}};r.lines={line(){}};
  r.player(g);return cubes;
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('outside overheating vibrates the actual body increasingly while preserving collision positions',()=>{
  const g=new Game({gameMode:50});g.ready(15);g.setState('playing');g.t=.123;
  g.player.origin=new V(-18,12,0);
  const physical=[...g.player.alive].map(i=>g.player.pos(i).array()),metric=portalMetrics(g.course,g.player);
  g.thermal(g.difficulty.overheatGraceSeconds-.01);
  assert.deepEqual(capturePlayer(g).map(c=>c.pos),physical,'No vibration during the outside grace period');
  g.thermal(.02);assert.ok(g.heat>0);
  const onset=capturePlayer(g);assert.ok(distance(onset[0].pos,physical[0])>.05);
  g.thermal(2);const hottest=capturePlayer(g);
  assert.ok(distance(hottest[0].pos,physical[0])>distance(onset[0].pos,physical[0]));
  assert.deepEqual([...g.player.alive].map(i=>g.player.pos(i).array()),physical);
  assert.deepEqual(portalMetrics(g.course,g.player),metric);
  assert.equal(g.player.alive.size,125,'Drawing vibration never destroys or moves cells');
  g.command('shake 0');assert.deepEqual(capturePlayer(g).map(c=>c.pos),physical);
  g.command('shake true');assert.deepEqual(capturePlayer(g),hottest);
  g.player.origin=new V(-18,0,0);g.thermal(.01);assert.equal(g.heat,0);
  assert.deepEqual(capturePlayer(g).map(c=>c.pos),[...g.player.alive].map(i=>g.player.pos(i).array()),'Returning inside stops the shaking');
});

test('hot cells flash red/orange, freeze on pause/help, and stay steadily hot when the switch is off',()=>{
  const g=new Game({gameMode:50});g.ready(15);g.setState('playing');g.heat=1;g.t=.123;
  g.hitTime=.2;g.lastHit='bounds'; // Boundary hit flashes must not wash heat back to blue.
  const first=capturePlayer(g);assert.ok(first[124].color[0]>first[124].color[2]);
  g.t+=.04;const second=capturePlayer(g);assert.notDeepEqual(first[0].color,second[0].color);
  for(const flag of ['paused','help']) {g[flag]=true;g.tick(10);assert.deepEqual(capturePlayer(g),second);g[flag]=false;}
  g.command('shake false');const steady=capturePlayer(g);g.t+=.2;
  assert.deepEqual(capturePlayer(g),steady);assert.ok(steady[124].color[0]>steady[124].color[2]);
  g.command('shake 1');assert.notDeepEqual(capturePlayer(g),steady);
});

test('console accepts true/false and 0/1 for shaking and persists the choice through the browser adapter',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game({gameMode:50}),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(key,value){saved.push([key,value]);}});
  for(const [command,expected] of [['shake 0',false],['shake true',true],['set shake false',false],['set shake 1',true]]) {
    elements['console-input'].value=command;elements['console-form'].onsubmit({preventDefault(){}});
    assert.equal(game.flags.shake,expected);assert.deepEqual(saved.at(-1),['cube-libre-shake-v1',expected]);
  }
  game.command('shake false');game.newRun();assert.equal(game.flags.shake,false);
  assert.match(game.command('help'),/route3d shake/);
});
