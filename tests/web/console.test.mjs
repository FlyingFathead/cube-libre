import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Game,V} from '../../web/js/core.mjs';

test('every boolean shares toggle, explicit values, and non-mutating status aliases',()=>{
  const g=new Game();let muted=false;
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
  const g=new Game(),flags={...g.flags};
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
  const g=new Game();g.ready(10);g.player.setSpinAngles(20,30,40);
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
  const game=new Game(),elements={'console-form':{},'console-input':{},'console-log':{}},saved=[],messages=[];
  vm.runInNewContext(source.slice(start,end),{$:id=>elements[id],game,history:[],historyIndex:0,log:[],consoleLog:line=>messages.push(line),syncAudio(){},write:(...entry)=>saved.push(entry)});
  const submit=value=>{elements['console-input'].value=value;elements['console-form'].onsubmit({preventDefault(){}});};
  for(const [key,storage] of [['shake','shake'],['spin','spin'],['rotation_shocks','rotation-shocks'],['portal_white_light','portal-white-light'],['culling','culling'],['microgravity','microgravity'],['overheat_blocks_recoupling','overheat-blocks-recoupling']]) {
    submit(`toggle ${key}`);assert.deepEqual(saved.at(-1),[`cube-libre-${storage}-v1`,false]);
    assert.equal(messages.at(-1),`${key} set to false`);
    const writes=saved.length;for(const alias of ['set','view','status'])submit(`${alias} ${key}`);
    assert.equal(saved.length,writes);assert.equal(messages.at(-1),`Status for ${key} is: Disabled`);
    const load=source.split('\n').find(line=>line.includes(`game.flags.${key}=read(`)),fresh=new Game();
    vm.runInNewContext(load,{game:fresh,read:name=>saved.findLast(([key])=>key===name)?.[1]});
    assert.equal(fresh.flags[key],false);
    submit(`set ${key} enabled`);assert.deepEqual(saved.at(-1),[`cube-libre-${storage}-v1`,true]);
  }
  submit('toggle unknown');assert.equal(messages.at(-1),'ERROR: unknown not found!');
});

test('audio mute uses the shared boolean interface and remains compatible with its button',async()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const game=new Game(),writes=[],audio={muted:false,failed:[],mute(value=!this.muted){this.muted=value;},async unlock(){}};
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
