import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHelpTabs,createVisualOptions,createOptionsReset} from '../../web/js/help-tabs.mjs';
import {createPhilosophySection,renderPhilosophy} from '../../web/js/philosophy.mjs';
import {createMobileOptions,createTouchHelp} from '../../web/js/mobile.mjs';
import {navigateControllerMenu} from '../../web/js/gamepad.mjs';
import {backupHelpText} from '../../web/js/backup.mjs';
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
const philosophy=readFileSync(new URL('../../docs/PHILOSOPHY.md',import.meta.url),'utf8');
function buildHelp({bonus=false,connected=false,paused=false,touch=false,gameMode=50}={}) {
  const document=dom(),game=new Game({gameMode});game.ready(15);game.setState(bonus?'bonus_playing':'playing');game.paused=paused;
  const nodes=Object.fromEntries(['modal','modal-title','modal-body','modal-actions','console'].map(k=>[k,document.createElement('div')]));
  nodes.modal.append(nodes['modal-title'],nodes['modal-body'],nodes['modal-actions']);
  const requests=[],cache=new Map();
  const writes=[],ctx={document,game,controller:{enabled:true,connected},modalKind:null,previousPaused:false,$:id=>nodes[id],clearInput(){},syncAudio(){},focusGame(){},write:(...x)=>writes.push(x),
    createPhilosophySection:(doc,url)=>createPhilosophySection(doc,url,{cache,fetcher:async url=>{requests.push(url);return {ok:true,text:async()=>philosophy};}}),
    backupHelpText,createHelpTabs,createVisualOptions,createOptionsReset,createMobileOptions,createTouchHelp,mobile:{enabled:touch,mode:0,helpers:false,setMode(n){this.mode=n;},setHelpers(n){this.helpers=n;}},releaseAssetURL,featuresForSettings,shutterGateCount,shutterInterval,shutterStepInterval,BONUS_SCHEDULE,PIECES_RULES,BALANCE,release:{version:'0.23.1',upstream:{version:'0.15.79'}}};
  vm.createContext(ctx);
  const a=source.indexOf('  function closeModal()'),b=source.indexOf('  function pause()',a),c=source.indexOf('  function controllerHelp('),d=source.indexOf('  function menu()',c);
  vm.runInContext((source.slice(a,b)+source.slice(c,d)).replaceAll('import.meta.url',JSON.stringify('https://flyingfathead.github.io/cube-libre/js/app.mjs')),ctx);
  ctx.help();return {document,game,nodes,writes,ctx,requests};
}

test('actual Help separates keyboard, controller and visual and rescue options, including bonus-specific maps',()=>{
  for(const bonus of [false,true])for(const connected of [false,true]) {
    const {nodes,game,writes,ctx}=buildHelp({bonus,connected}),body=nodes['modal-body'];
    const tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
    assert.deepEqual(tabs.map(t=>t.textContent),['KEYBOARD','CONTROLLER','TOUCH','OPTIONS','PHILOSOPHY']);
    assert.equal(panels.filter(p=>!p.hidden).length,1);assert.equal(panels[connected?1:0].hidden,false);
    assert.equal(tabs[connected?1:0].attrs['aria-selected'],'true');assert.equal(game.paused,true);assert.equal(game.help,true);
    assert.equal(panels[0].querySelectorAll('input').length,0);assert.equal(panels[1].querySelectorAll('input').length,0);
    assert.ok(panels[0].querySelector('img').src.includes(bonus?'keyboard-bonus-controls':'keyboard-controls'));
    assert.ok(panels[1].querySelector('img').src.includes('controller-controls.svg'));
    assert.deepEqual(panels[3].querySelectorAll('input').map(i=>i.dataset.setting),['shake','rotation_shocks','portal_white_light','panic','backup_cubes_enabled']);
    assert.ok(body.textContent.includes('© 2024–2026 FlyingFathead'));assert.ok(body.textContent.includes('Web version · Based on PyGame v0.15.79'));
    assert.ok(!body.textContent.includes('Console: set'));assert.equal(writes.length,0);
    ctx.closeModal();assert.equal(game.paused,false);assert.equal(game.help,false);
  }
});

test('tab clicks and arrow/Home/End keys hide inactive panels, move focus and never advance play',()=>{
  const {nodes,game,document}=buildHelp(),body=nodes['modal-body'],tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
  const before={state:game.state,time:game.t,leg:game.legTime,flags:{...game.flags}};
  tabs[3].click();assert.equal(panels[3].hidden,false);assert.equal(tabs[3].tabIndex,0);assert.equal(tabs[0].tabIndex,-1);
  for(const [from,key,next] of [[3,'ArrowRight',4],[4,'ArrowRight',0],[0,'ArrowLeft',4],[4,'Home',0],[0,'End',4]]) {
    let prevented=false;panels[next].scrollTop=400;tabs[from].events.keydown({key,preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(document.activeElement,tabs[next]);assert.equal(panels[next].hidden,false);assert.equal(panels[next].scrollTop,0);
    assert.equal(panels.filter(p=>!p.hidden).length,1);
  }
  assert.deepEqual({state:game.state,time:game.t,leg:game.legTime,flags:game.flags},before);assert.equal(game.paused,true);
});

test('Options saves visual effects and Panic while preserving all other gameplay flags',()=>{
  const {nodes,game,writes,ctx}=buildHelp({paused:true});
  const keys=['spin','microgravity','overheat_blocks_recoupling','change_1','change_1_random_per_leg','change_1_no_repeat_leg','culling'];
  for(const key of keys)game.command(`set ${key} false`);
  const flags={...game.flags},course=game.course,pose=game.player.spinAngles;
  for(const input of nodes['modal-body'].querySelectorAll('input')){input.checked=false;input.events.change();}
  assert.equal(writes.length,5);assert.equal(game.flags.panic,false);assert.deepEqual(writes.map(x=>x[0]),['cube-libre-shake-v1','cube-libre-rotation-shocks-v1','cube-libre-portal-white-light-v1','cube-libre-panic-v1','cube-libre-backup-cubes-enabled-v1']);
  for(const key of keys)assert.equal(game.flags[key],flags[key]);assert.equal(game.course,course);assert.equal(game.player.spinAngles,pose);
  ctx.closeModal();assert.equal(game.paused,true,'Help restores an already paused run');
  for(const key of keys)assert.equal(game.command(`toggle ${key}`),`${key} set to true`);
});

test('controller navigation reaches tabs and visible options, with scrolling confined to the active panel',()=>{
  const {nodes,document}=buildHelp({connected:true}),root=nodes.modal,body=nodes['modal-body'];
  const tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
  tabs[2].focus();navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);assert.equal(document.activeElement,tabs[3]);
  navigateControllerMenu(root,{menuStep:0,scroll:0,actions:{confirm:true}},document,.1);assert.equal(panels[3].hidden,false);
  navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);assert.equal(document.activeElement,tabs[4]);
  navigateControllerMenu(root,{menuStep:1,scroll:1,actions:{}},document,.1);
  assert.equal(document.activeElement,panels[3].querySelector('button'));assert.equal(panels[3].scrollTop,55);assert.equal(panels[1].scrollTop,0);assert.equal(root.scrollTop,0);
  tabs[0].click();tabs[4].focus();navigateControllerMenu(root,{menuStep:1,scroll:0,actions:{}},document,.1);
  assert.equal(document.activeElement.tag,'summary','Hidden Options checkboxes are skipped');
});

test('Philosophy loads the real Markdown on selection, formats it and remains scrollable while play is paused',async()=>{
  for(const touch of [false,true])for(const connected of [false,true]) {
    const {nodes,game,ctx,requests,document}=buildHelp({touch,connected}),body=nodes['modal-body'];
    const before={time:game.t,leg:game.legTime,score:game.score,cells:[...game.player.alive],flags:{...game.flags}};
    let tabs=body.querySelectorAll('[role="tab"]'),panels=body.querySelectorAll('[role="tabpanel"]');
    assert.equal(requests.length,0,'Opening Help does not fetch optional philosophy');
    tabs[4].focus();navigateControllerMenu(nodes.modal,{menuStep:0,scroll:0,actions:{confirm:true}},document,.1);
    tabs[4].click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests.length,1);assert.equal(requests[0].pathname,'/cube-libre/assets/PHILOSOPHY.md');
    assert.equal(panels[4].hidden,false);assert.equal(panels[4].querySelector('article').attrs['aria-busy'],'false');
    assert.equal(panels[4].querySelector('h3').textContent,"ChaosWhisperer's take on the game's philosophy");
    assert.match(panels[4].querySelector('em').textContent,/Harry Horsperg \(a.k.a. FlyingFathead\), the developer of Cube Libre/);
    assert.ok(panels[4].querySelectorAll('strong').some(el=>el.textContent==='"Cube Souls"'));
    assert.ok(panels[4].querySelectorAll('p').length>8);assert.ok(!panels[4].textContent.includes('**'));
    assert.match(panels[4].textContent,/time, space, life, death and existence/);
    navigateControllerMenu(nodes.modal,{menuStep:0,scroll:1,actions:{}},document,.1);
    assert.equal(panels[4].scrollTop,55);assert.equal(panels[0].scrollTop,0);assert.equal(nodes.modal.scrollTop,0);
    game.tick(5);assert.equal(game.paused,true);assert.equal(game.help,true);
    assert.deepEqual({time:game.t,leg:game.legTime,score:game.score,cells:[...game.player.alive],flags:game.flags},before);
    ctx.closeModal();ctx.help();tabs=body.querySelectorAll('[role="tab"]');tabs[4].click();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1,'Reopening uses the successful read');
  }
});

test('Philosophy read failures can retry, release URLs are retained, and Markdown never injects HTML',async()=>{
  const document=dom(),cache=new Map(),url=releaseAssetURL('../assets/PHILOSOPHY.md','https://example.test/cube-libre/js/app.mjs','0.30.2');
  let calls=0;
  const section=createPhilosophySection(document,url,{cache,fetcher:async requested=>{
    assert.equal(requested.searchParams.get('v'),'0.30.2');calls++;
    if(calls===1)throw Error('offline');
    if(calls===2)return {ok:false};
    if(calls===3)return {ok:true,text:async()=>''};
    return {ok:true,text:async()=>philosophy};
  }});
  for(let attempt=0;attempt<3;attempt++) {
    await section.onSelect();assert.equal(section.body.attrs['aria-busy'],'false');
    assert.match(section.body.textContent,/Could not load/);assert.equal(section.body.querySelector('button').textContent,'Try again');
  }
  section.body.querySelector('button').click();await section.onSelect();
  assert.equal(calls,4);assert.ok(section.body.querySelector('h3'));
  await section.onSelect();assert.equal(calls,4);
  const literal=document.createElement('article');renderPhilosophy(document,literal,'# Title\n\n**Bold** and *italic* <script>alert(1)</script> [source](https://example.test/report) [unsafe](javascript:alert)');
  assert.equal(literal.querySelector('script'),null);assert.match(literal.textContent,/<script>alert\(1\)<\/script>/);
  assert.equal(literal.querySelector('strong').textContent,'Bold');assert.equal(literal.querySelector('em').textContent,'italic');
  const links=literal.querySelectorAll('a');assert.equal(links.length,1);assert.equal(links[0].href,'https://example.test/report');
  assert.equal(links[0].target,'_blank');assert.equal(links[0].rel,'noopener noreferrer');
});


test('touch Help opens by default in mobile mode and Options can switch the saved input mode',()=>{
  for(const bonus of [true,false]) {
    const {nodes,ctx}=buildHelp({bonus,touch:true});
    const panels=nodes['modal-body'].querySelectorAll('[role="tabpanel"]');
    assert.equal(panels[2].hidden,false);assert.ok(panels[2].querySelector('img').src.includes('touch-controls.svg'));
    assert.ok(panels[2].textContent.includes(bonus?'roll on the floor':'three movement axes'));
    const modes=panels[3].querySelectorAll('button');assert.equal(modes.length,5);modes[2].click();assert.equal(ctx.mobile.mode,2);
    assert.equal(modes[2].attrs['aria-pressed'],'true');assert.equal(modes[0].attrs['aria-pressed'],'false');
  }
});


test('Help uses the active campaign cap and milestones without offering the original mode as a public option',()=>{
  for(const gameMode of [20,50]) {
    const {nodes,game}=buildHelp({gameMode}),body=nodes['modal-body'];
    assert.ok(body.textContent.includes(`up to ${gameMode}.`));
    const rows=body.querySelectorAll('tr').filter(row=>row.textContent.includes('LOSS ...'));
    assert.equal(rows.length,1);assert.ok(rows[0].textContent.startsWith(gameMode===20?'16':'44'));
    const options=body.querySelectorAll('[role="tabpanel"]')[3];
    assert.ok(!options.textContent.includes('50-level'));assert.ok(!options.textContent.includes('game_mode'));
    assert.equal(options.querySelectorAll('input').some(i=>i.dataset.setting==='game_mode'),false);
    assert.equal(game.gameMode,gameMode);
  }
});


test('Backup option is saved and Reset to defaults restores panel controls without spending reserves or resetting the run',()=>{
  const {nodes,game,ctx,writes}=buildHelp({touch:true,paused:true});
  game.backupCubes=2;const before={level:game.level,score:game.score,cells:[...game.player.alive],state:game.state};
  ctx.mobile.setMode(2);ctx.mobile.setHelpers(true);
  const panel=nodes['modal-body'].querySelectorAll('[role="tabpanel"]')[3];
  const inputs=panel.querySelectorAll('input');for(const input of inputs){input.checked=false;input.events.change();}
  assert.equal(game.flags.backup_cubes_enabled,false);assert.ok(writes.some(([key,value])=>key==='cube-libre-backup-cubes-enabled-v1'&&value===false));
  panel.querySelectorAll('button').find(b=>b.textContent==='Reset to defaults').click();
  assert.equal(ctx.mobile.mode,0);assert.equal(ctx.mobile.helpers,false);
  for(const input of panel.querySelectorAll('input'))assert.equal(input.checked,true);
  assert.equal(game.backupCubes,2);assert.deepEqual({level:game.level,score:game.score,cells:[...game.player.alive],state:game.state},before);
  assert.equal(game.paused,true);assert.equal(game.help,true);
  const panels=nodes['modal-body'].querySelectorAll('[role="tabpanel"]');
  for(const index of [0,1,2])assert.match(panels[index].textContent,/Collect all 124.*Space.*Xbox A/);
  let released=0;ctx.mobile.orientation={release(){released++;}};
  createOptionsReset(ctx.document,game,ctx.mobile,ctx.write,()=>{}).querySelector('button').click();
  assert.equal(released,1);assert.equal(game.backupCubes,2);
});
