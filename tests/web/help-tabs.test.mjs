import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHelpTabs,createVisualOptions} from '../../web/js/help-tabs.mjs';
import {createMobileOptions,createTouchHelp} from '../../web/js/mobile.mjs';
import {navigateControllerMenu} from '../../web/js/gamepad.mjs';
import {Game,BALANCE} from '../../web/js/core.mjs';
import {featuresForSettings} from '../../web/js/difficulty.mjs';
import {shutterGateCount,shutterInterval,shutterStepInterval} from '../../web/js/changes.mjs';
import {BONUS_SCHEDULE,PIECES_RULES} from '../../web/js/bonus.mjs';
import {releaseAssetURL} from '../../web/js/updates.mjs';

function dom() {
  const document={activeElement:null};
  function element(tag) {
    const el={tag,children:[],attrs:{},dataset:{},events:{},hidden:false,scrollTop:0,open:false,parent:null,
      setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},
      prepend(...xs){this.children.unshift(...xs);for(const x of xs)if(typeof x==='object')x.parent=this;},
      append(...xs){for(const x of xs){this.children.push(x);if(typeof x==='object')x.parent=this;}},replaceChildren(...xs){this.children=[];this.append(...xs);},
      addEventListener(k,fn){this.events[k]=fn;},focus(){document.activeElement=this;},click(){this.events.click?.();this.onclick?.();},scrollIntoView(){},
      showModal(){this.open=true;},close(){this.open=false;},
      closest(selector){if(selector==='[hidden]')return this.hidden?this:this.parent?.closest(selector);return null;},
      getClientRects(){return this.closest('[hidden]')?[]:[{}];},
      querySelectorAll(selector){return this.children.filter(x=>typeof x==='object').flatMap(x=>[...(matches(x,selector)?[x]:[]),...x.querySelectorAll(selector)]);},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    };
    let ownText='';Object.defineProperty(el,'textContent',{get:()=>ownText+el.children.map(c=>typeof c==='string'?c:c.textContent).join(''),set:v=>{ownText=String(v);el.children=[];}});
    Object.defineProperty(el,'firstElementChild',{get:()=>el.children.find(x=>typeof x==='object')});
    return el;
  }
  function matches(el,selector){
    if(selector.includes(','))return selector.split(',').some(s=>matches(el,s.trim()));
    if(selector.startsWith('[role'))return el.attrs.role===selector.match(/role=["']?(\w+)/)[1]&&(!selector.includes('aria-selected')||el.attrs['aria-selected']==='true')&&(!selector.includes(':not([hidden])')||!el.hidden);
    if(selector==='a[href]')return el.tag==='a'&&Boolean(el.href);
    return el.tag===selector;
  }
  document.createElement=element;return document;
}

const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
function buildHelp({bonus=false,connected=false,paused=false,touch=false}={}) {
  const document=dom(),game=new Game();game.ready(15);game.setState(bonus?'bonus_playing':'playing');game.paused=paused;
  const nodes=Object.fromEntries(['modal','modal-title','modal-body','modal-actions','console'].map(k=>[k,document.createElement('div')]));
  nodes.modal.append(nodes['modal-title'],nodes['modal-body'],nodes['modal-actions']);
  const writes=[],ctx={document,game,controller:{enabled:true,connected},modalKind:null,previousPaused:false,$:id=>nodes[id],clearInput(){},syncAudio(){},focusGame(){},write:(...x)=>writes.push(x),
    createHelpTabs,createVisualOptions,createMobileOptions,createTouchHelp,mobile:{enabled:touch,mode:0,helpers:false,setMode(n){this.mode=n;},setHelpers(n){this.helpers=n;}},releaseAssetURL,featuresForSettings,shutterGateCount,shutterInterval,shutterStepInterval,BONUS_SCHEDULE,PIECES_RULES,BALANCE,release:{version:'0.23.1',upstream:{version:'0.15.79'}}};
  vm.createContext(ctx);
  const a=source.indexOf('  function closeModal()'),b=source.indexOf('  function pause()',a),c=source.indexOf('  function controllerHelp('),d=source.indexOf('  function menu()',c);
  vm.runInContext((source.slice(a,b)+source.slice(c,d)).replaceAll('import.meta.url',JSON.stringify('https://flyingfathead.github.io/cube-libre/js/app.mjs')),ctx);
  ctx.help();return {document,game,nodes,writes,ctx};
}

test('actual Help separates keyboard, controller and visual-only options, including bonus-specific maps',()=>{
  for(const bonus of [false,true])for(const connected of [false,true]) {
    const {nodes,game,writes,ctx}=buildHelp({bonus,connected}),body=nodes['modal-body'];
    const tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
    assert.deepEqual(tabs.map(t=>t.textContent),['KEYBOARD','CONTROLLER','TOUCH','OPTIONS']);
    assert.equal(panels.filter(p=>!p.hidden).length,1);assert.equal(panels[connected?1:0].hidden,false);
    assert.equal(tabs[connected?1:0].attrs['aria-selected'],'true');assert.equal(game.paused,true);assert.equal(game.help,true);
    assert.equal(panels[0].querySelectorAll('input').length,0);assert.equal(panels[1].querySelectorAll('input').length,0);
    assert.ok(panels[0].querySelector('img').src.includes(bonus?'keyboard-bonus-controls':'keyboard-controls'));
    assert.ok(panels[1].querySelector('img').src.includes('controller-controls.svg'));
    assert.deepEqual(panels[3].querySelectorAll('input').map(i=>i.dataset.setting),['shake','rotation_shocks','portal_white_light']);
    assert.ok(body.textContent.includes('© 2024–2026 FlyingFathead'));assert.ok(body.textContent.includes('Web version · Based on PyGame v0.15.79'));
    assert.ok(!body.textContent.includes('Console: set'));assert.equal(writes.length,0);
    ctx.closeModal();assert.equal(game.paused,false);assert.equal(game.help,false);
  }
});

test('tab clicks and arrow/Home/End keys hide inactive panels, move focus and never advance play',()=>{
  const {nodes,game,document}=buildHelp(),body=nodes['modal-body'],tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
  const before={state:game.state,time:game.t,leg:game.legTime,flags:{...game.flags}};
  tabs[3].click();assert.equal(panels[3].hidden,false);assert.equal(tabs[3].tabIndex,0);assert.equal(tabs[0].tabIndex,-1);
  for(const [from,key,next] of [[3,'ArrowRight',0],[0,'ArrowLeft',3],[3,'Home',0],[0,'End',3]]) {
    let prevented=false;panels[next].scrollTop=400;tabs[from].events.keydown({key,preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(document.activeElement,tabs[next]);assert.equal(panels[next].hidden,false);assert.equal(panels[next].scrollTop,0);
    assert.equal(panels.filter(p=>!p.hidden).length,1);
  }
  assert.deepEqual({state:game.state,time:game.t,leg:game.legTime,flags:game.flags},before);assert.equal(game.paused,true);
});

test('Options writes only visual preferences; gameplay flags remain console-editable and untouched by Help',()=>{
  const {nodes,game,writes,ctx}=buildHelp({paused:true});
  const keys=['spin','microgravity','overheat_blocks_recoupling','change_1','change_1_random_per_leg','change_1_no_repeat_leg','culling'];
  for(const key of keys)game.command(`set ${key} false`);
  const flags={...game.flags},course=game.course,pose=game.player.spinAngles;
  for(const input of nodes['modal-body'].querySelectorAll('input')){input.checked=false;input.events.change();}
  assert.equal(writes.length,3);assert.deepEqual(writes.map(x=>x[0]),['cube-libre-shake-v1','cube-libre-rotation-shocks-v1','cube-libre-portal-white-light-v1']);
  for(const key of keys)assert.equal(game.flags[key],flags[key]);assert.equal(game.course,course);assert.equal(game.player.spinAngles,pose);
  ctx.closeModal();assert.equal(game.paused,true,'Help restores an already paused run');
  for(const key of keys)assert.equal(game.command(`toggle ${key}`),`${key} set to true`);
});

test('controller navigation reaches tabs and visible options, with scrolling confined to the active panel',()=>{
  const {nodes,document}=buildHelp({connected:true}),root=nodes.modal,body=nodes['modal-body'];
  const tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
  tabs[2].focus();navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);assert.equal(document.activeElement,tabs[3]);
  navigateControllerMenu(root,{menuStep:0,scroll:0,actions:{confirm:true}},document,.1);assert.equal(panels[3].hidden,false);
  navigateControllerMenu(root,{menuStep:1,scroll:1,actions:{}},document,.1);
  assert.equal(document.activeElement,panels[3].querySelector('button'));assert.equal(panels[3].scrollTop,55);assert.equal(panels[1].scrollTop,0);assert.equal(root.scrollTop,0);
  tabs[0].click();tabs[3].focus();navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);
  assert.equal(document.activeElement.tag,'summary','Hidden Options checkboxes are skipped');
});


test('touch Help opens by default in mobile mode and Options can switch the saved input mode',()=>{
  for(const bonus of [true,false]) {
    const {nodes,ctx}=buildHelp({bonus,touch:true});
    const panels=nodes['modal-body'].querySelectorAll('[role="tabpanel"]');
    assert.equal(panels[2].hidden,false);assert.ok(panels[2].querySelector('img').src.includes('touch-controls.svg'));
    assert.ok(panels[2].textContent.includes(bonus?'roll on the floor':'three movement axes'));
    const modes=panels[3].querySelectorAll('button');assert.equal(modes.length,4);modes[2].click();assert.equal(ctx.mobile.mode,2);
    assert.equal(modes[2].attrs['aria-pressed'],'true');assert.equal(modes[0].attrs['aria-pressed'],'false');
  }
});
