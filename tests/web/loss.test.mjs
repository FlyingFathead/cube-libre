import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,cells,C,V,cellColor} from '../../web/js/core.mjs';
import {introductionCard,introductionsForLevel} from '../../web/js/difficulty.mjs';
import {LOSS_ASSEMBLY,lossGreyAmount,lossGhostPose} from '../../web/js/loss.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';

const shape=cells.map((_,i)=>i).filter(i=>i%3===0);
const finishCards=g=>{while(g.state.endsWith('_intro'))g.tick(5.01);};
function escape(g,survivors) {
  g.setState('playing');g.player.alive=new Set(survivors);g.win();
  assert.equal(g.state,'portal_warp');g.tick(3.41);g.continue();
}
function draw(g,assembly=false) {
  const drawn=[],r=Object.create(Renderer.prototype);
  r.cubes={cube(pos,color,scale,axis,angle,alpha){drawn.push({pos:pos.array(),color,scale,alpha});}};
  r.lines={line(){}};r[assembly?'reassemble':'player'](g);return drawn;
}

test('LOSS starts at the exit of 44 and carries exact surviving cells through bonus rounds and the final TIME card',()=>{
  const g=new Game({gameMode:50,rng:()=>.5});g.ready(43);
  escape(g,shape);assert.equal(g.level,44);assert.equal(g.state,'loss_intro');finishCards(g);
  assert.equal(g.entryCells.length,125,'Level 44 still arrives with a full body');
  escape(g,shape);assert.equal(g.level,45);assert.deepEqual([...g.player.alive],shape);
  assert.deepEqual(g.entryCells,shape);assert.equal(g.missingEntryCells.length,125-shape.length);
  for(const outcome of ['escaped','timeout']) {
    const b=new Game({gameMode:50,rng:()=>.5});b.ready(45,{survivors:shape});
    const remaining=shape.slice(7);escape(b,remaining);assert.equal(b.state,'bonus_intro');
    assert.deepEqual([...b.player.alive],remaining);const before=b.score;
    b.setState('bonus_playing');b.bonus.collected=125;b.bonus.result=outcome;b.tick(.01);
    assert.equal(b.score-before,outcome==='escaped'?12500:0);
    b.setState('bonus_result');b.stateTime=1;b.continue();
    assert.equal(b.level,46);assert.deepEqual(b.entryCells,remaining);
    assert.deepEqual([...b.player.alive],remaining,'Bonus collection changes score, never campaign cells');
  }
  const final=new Game({gameMode:50});final.ready(49,{survivors:shape});escape(final,shape.slice(10));
  assert.equal(final.state,'time_intro');assert.equal(final.level,50);finishCards(final);
  assert.deepEqual(final.entryCells,shape.slice(10));final.setState('playing');final.win();
  assert.equal(final.state,'ascension','The ending is after clearing level 50');
  assert.equal(final.runSummary.finalCubes,shape.length-10);
});

test('automatic death, console restart and UI retry restore only the level-entry checkpoint; new runs start full',()=>{
  for(const retry of ['death','restart','ui']) {
    const g=new Game({gameMode:50,rng:()=>.5});g.ready(45,{survivors:shape});g.setState('playing');
    g.score=1234;g.player.alive=new Set(shape.slice(8));
    if(retry==='death') {
      g.die();assert.equal(g.reassembly.length,shape.length);
      g.tick(.49);g.tick(3.76);assert.equal(g.state,'reassembly_flash');
    } else if(retry==='restart')g.command('restart');
    else {
      const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
      const start=source.indexOf('  function reset()'),end=source.indexOf('\n  function ',start+3);
      let actions;
      vm.runInNewContext(source.slice(start,end)+'\nreset();',{game:g,modal(_k,_t,_b,a){actions=a;},closeModal(){},syncAudio(){}});
      actions.find(([label])=>label.includes('Retry'))[1]();
    }
    assert.deepEqual([...g.player.alive],shape);assert.equal(g.score,1234);
    assert.equal(g.player.fragments.length,0);assert.equal(g.legTime,g.difficulty.secondsPerLeg);
    g.command('heal');g.retry();assert.deepEqual([...g.player.alive],shape,'Debug healing does not overwrite the checkpoint');
    g.newRun();assert.equal(g.player.alive.size,125);assert.equal(g.missingEntryCells.length,0);
  }
  const g=new Game({gameMode:50});g.ready(49,{survivors:shape});escape(g,shape.slice(4));
  g.retry();assert.deepEqual(g.entryCells,shape.slice(4),'Retrying during a milestone uses its pending body');
});

test('LOSS controls move the rule and card together, including level zero, while debug jumps show all applicable cards',()=>{
  const g=new Game({gameMode:50});assert.equal(g.command('status loss'),'Status for loss is: Enabled');
  g.command('set loss_min_level 0');g.newRun();g.tick(9.21);assert.equal(g.state,'loss_intro');
  assert.equal(introductionCard(g.state,g.level,g.flags,g.changeSettings,g.lossMinLevel).title,'LOSS ...');
  assert.equal(g.lossActive,true);finishCards(g);escape(g,shape);assert.deepEqual(g.entryCells,shape);
  g.command('set loss off');escape(g,shape.slice(3));finishCards(g);assert.equal(g.player.alive.size,125);
  for(const value of ['-1','51','1.2','NaN','true'])assert.throws(()=>g.command(`set loss_min_level ${value}`));
  g.command('loss on');g.command('loss_min_level 5');g.command('level 5');
  assert.equal(g.state,'time_intro');g.tick(5.01);assert.equal(g.state,'loss_intro');g.tick(5.01);
  assert.equal(g.state,'level_ready');assert.equal(g.entryCells.length,125);
  g.command('loss_min_level 44');
  for(const level of [3,4,5,6,7,8,10,15,20,35,44,50])for(const prefix of ['level','set level']) {
    g.command(`${prefix} ${level}`);
    assert.equal(g.state,introductionsForLevel(level)[0]);const before=g.stateTime;
    g.paused=true;g.tick(6);assert.equal(g.stateTime,before);g.paused=false;
    finishCards(g);assert.equal(g.player.alive.size,125);
  }
});

test('absent forms tremble, scatter with one lament, and never enter recovery or the physical body',()=>{
  const g=new Game({gameMode:50,rng:()=>.5});g.ready(45,{survivors:shape});g.tick(1.66);
  assert.equal(g.state,'loss_assembly');assert.equal(g.reassembly.length,shape.length);
  const checkpoint=[...g.player.alive],absent=g.missingEntryCells[0],p=cells[absent];
  const fixed=lossGhostPose(p,absent,2.3,false),shaking=lossGhostPose(p,absent,2.3,true);
  assert.deepEqual(fixed.position,p);assert.notDeepEqual(shaking.position,p);
  assert.ok(Math.hypot(...lossGhostPose(p,absent,3.2).position)>Math.hypot(...p)+4);
  g.tick(2.3);assert.equal(draw(g,true).length,125);assert.equal(g.player.fragments.length,0);
  const frozen=draw(g,true);g.paused=true;g.tick(10);assert.deepEqual(draw(g,true),frozen);g.paused=false;
  g.tick(.16);g.tick(.1);assert.equal(g.events.filter(e=>e.name==='loss_weep').length,1);
  const sounds=[],audio=Object.create(GameAudio.prototype);audio.ready=false;audio.sound=(...args)=>sounds.push(args);audio.stopAll=()=>{};
  audio.update(g);assert.equal(sounds.filter(s=>s[0]==='loss_weep').length,1);audio.update(g);
  assert.equal(sounds.filter(s=>s[0]==='loss_weep').length,1);
  g.stateTime=3.74;assert.equal(draw(g,true).length,shape.length);
  g.tick(.02);assert.equal(g.state,'course_materialize');assert.deepEqual([...g.player.alive],checkpoint);
  assert.equal(g.player.fragments.length,0);assert.equal(g.recoupling.length,0);assert.equal(g.legTime,g.difficulty.secondsPerLeg);
});

test('body colour starts subtly at 44, accelerates to neutral grey at 50, and leaves heat signals and physics intact',()=>{
  assert.equal(lossGreyAmount(43),0);assert.ok(lossGreyAmount(44)>0&&lossGreyAmount(44)<.04);
  let previous=lossGreyAmount(44),increment=0;
  for(let level=45;level<=50;level++) {const amount=lossGreyAmount(level);assert.ok(amount-previous>increment);increment=amount-previous;previous=amount;}
  assert.equal(previous,1);assert.equal(lossGreyAmount(500),1);assert.equal(lossGreyAmount(5,5),.025);
  const g=new Game({gameMode:50});g.ready(50);g.setState('playing');
  const physical=[...g.player.alive].map(i=>g.player.pos(i).array());
  for(const cube of draw(g))assert.ok(Math.abs(cube.color[0]-cube.color[1])<1e-12&&Math.abs(cube.color[1]-cube.color[2])<1e-12);
  assert.deepEqual(draw(g).map(c=>c.pos),physical);
  g.command('loss_grey false');assert.deepEqual(draw(g)[0].color,cellColor(0));
  g.command('loss_grey true');g.heat=1;g.t=.123;
  assert.ok(draw(g)[0].color[0]>draw(g)[0].color[2],'Heat stays red over the grey body');
  const r=Object.create(Renderer.prototype);g.heat=0;g.ready(45,{survivors:shape});g.makeReassembly();g.setState('reassembly');g.stateTime=3.74;
  draw(g,true)[0].color.forEach((v,i)=>assert.ok(Math.abs(v-r.lossColor(g,cellColor(shape[0]))[i])<1e-12));
});

test('LOSS and outline switches save through the real console; status does not write and previews run unpaused',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game({gameMode:50}),nodes={'console-form':{},'console-input':{}},writes=[];let closed=0;
  const ctx={$:id=>nodes[id],game,history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},focusGame(){},closeConsole(){closed++;},audio:{muted:true},write(k,v){writes.push([k,v]);}};
  vm.runInNewContext(source.slice(start,end),ctx);
  const submit=value=>{nodes['console-input'].value=value;nodes['console-form'].onsubmit({preventDefault(){}});};
  for(const key of ['loss','loss_grey','route_outline']) {submit(`set ${key} false`);assert.deepEqual(writes.at(-1),[`cube-libre-${key.replaceAll('_','-')}-v1`,false]);}
  const before=writes.length;for(const alias of ['status','view','set'])for(const key of ['loss','loss_grey','route_outline'])submit(`${alias} ${key}`);
  assert.equal(writes.length,before);submit('test loss');assert.equal(closed,1);assert.equal(game.paused,false);assert.equal(game.state,'loss_intro');
  finishCards(game);assert.ok(game.entryCells.length<125);game.tick(1.66);assert.equal(game.state,'loss_assembly');
  submit('thank_you_note');assert.equal(closed,2);assert.equal(game.state,'thank_you_note');assert.equal(game.paused,false);
});
