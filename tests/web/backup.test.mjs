import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,V,cells,clamp,smooth} from '../../web/js/core.mjs';
import {BackupProtection,backupStatus,perfectBonusGather,BACKUP_AWARD_SECONDS} from '../../web/js/backup.mjs';
import {scheduledBonus,PickingUpThePieces} from '../../web/js/bonus.mjs';
import {CheckpointStore,validateCheckpoint,RESUME_TIMING} from '../../web/js/save-game.mjs';
import {Renderer} from '../../web/js/render.mjs';
import {GameAudio} from '../../web/js/audio.mjs';
import {GamepadInput,emptyMovement} from '../../web/js/gamepad.mjs';
import * as T from '../../web/vendor/three.module.min.js';

function setup(mode=20,level=10,survivors=null) {
  const writes=[],store=new CheckpointStore(()=>({getItem:()=>null,setItem:(k,v)=>writes.push(JSON.parse(v)),removeItem(){}}));
  const g=new Game({gameMode:mode,rng:()=>.5,saveCheckpoint:c=>store.save(c)});
  g.newRun();g.flags.backup_flawless_levels=false;g.ready(level,{survivors});g.setState('playing');g.flags.suction=false;
  return {g,store,writes};
}
function offer(g,leg=0) {
  g.player.origin=g.course.modules[leg].world(0);g.trackPanicLeg();
  g.player.alive.clear();g.die();g.tick(.76);assert.equal(g.state,'reassembly');
}
function complete(g,{count=124,result='escaped',preview=false}={}) {
  g.startBonus('001',{preview});g.setState('bonus_playing');
  g.bonus.pieces.forEach((p,i)=>p.collected=i<count);g.bonus.collected=count;g.bonus.result=result;
  g.tick(.01);
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('collecting 100% in a bonus earns one saved Backup Cube even on timeout; partial gathers and previews earn none',()=>{
  for(const mode of [20,50])for(const count of [123,124])for(const result of ['escaped','timeout'])for(const preview of [false,true]) {
    const {g,store}=setup(mode,5);g.win();g.bonusesPlayedAfter.add(5);const before=store.value;
    complete(g,{count,result,preview});
    const earned=count===124&&!preview?1:0;
    assert.equal(g.backupCubes,earned);assert.equal(Boolean(g.bonus.backupAwarded),!!earned);
    assert.equal(g.runStats.backupCubesGained,earned);assert.equal(g.runStats.backupCubesUsed,0);
    assert.equal(store.value.backupCubes,earned);
    if(preview)assert.deepEqual(store.value,before);
    g.tick(2.1);assert.equal(g.state,earned?'backup_award':'bonus_result');
    if(earned){g.tick(BACKUP_AWARD_SECONDS);assert.equal(g.state,'bonus_result');}
    g.tick(10);assert.equal(g.backupCubes,earned,'Repeated result frames cannot award again');assert.equal(g.runStats.backupCubesGained,earned);
  }
  const {g}=setup();g.command('backup_cubes_enabled false');complete(g);assert.equal(g.backupCubes,0);
  const b=new PickingUpThePieces();b.collected=124;b.result='escaped';assert.equal(perfectBonusGather(b),false,'A counter alone cannot claim uncollected pieces');
});

test('three perfect regular bonuses stack; the optional final bonus has no duplicate schedule or reload skip',()=>{
  const {g,store}=setup();
  for(const level of [5,10,15]) {g.ready(level);g.setState('playing');g.win();g.bonusesPlayedAfter.add(level);complete(g);}
  assert.equal(g.backupCubes,3);assert.equal(store.value.backupCubes,3);
  assert.deepEqual(Array.from({length:20},(_,i)=>i+1).filter(i=>g.scheduledBonus(i)),[5,10,15]);
  g.command('bonus_before_final true');assert.equal(g.scheduledBonus(19),'001');assert.equal(g.scheduledBonus(20),null);
  assert.equal(scheduledBonus(49,50,undefined,true),'001');assert.equal(scheduledBonus(50,50,undefined,true),null);
  g.ready(19);g.setState('playing');g.win();assert.equal(store.value.stage,'bonus');
  const r=setup().g;r.resumeCheckpoint(store.value);r.tick(RESUME_TIMING.seconds);assert.equal(r.state,'bonus_intro');
  assert.equal(r.backupCubes,3);assert.equal(r.flags.bonus_before_final,false);
  complete(r);assert.equal(r.backupCubes,4);assert.ok(r.bonusesPlayedAfter.has(19));
  g.newRun();assert.equal(g.backupCubes,0);assert.equal(store.value.backupCubes,0);
});

test('all 124 bonus pieces can be gathered through real rolling controls before the existing deadline',()=>{
  const {g,store}=setup(20,5);g.win();g.bonusesPlayedAfter.add(5);
  let seed=3;g.rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  g.startBonus('001');g.setState('bonus_playing');const b=g.bonus;
  for(let frame=0;frame<45*120&&!b.result&&b.collected<124;frame++) {
    const target=b.pieces.filter(p=>!p.collected).sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];
    const dx=target.x-b.x,dz=target.z-b.z;
    g.tick(1/120,Math.abs(dx)>Math.abs(dz)?{x:Math.sign(dx),rush:true}:{z:Math.sign(dz),rush:true});
  }
  assert.equal(b.collected,124);assert.ok(b.timeLeft>10);assert.equal(g.backupCubes,0,'Settle the reward when the round ends');
  const score=g.score;g.tick(b.timeLeft+.01);assert.equal(b.result,'timeout');
  assert.equal(g.backupCubes,1);assert.equal(store.value.backupCubes,1);assert.equal(g.score,score,'Only escaping banks bonus points');
});

test('one charge restores all 125 cells at every reached corner in both campaigns, including LOSS, with old corridors sealed',()=>{
  for(const mode of [20,50]) {
    const {g,store}=setup(mode,mode,[0,13,62]);
    for(const module of g.course.modules) {
      const leg=module.index;g.resetAttempt();g.setState('playing');g.backupCubes=2;offer(g,leg);
      const score=g.score;assert.equal(backupStatus(g).enabled,true);assert.equal(g.requestBackupCube(),true);
      assert.equal(g.backupCubes,1);assert.equal(g.player.alive.size,125);assert.equal(g.entryCells.length,125);
      assert.equal(g.missingEntryCells.length,0);assert.equal(g.recoupling.length,0);assert.equal(g.player.fragments.length,0);
      assert.equal(g.state,'playing');assert.equal(g.panicLeg,leg);assert.equal(g.timedModule,leg);assert.equal(g.score,score);
      assert.equal(g.course.collapsed.size,leg);assert.equal(g.course.collapsedSectionAt(g.player.origin),-1);
      if(leg)assert.deepEqual(g.player.origin.array(),g.course.modules[leg].start.array());
      near(g.legTime,g.difficulty.secondsPerLeg);assert.equal(g.backupActive,true);
      assert.equal(store.value.backupCubes,1);assert.equal(store.value.backupResumeLeg,leg);assert.equal(store.value.cells.length,125);
      assert.equal(g.requestBackupCube(),false);assert.equal(g.backupCubes,1);
      assert.equal(g.runStats.backupCubesUsed,leg+1,'Only accepted uses count, across repeated attempts');
      g.tick(1/60);assert.equal(g.state,'playing');assert.equal(g.player.alive.size,125);
      if(leg){assert.ok(g.course.collapsedSectionAt(g.course.modules[leg-1].world(0))>=0);g.player.origin=g.course.modules[leg].world(-9);g.trackPanicLeg();assert.equal(g.course.rescueJoint,-1);}
    }
  }
});

test('the reassembly offer is absent without reserve and cannot spend during pause, Help, setup, results or after its deadline',()=>{
  const {g}=setup();offer(g);assert.equal(backupStatus(g).visible,false);assert.equal(g.requestBackupCube(),false);
  g.backupCubes=1;
  for(const field of ['paused','help']){g[field]=true;const t=g.stateTime;g.tick(10);assert.equal(g.stateTime,t);assert.equal(g.requestBackupCube(),false);g[field]=false;}
  g.command('backup_cubes_enabled false');assert.equal(backupStatus(g).visible,false);assert.equal(g.backupCubes,1);g.command('backup_cubes_enabled true');
  g.tick(3.75);assert.equal(g.state,'reassembly_flash');assert.equal(g.requestBackupCube(),false);assert.equal(g.backupCubes,1);
  for(const state of ['title','playing','course_materialize','level_ready','loss_assembly','bonus_result','backup_award','death_dissolve']){g.setState(state);assert.equal(backupStatus(g).visible,false);assert.equal(g.requestBackupCube(),false);}
});

test('Backup protection lasts four seconds, freezes in Help and Panic, fades visibly and expires without a damage backlog',()=>{
  for(const fps of [30,60,120]) {
    const {g}=setup(20,10);g.backupCubes=1;offer(g,4);g.requestBackupCube();
    for(const field of ['paused','help']){g[field]=true;g.tick(8);near(g.backupProtection.remaining,4);g[field]=false;}
    const remaining=g.backupProtection.remaining;g.requestPanic();g.tick(.5);near(g.backupProtection.remaining,remaining);
    g.panic=null;g.player.origin=g.course.modules[4].world(0,12,0);g.flags.mercy_mode=false;
    for(let i=0;i<fps*3.8;i++)g.tick(1/fps);
    assert.equal(g.player.alive.size,125);assert.ok(g.backupProtection.glow<1);assert.ok(g.backupProtection.glow>0);
    for(let i=0;i<fps*.4;i++)g.tick(1/fps);
    assert.ok(g.player.alive.size<125);assert.equal(g.backupProtection.glow,0);assert.equal(g.backupActive,false);
  }
  const {g}=setup();g.backupCubes=1;offer(g,3);g.requestBackupCube();g.flags.mercy_mode=false;
  g.player.origin=g.course.modules[3].world(0,12);assert.equal(g.damage(),null);
  g.backupProtection.tick(4);g.player.origin=g.course.modules[3].world(-12);g.tick(.01);assert.equal(g.player.alive.size,125,'Escaping before expiry does not schedule a later hit');
});

test('Backup protection includes live lasers, shutters and sealed contact; the leg deadline still applies',()=>{
  const {g}=setup(20,10);g.backupCubes=1;offer(g,4);g.requestBackupCube();g.flags.mercy_mode=false;
  const laser=g.course.moduleLasers[4][0];g.player.origin=laser.center;
  g.course.activeLasers=()=>[laser];laser.hits=()=>true;laser.touchesShutter=()=>true;
  assert.equal(g.damage(),null);g.shutterState=()=>({closed:true,cycle:1});g.shutters.schedule=()=>[];
  g.updateShutters(.01);assert.equal(g.player.alive.size,125);assert.equal(g.shutters.contacts.get(laser),1);
  g.backupProtection.tick(4);g.updateShutters(.01);assert.equal(g.player.alive.size,125,'Protected shutter contact has no delayed bite');
  g.backupProtection.start(4);g.player.origin=g.course.modules[0].world(0);g.tick(.01);assert.equal(g.state,'playing');
  g.backupProtection.start(0);g.tick(.01);assert.equal(g.state,'death_dissolve');assert.ok(g.sealedZap);
  g.tick(.76);g.backupCubes=1;g.requestBackupCube();g.legTime=.001;g.tick(.01);assert.equal(g.state,'death_dissolve');assert.equal(g.sealedZap,null);
});

test('saved reserves, gained/used totals and spent checkpoints migrate safely; reload cannot refund or refill protection',()=>{
  const {g,store}=setup(20,17,[0,13,62]);g.backupCubes=2;g.runStats.backupCubesGained=2;offer(g,10);g.requestBackupCube();
  const spent=structuredClone(store.value);assert.equal(spent.schema,3);
  const r=setup().g;r.resumeCheckpoint(spent);r.tick(RESUME_TIMING.seconds);
  assert.equal(r.state,'playing');assert.equal(r.backupCubes,1);assert.equal(r.panicLeg,10);assert.equal(r.player.alive.size,125);assert.equal(r.backupActive,false);
  assert.equal(r.runStats.backupCubesGained,2);assert.equal(r.runStats.backupCubesUsed,1);
  assert.equal(r.course.collapsedSectionAt(r.player.origin),-1);assert.equal(r.course.collapsed.size,10);
  r.player.alive.clear();r.die();r.tick(.76);r.tick(3.75);r.tick(1.11);
  assert.equal(r.panicLeg,0);assert.equal(r.backupCubes,1);assert.equal(r.backupResumeLeg,null);
  for(const schema of [1,2]) {
    const old={...spent,schema,backupCubes:undefined,backupResumeLeg:undefined};if(schema===1)old.gameMode=undefined;
    const migrated=validateCheckpoint(old);assert.equal(migrated.schema,3);assert.equal(migrated.backupCubes,0);assert.equal(migrated.backupResumeLeg,null);
    assert.equal(migrated.runStats.backupCubesGained,0);assert.equal(migrated.runStats.backupCubesUsed,0);
  }
  assert.equal(validateCheckpoint({...spent,backupCubes:60}).backupCubes,60,'The original campaign can earn more than fifty reserves');
  for(const patch of [{backupCubes:-1},{backupCubes:1.5},{backupCubes:NaN},{backupCubes:101},{backupResumeLeg:17},{backupResumeLeg:1.5},{cells:[62]}])assert.equal(validateCheckpoint({...spent,...patch}),null);
  for(const key of ['backupCubesGained','backupCubesUsed'])for(const value of [-1,1.5,undefined])assert.equal(validateCheckpoint({...spent,runStats:{...spent.runStats,[key]:value}}),null);
  r.beginAscension();r.setState('run_summary');const rows=[];
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8'),a=source.indexOf("    if(s==='run_summary'&&"),b=source.indexOf('    if(opening)',a);
  vm.runInNewContext(source.slice(a,b),{game:r,s:'run_summary',lastSummary:null,document:{createElement:tag=>({tag})},$:()=>({replaceChildren:(...items)=>rows.push(...items)})});
  const values=Object.fromEntries(rows.filter(x=>x.tag==='dt').map((x,i)=>[x.textContent,rows[i*2+1].textContent]));
  assert.equal(values['BACKUP CUBES GAINED'],'2');assert.equal(values['BACKUP CUBES USED'],'1');assert.equal(values['BACKUP CUBES REMAINING'],'1');
});

test('console preview plays the complete reward animation and one choir cue without spending, earning or changing the save',()=>{
  const {g,store,writes}=setup();g.backupCubes=2;g.checkpoint();const saved=structuredClone(store.value),stats={...g.runStats},n=writes.length;
  assert.match(g.command('test backup_cube_anim'),/preview/);assert.equal(g.state,'backup_award');assert.equal(g.backupCubes,2);
  assert.equal(g.events.filter(e=>e.name==='backup_choir').length,1);g.continue();assert.equal(g.state,'backup_award');
  g.paused=true;g.tick(10);assert.equal(g.stateTime,0);g.paused=false;g.tick(BACKUP_AWARD_SECONDS);
  assert.equal(g.state,'bonus_result');g.tick(.5);g.continue();assert.equal(g.level,10);
  assert.deepEqual(store.value,saved);assert.equal(writes.length,n);assert.deepEqual(g.runStats,stats);assert.equal(g.backupCubes,2);
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const a=source.indexOf("  $('console-form').onsubmit="),b=source.indexOf("  $('console-input').addEventListener",a),nodes={'console-form':{},'console-input':{value:'test backup_cube_anim'}};
  const ctx={game:g,$:id=>nodes[id],history:[],historyIndex:0,log:[],consoleLog(){},syncAudio(){},write(){},closeConsole(){g.paused=false;},focusGame(){},audio:{unlock:async()=>{}},audioWarning:''};
  g.paused=true;vm.runInNewContext(source.slice(a,b),ctx);nodes['console-form'].onsubmit({preventDefault(){}});
  assert.equal(g.paused,false);assert.equal(g.state,'backup_award');assert.deepEqual(store.value,saved);
});

test('backup tuning and boolean aliases are validated and status queries cannot spend or extend protection',()=>{
  const {g}=setup();assert.equal(g.flags.backup_cubes_enabled,true);g.backupCubes=1;
  g.command('backup_invincibility_seconds 5');offer(g);g.requestBackupCube();near(g.backupProtection.remaining,5);
  const before=JSON.stringify({count:g.backupCubes,protection:g.backupProtection,body:[...g.player.alive]});
  for(const cmd of ['status backup_cubes','get backup_cubes_enabled','view backup_invincibility_seconds','viewconfig'])assert.ok(g.command(cmd));
  assert.equal(JSON.stringify({count:g.backupCubes,protection:g.backupProtection,body:[...g.player.alive]}),before);
  for(const val of ['-1','31','NaN','wat'])assert.throws(()=>g.command(`backup_invincibility_seconds ${val}`));
  g.command('backup_invincibility_seconds 2');near(g.backupProtection.remaining,5);
  g.command('backup_cubes_enabled off');assert.equal(g.backupActive,true);g.command('backup_cubes_enabled on');near(g.backupProtection.remaining,5);
  assert.throws(()=>g.command('set backup_cubes 10'));assert.equal(g.backupCubes,0);
});

test('the award draws 125 individually outlined white cubes and protected body colours fade back to the regular palette',()=>{
  const {g}=setup();g.command('test backup_cube_anim');
  const r=Object.create(Renderer.prototype);let drawn=[];r.cubes={cube:(...args)=>drawn.push(args)};r.lines={line(){}};
  r.camera=new T.PerspectiveCamera(45,9/16,.1,1500);r.width=390;r.height=844;r.backupAward(g);
  assert.equal(drawn.length,125);assert.ok(drawn.every(([,c,,,,,,outline])=>c.every(x=>x===1)&&outline.length===3));
  assert.equal(new Set(drawn.map(([p])=>p.array().join(','))).size,125);
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390],[568,320]]) {
    r.width=width;r.height=height;r.camera.aspect=width/height;r.camera.updateProjectionMatrix();
    for(let t=0;t<=BACKUP_AWARD_SECONDS;t+=.5) {
      drawn=[];g.stateTime=t;r.backupAward(g);r.camera.updateMatrixWorld(true);
      for(const [p,,scale,,,,,,q] of drawn)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]) {
        const v=new T.Vector3(x*scale,y*scale,z*scale).applyQuaternion(new T.Quaternion(...q)).add(new T.Vector3(...p.array())).project(r.camera);
        const px=(v.x+1)*width/2,py=(1-v.y)*height/2;
        assert.ok(px>8&&px<width-8&&py>8&&py<height*(height<=450?.48:.71),'The whole animated cube fits above its reward text');
      }
    }
  }
  g.ready(10);g.setState('playing');g.backupProtection.start(4);drawn=[];r.player(g);
  assert.equal(drawn.length,125);assert.ok(drawn.every(([,c])=>c.every(x=>x===1)));
  g.backupProtection.tick(4);drawn=[];r.player(g);assert.ok(drawn.some(([,c])=>c.some(x=>x!==1)));
});

test('the choir dispatches once and ends when leaving its scene, without replay after late audio loading',()=>{
  const {g}=setup();g.command('test backup_cube_anim');const calls=[];
  const a=Object.create(GameAudio.prototype);a.ready=false;a.sound=(...args)=>calls.push(args);a.stop=()=>{};a.stopAll=()=>{};
  a.update(g);a.update(g);assert.equal(calls.filter(x=>x[0]==='backup_choir').length,1);
  a.ready=true;a.update(g);assert.equal(calls.filter(x=>x[0]==='backup_choir').length,1);
  a.channels=new Map([['backup_choir',{}]]);
  let stopped=false;a.stop=name=>{if(name==='backup_choir')stopped=true;};g.setState('bonus_result');a.update(g);assert.equal(stopped,true);
});


test('flawless escape rewards default on and use only the 125-piece portal count, once per cleared level',()=>{
  assert.equal(new Game().flags.backup_flawless_levels,true);
  for(const mode of [20,50])for(const kind of ['off','clean','repaired','backup','partial','final']) {
    const {g,store}=setup(mode,kind==='final'?mode:7,kind==='partial'?[0,62]:null);
    if(kind!=='off')g.command('backup_flawless_levels true');
    if(kind==='repaired'){g.player.destroy(1,g.player.origin);g.requestRecouple();g.tickRecouple(2);assert.equal(g.player.alive.size,125);}
    if(kind==='backup'){g.backupCubes=1;offer(g,4);g.requestBackupCube();}
    g.win();const expected=['off','partial'].includes(kind)?0:1;
    assert.equal(g.backupCubes,expected);assert.equal(store.value.backupCubes,expected);
    assert.equal(g.runStats.backupCubesGained,expected);
    if(kind==='clean'){g.tick(3.41);assert.equal(g.state,'result_overlay');assert.equal(g.flawlessBackupAward,true);}
    g.win();assert.equal(g.backupCubes,expected);assert.equal(g.runStats.backupCubesGained,expected);
  }
});

test('actual mouse, touch, keyboard and controller handlers spend once, with a conditional offer and gold reserve HUD',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  assert.match(html,/<button[^>]*id="use-backup"/);
  for(const mobileMode of [false,true])for(const input of ['mouse','touch','Space','Enter','controller']) {
    const {g}=setup();g.backupCubes=2;offer(g,6);
    const nodes=new Map(),events={},document={hidden:false,hasFocus:()=>true,fullscreenElement:null};
    const $=id=>{
      if(!nodes.has(id)) {
        const classes=new Set();nodes.set(id,{hidden:false,open:false,textContent:'',style:{setProperty(){}},
          classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},
          setAttribute(){},click(){this.onclick?.({pointerType:input});}});
      }
      return nodes.get(id);
    };
    const pad={index:0,id:'Xbox',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};
    const controller=new GamepadInput({getGamepads:()=>[pad]});controller.poll(0);
    const ctx={game:g,$,document,controller,emptyMovement,controllerMovement:emptyMovement(),controllerAction:false,
      window:{addEventListener:(key,fn)=>events[key]=fn},keyboard:new Set(),HTMLButtonElement:class {},modalKind:null,
      loadingStart:false,clearInput(){controller.suspend();},focusGame(){},syncAudio(){},navigateControllerMenu(){},
      performance:{now:()=>1000},lastHUD:-1,lastSummary:null,openingLines:[],pendingUpdate:null,mobile:{enabled:mobileMode,sync(){}},
      audio:{muted:false},audioWarning:'',clamp,smooth};
    vm.createContext(ctx);
    const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
    vm.runInContext(cut('  function useBackupCube()',"  $('settings').onclick")+
      cut('  const keyCodes=',"  window.addEventListener('keyup'")+
      cut('  function updateController(','  function input()')+
      cut('  function ui()',"  $('boot').hidden=true"),ctx);
    ctx.ui();assert.equal($('use-backup').hidden,false);assert.equal($('use-backup').disabled,false);
    assert.match($('backup-window').textContent,/LEG 7\/10/);assert.match($('backup-hint').textContent,mobileMode?/TAP HERE/:/PRESS SPACE/);
    assert.equal($('backup-count').textContent,'BACKUP CUBES: 2');assert.equal($('backup-count').classList.contains('has-backup'),true);
    for(const blocked of ['paused','help','hidden','modal','console']) {
      if(['paused','help'].includes(blocked))g[blocked]=true;else if(blocked==='hidden')document.hidden=true;else $(blocked).open=true;
      ctx.ui();assert.equal($('use-backup').hidden,true);$('use-backup').click();assert.equal(g.backupCubes,2);
      g.paused=g.help=document.hidden=false;$('modal').open=$('console').open=false;
    }
    const key=(code,extra={})=>events.keydown({code,target:{},preventDefault(){},...extra});
    for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true}]){key('Space',extra);assert.equal(g.backupCubes,2);}
    if(input==='controller') {
      ctx.updateController(50,.01);pad.buttons[0].value=1;ctx.updateController(100,.01);ctx.updateController(120,.01);
    } else if(['Space','Enter'].includes(input)){key(input);key(input,{repeat:true});key(input);}
    else {$('use-backup').click();$('use-backup').click();}
    assert.equal(g.backupCubes,1,`${input} / mobile=${mobileMode}`);assert.equal(g.state,'playing');assert.equal(g.panicLeg,6);assert.equal(g.player.alive.size,125);
    ctx.ui();assert.equal($('use-backup').hidden,true);
    g.backupCubes=0;offer(g,6);ctx.ui();assert.equal($('use-backup').hidden,true);assert.equal($('backup-count').classList.contains('has-backup'),false);
    g.command('test backup_cube_anim');ctx.ui();assert.equal($('hud').hidden,true);assert.equal($('bottom-ui').hidden,true);assert.equal($('card-title').textContent,'1 BACKUP CUBE ASSEMBLED');
    assert.match($('card-subtitle').textContent,/fully intact/);assert.equal($('next').hidden,true);
    g.tick(1.6);ctx.ui();assert.equal($('next').hidden,false);
  }
});
