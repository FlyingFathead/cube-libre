import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CheckpointStore} from '../../web/js/save-game.mjs';
import {Game,V} from '../../web/js/core.mjs';
import {CHANGE_NUMBERS} from '../../web/js/changes.mjs';

test('top-level reset persists through the browser adapter and preserves all other records, preferences and active play',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  const read=(key,fallback)'),end=source.indexOf('  game.flags.shake=',start);
  const storage=new Map([['cube-libre-scores-v1',JSON.stringify({highest_level:50,best_escape:117,best_score:23000})],['cube-libre-star-pattern-v1','1']]);
  const writes=[];
  const load=()=>{
    const context=vm.createContext({Game,CheckpointStore,clamp:(n,min,max)=>Math.min(max,Math.max(min,n)),localStorage:{
      getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes.push(key);storage.set(key,value);}
    }});
    vm.runInContext(source.slice(start,end),context);const g=vm.runInContext('game',context);g.command('game_mode 50');return g;
  };
  const g=load();g.ready(20);g.setState('playing');g.paused=true;g.score=700;g.flags.spin=false;g.shutters.tick(1.1);
  const course=g.course,player=g.player,flags={...g.flags},clock=g.legTime;
  for(const command of ['reset top level','  RESET   TOP_LEVEL  ','reset highest_level','reset toplevel','toplevel reset','  TOP_LEVEL   RESET  ']) {
    g.stats.highest_level=50;const count=writes.length;
    for(const query of ['toplevel',' TOP_LEVEL '])assert.equal(g.command(query),'TOP LEVEL: 50/50');
    for(const alias of ['get','view','status','set','flag'])for(const name of ['toplevel','top_level'])
      assert.equal(g.command(`${alias} ${name}`),'Status for top_level is: 50');
    assert.ok(g.command('viewconfig').includes('top_level | 50 | Saved top level |'));
    assert.equal(writes.length,count);assert.equal(g.stats.highest_level,50);
    assert.equal(g.command(command),'Top level reset to 1/50. Best score and best escape kept.');
    assert.equal(writes.length,count+1);assert.equal(writes.at(-1),'cube-libre-mode-scores-v1');
    assert.deepEqual(JSON.parse(storage.get('cube-libre-mode-scores-v1'))[50],{highest_level:1,best_escape:117,best_score:23000});
    const reloaded=load();assert.equal(reloaded.stats.highest_level,1);assert.equal(reloaded.stats.best_score,23000);assert.equal(reloaded.stats.best_escape,117);
    assert.equal(reloaded.command('toplevel'),'TOP LEVEL: 1/50');
    assert.equal(g.course,course);assert.equal(g.player,player);assert.equal(g.state,'playing');assert.equal(g.paused,true);
    assert.equal(g.level,20);assert.equal(g.score,700);assert.equal(g.legTime,clock);assert.equal(g.shutters.time,1.1);assert.deepEqual(g.flags,flags);
    assert.equal(storage.get('cube-libre-star-pattern-v1'),'1');
  }
  const before=JSON.stringify([...storage]),count=writes.length;
  for(const command of ['reset','reset all','reset score','reset top level extra','reset top_level extra'])assert.throws(()=>g.command(command),/Usage: reset top level/);
  for(const name of ['toplevel','top_level']) {
    for(const suffix of ['all','50','reset extra'])assert.throws(()=>g.command(`${name} ${suffix}`),/Usage:/);
    assert.throws(()=>g.command(`toggle ${name}`),/cannot be toggled/);
    assert.throws(()=>g.command(`set ${name} true`),/cannot be toggled/);
  }
  assert.throws(()=>g.command('toggle reset'),/cannot be toggled/);
  assert.equal(JSON.stringify([...storage]),before);assert.equal(writes.length,count);
  assert.ok(g.command('help').includes('reset top level'));
  const fresh=load();fresh.newRun();assert.equal(fresh.stats.highest_level,1);
  fresh.ready(7);assert.equal(JSON.parse(storage.get('cube-libre-mode-scores-v1'))[50].highest_level,7);
});

test('all config listing aliases report live values from every registered setting without side effects',()=>{
  const g=new Game({gameMode:50});g.ready(7);g.player.setSpinAngles(5,10,15);g.shutters.tick(.75);
  let muted=false;g.consoleSettings.mute={get:()=>muted,set:v=>{muted=v;}};
  g.consoleSettings.future_setting={name:'Future setting',description:'Registered without editing the listing.',get:()=>true,set:()=>assert.fail('Listing must not call a setter')};
  g.flags.future_flag=true;
  const aliases=['viewconfig','showconfig','showvars','viewvars','listvars','listconfig'];
  const snapshot=()=>JSON.stringify({flags:g.flags,pose:g.player.spinAngles,time:g.shutters.time,state:g.state,score:g.score,level:g.level,muted});
  const before=snapshot(),course=g.course,output=g.command(aliases[0]);
  for(const alias of aliases)assert.equal(g.command(`  ${alias.toUpperCase()}  `),output);
  assert.equal(snapshot(),before);assert.equal(g.course,course);
  const rows=output.split('\n').filter(line=>/^[a-z_0-9]+ \|/.test(line));
  const names=rows.map(line=>line.split(' | ')[0]);
  const expected=[...Object.keys(g.flags),'locate',...Object.keys(g.consoleSettings),'level','score','cubes','top_level',...Object.keys(CHANGE_NUMBERS),...Object.keys(g.previewSettings),...Object.keys(g.routeOutlineSettings),...Object.keys(g.mercySettings),'loss_min_level','loss_grey_min_level','game_mode','star_pattern','auto_locate_min_level','panic_outside_seconds','panic_cooldown_seconds','panic_score_penalty_percent'];
  assert.deepEqual(new Set(names),new Set(expected));assert.equal(names.length,expected.length);
  for(const row of rows)assert.equal(row.split(' | ').length,4);
  assert.match(output,/star_pattern \| 2 \| Background star pattern \| 0: no background stars; 1: original/);
  assert.match(output,/change_1_min_level \| 4 \|/);
  assert.match(output,/future_setting \| true \| Future setting \| Registered without editing the listing\./);
  assert.match(output,/future_flag \| true \| Future flag \| Enable or disable future flag\./);
  g.command('star_pattern 0');g.command('set change_1_interval 6');g.command('toggle mute');
  g.command('score 432');g.command('cubes 64');
  const changed=g.command('showvars');
  for(const row of ['star_pattern | 0 |','change_1_interval | 6 |','mute | true |','score | 432 |','cubes | 64 |'])assert.ok(changed.includes(row),row);
  for(const alias of aliases) {
    assert.throws(()=>g.command(`${alias} extra`),/Usage:/);
    assert.throws(()=>g.command(`toggle ${alias}`),/cannot be toggled/);
  }
});

test('console keeps an entire long config response and Page Up/Down scroll the output',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const elements={'console-log':{textContent:'',scrollTop:0,scrollHeight:10000},'console-input':{addEventListener:(name,callback)=>{elements.keydown=callback;}}};
  const context=vm.createContext({$:id=>elements[id],log:[],history:[],historyIndex:0,clamp:(n,min,max)=>Math.min(max,Math.max(min,n))});
  const start=source.indexOf('  function consoleLog('),end=source.indexOf('  function openConsole(',start);
  vm.runInContext(source.slice(start,end),context);
  vm.runInContext('consoleLog("old history"); consoleLog(Array.from({length:300},(_,i)=>"parameter_"+i).join("\\n"));',context);
  assert.equal(elements['console-log'].textContent.split('\n').length,300);
  assert.ok(elements['console-log'].textContent.startsWith('parameter_0\n'));
  assert.ok(elements['console-log'].textContent.endsWith('parameter_299'));
  const keys=source.indexOf("  $('console-input').addEventListener('keydown'"),keysEnd=source.indexOf("  $('console-close').onclick",keys);
  vm.runInContext(source.slice(keys,keysEnd),context);
  let prevented=0;const output=elements['console-log'];
  elements.keydown({code:'PageUp',preventDefault(){prevented++;}});assert.equal(output.scrollTop,9800);
  elements.keydown({code:'PageDown',preventDefault(){prevented++;}});assert.equal(output.scrollTop,10000);assert.equal(prevented,2);
});

test('every boolean shares toggle, explicit values, and non-mutating status aliases',()=>{
  const g=new Game({gameMode:50});let muted=false;
  g.consoleSettings.mute={get:()=>muted,set:value=>{muted=value;}};
  const settings=[...Object.keys(g.flags),'locate','mute'];
  const read=key=>key==='mute'?muted:key==='locate'?g.locate:g.flags[key];
  for(const key of settings) {
    for(const [yes,no] of [['true','false'],['on','off'],['1','0'],['enabled','disabled'],['yes','no']]) {
      assert.equal(g.command(`set ${key} ${yes}`),`${key} set to true`);
      assert.equal(read(key),true);
      for(const alias of ['status','view','set','get','flag']) {
        assert.equal(g.command(`${alias} ${key}`),`Status for ${key} is: Enabled`);
        assert.equal(read(key),true);
      }
      assert.equal(g.command(`set ${key} ${no}`),`${key} set to false`);
      assert.equal(g.command(`status ${key}`),`Status for ${key} is: Disabled`);
      assert.equal(read(key),false);
      assert.equal(g.command(`toggle ${key}`),`${key} set to true`);
      assert.equal(g.command(`toggle ${key}`),`${key} set to false`);
      assert.equal(read(key),false);
    }
    assert.ok(g.command('flags').includes(`Status for ${key} is: Disabled`));
  }
  assert.equal(g.command('  SeT   ShAkE   EnAbLeD  '),'shake set to true');
  for(const alias of ['flag shake disabled','shake on','shake 0'])g.command(alias);
  assert.equal(g.flags.shake,false);
});

test('unknown settings, non-booleans and malformed values fail without changing the game',()=>{
  const g=new Game({gameMode:50}),flags={...g.flags};
  for(const name of ['missing','__proto__','constructor','tostring'])for(const cmd of ['status','view','get','set','toggle']) {
    assert.throws(()=>g.command(`${cmd} ${name}`),{message:`${name} not found!`});
    assert.throws(()=>g.command(`set ${name} on`),{message:`${name} not found!`});
  }
  for(const key of ['level','score','cubes','restart','kill','route']) {
    assert.throws(()=>g.command(`toggle ${key}`),{message:`${key} cannot be toggled with on/off!`});
    assert.throws(()=>g.command(`set ${key} enabled`),{message:`${key} cannot be toggled with on/off!`});
  }
  for(const value of ['maybe','2','-1','null'])assert.throws(()=>g.command(`set shake ${value}`),/Expected true\/false/);
  for(const cmd of ['set','view','status','toggle','get','toggle shake off','set shake on extra'])assert.throws(()=>g.command(cmd),/Usage:/);
  assert.deepEqual(g.flags,flags);assert.equal(g.player.alive.size,125);assert.equal(g.level,1);
  for(const key of ['level','score','cubes'])for(const cmd of ['set','view','status'])assert.equal(g.command(`${cmd} ${key}`),`Status for ${key} is: ${key==='cubes'?125:key==='score'?0:1}`);
});

test('queries preserve poses and route state, while setters apply the required side effects',()=>{
  const g=new Game({gameMode:50});g.ready(10);g.player.setSpinAngles(20,30,40);
  g.kickRotation(g.player.origin.add(new V(2,2,2)));g.updateRotationShock(.1);
  const course=g.course,version=g.geometryVersion,pose=g.player.pos(124).array(),angle=g.rotationShock.angle.array();
  for(const key of ['spin','rotation_shocks','route3d','portal'])for(const alias of ['set','view','status'])g.command(`${alias} ${key}`);
  assert.equal(g.course,course);assert.equal(g.geometryVersion,version);
  assert.deepEqual(g.player.pos(124).array(),pose);assert.deepEqual(g.rotationShock.angle.array(),angle);
  g.command('toggle spin');assert.deepEqual(g.player.spinAngles,[0,0,0]);
  g.command('toggle rotation_shocks');assert.equal(g.rotationShock.angle.length(),0);assert.equal(g.rotationShock.velocity.length(),0);
  g.command('toggle route3d');assert.ok(g.course.modules.every(m=>m.bx.y===0));assert.equal(g.geometryVersion,version+1);
  g.command('portal');assert.equal(g.course.portal.local(g.player.origin).x,15);
  g.command('set portal off');assert.equal(g.flags.portal,false);
  g.command('set level 20');assert.equal(g.level,20);assert.equal(g.flags.rotation_shocks,false);
});

test('browser console aliases save visual and movement preferences and status queries do not write',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf("$('console-form').onsubmit="),end=source.indexOf("  $('console-input').addEventListener",start);
  const game=new Game({gameMode:50}),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[],messages=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog:line=>messages.push(line),syncAudio(){},write:(...entry)=>saved.push(entry)});
  const submit=value=>{elements['console-input'].value=value;elements['console-form'].onsubmit({preventDefault(){}});};
  for(const [key,storage] of [['shake','shake'],['spin','spin'],['rotation_shocks','rotation-shocks'],['portal_white_light','portal-white-light'],['culling','culling'],['preview_outline','preview-outline'],['microgravity','microgravity'],['overheat_blocks_recoupling','overheat-blocks-recoupling'],['change_1','change-1'],['change_1_random_per_leg','change-1-random-per-leg'],['change_1_no_repeat_leg','change-1-no-repeat-leg']]) {
    submit(`toggle ${key}`);assert.deepEqual(saved.at(-1),[`cube-libre-${storage}-v1`,false]);
    assert.equal(messages.at(-1),`${key} set to false`);
    const writes=saved.length;for(const alias of ['set','view','status'])submit(`${alias} ${key}`);
    assert.equal(saved.length,writes);assert.equal(messages.at(-1),`Status for ${key} is: Disabled`);
    const load=source.split('\n').find(line=>line.includes(`game.flags.${key}=read(`)),fresh=new Game({gameMode:50});
    vm.runInNewContext(load,{game:fresh,read:name=>saved.findLast(([key])=>key===name)?.[1]});
    assert.equal(fresh.flags[key],false);
    submit(`set ${key} enabled`);assert.deepEqual(saved.at(-1),[`cube-libre-${storage}-v1`,true]);
  }
  submit('toggle unknown');assert.equal(messages.at(-1),'ERROR: unknown not found!');
});

test('audio mute uses the shared boolean interface and remains compatible with its button',async()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const game=new Game({gameMode:50}),writes=[],audio={muted:false,failed:[],mute(value=!this.muted){this.muted=value;},async unlock(){}};
  const context=vm.createContext({game,audio,write:(...entry)=>writes.push(entry),syncAudio(){},audioWarning:''});
  const start=source.indexOf('  async function mute('),end=source.indexOf('  async function fullscreen(',start);
  vm.runInContext(source.slice(start,end),context);
  vm.runInContext(source.split('\n').find(line=>line.includes('game.consoleSettings.mute=')),context);
  assert.equal(game.command('toggle mute'),'mute set to true');assert.equal(audio.muted,true);
  assert.equal(game.command('status mute'),'Status for mute is: Enabled');
  assert.equal(game.command('set mute disabled'),'mute set to false');await Promise.resolve();assert.equal(audio.muted,false);
  assert.deepEqual(writes.at(-1),['cube-libre-muted-v1',false]);
  await vm.runInContext('mute({type:"click"})',context);assert.equal(audio.muted,true);
});
