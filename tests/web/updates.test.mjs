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
  const element=()=>({open:false,dataset:{},children:[],textContent:'',append(...xs){this.children.push(...xs);},replaceChildren(){this.children=[];},querySelector(){return this.children[0];},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
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
