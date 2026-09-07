import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MobileOrientation,createOrientationOptions} from '../../web/js/orientation.mjs';
import {createMobileOptions} from '../../web/js/mobile.mjs';
import {Game} from '../../web/js/core.mjs';

function events(object={}) {
  const listeners={};return Object.assign(object,{
    addEventListener(name,fn){(listeners[name]??=[]).push(fn);},
    fire(name,event={}){for(const fn of listeners[name]||[])fn(event);}
  });
}
function setup(type='portrait-primary') {
  const calls=[];
  const orientation=events({type,async lock(target){calls.push(['lock',target]);this.type=target;},unlock(){calls.push(['unlock']);}});
  const view=events({screen:{orientation},innerWidth:400,innerHeight:800});
  const document=events({defaultView:view,hidden:false,fullscreenElement:null,fullscreenEnabled:true});
  const element={async requestFullscreen(){calls.push(['fullscreen']);document.fullscreenElement=element;document.fire('fullscreenchange');}};
  document.getElementById=()=>element;
  document.createElement=tag=>events({tag,children:[],attrs:{},dataset:{},hidden:false,disabled:false,
    append(...children){this.children.push(...children);},setAttribute(k,v){this.attrs[k]=v;}});
  const control=new MobileOrientation({document});control.setAvailable(true);
  const panel=createOrientationOptions(document,control),input=panel.children[1].children[0],status=panel.children[2],button=panel.children[3];
  return {control,panel,input,status,button,document,view,orientation,element,calls};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const reject=name=>{const error=Error(name);error.name=name;return error;};

test('mobile orientation starts off, locks the current portrait or landscape only on success, and unlocks without changing fullscreen',async()=>{
  for(const type of ['portrait-primary','portrait-secondary','landscape-primary','landscape-secondary']) {
    const s=setup(type);assert.equal(s.input.checked,false);assert.equal(s.button.hidden,true);assert.deepEqual(s.calls,[]);
    s.input.checked=true;s.input.fire('change');
    assert.equal(s.input.checked,false,'Pending requests must not claim success');assert.equal(s.input.disabled,true);
    await flush();assert.deepEqual(s.calls,[['lock',type]]);assert.equal(s.input.checked,true);assert.equal(s.input.disabled,false);
    assert.match(s.status.textContent,new RegExp(`Locked in ${type.split('-')[0]}`));
    s.input.checked=false;s.input.fire('change');assert.equal(s.control.locked,false);assert.deepEqual(s.calls.at(-1),['unlock']);
    assert.equal(s.document.fullscreenElement,null);
  }
});

test('fullscreen is an explicit fallback and locks the orientation captured before fullscreen rotates the display',async()=>{
  const s=setup('portrait-secondary');
  s.orientation.lock=async target=>{s.calls.push(['lock',target]);if(!s.document.fullscreenElement)throw reject('SecurityError');s.orientation.type=target;};
  s.element.requestFullscreen=async()=>{s.calls.push(['fullscreen']);s.document.fullscreenElement=s.element;s.orientation.type='landscape-primary';s.document.fire('fullscreenchange');};
  s.input.checked=true;s.input.fire('change');await flush();
  assert.equal(s.input.checked,false);assert.equal(s.button.hidden,false);assert.match(s.status.textContent,/Not locked yet/);
  assert.deepEqual(s.calls,[['lock','portrait-secondary']],'A denied lock never enters fullscreen automatically');
  s.button.fire('click');assert.deepEqual(s.calls.at(-1),['fullscreen'],'Fullscreen is requested during the button gesture');await flush();
  assert.deepEqual(s.calls.at(-1),['lock','portrait-secondary']);assert.equal(s.input.checked,true);assert.equal(s.button.hidden,true);
  s.input.checked=false;s.input.fire('change');assert.equal(s.document.fullscreenElement,s.element,'Unlocking does not unexpectedly exit fullscreen');
});

test('missing or rejected mobile APIs leave controls unlocked with device-setting guidance and no fullscreen loop',async()=>{
  for(const failure of ['missing','NotSupportedError','fullscreen denied','lock denied in fullscreen','fullscreen disabled']) {
    const s=setup();
    if(failure==='missing'){
      delete s.orientation.lock;const c=new MobileOrientation({document:s.document});c.setAvailable(true);
      const ui=createOrientationOptions(s.document,c);assert.equal(ui.children[1].children[0].disabled,true);assert.match(ui.children[2].textContent,/device’s rotation lock/);await c.request();assert.deepEqual(s.calls,[]);continue;
    }
    s.orientation.lock=async()=>{throw reject(failure==='NotSupportedError'?'NotSupportedError':'SecurityError');};
    if(failure==='lock denied in fullscreen')s.document.fullscreenElement=s.element;
    if(failure==='fullscreen disabled')s.document.fullscreenEnabled=false;
    await s.control.request();
    if(failure==='fullscreen denied'){s.element.requestFullscreen=async()=>{throw reject('NotAllowedError');};await s.control.request(true);}
    assert.equal(s.input.checked,false);assert.equal(s.control.busy,false);assert.equal(s.button.hidden,true);
    assert.match(s.status.textContent,/device’s rotation lock/);
  }
});

test('leaving fullscreen, hiding the page, switching away and native rotation release confirmed or pending locks safely',async()=>{
  for(const interrupt of [
    s=>{s.document.fullscreenElement=null;s.document.fire('fullscreenchange');},
    s=>{s.document.hidden=true;s.document.fire('visibilitychange');},
    s=>s.view.fire('pagehide'),s=>s.control.setAvailable(false)
  ])for(const stage of ['locked','pending lock','pending fullscreen']) {
    const s=setup(),delay=pending();
    if(stage==='pending lock')s.orientation.lock=()=>delay.promise;
    if(stage==='pending fullscreen')s.element.requestFullscreen=()=>delay.promise;
    const request=s.control.request(stage==='pending fullscreen');
    if(stage==='locked')await request;
    interrupt(s);assert.equal(s.input.checked,false);
    delay.resolve();await request;assert.equal(s.control.locked,false);assert.equal(s.control.busy,false);
    if(stage==='pending fullscreen')assert.equal(s.calls.some(c=>c[0]==='lock'),false,'Cancelled fullscreen never starts a late lock');
  }
  const s=setup();await s.control.request();s.orientation.type='landscape-primary';s.orientation.fire('change');
  assert.equal(s.input.checked,false);assert.match(s.status.textContent,/browser released/);
});

test('mobile Options exposes the orientation control without changing gameplay or persisting a fullscreen request',async()=>{
  const s=setup(),game=new Game();game.ready(6);game.setState('playing');
  const before={flags:{...game.flags},time:game.t,clock:game.legTime,state:game.state};
  const mobile={mode:0,helpers:false,orientation:s.control,setMode(){throw Error('Unrelated input mutation');},setHelpers(){throw Error('Unrelated helper mutation');}};
  const options=createMobileOptions(s.document,mobile),section=options.children.at(-1),input=section.children[1].children[0];
  assert.equal(section.hidden,false);input.checked=true;input.fire('change');await flush();assert.equal(input.checked,true);
  assert.deepEqual({flags:game.flags,time:game.t,clock:game.legTime,state:game.state},before);
  s.control.setAvailable(false);assert.equal(section.hidden,true);assert.equal(input.checked,false);
  s.control.setAvailable(true);assert.equal(section.hidden,false);assert.equal(input.checked,false);
  const reopened=createMobileOptions(s.document,mobile);assert.equal(reopened.children.at(-1).children[1].children[0].checked,false);
  assert.equal(new MobileOrientation({document:s.document}).locked,false,'New page visits never automatically request a lock');
});

test('real app resize and orientation handlers keep portrait and landscape playable, freeze the clock and release held gestures',()=>{
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  for(const startPortrait of [true,false]) {
    const s=setup(),game=new Game();game.ready(6);game.setState('playing');
    let held=true,resizes=0,invalidates=0;
    const renderer={width:startPortrait?400:800,height:startPortrait?800:400,resize(){resizes++;}};
    const mobile={enabled:true,resize(){held=false;},canPlay:()=>!game.paused};
    const ctx={window:s.view,document:s.document,renderer,mobile,game,titleLayout:{invalidate(){invalidates++;}},clearInput(){held=false;},pause(){game.paused=true;}};
    vm.createContext(ctx);
    const a=source.indexOf('  let portrait=renderer.height>=renderer.width;'),b=source.indexOf('  function updateController(',a);
    vm.runInContext(source.slice(a,b),ctx);
    [renderer.width,renderer.height]=[renderer.height,renderer.width];s.view.fire('resize');
    assert.equal(game.paused,true);assert.equal(held,false);assert.equal(resizes,1);assert.equal(invalidates,1);
    const clock=game.legTime;game.tick(.5,new Set());assert.equal(game.legTime,clock);
    game.paused=false;held=true;s.view.fire('orientationchange');assert.equal(game.paused,true);assert.equal(held,false);
    game.paused=false;held=true;s.document.fire('fullscreenchange');assert.equal(game.paused,true);assert.equal(held,false);
  }
});
