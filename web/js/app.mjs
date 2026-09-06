import {UpdateChecker,UPDATE_INTERVAL_MS} from './updates.mjs';
import {BONUS_SCHEDULE,PIECES_RULES} from './bonus.mjs';
const $=id=>document.getElementById(id);
function fail(error) {
  $('boot').hidden=false; $('boot-text').textContent=`Cube Libre could not start: ${error.message}. See the browser console for details.`;
  $('reload').hidden=false; $('reload').onclick=()=>location.reload(); console.error(error);
}
async function loadJSON(path) {const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}

async function main() {
  const [{Game,C,BALANCE,ASCENSION_TIMING,clamp,smooth,portalMetrics,openingLineOpacity},{Renderer,hsv},{GameAudio},titleCells,font,release]=await Promise.all([
    import('./core.mjs'),import('./render.mjs'),import('./audio.mjs'),loadJSON('../assets/title-cells.json'),loadJSON('../assets/fonts/cube_libre_5x7.json'),loadJSON('../version.json')
  ]);
  const updates=new UpdateChecker(release.version);let pendingUpdate=null,lastUpdateCheck=-Infinity;
  async function checkUpdates() {
    if(document.hidden||Date.now()-lastUpdateCheck<10000)return;
    lastUpdateCheck=Date.now();const version=await updates.check();if(version)pendingUpdate=version;
  }
  const versionLabel=`Web v${release.version} · Based on PyGame v${release.upstream.version}`;
  $('title-version').textContent=versionLabel;
  document.title=`Cube Libre · Web v${release.version}`;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));}catch{}};
  const raw=read('cube-libre-scores-v1',{}),stats={
    best_escape:clamp(Math.trunc(Number(raw?.best_escape)||0),0,125),highest_level:clamp(Math.trunc(Number(raw?.highest_level)||1),1,1000000),
    best_score:clamp(Math.trunc(Number(raw?.best_score)||0),0,Number.MAX_SAFE_INTEGER)};
  const game=new Game({stats,save:s=>write('cube-libre-scores-v1',s)});
  game.flags.shake=read('cube-libre-shake-v1',game.flags.shake)!==false;
  game.flags.spin=read('cube-libre-spin-v1',game.flags.spin)!==false;
  const renderer=new Renderer($('scene'),$('fx'),titleCells);
  const keyboard=new Set(),pointers=new Map();
  const clearInput=()=>{keyboard.clear();pointers.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));};
  let loadingStart=false,audioProgress='',audioWarning='',modalKind=null,previousPaused=false,consolePaused=false,raf=0;
  const audio=new GameAudio((done,total)=>{audioProgress=`Loading audio ${done}/${total}`;});
  audio.mute(read('cube-libre-muted-v1',false)===true);
  const focusGame=()=>{$('game').focus({preventScroll:true});};
  const syncAudio=()=>audio.pause(game.paused||game.help||document.hidden);
  async function start() {
    if(loadingStart) return;
    loadingStart=true; $('start').disabled=true;
    if(!audio.muted) {
      try {await audio.unlock();if(audio.failed.length)audioWarning=`${audio.failed.length} sound(s) unavailable; play continues.`;}
      catch {audioWarning='Audio unavailable. The game will play silently.';audio.mute(true);}
    }
    loadingStart=false;$('start').disabled=false;audioProgress='';clearInput();game.newRun();focusGame();syncAudio();
  }
  function closeModal() {
    if(!$('modal').open) return;
    $('modal').close(); modalKind=null; game.help=false; game.paused=previousPaused;clearInput();syncAudio();focusGame();
  }
  function modal(kind,title,body,actions) {
    if($('console').open) closeConsole();
    if($('modal').open) closeModal();
    previousPaused=game.paused;game.paused=true;game.help=kind==='help';modalKind=kind;clearInput();syncAudio();
    $('modal').dataset.kind=kind;
    $('modal-title').textContent=title; $('modal-body').replaceChildren(); $('modal-actions').replaceChildren();
    if(typeof body==='string') {const p=document.createElement('p');p.textContent=body;$('modal-body').append(p);} else $('modal-body').append(body);
    for(const [label,callback] of actions) {const b=document.createElement('button');b.textContent=label;b.onclick=callback;$('modal-actions').append(b);}
    $('modal').showModal();
    if(kind==='help') {
      body.querySelector('.keyboard-map-scroll')?.focus({preventScroll:true});
      $('modal').scrollTop=0;
    } else $('modal-actions').querySelector('button')?.focus();
  }
  function pause() {
    if(modalKind==='pause') return closeModal();
    if(game.state==='title') return;
    if(game.paused&&!$('modal').open&&!$('console').open) {game.paused=false;syncAudio();return;}
    modal('pause','PAUSED','Your remaining pieces can wait.',[['Resume (P)',closeModal],['Help',help],['Reset options',reset],['Main menu',menu]]);
  }
  function help() {
    if(modalKind==='help') return closeModal();
    const inBonus=game.state.startsWith('bonus_');
    const body=document.createElement('div');
    const shakeLabel=document.createElement('label');shakeLabel.className='shake-setting';
    const shakeToggle=document.createElement('input');shakeToggle.type='checkbox';shakeToggle.checked=game.flags.shake;
    shakeToggle.addEventListener('change',()=>{game.flags.shake=shakeToggle.checked;write('cube-libre-shake-v1',game.flags.shake);});
    shakeLabel.append(shakeToggle,'Shaking and heat flashes');body.append(shakeLabel);
    const spinLabel=document.createElement('label');spinLabel.className='shake-setting';
    const spinToggle=document.createElement('input');spinToggle.type='checkbox';spinToggle.checked=game.flags.spin;
    spinToggle.addEventListener('change',()=>{game.command(`spin ${spinToggle.checked}`);write('cube-libre-spin-v1',game.flags.spin);});
    spinLabel.append(spinToggle,'Player auto-rotation (normal levels)');body.append(spinLabel);
    if(inBonus) {
      const bonusHelp=document.createElement('p');bonusHelp.className='bonus-help';
      bonusHelp.textContent='BONUS ROUND: W / ↑ rolls toward the ramp, S / ↓ rolls back, A / D or ← / → rolls sideways. Hold Shift to rush. Touch loose pieces to collect them, then roll up the ramp into the portal before time runs out. The golden ring marks your body.';body.append(bonusHelp);
    }
    const p=document.createElement('p');p.textContent=inBonus?'BONUS CONTROLS · Recover what you can, then escape. Touching a loose piece collects it automatically.':'Reach the portal with as many of your 125 cubes as possible. The entire surviving body must enter. The view rotates; movement stays on the world axes.';body.append(p);
    const figure=document.createElement('figure');figure.className='keyboard-help';
    const map=document.createElement('div');map.className='keyboard-map-scroll';map.tabIndex=0;
    map.setAttribute('role','region');map.setAttribute('aria-label','Keyboard control map. Scroll sideways on smaller screens.');
    const diagram=document.createElement('img');
    diagram.src=(inBonus?new URL('../assets/keyboard-bonus-controls.svg',import.meta.url):new URL('../assets/keyboard-controls.svg',import.meta.url)).href;
    diagram.alt=inBonus?'Bonus keyboard map: WASD or arrows roll on the floor, W goes toward the ramp, Shift rushes. Collect pieces by contact. H help, P pause, M mute, Esc menu.':'Keyboard map: A/D move along X; W/S move along Y from level 3; Q/E move along Z. Hold Shift to rush, C to recover loose cubes, L to locate your cube. Space or Enter starts a run or advances a level. H opens help, P pauses, M mutes, and Esc opens the menu.';
    diagram.width=1040;diagram.height=590;map.append(diagram);figure.append(map);
    const caption=document.createElement('figcaption');caption.textContent=inBonus?'W / ↑ goes toward the ramp. S / ↓ rolls back. A / D or ← / → rolls sideways. Hold Shift to rush. The camera follows you.':'Hold the movement keys to move. Matching colors mark each pair. The view rotates, so these directions rotate on screen too. On small screens, scroll the keyboard sideways.';figure.append(caption);body.append(figure);
    const table=document.createElement('table');
    for(const [keys,action] of (inBonus?[
      ['W / S or ↑ / ↓','Roll forward toward the ramp / back'],['A / D or ← / →','Roll left / right'],
      ['Q / E','Alternate back / forward'],['Shift','Rush (10 units/s; normal roll speed 6 units/s)'],
      ['Touch loose pieces','Collect and rebuild automatically'],['Space / Enter','Continue after the result'],
      ['P / H','Pause / help'],['M','Mute / unmute'],['Esc','Main menu'],['` / Ctrl+Shift+F1','Debug console']
    ]:[
      ['Space / Enter','New run / next level'],['A / D or ← / →','Move along world X'],['W / S or ↑ / ↓','Move along world Y'],
      ['Q / E','Move along world Z (Q = +Z)'],['Ctrl + A / D','Alternate Z movement'],['Shift','Rush (2.6× speed)'],
      ['C','Re-couple: 5 requests per 10 seconds; loose cubes expire after 8 seconds'],['P / H','Pause / help'],['L','Locate camera; automatic from level 3'],
      ['M','Mute / unmute'],['Alt+F / Alt+Enter / F11','Fullscreen (or use the button)'],['Esc','Main menu confirmation'],
      ['Ctrl+Shift+F2','Reset run or retry current level'],['` / Ctrl+Shift+F1','Debug console']
    ])) {const tr=document.createElement('tr');for(const text of [keys,action]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}
    body.append(table);const q=document.createElement('p');q.textContent=`Level 3 opens the Y axis. Time starts at level ${BALANCE.timeStartLevel}: ${C.TIME_PER_LEG_SECONDS} seconds per leg, gradually tightening to ${BALANCE.minSecondsPerLeg} seconds by level ${BALANCE.capLevel}. TIME returns at levels ${BALANCE.timeReminderLevels.join(', ')} to announce the allowance. Entropy starts at level ${BALANCE.entropyStartLevel}: re-coupling yield drops from ${C.RECOUPLING_GATHER_RATE*100}% to ${C.ENTROPY_RECOUPLING_GATHER_RATE*100}% per request, then gradually to ${BALANCE.minRecouplingRate*100}% by level ${BALANCE.capLevel}. Both stop tightening there. Heat arrives at level ${BALANCE.entropyStartLevel+BALANCE.heatDelayLevels}: the out-of-bounds overheating grace period drops from ${C.BOUNDARY_OVERHEAT_SECONDS.toFixed(1)} to ${(C.BOUNDARY_OVERHEAT_SECONDS-BALANCE.overheatGraceReductionSeconds).toFixed(1)} seconds. Repeated requests can recover more pieces before they expire. Lost cubes cost 100 potential points each. Death rebuilds your current level; your run score stays.`;body.append(q);
    const bonusRules=document.createElement('p');bonusRules.textContent=`PICKING UP THE PIECES · Bonus round 001 follows level ${BONUS_SCHEDULE.firstLevel}, then every ${BONUS_SCHEDULE.interval} levels before the final level cap. Roll on a solid floor using WASD / arrow keys; Shift rushes. Collect the scattered pieces and take the ramp to the portal within ${PIECES_RULES.seconds} seconds. Each piece banks ${PIECES_RULES.pointsPerPiece} bonus points only if you escape. Running out of time forfeits this bonus; your existing score is kept and the next level follows. C and the corridor heat/entropy rules do not apply. Console: test bonus_round_1 previews the complete round.`;body.append(bonusRules);
    const rules=game.difficulty,current=document.createElement('p');
    current.textContent=`Level ${game.level}: ${rules.timed?`${rules.secondsPerLeg.toFixed(1)} seconds per leg`:'no timer'} · ${Math.round(rules.recouplingRate*100)}% re-coupling yield per request · ${rules.overheatGraceSeconds.toFixed(1)} seconds before overheating outside.`;body.append(current);
    const credits=document.createElement('p');credits.className='version-note';
    credits.append(`CUBE LIBRE v${release.version} | By FlyingFathead | `);
    const authorLink=document.createElement('a');authorLink.href='https://github.com/FlyingFathead';authorLink.textContent='github.com/FlyingFathead';authorLink.target='_blank';authorLink.rel='noopener';credits.append(authorLink);body.append(credits);
    const copyright=document.createElement('p');copyright.className='version-note';copyright.textContent='© 2024–2026 FlyingFathead';body.append(copyright);
    const version=document.createElement('p');version.className='version-note';version.textContent=`Web version · Based on PyGame v${release.upstream.version}`;body.append(version);
    modal('help','CUBE LIBRE · CONTROLS',body,[['Back to game (H)',closeModal]]);
  }
  function menu() {
    if(game.state==='title') {
      modal('quit','END SESSION?','You can close this browser tab, or stay for another run.',[['Stay (N / Esc)',closeModal],['End session (Y)',()=>{closeModal();audio.stopAll();audio.pause(true);game.setState('ended');}]]);
    } else modal('menu','EXIT TO MAIN MENU?','The current run will end. Your best escape and highest level are saved in this browser.',[
      ['Keep playing (N / Esc)',closeModal],['Main menu (Y)',()=>{closeModal();game.title();syncAudio();}]
    ]);
  }
  function reset() {
    modal('reset','RESET OPTIONS',`Current level: ${game.level} · Score: ${game.score}`,[
      ['Cancel (Esc)',closeModal],['1 · Start at level one',()=>{closeModal();game.newRun();syncAudio();}],
      ['2 · Retry current level',()=>{closeModal();game.ready(game.level);syncAudio();}]
    ]);
  }
  async function mute() {
    audio.mute();write('cube-libre-muted-v1',audio.muted);
    if(!audio.muted) {try{await audio.unlock();audioWarning=audio.failed.length?'Some audio could not load.':'';}catch{audioWarning='Audio unavailable. The game will play silently.';audio.mute(true);}}
    syncAudio();
  }
  async function fullscreen() {
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if($('game').requestFullscreen) await $('game').requestFullscreen();
      else audioWarning='Use your browser’s fullscreen option on this device.';
    } catch {audioWarning='Fullscreen was unavailable. Try the browser’s fullscreen option.';}
    clearInput();
  }
  const log=[];const history=[];let historyIndex=0;
  function consoleLog(text) {
    log.push(...String(text).split('\n'));if(log.length>120)log.splice(0,log.length-120);
    $('console-log').textContent=log.join('\n');$('console-log').scrollTop=$('console-log').scrollHeight;
  }
  function openConsole() {
    if($('modal').open) closeModal();
    consolePaused=game.paused;game.paused=true;clearInput();syncAudio();
    $('console').showModal();$('console-input').focus();
    if(!log.length) consoleLog('Cube Libre debug console. Type help for commands.');
  }
  function closeConsole() {if(!$('console').open)return;$('console').close();game.paused=consolePaused;clearInput();syncAudio();focusGame();}
  $('console-form').onsubmit=e=>{
    e.preventDefault();const value=$('console-input').value.trim();if(!value)return;
    history.push(value);historyIndex=history.length;$('console-input').value='';
    if(['clear','cls'].includes(value.toLowerCase())) {log.length=0;$('console-log').textContent='';return;}
    consoleLog(`> ${value}`);
    try {
      const previousShake=game.flags.shake,previousSpin=game.flags.spin;
      consoleLog(game.command(value));
      if(game.flags.shake!==previousShake)write('cube-libre-shake-v1',game.flags.shake);
      if(game.flags.spin!==previousSpin)write('cube-libre-spin-v1',game.flags.spin);
      if(/^(view_end_anim_v1|view_bonus_001|test\s+(ending_1|bonus_round_1)|bonus(?:\s+\S+)?)$/i.test(value)) { closeConsole();game.paused=false;game.help=false;syncAudio();focusGame();if(!audio.muted)audio.unlock().then(syncAudio,()=>{});return; }
    }catch(err){consoleLog(`ERROR: ${err.message}`);}
    // Commands that change state must still respect the open console's pause.
    game.paused=true;syncAudio();
  };
  $('console-input').addEventListener('keydown',e=>{
    if(e.code==='ArrowUp'||e.code==='ArrowDown') {e.preventDefault();historyIndex=clamp(historyIndex+(e.code==='ArrowUp'?-1:1),0,history.length);e.target.value=history[historyIndex]||'';}
    if(e.ctrlKey&&e.code==='KeyL') {e.preventDefault();log.length=0;$('console-log').textContent='';}
    if(e.code==='PageUp'||e.code==='PageDown') {e.preventDefault();$('console-log').scrollTop+=(e.code==='PageUp'?-1:1)*200;}
  });
  $('console-close').onclick=closeConsole;
  $('console').addEventListener('cancel',e=>{e.preventDefault();closeConsole();});
  $('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  $('start').onclick=start;$('next').onclick=()=>{clearInput();if(game.state==='ended')start();else game.continue();};
  $('pause').onclick=pause;$('help').onclick=help;$('mute').onclick=mute;$('fullscreen').onclick=fullscreen;$('menu').onclick=menu;
  $('locate').onclick=()=>{game.locate=!game.locate;game.messageSet(`LOCATE ${game.locate?'ON':'OFF'}${game.level>=3?' · AUTO TRACKING ACTIVE':''}`);};
  $('touch-c').onclick=()=>game.requestRecouple();
  const keyCodes=new Set(['KeyA','KeyD','KeyW','KeyS','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','ControlLeft','ControlRight']);
  window.addEventListener('keydown',e=>{
    const code=e.code;
    if(e.metaKey) return;
    if(['update','mobile'].includes(modalKind)&&code==='Space') {e.preventDefault();if(!e.repeat)closeModal();return;}
    if(code==='Backquote'||(e.ctrlKey&&e.shiftKey&&code==='F1')) {
      e.preventDefault();if(!e.repeat){if($('console').open)closeConsole();else openConsole();}return;
    }
    if($('console').open) return;
    if((e.altKey&&(code==='KeyF'||code==='Enter'))||code==='F11') {e.preventDefault();if(!e.repeat)fullscreen();return;}
    if($('modal').open) {
      if(e.repeat)return;
      if((code==='KeyH'&&modalKind==='help')||(code==='KeyP'&&modalKind==='pause')||code==='KeyN') {e.preventDefault();closeModal();}
      else if(code==='KeyY'&&['menu','quit'].includes(modalKind)) {$('modal-actions').lastElementChild.click();}
      else if(modalKind==='reset'&&['Digit1','Digit2'].includes(code)) {$('modal-actions').children[code==='Digit1'?1:2].click();}
      return;
    }
    if(e.ctrlKey&&e.shiftKey&&!e.altKey&&code==='F2') {e.preventDefault();if(!e.repeat)reset();return;}
    if(e.altKey) return;
    if(keyCodes.has(code)) {e.preventDefault();keyboard.add(code);return;}
    if(e.repeat)return;
    if(['Space','Enter'].includes(code)) {
      if(e.target instanceof HTMLButtonElement) return;
      e.preventDefault();if(game.state==='title')start();else if(game.state==='ended'){game.title();start();}else {clearInput();game.continue();}
    } else if(code==='KeyC') {e.preventDefault();game.requestRecouple();}
    else if(code==='KeyP')pause();else if(code==='KeyH')help();else if(code==='KeyM')mute();
    else if(code==='KeyL')$('locate').click();else if(code==='Escape'){e.preventDefault();menu();}
  });
  window.addEventListener('keyup',e=>keyboard.delete(e.code));
  window.addEventListener('blur',()=>{clearInput();if(game.state!=='title'&&game.state!=='ended'&&!game.paused)pause();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdates();if(document.hidden){clearInput();if(game.state!=='title'&&game.state!=='ended'&&!game.paused)pause();}syncAudio();});
  for(const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,button.dataset.key);button.classList.add('held');});
    const up=e=>{pointers.delete(e.pointerId);if(![...pointers.values()].includes(button.dataset.key))button.classList.remove('held');};
    button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  }
  $('scene').addEventListener('pointerdown',()=>focusGame());
  $('ending').addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();if(e.detail>1)return;
    clearInput();game.continue();focusGame();syncAudio();
  });
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();game.paused=true;syncAudio();cancelAnimationFrame(raf);fail(Error('The graphics context was lost. Reload to restart'));});
  window.addEventListener('resize',()=>renderer.resize());
  document.addEventListener('fullscreenchange',()=>{clearInput();renderer.resize();});

  function input() {
    const held=new Set([...keyboard,...pointers.values()]),has=(...keys)=>keys.some(k=>held.has(k));
    if(game.state.startsWith('bonus_'))return {x:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),z:Number(has('KeyS','ArrowDown','KeyQ'))-Number(has('KeyW','ArrowUp','KeyE')),rush:has('ShiftLeft','ShiftRight')};
    const ctrl=has('ControlLeft','ControlRight');
    let z=Number(has('KeyQ'))-Number(has('KeyE'));
    if(ctrl&&z===0)z=Number(has('KeyA','ArrowLeft'))-Number(has('KeyD','ArrowRight'));
    return {x:ctrl?0:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),
      y:Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown')),z,rush:has('ShiftLeft','ShiftRight')};
  }
  let dotsSize='';
  function dots(text,t) {
    const canvas=$('start-dots'),width=canvas.clientWidth,height=canvas.clientHeight,ratio=Math.min(devicePixelRatio||1,2),size=`${width},${height},${ratio}`;
    if(dotsSize!==size){canvas.width=width*ratio;canvas.height=height*ratio;dotsSize=size;}
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const pitch=Math.min(4.4,width/(text.length*6+2),height/10),left=(width-(text.length*6-1)*pitch)/2,top=(height-7*pitch)/2;
    const col=hsv(t*.10,.55,1).map(n=>Math.round(n*255));ctx.fillStyle=`rgb(${col.join(',')})`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=5;
    ctx.globalAlpha=.72+.28*Math.sin(t*4);
    [...text].forEach((ch,i)=>(font.glyphs[ch]||font.glyphs['?']).forEach((row,y)=>[...row].forEach((bit,x)=>{
      if(bit==='1'){ctx.beginPath();ctx.arc(left+(i*6+x+.5)*pitch,top+(y+.5)*pitch,pitch*.35,0,Math.PI*2);ctx.fill();}
    })));
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
  let lastHUD=-1;
  let lastSummary=null,lastBonusControls=null;
  const openingLines=[...document.querySelectorAll('#opening p')];
  function ui() {
    if(pendingUpdate&&!document.hidden&&!loadingStart&&!$('modal').open&&!$('console').open) {
      const version=pendingUpdate;pendingUpdate=null;
      const body=document.createElement('div'),instructions=document.createElement('p'),versions=document.createElement('p');
      instructions.className='update-instructions';instructions.textContent='PRESS F5 / REFRESH TO RELOAD\nSPACE BAR TO DISMISS.';
      versions.className='version-note';versions.textContent=`Updated version: ${version}\nThis version: ${release.version}`;
      body.append(instructions,versions);
      modal('update','THIS GAME HAS BEEN UPDATED',body,[['Dismiss (Space)',closeModal],['Refresh / reload',()=>location.reload()]]);
    }
    const s=game.state,title=s==='title',playing=s==='playing',preview=s==='course_materialize';
    const bonus=s.startsWith('bonus_'),bonusPlaying=s==='bonus_playing',bonusIntro=s==='bonus_intro',bonusResult=s==='bonus_result';
    const clock=bonus?game.bonus.timeLeft:game.legTime;
    const opening=s==='opening_intro';
    const ending=['ascension','ascension_white','ascension_title','run_summary'].includes(s);
    $('opening').hidden=!opening;
    $('bottom-ui').hidden=opening||ending;
    $('ending').hidden=!(s==='ascension_title'||s==='run_summary');
    $('ascension-copy').hidden=s!=='ascension_title';
    $('run-summary').hidden=s!=='run_summary';
    $('ending-next').hidden=!(s==='ascension_title'&&game.stateTime>=ASCENSION_TIMING.continueAfter||s==='run_summary'&&game.stateTime>=ASCENSION_TIMING.summaryInputDelay);
    $('ending-next').textContent=s==='run_summary'?'Space / Enter / click to return to the main menu':'Space / Enter / click to see your stats';
    if(s==='ascension_title') {
      $('ascension-title').style.opacity=String(smooth(game.stateTime/ASCENSION_TIMING.titleFadeSeconds));
      $('ascension-subtitle').style.opacity=String(smooth((game.stateTime-ASCENSION_TIMING.subtitleStarts)/ASCENSION_TIMING.subtitleFadeSeconds));
    }
    if(s==='run_summary'&&game.runSummary!==lastSummary) {
      lastSummary=game.runSummary;
      const r=lastSummary,total=Math.floor(r.playSeconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
      const duration=`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      const rows=[['Total score',r.score.toLocaleString()],['Best score',r.bestScore.toLocaleString()],
        ['Levels cleared this run',`${r.levelsCleared} / ${BALANCE.levelCap}`],['Final level',r.finalLevel],
        ['Cubes at the final portal',`${r.finalCubes} / 125`],['Best escape',`${r.bestEscape} / 125`],
        ['Time in play',duration],['Deaths / reassemblies',r.deaths],['Pieces re-coupled',r.recoupledCubes],
        ['Bonus rounds played',r.bonusRounds],['Bonus pieces banked',r.bonusPieces],['Bonus points',r.bonusScore.toLocaleString()]];
      $('summary-values').replaceChildren(...rows.flatMap(([label,value])=>{
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);return [dt,dd];
      }));
    }
    if(opening) openingLines.forEach((line,i)=>{line.style.opacity=String(openingLineOpacity(game.stateTime,i));});
    // Use the leg clock, including resets, instead of a separate countdown timer.
    // Update visibility before the slower HUD refresh so transitions clear it immediately.
    const timed=bonusPlaying||playing&&game.difficulty.timed;
    const urgent=timed&&clock>0&&clock<=10;
    const countdown=$('countdown');
    countdown.hidden=!urgent;
    $('timer').hidden=!timed;
    $('time-reset').hidden=!(timed&&!bonus&&game.timeResetNotice>0);
    $('time-reset').style.animationPlayState=game.paused||game.help||document.hidden?'paused':'running';
    if(urgent) {
      const seconds=Math.ceil(clock);
      const text=`ONLY ${seconds} ${seconds===1?'SECOND':'SECONDS'} LEFT!`;
      if($('countdown-text').textContent!==text) {
        $('countdown-text').textContent=text;
        countdown.style.setProperty('--countdown-period',`${.45+(seconds-1)*.09}s`);
      }
      countdown.classList.toggle('critical',seconds<=3);
      countdown.classList.toggle('is-paused',game.paused||game.help||document.hidden);
    }
    $('title').hidden=!title;$('hud').hidden=!(playing||preview||bonusPlaying);$('toolbar').hidden=s==='ended';
    for(const id of ['pause','locate','menu'])$(id).hidden=title;
    $('mute').textContent=audio.muted?'Sound off':'Sound on';$('mute').setAttribute('aria-pressed',String(audio.muted));
    $('locate').hidden=title||bonus;
    $('bonus-instructions').hidden=!bonusPlaying;
    if(lastBonusControls!==bonus) {
      lastBonusControls=bonus;
      for(const key of ['KeyW','KeyS','KeyQ','KeyE']) {
        const button=document.querySelector(`[data-key="${key}"]`);
        button.hidden=bonus&&['KeyQ','KeyE'].includes(key);
        const label=key==='KeyW'?(bonus?'W Forward':'W +Y'):key==='KeyS'?(bonus?'S Back':'S −Y'):key==='KeyQ'?'Q +Z':'E −Z';
        button.textContent=label;button.setAttribute('aria-label',label);
      }
      $('touch-c').hidden=bonus;
    }
    $('locate').setAttribute('aria-pressed',String(game.locate||game.level>=3));
    $('pause').textContent=game.paused?'Resume':'Pause';
    $('fullscreen').textContent=document.fullscreenElement?'Windowed':'Fullscreen';
    $('touch-controls').hidden=!((playing||bonusPlaying)&&matchMedia('(pointer: coarse)').matches&&!game.paused);
    $('audio-status').textContent=loadingStart?audioProgress:audioWarning;
    if(title) {
      dots(loadingStart?'LOADING AUDIO - PLEASE WAIT':'SPACE / ENTER = NEW RUN',game.t);
      $('title-stats').textContent=`Score ${game.score} · Best escape ${game.stats.best_escape}/125 · Highest level ${game.stats.highest_level}`;
    }
    const phase=s.endsWith('_intro')&&!opening&&!bonusIntro,ready=s==='level_ready',result=s==='result_overlay',rebuild=s==='reassembly',ended=s==='ended';
    $('card').hidden=!(phase||ready||result||rebuild||ended||bonusIntro||bonusResult);
    $('card').className=ready?'ready':rebuild?'rebuilding':ended?'ready':'';
    $('card').style.color='';$('card').style.opacity='1';$('card-subtitle').style.opacity='1';$('card-detail').style.opacity='1';$('next').hidden=!(result||ended||bonusResult);$('next').textContent=ended?'Start a new run':'Space / Enter = next level';
    if(bonusIntro) {
      const t=game.stateTime,fade=1-smooth((t-4.3)/.7);
      $('card-title').textContent=game.bonus.name;
      $('card-subtitle').textContent='BONUS ROUND';
      $('card-detail').textContent=`${game.bonus.duration} SECONDS · RECOVER YOUR PIECES\nROLL UP THE RAMP. REACH THE PORTAL.`;
      $('card').style.opacity=String(smooth(t/1.1)*fade);
      $('card-subtitle').style.opacity=String(smooth((t-1.1)/1.1));
      $('card-detail').style.opacity=String(smooth((t-2.1)/1.1));
    } else if(bonusResult) {
      const b=game.bonus,escaped=b.result==='escaped';
      $('card-title').textContent=escaped?'PIECES RECOVERED':'TIME RAN OUT';
      $('card-subtitle').textContent=`${b.collected} / ${b.rules.pieces} PIECES ${escaped?'BROUGHT HOME':'LEFT BEHIND'}`;
      $('card-detail').textContent=game.bonusPreview?`TEST ROUND · ${escaped?b.potentialScore:0} POINTS (NOT AWARDED)\nNEXT: LEVEL ${game.previewReturn.nextLevel}`:`BONUS +${escaped?b.potentialScore:0} · TOTAL ${game.score}\n${escaped?'YOU KEPT WHAT YOU COULD.':'YOUR JOURNEY CONTINUES.'}`;
      $('next').textContent=game.bonusPreview?`Space / Enter / click for level ${game.previewReturn.nextLevel}`:'Space / Enter / click for the next level';
      $('next').hidden=game.stateTime<.4;
    } else if(phase) {
      $('card-title').textContent={space_intro:'SPACE ...',time_intro:'TIME ...',entropy_intro:'ENTROPY ...',heat_intro:'HEAT ...'}[s];
      $('card-subtitle').textContent={space_intro:'WORLD Y AXIS OPENS FROM HERE',
        time_intro:`${game.difficulty.secondsPerLeg.toFixed(1)} SECONDS PER LEG\n${game.level===BALANCE.timeStartLevel?'THE CLOCK STARTS NOW':game.level>=BALANCE.capLevel?'THE FINAL TIME LIMIT':'THE CLOCK TIGHTENS'}`,
        entropy_intro:`${Math.round(game.difficulty.recouplingRate*100)}% RE-COUPLING YIELD PER REQUEST\nFALLING TO ${BALANCE.minRecouplingRate*100}% BY LEVEL ${BALANCE.capLevel}`,
        heat_intro:`OVERHEATING AFTER ${game.difficulty.overheatGraceSeconds.toFixed(1)} SECONDS\nOUTSIDE THE CORRIDOR`}[s];
      $('card-detail').textContent=s==='heat_intro'?`PREVIOUSLY ${C.BOUNDARY_OVERHEAT_SECONDS.toFixed(1)} SECONDS`:'';$('card').style.opacity=String(smooth(game.stateTime/1.1)*(1-smooth((game.stateTime/5-.86)/.14)));
    } else if(ready) {
      const rules=game.difficulty;
      $('card-title').textContent=`LEVEL ${game.level}`;$('card-subtitle').textContent='GET READY';
      $('card-detail').textContent=rules.timed?`${rules.secondsPerLeg.toFixed(1)} SECONDS PER LEG\n${Math.round(rules.recouplingRate*100)}% RE-COUPLING YIELD PER REQUEST${rules.heat?`\nOVERHEATING AFTER ${rules.overheatGraceSeconds.toFixed(1)} SECONDS OUTSIDE`:""}`:'';
      const color=hsv(game.level*.17,.55,1).map(v=>Math.round(v*255));$('card').style.color=`rgb(${color.join(',')})`;
      $('card').style.opacity=String(smooth(game.stateTime/.95));
    } else {
      $('card').style.color='';
      if(result) {
        $('card-title').textContent='TRANSCENDENCE';$('card-subtitle').textContent=`LEVEL ${game.completedLevel} COMPLETE\nCUBES INTACT: ${game.lastEscape}/125 (${Math.round(game.lastEscape/125*100)}%)`;
        $('card-detail').textContent=`SCORE +${game.lastEscape*100} · TOTAL ${game.score}\nBEST ESCAPE ${game.stats.best_escape}/125 · HIGHEST LEVEL ${game.stats.highest_level}`;
        $('card').style.opacity=String(1-smooth((game.stateTime/4.25-.56)/.40));
      } else if(rebuild) {
        $('card-title').textContent=game.stateTime>3.25?'REASSEMBLED':'REASSEMBLY IN PROGRESS';$('card-subtitle').textContent='';$('card-detail').textContent='';
      } else if(ended) {
        $('card-title').textContent='SESSION ENDED';$('card-subtitle').textContent='You can close this tab.';$('card-detail').textContent='Space / Enter = new run';
      }
    }
    if(lastHUD>=0&&performance.now()-lastHUD<100)return;lastHUD=performance.now();
    const n=game.player.alive.size;
    $('cube-count').textContent=`LVL ${String(game.level).padStart(2,'0')} · CUBES ${String(n).padStart(3,'0')}/125`;
    $('score').textContent=`INTEGRITY ${(n/125*100).toFixed(1)}% · SCORE ${game.score}`;
    $('records').textContent=`BEST ESCAPE ${game.stats.best_escape}/125 · HIGHEST LEVEL ${game.stats.highest_level}`;
    $('integrity-warning').textContent=n<=18?'CRITICAL: STRUCTURE FAILING':n<=42?'WARNING: STRUCTURE FAILING':'';
    if(bonusPlaying) {
      const b=game.bonus;
      $('cube-count').textContent='BONUS ROUND 001';
      $('score').textContent=`PIECES ${b.collected} / ${b.rules.pieces} · BONUS ${b.potentialScore}`;
      $('records').textContent=game.bonusPreview?'PREVIEW · Reach the portal to finish':'Reach the portal to bank your bonus';
      $('integrity-warning').textContent='';
    }
    $('timer').textContent=`${clock.toFixed(1)}s\n${bonus?'BONUS':`LEG ${game.timedModule+1}`}`;
    const timeUrgency=1-clamp(clock/10);
    $('timer').style.color=`hsl(${48*(1-timeUrgency)}, 100%, ${85-30*timeUrgency}%)`;
    $('notice').textContent=playing&&game.messageTime>0?game.message:preview?'COURSE MATERIALIZING':'';
    const fragments=game.player.fragments,remaining=fragments.length?Math.min(...fragments.map(f=>8-f.age)):0;
    const recovering=game.recoupling.length>0;
    $('recovery').hidden=!(playing&&(fragments.length||recovering||game.cooldown>0));
    $('recovery').textContent=game.cooldown>0?`RE-COUPLING ON COOLDOWN · ${game.cooldown.toFixed(1)}s`:recovering?`RE-COUPLING ${game.recoupling.length} CELLS · ${Math.round(clamp(game.recoupleTime/1.18)*100)}%`:
      `${remaining<1.75?'LAST CHANCE! ':''}PRESS C TO RE-COUPLE · ${fragments.length} LOOSE\nCELLS EXPIRING IN ${remaining.toFixed(1)}s`;
    $('danger').hidden=!(playing&&game.outside);$('danger').className=game.heat>0?'hot':'';
    $('danger').textContent=game.heat>0?'OVERHEATING · RETURN TO COURSE':'DANGER · OUT OF BOUNDS';
  }
  $('boot').hidden=true;focusGame();
  const mobileBrowser=navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1;
  if(mobileBrowser) {
    let seen=false;try{seen=sessionStorage.getItem('cube-libre-mobile-notice')==='1';sessionStorage.setItem('cube-libre-mobile-notice','1');}catch{}
    if(!seen)modal('mobile','MOBILE BROWSER DETECTED','THIS GAME SHOULD BE PLAYED\nON A DESKTOP COMPUTER\n\nBUT HAVE IT YOUR WAY...\n\nPRESS SPACE TO CONTINUE',[['TAP HERE TO CONTINUE',closeModal]]);
  }
  checkUpdates();setInterval(checkUpdates,UPDATE_INTERVAL_MS);
  // Fixed simulation steps preserve laser collision and quota timing on high-refresh displays.
  // A background tab pauses instead of accruing catch-up damage or timer loss.
  let previous=performance.now(),accumulator=0;
  function frame(now) {
    try {
      const dt=Math.min((now-previous)/1000,.1);previous=now;
      if(game.paused||document.hidden)accumulator=0;
      else {accumulator+=dt;while(accumulator>=1/120){game.tick(1/120,input());accumulator-=1/120;}}
      audio.update(game);renderer.render(game);ui();raf=requestAnimationFrame(frame);
    } catch(error) {game.paused=true;audio.pause(true);fail(error);}
  }
  raf=requestAnimationFrame(frame);
}
main().catch(fail);
