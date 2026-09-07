import test from 'node:test';
import assert from 'node:assert/strict';
import {UpdateChecker,newerVersion} from '../../web/js/updates.mjs';

test('update versions compare numerically and ignore invalid, equal or older releases',()=>{
  for(const v of ['0.18.1','0.19.0','0.100.0','1.0.0'])assert.equal(newerVersion(v,'0.18.0'),true);
  for(const v of ['0.18.0','0.17.99','0.9.999','broken','1.0','1.0.0-beta','01.2.3',null,{},'9999999999999999999999.0.0'])assert.equal(newerVersion(v,'0.18.0'),false);
});

test('the deployed project version is fetched fresh and each newer version notifies only once',async()=>{
  let version='0.18.0',calls=[];
  const checker=new UpdateChecker('0.18.0',{url:'https://flyingfathead.github.io/cube-libre/version.json',now:()=>123,fetcher:async(url,options)=>{
    calls.push({url,options});return {ok:true,json:async()=>({version,edition:'web'})};
  }});
  assert.equal(await checker.check(),null);version='0.18.1';assert.equal(await checker.check(),'0.18.1');assert.equal(await checker.check(),null);
  version='0.19.0';assert.equal(await checker.check(),'0.19.0');
  assert.equal(calls[0].url.pathname,'/cube-libre/version.json');assert.equal(calls[0].url.searchParams.get('check'),'123');assert.equal(calls[0].options.cache,'no-store');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('offline, invalid JSON, missing files and overlapping checks never interrupt play',async()=>{
  const checker=new UpdateChecker('0.18.0');
  for(const fetcher of [async()=>{throw Error('offline');},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw Error('HTML response');}}),async()=>({ok:true,json:async()=>({version:'1.0.0',edition:'pygame'})})]) {
    checker.fetcher=fetcher;assert.equal(await checker.check(),null);assert.equal(checker.pending,false);
  }
  let resolve;checker.fetcher=()=>new Promise(r=>{resolve=r;});
  const first=checker.check();assert.equal(await checker.check(),null);
  resolve({ok:true,json:async()=>({version:'0.20.0',edition:'web'})});assert.equal(await first,'0.20.0');
});

test('update and mobile notices pause the real modal flow and Space dismisses without advancing play',async()=>{
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const element=()=>({open:false,dataset:{},children:[],textContent:'',append(...xs){this.children.push(...xs);},replaceChildren(){this.children=[];},get firstElementChild(){return this.children[0];},click(){this.onclick?.();},querySelector(){return this.children[0];},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
  const elements={modal:element(),'modal-title':element(),'modal-body':element(),'modal-actions':element(),console:element()};
  const handlers={},context={$:id=>elements[id],document:{createElement:element},window:{addEventListener(type,fn){handlers[type]=fn;}},game:{paused:false,help:false},previousPaused:false,modalKind:null,clearInput(){},syncAudio(){},focusGame(){}};
  const modalStart=source.indexOf('  function closeModal()'),modalEnd=source.indexOf('  function pause()',modalStart);
  const keyStart=source.indexOf("  window.addEventListener('keydown'"),keyEnd=source.indexOf("  window.addEventListener('keyup'",keyStart);
  vm.createContext(context);vm.runInContext(source.slice(modalStart,modalEnd)+source.slice(keyStart,keyEnd),context);
  for(const kind of ['update','mobile']) {
    context.modal(kind,'NOTICE','Body',[['Dismiss',context.closeModal]]);
    assert.equal(context.game.paused,true);assert.equal(elements.modal.open,true);
    handlers.keydown({code:'Space',repeat:true,preventDefault(){}});assert.equal(elements.modal.open,true);
    handlers.keydown({code:'Space',repeat:false,preventDefault(){}});assert.equal(elements.modal.open,false);assert.equal(context.game.paused,false);
  }
  context.game.paused=true;context.modal('update','NOTICE','Body',[['Dismiss',context.closeModal]]);
  handlers.keydown({code:'Space',repeat:false,preventDefault(){}});assert.equal(context.game.paused,true,'An already paused game stays paused');
});

test('startup bypasses a stale entrypoint once and never runs a mixed release or enters a reload loop',async()=>{
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace("import('./js/app.mjs')","loadGame()");
  async function run(version,href='https://flyingfathead.github.io/cube-libre/',failure=false) {
    const nodes={'boot-text':{},reload:{hidden:true},'release-data':{textContent:JSON.stringify({edition:'web',version:'0.23.0'})},'release-components':{textContent:'[]'}},calls=[],redirects=[];
    const ctx={URL,AbortSignal,Date,console:{error(){}},document:{getElementById:id=>nodes[id],querySelectorAll:()=>[]},location:{href,protocol:'https:',replace:url=>redirects.push(url),reload(){}},
      fetch:async(url,options)=>{calls.push({url,options});if(failure)throw Error('offline');return {ok:true,json:async()=>({edition:'web',version})};},loadGame:async()=>{ctx.loaded=(ctx.loaded||0)+1;}};
    await vm.runInNewContext(script,ctx);return {ctx,nodes,calls,redirects};
  }
  let r=await run('0.24.0');assert.equal(r.ctx.loaded,undefined);assert.equal(r.redirects.length,1);
  const fresh=new URL(r.redirects[0]);assert.equal(fresh.pathname,'/cube-libre/');assert.equal(fresh.searchParams.get('release'),'0.24.0');
  assert.equal(r.calls[0].options.cache,'no-store');assert.equal(r.calls[0].url.pathname,'/cube-libre/version.json');
  r=await run('0.24.0',fresh.href);assert.equal(r.redirects.length,0);assert.equal(r.ctx.loaded,undefined);assert.equal(r.nodes.reload.hidden,false);assert.match(r.nodes['boot-text'].textContent,/deployment is still updating/);
  for(const [version,failure] of [['0.23.0',false],['0.22.1',false],['broken',false],[null,true]]) {
    r=await run(version,undefined,failure);assert.equal(r.ctx.loaded,1);assert.equal(r.ctx.CUBE_LIBRE_RELEASE.version,'0.23.0');assert.equal(r.redirects.length,0);
  }
});

test('a stale version cookie refreshes all components before boot, while failed refreshes and blocked cookies cannot cause reload loops',async()=>{
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  const release=JSON.parse(html.match(/<script id="release-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const components=JSON.parse(html.match(/<script id="release-components" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace("import('./js/app.mjs')","loadGame()");
  async function run({cookie='other-game=kept; cube-libre-web-version=0.29.2',blocked=false,offline=false,failComponent=false}={}) {
    const nodes={'boot-text':{},reload:{hidden:true},'release-data':{textContent:JSON.stringify(release)},'release-components':{textContent:JSON.stringify(components)}};
    const calls=[],writes=[],redirects=[],styles=[{href:'https://flyingfathead.github.io/cube-libre/style.css?v='+release.version}];
    const document={getElementById:id=>nodes[id],querySelectorAll:()=>styles};
    Object.defineProperty(document,'cookie',{get(){if(blocked)throw Error('Blocked');return cookie;},set(value){if(blocked)throw Error('Blocked');writes.push(value);}});
    const ctx={document,URL,AbortSignal,Date,console:{error(){}},location:{href:'https://flyingfathead.github.io/cube-libre/',protocol:'https:',replace:url=>redirects.push(url)},
      fetch:async(url,options)=>{calls.push({url,options});if(offline)throw Error('Offline');return url.pathname.endsWith('/version.json')?{ok:true,json:async()=>release}:{ok:!failComponent,arrayBuffer:async()=>new ArrayBuffer(0)};},
      loadGame:async()=>{ctx.loaded=true;assert.equal(calls.filter(c=>c.options.cache==='reload').length,offline||cookie.endsWith(release.version)?0:components.length);}};
    await vm.runInNewContext(script,ctx);return {ctx,calls,writes,redirects,nodes,styles};
  }
  for(const cookie of ['', 'cube-libre-web-version=invalid', 'other-game=kept; cube-libre-web-version=0.29.2']) {
    const r=await run({cookie});assert.equal(r.ctx.loaded,true);assert.equal(r.redirects.length,0);
    const refreshed=r.calls.filter(c=>c.options.cache==='reload');assert.equal(refreshed.length,components.length);
    assert.ok(refreshed.every(c=>c.url.searchParams.get('v')===release.version&&c.url.pathname.startsWith('/cube-libre/')));
    assert.match(r.writes[0],new RegExp('^cube-libre-web-version='+release.version.replaceAll('.','\\.')+'; Path=/cube-libre/;'));
    assert.match(r.writes[0],/SameSite=Lax; Secure$/);assert.ok(new URL(r.styles[0].href).searchParams.has('boot'));
  }
  let r=await run({cookie:'cube-libre-web-version='+release.version});assert.equal(r.ctx.loaded,true);assert.equal(r.calls.length,1);
  r=await run({blocked:true});assert.equal(r.ctx.loaded,true);assert.equal(r.redirects.length,0);assert.equal(r.writes.length,0);
  r=await run({offline:true});assert.equal(r.ctx.loaded,true);assert.equal(r.calls.length,1);assert.equal(r.writes.length,0);
  r=await run({failComponent:true});assert.equal(r.ctx.loaded,undefined);assert.equal(r.writes.length,0);assert.equal(r.redirects.length,0);assert.equal(r.nodes.reload.hidden,false);
});

test('release URLs cover transitive modules and assets while retaining the Pages project path',async()=>{
  const {readFileSync}=await import('node:fs'),{releaseAssetURL}=await import('../../web/js/updates.mjs');
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  const imports=JSON.parse(html.match(/<script id="release-imports" type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const release=JSON.parse(html.match(/<script id="release-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(html.indexOf('type="importmap"')<html.indexOf("import('./js/app.mjs')"));
  for(const path of ['./js/app.mjs','./js/core.mjs','./js/gamepad.mjs','./vendor/three.module.min.js','./vendor/three.core.min.js'])assert.equal(imports[path],`${path}?v=${release.version}`);
  for(const base of ['https://flyingfathead.github.io/cube-libre/js/app.mjs?v=0.23.0','http://localhost:8000/js/app.mjs?v=0.23.0']) {
    const url=releaseAssetURL('../assets/title-cells.json',base,'0.23.0');assert.equal(url.searchParams.get('v'),'0.23.0');assert.equal(url.origin,new URL(base).origin);
    assert.ok(url.pathname.endsWith('/assets/title-cells.json'));assert.equal(url.pathname.startsWith('/cube-libre/'),base.startsWith('https:'));
  }
});

test('top-right leg text reports the live leg and full route length, while bonus keeps its own label',async()=>{
  const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm'),{Game}=await import('../../web/js/core.mjs');
  const source=readFileSync(new URL('../../web/js/app.mjs',import.meta.url),'utf8');
  const line=source.split('\n').find(s=>s.includes("$('timer').textContent="));
  for(const [level,leg,bonus,expected] of [[5,0,false,'LEG 1/5'],[50,0,false,'LEG 1/50'],[50,49,false,'LEG 50/50'],[50,49,true,'BONUS']]) {
    const game=new Game({gameMode:50});game.ready(level);game.timedModule=leg;const timer={};
    vm.runInNewContext(line,{$:()=>timer,game,bonus,clock:10});assert.equal(timer.textContent,`10.0s\n${expected}`);
  }
});
