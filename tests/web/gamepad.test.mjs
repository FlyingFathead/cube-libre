import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GamepadInput,deadzoneAxis,emptyMovement,mergeMovement,navigateControllerMenu} from '../../web/js/gamepad.mjs';
import {Game} from '../../web/js/core.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pad=(index=0)=>({index,id:`Xbox ${index}`,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))});
const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
function setup(){let pads=[pad()];const controller=new GamepadInput({getGamepads:()=>pads});controller.poll(0);return {controller,get p(){return pads[0];},set pads(value){pads=value;}};}

test('standard controller provides analog X/Y, independent Z triggers and bonus floor rolling',()=>{
  const s=setup(),c=s.controller,p=s.p;
  p.axes=[.59,-.59,0,0];p.buttons[6].value=.53;
  let f=c.poll(.01);near(f.movement.x,.5);near(f.movement.y,.5);near(f.movement.z,.5);
  p.buttons[7].value=.53;near(c.poll(.02).movement.z,0);
  f=c.poll(.03,{bonus:true});near(f.movement.x,.5);near(f.movement.y,0);near(f.movement.z,-.5);
  p.axes=[.1,-.17,0,0];p.buttons[6].value=p.buttons[7].value=0;
  assert.deepEqual(c.poll(.04).movement,emptyMovement());
  for(const x of [NaN,Infinity,undefined])assert.equal(deadzoneAxis(x),0);
  assert.equal(deadzoneAxis(5),1);assert.equal(deadzoneAxis(-5),-1);
});

test('LB and X re-couple on press only, RB holds rush, and connect/focus transitions require neutral',()=>{
  const p=pad();p.buttons[0].value=1;
  const c=new GamepadInput({getGamepads:()=>[p]});assert.equal(c.poll(0).actions.confirm,undefined);
  assert.equal(c.poll(.1).actions.confirm,undefined);p.buttons[0].value=0;c.poll(.2);
  p.buttons[0].value=1;assert.equal(c.poll(.3).actions.confirm,true);assert.equal(c.poll(.4).actions.confirm,false);
  p.buttons[0].value=0;p.buttons[4].value=p.buttons[2].value=p.buttons[5].value=1;
  let f=c.poll(.5);assert.equal(f.actions.recouple,true);assert.equal(f.movement.rush,true);
  assert.equal(c.poll(.6).actions.recouple,false);
  c.poll(.7,{focused:false});assert.deepEqual(c.poll(.8).movement,emptyMovement());
  p.buttons.forEach(b=>b.value=0);c.poll(.9);p.buttons[2].value=1;assert.equal(c.poll(1).actions.recouple,true);
  for(const [i,key] of [[1,'back'],[3,'locate'],[8,'help'],[9,'pause']]){p.buttons[i].value=1;assert.equal(c.poll(2+i).actions[key],true);}
});

test('fresh polling preserves one pad, disconnects safely and reports unsupported or blocked input',()=>{
  const s=setup(),c=s.controller,first=s.p,second=pad(1);first.axes[0]=1;second.axes[0]=-1;
  s.pads=[second,first];assert.equal(c.poll(1).movement.x,1);assert.equal(c.index,0);
  s.pads=[second];let f=c.poll(2);assert.equal(f.disconnected,true);assert.deepEqual(f.movement,emptyMovement());
  second.axes[0]=0;c.poll(3);second.axes[0]=-1;assert.equal(c.poll(4).movement.x,-1);
  c.enabled=false;assert.deepEqual(c.poll(5).movement,emptyMovement());assert.equal(c.status,'disabled');
  c.enabled=true;s.pads=[{...pad(),mapping:''}];assert.equal(c.poll(6).status,'unmapped');
  c.getGamepads=()=>{throw Error('blocked');};assert.equal(c.poll(7).status,'unavailable');
  s.pads=[];c.getGamepads=()=>[];assert.equal(c.poll(8).status,'waiting');
});

test('menu navigation repeats deliberately, focuses visible controls and scrolls without clicking hidden actions',()=>{
  const s=setup(),p=s.p,c=s.controller;p.buttons[13].value=1;
  assert.equal(c.poll(0).menuStep,1);assert.equal(c.poll(.2).menuStep,0);assert.equal(c.poll(.37).menuStep,1);
  assert.equal(c.poll(.4).menuStep,0);assert.equal(c.poll(.5).menuStep,1);
  const document={activeElement:null},clicked=[],choice=(name,hidden=false)=>({disabled:false,closest:()=>hidden,getClientRects:()=>[{}],focus(){document.activeElement=this;},scrollIntoView(){},click(){clicked.push(name);}});
  const a=choice('a'),b=choice('b'),hidden=choice('hidden',true),root={scrollTop:0,querySelectorAll:()=>[a,hidden,b]};
  navigateControllerMenu(root,{menuStep:0,scroll:1,actions:{confirm:true}},document,.1);
  assert.equal(document.activeElement,a);assert.deepEqual(clicked,[]);near(root.scrollTop,55);
  navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);assert.equal(document.activeElement,b);
  navigateControllerMenu(root,{menuStep:0,scroll:0,actions:{confirm:true}},document,.1);assert.deepEqual(clicked,['b']);
});

test('keyboard/controller mixing caps speed and actual normal gameplay responds to partial analog thrust',()=>{
  assert.deepEqual(mergeMovement({x:1,y:-1,z:.5,rush:false},{x:1,y:1,z:.8,rush:true}),{x:1,y:0,z:1,rush:true});
  for(const microgravity of [false,true]) {
    const full=new Game({gameMode:50}),half=new Game({gameMode:50});for(const g of [full,half]){g.ready(1);g.setState('playing');g.flags.microgravity=microgravity;g.flags.damage=false;g.flags.suction=false;}
    const start=half.player.origin.x;
    for(let i=0;i<60;i++){full.tick(1/120,{x:1});half.tick(1/120,{x:.5});}
    near(half.player.origin.x-start,(full.player.origin.x-start)/2);
  }
});

test('controller and deadzone console setters save preferences while queries preserve momentum and write nothing',()=>{
  const game=new Game({gameMode:50}),writes=[],context={game,GamepadInput,emptyMovement,read:(key,fallback)=>key==='cube-libre-controller-deadzone-v1'?.25:fallback,write:(...x)=>writes.push(x)};
  vm.createContext(context);
  const a=source.indexOf('  const controller=new GamepadInput()'),b=source.indexOf('  const keyboard=',a);
  vm.runInContext(source.slice(a,b),context);
  assert.equal(game.command('status controller_deadzone'),'Status for controller_deadzone is: 0.25');
  assert.equal(game.command('set controller_deadzone 0.3'),'controller_deadzone set to 0.3');
  assert.deepEqual(writes.at(-1),['cube-libre-controller-deadzone-v1',.3]);
  assert.equal(game.command('toggle controller'),'controller set to false');
  assert.deepEqual(writes.at(-1),['cube-libre-controller-v1',false]);
  const count=writes.length;for(const key of ['controller','controller_deadzone'])for(const alias of ['set','view','status'])game.command(`${alias} ${key}`);
  game.command('viewconfig');assert.equal(writes.length,count);
  for(const n of ['-1','1','NaN','on'])assert.throws(()=>game.command(`set controller_deadzone ${n}`));
  assert.equal(writes.length,count);assert.match(game.command('viewconfig'),/controller_deadzone \| 0.3/);
});

test('real browser controller dispatcher separates gameplay, pause, Help, console and ending inputs',()=>{
  const s=setup(),game=new Game({gameMode:50});game.ready(7);game.setState('playing');let recouples=0;game.requestRecouple=()=>recouples++;
  const nodes={modal:{open:false},console:{open:false},'modal-title':{},'modal-body':{firstElementChild:{}},'console-log':{scrollTop:0},locate:{click(){game.locate=!game.locate;}}};
  const ctx={game,controller:s.controller,emptyMovement,controllerMovement:emptyMovement(),controllerAction:false,document:{hidden:false,hasFocus:()=>true},$:id=>nodes[id],modalKind:null,syncAudio(){},navigateControllerMenu(){},
    clearInput(){s.controller.suspend();},pause(){game.paused=!game.paused;nodes.modal.open=game.paused;ctx.modalKind='pause';},help(){game.help=true;game.paused=true;nodes.modal.open=true;ctx.modalKind='help';},
    closeModal(){nodes.modal.open=false;game.paused=game.help=false;s.controller.suspend();},closeConsole(){nodes.console.open=false;},menu(){game.menu();},start(){}};
  vm.createContext(ctx);const a=source.indexOf('  function updateController('),b=source.indexOf('  function input()',a);vm.runInContext(source.slice(a,b),ctx);
  const release=()=>{s.p.buttons.forEach(b=>b.value=0);ctx.updateController(0,.01);};
  const press=i=>{s.p.buttons[i].value=1;ctx.updateController(10,.01);};
  press(4);ctx.updateController(20,.01);assert.equal(recouples,1);release();
  press(1);assert.ok(game.panic);assert.equal(game.state,'playing');ctx.updateController(20,.01);assert.equal(game.events.filter(e=>e.name==='panic').length,1);release();
  game.resetAttempt();game.setState('playing');
  press(9);assert.equal(game.paused,true);release();press(9);assert.equal(game.paused,false);release();
  press(8);assert.equal(game.help,true);release();press(1);assert.equal(game.help,false);release();
  nodes.console.open=true;press(4);assert.equal(recouples,1);release();press(13);assert.equal(nodes['console-log'].scrollTop,200);release();press(1);assert.equal(nodes.console.open,false);release();
  game.setState('thank_you_note');game.stateTime=30;press(0);assert.equal(game.state,'run_summary');
  ctx.updateController(20,.01);assert.equal(game.state,'run_summary');release();game.stateTime=1;press(0);assert.equal(game.state,'title');release();
  game.ready(7);game.setState('playing');s.pads=[];ctx.updateController(30,.01);assert.equal(game.paused,true);assert.equal(nodes['modal-title'].textContent,'CONTROLLER DISCONNECTED');
  nodes.modal.open=false;game.paused=false;s.pads=[pad()];ctx.updateController(40,.01);s.controller.enabled=false;s.pads=[];ctx.updateController(50,.01);assert.equal(game.paused,false,'Disabled controller cannot pause keyboard play on disconnect');
});

test('controller-only start does not await a browser-blocked audio unlock',async()=>{
  const game=new Game({gameMode:50}),nodes={start:{}},ctx={game,$:id=>nodes[id],controllerAction:false,controllerAudioPending:false,loadingStart:false,audioProgress:'',audioWarning:'',
    audio:{muted:false,failed:[],unlock:()=>new Promise(()=>{})},clearInput(){},focusGame(){},syncAudio(){}};
  vm.createContext(ctx);const a=source.indexOf('  async function start('),b=source.indexOf('  function unlockControllerAudio()',a);vm.runInContext(source.slice(a,b),ctx);
  await ctx.start({controller:true});assert.equal(game.state,'opening_intro');assert.equal(ctx.loadingStart,false);assert.equal(nodes.start.disabled,false);
  assert.match(ctx.audioWarning,/keyboard key once/);assert.equal(ctx.controllerAudioPending,true);
});
