import {CheckpointStore,RESUME_TIMING} from './save-game.mjs';
import {MobileControls,detectMobile,MOBILE_NOTICE,createTouchHelp,createMobileOptions} from './mobile.mjs';
import {createHelpTabs,createVisualOptions} from './help-tabs.mjs';
import {GamepadInput,emptyMovement,mergeMovement,navigateControllerMenu} from './gamepad.mjs';
import {shutterGateCount,shutterInterval,shutterStepInterval} from './changes.mjs';
import {UpdateChecker,UPDATE_INTERVAL_MS,releaseAssetURL} from './updates.mjs';
import {BONUS_SCHEDULE,PIECES_RULES} from './bonus.mjs';
import {observeTitleLayout} from './title-layout.mjs';
import {featuresForSettings,introductionCard} from './difficulty.mjs';
const $=id=>document.getElementById(id);
function fail(error) {
  $('boot').hidden=false; $('boot-text').textContent=`Cube Libre could not start: ${error.message}. See the browser console for details.`;
  $('reload').hidden=false; $('reload').onclick=()=>location.reload(); console.error(error);
}
async function loadJSON(path) {const r=await fetch(releaseAssetURL(path,import.meta.url));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}

async function main() {
  const [{Game,C,BALANCE,ASCENSION_TIMING,THANK_YOU_TIMING,thankYouOpacity,clamp,smooth,portalMetrics,openingLineOpacity},{Renderer,hsv},{GameAudio},titleCells,font,release]=await Promise.all([
    import('./core.mjs'),import('./render.mjs'),import('./audio.mjs'),loadJSON('../assets/title-cells.json'),loadJSON('../assets/fonts/cube_libre_5x7.json'),globalThis.CUBE_LIBRE_RELEASE||loadJSON('../version.json')
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
  // Old records belong exclusively to the original 50-level campaign. Reading
  // never writes; each later record update retains both modes in the new key.
  const raw=read('cube-libre-scores-v1',{}),savedRecords=read('cube-libre-mode-scores-v1',{});
  const modeRecords={20:savedRecords?.[20]||{},50:savedRecords?.[50]||raw};
  const campaignStore=new CheckpointStore(()=>localStorage);
  const game=new Game({modeRecords,save:(s,mode)=>{modeRecords[mode]=s;write('cube-libre-mode-scores-v1',modeRecords);},saveCheckpoint:data=>campaignStore.save(data)});
  game.flags.panic_show_inactive=read('cube-libre-panic-show-inactive-v1',game.flags.panic_show_inactive)!==false;
  game.flags.panic=read('cube-libre-panic-v1',game.flags.panic)!==false;
  game.flags.shake=read('cube-libre-shake-v1',game.flags.shake)!==false;
  game.flags.spin=read('cube-libre-spin-v1',game.flags.spin)!==false;
  game.flags.portal_white_light=read('cube-libre-portal-white-light-v1',game.flags.portal_white_light)!==false;
  game.flags.culling=read('cube-libre-culling-v1',game.flags.culling)!==false;
  game.flags.rotation_shocks=read('cube-libre-rotation-shocks-v1',game.flags.rotation_shocks)!==false;
  game.flags.microgravity=read('cube-libre-microgravity-v1',game.flags.microgravity)!==false;
  game.flags.overheat_blocks_recoupling=read('cube-libre-overheat-blocks-recoupling-v1',game.flags.overheat_blocks_recoupling)!==false;
  game.flags.change_1=read('cube-libre-change-1-v1',game.flags.change_1)!==false;
  game.flags.change_1_random_per_leg=read('cube-libre-change-1-random-per-leg-v1',game.flags.change_1_random_per_leg)!==false;
  game.flags.change_1_no_repeat_leg=read('cube-libre-change-1-no-repeat-leg-v1',game.flags.change_1_no_repeat_leg)!==false;
  for(const key of ['change_2','change_3','change_4','change_4_pattern','loss','loss_grey','route_outline','end_portal'])game.flags[key]=read(`cube-libre-${key.replaceAll('_','-')}-v1`,game.flags[key])!==false;
  game.flags.preview_outline=read('cube-libre-preview-outline-v1',game.flags.preview_outline)!==false;
  const savedStarPattern=read('cube-libre-star-pattern-v1',game.starPattern);
  if(Number.isInteger(savedStarPattern)&&savedStarPattern>=0&&savedStarPattern<=2)game.starPattern=savedStarPattern;
  const renderer=new Renderer($('scene'),$('fx'),titleCells);
  const controller=new GamepadInput();
  controller.enabled=read('cube-libre-controller-v1',true)!==false;
  try{controller.setDeadzone(read('cube-libre-controller-deadzone-v1',controller.deadzone));}catch{}
  let controllerMovement=emptyMovement(),controllerAction=false,controllerAudioPending=false;
  game.consoleSettings.controller={get:()=>controller.enabled,set:value=>{controller.enabled=value;controller.suspend();controllerMovement=emptyMovement();write('cube-libre-controller-v1',value);}};
  game.consoleNumbers.controller_deadzone={get:()=>controller.deadzone,set:value=>{const n=controller.setDeadzone(value);controllerMovement=emptyMovement();write('cube-libre-controller-deadzone-v1',n);return n;}};
  const keyboard=new Set(),pointers=new Map();let mobile=null;
  const clearInput=()=>{mobile?.reset();controller.suspend();controllerMovement=emptyMovement();keyboard.clear();pointers.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));};
  let loadingStart=false,audioProgress='',audioWarning='',modalKind=null,previousPaused=false,consolePaused=false,raf=0;
  const audio=new GameAudio((done,total)=>{audioProgress=`Loading audio ${done}/${total}`;});
  audio.mute(read('cube-libre-muted-v1',false)===true);
  game.consoleSettings.mute={get:()=>audio.muted,set:value=>{void mute(value);}};
  const focusGame=()=>{$('game').focus({preventScroll:true});};
  const syncAudio=()=>audio.pause(game.paused||game.help||document.hidden);
  const mobileBrowser=detectMobile();
  mobile=new MobileControls({document,game,renderer,detected:mobileBrowser,read,write,focus:focusGame});
  game.consoleSettings.touch_helpers={get:()=>mobile.helpers,set:value=>mobile.setHelpers(value),name:'Extra touch areas',description:'Show optional drag/depth thumb areas alongside the cube orb. Saved; off by default.'};
  game.consoleNumbers.mobile_mode={get:()=>mobile.mode,set:value=>mobile.setMode(value),name:'Mobile input mode',description:'0 automatic, 1 touch beta, 2 keyboard/controller. Saved in this browser.'};
  for(const [key,property,min,max] of [['touch_rush_radius','rushRadius',38,140],['touch_deadzone','deadzone',0,24],['touch_grab_radius','grabRadius',24,100],['mobile_pixel_ratio','pixelRatio',.5,2]]) {
    game.consoleNumbers[key]={get:()=>mobile.rules[property],set:value=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${key} expects ${min}–${max}`);mobile.rules[property]=n;mobile.reset();if(property==='pixelRatio')mobile.applyMode();return n;}};
  }
  async function start(options={}) {
    const fromController=options.controller===true||controllerAction;
    if(loadingStart) return;
    loadingStart=true; $('start').disabled=true;
    if(!audio.muted&&(fromController||mobile?.enabled)) {
      // Start touch play without waiting for mobile audio downloads. Gamepads may
      // also need a later pointer/keyboard gesture to unlock the audio context.
      controllerAudioPending=true;audioWarning=fromController?'Click the game or press a keyboard key once to enable sound.':'Sound is loading; tap the game if it stays silent.';
      void audio.unlock().then(()=>{controllerAudioPending=false;audioWarning=audio.failed.length?'Some audio could not load.':'';syncAudio();},()=>{controllerAudioPending=false;audioWarning='Audio unavailable. The game will play silently.';});
    } else if(!audio.muted) {
      try {await audio.unlock();if(audio.failed.length)audioWarning=`${audio.failed.length} sound(s) unavailable; play continues.`;}
      catch {audioWarning='Audio unavailable. The game will play silently.';audio.mute(true);}
    }
    loadingStart=false;$('start').disabled=false;audioProgress='';clearInput();
    if(options.resume===true)game.resumeCheckpoint(campaignStore.value);else game.newRun();
    focusGame();syncAudio();
  }
  function startOrContinue(options={}) {
    return start({...options,resume:!!campaignStore.value});
  }
  function requestNewRun() {
    if(!campaignStore.value){void start();return;}
    modal('new-run','START A NEW RUN?',`Your saved journey at level ${campaignStore.value.level} will be replaced.`,[
      ['Keep saved run',closeModal],['Start new run',()=>{closeModal();void start();}]
    ]);
  }
  function unlockControllerAudio() {
    if(!controllerAudioPending)return;
    controllerAudioPending=false;
    void audio.unlock().then(()=>{audioWarning=audio.failed.length?'Some audio could not load.':'';syncAudio();},()=>{audioWarning='Audio unavailable. The game will play silently.';});
  }
  window.addEventListener('pointerdown',unlockControllerAudio,{capture:true});
  window.addEventListener("keydown",unlockControllerAudio,{capture:true});
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
      body.querySelector('[role="tab"][aria-selected="true"]')?.focus({preventScroll:true});
      $('modal').scrollTop=0;
    } else $('modal-actions').querySelector('button')?.focus();
  }
  function pause() {
    if(modalKind==='pause') return closeModal();
    if(game.state==='title') return;
    if(game.paused&&!$('modal').open&&!$('console').open) {game.paused=false;syncAudio();return;}
    modal('pause','PAUSED','Your remaining pieces can wait.',[['Resume (P)',closeModal],['Help',help],['Restart / retry',reset],['Main menu',menu]]);
  }
  function controllerHelp(inBonus) {
    const section=document.createElement('section');section.className='controller-help';
    const heading=document.createElement('h3');heading.textContent='XBOX-STYLE CONTROLLER';section.append(heading);
    const intro=document.createElement('p');intro.textContent=inBonus?'BONUS: left stick or D-pad rolls on the floor; RB rushes. Pieces are collected automatically.':'Left stick or D-pad moves on world X/Y; LT / RT moves on Z. LB re-couples without lifting your movement thumb; X also re-couples. RB rushes. B activates Panic during any normal leg.';section.append(intro);
    const figure=document.createElement('figure');figure.className='keyboard-help';
    const map=document.createElement('div');map.className='keyboard-map-scroll controller-map-scroll';map.tabIndex=0;map.setAttribute('role','region');map.setAttribute('aria-label','Controller map. Scroll sideways on smaller screens.');
    const image=document.createElement('img');image.src=releaseAssetURL('../assets/controller-controls.svg',import.meta.url).href;image.width=1040;image.height=650;
    image.alt='Xbox-style controller map: left stick moves X/Y or rolls in bonus. LT +Z, RT minus Z in normal levels. LB or X re-couples. RB rushes. A starts or confirms, B activates Panic during normal play and backs out in menus, Y locates the camera, View opens Help, Menu pauses. D-pad moves or selects menu items; right stick scrolls menus.';
    map.append(image);figure.append(map);section.append(figure);
    const table=document.createElement('table');
    for(const [key,action] of [
      ['Left stick / D-pad',inBonus?'Roll across the floor; up goes toward the ramp':'Move X/Y; up = +Y, right = +X'],
      ['LT / RT',inBonus?'Unused during bonus rolling':'Move +Z / −Z (analog triggers)'],
      ['LB / X',inBonus?'Pieces are collected by contact':'Re-couple on each press'],['RB','Hold to rush'],
      ['A','Start / confirm / continue'],['B',inBonus?'Back / main menu':'Panic rescue during play; Back in menus'],['Y','Locate camera'],
      ['Menu / Start','Pause / resume'],['View / Back','Help'],
      ['D-pad / left stick in menus','Select buttons and settings; A activates the selection'],['Right stick in menus','Scroll Help and other dialogs']
    ]) {const row=document.createElement('tr');for(const text of [key,action]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}table.append(row);}section.append(table);
    const hint=document.createElement('p');hint.textContent='Connect your controller by USB or Bluetooth, focus this page, and press then release a controller button. Firefox exposes controllers after you interact with them. Use an Xbox-style controller recognized by the browser. If sound stays silent, click the game or press a keyboard key once.';section.append(hint);
    return section;
  }
  function help(section='') {
    if(modalKind==='help') return closeModal();
    const inBonus=game.state.startsWith('bonus_');
    const body=document.createElement('div'),keyboardBody=document.createElement('div');
    if(inBonus) {
      const bonusHelp=document.createElement('p');bonusHelp.className='bonus-help';
      bonusHelp.textContent='BONUS ROUND: W / ↑ rolls toward the ramp, S / ↓ rolls back, A / D or ← / → rolls sideways. Hold Shift to rush. Touch loose pieces to collect them, then roll up the ramp into the portal before time runs out. The golden ring marks your body.';keyboardBody.append(bonusHelp);
    }
    const p=document.createElement('p');p.textContent=inBonus?'BONUS CONTROLS · Recover what you can, then escape. Touching a loose piece collects it automatically.':'Reach the portal with as many of your 125 cubes as possible. The entire surviving body must enter. The view rotates; movement stays on the world axes.';keyboardBody.append(p);
    if(!inBonus) {const propulsionHelp=document.createElement('p');propulsionHelp.textContent='With microgravity enabled, hold movement keys to build speed, release to coast, and steer in the opposite direction to brake. Shift increases your top speed.';keyboardBody.append(propulsionHelp);}
    const figure=document.createElement('figure');figure.className='keyboard-help';
    const map=document.createElement('div');map.className='keyboard-map-scroll';map.tabIndex=0;
    map.setAttribute('role','region');map.setAttribute('aria-label','Keyboard control map. Scroll sideways on smaller screens.');
    const diagram=document.createElement('img');
    diagram.src=(inBonus?releaseAssetURL('../assets/keyboard-bonus-controls.svg',import.meta.url):releaseAssetURL('../assets/keyboard-controls.svg',import.meta.url)).href;
    diagram.alt=inBonus?'Bonus keyboard map: WASD or arrows roll on the floor, W goes toward the ramp, Shift rushes. Collect pieces by contact. H help, P pause, M mute, Esc menu.':'Keyboard map: A/D move along X; W/S move along Y from SPACE; Q/E move along Z. Hold Shift to rush, C to recover loose cubes, V for Panic, L to locate your cube. Space or Enter starts a run or advances a level. H opens help, P pauses, M mutes, and Esc opens the menu.';
    diagram.width=1040;diagram.height=590;map.append(diagram);figure.append(map);
    const caption=document.createElement('figcaption');caption.textContent=inBonus?'W / ↑ goes toward the ramp. S / ↓ rolls back. A / D or ← / → rolls sideways. Hold Shift to rush. The camera follows you.':'Hold the movement keys to move. Matching colors mark each pair. The view rotates, so these directions rotate on screen too. On small screens, scroll the keyboard sideways.';figure.append(caption);keyboardBody.append(figure);
    const table=document.createElement('table');
    for(const [keys,action] of (inBonus?[
      ['W / S or ↑ / ↓','Roll forward toward the ramp / back'],['A / D or ← / →','Roll left / right'],
      ['Q / E','Alternate back / forward'],['Shift','Rush (10 units/s; normal roll speed 6 units/s)'],
      ['Touch loose pieces','Collect and rebuild automatically'],['Space / Enter','Continue after the result'],
      ['P / H','Pause / help'],['M','Mute / unmute'],['Esc','Main menu'],['` / Ctrl+Shift+F1','Debug console']
    ]:[
      ['Space / Enter','Continue saved run / new run / next level'],['A / D or ← / →','Move along world X'],['W / S or ↑ / ↓','Move along world Y'],
      ['Q / E','Move along world Z (Q = +Z)'],['Ctrl + A / D','Alternate Z movement'],['Shift','Rush (2.6× speed)'],
      ['V','Panic rescue during a leg; 30-second cooldown'],['C','Re-couple: 5 requests per 10 seconds; loose cubes expire after 8 seconds'],['P / H','Pause / help'],['L',`Locate camera; auto-location ${game.autoLocateMinLevel===0?'active from the start':`from level ${game.autoLocateMinLevel}`}`],
      ['M','Mute / unmute'],['Alt+F / Alt+Enter / F11','Fullscreen (or use the button)'],['Esc','Main menu confirmation'],
      ['Ctrl+Shift+F2','Reset run or retry current level'],['` / Ctrl+Shift+F1','Debug console']
    ])) {const tr=document.createElement('tr');for(const text of [keys,action]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}
    keyboardBody.append(table);
    const rulesDetails=document.createElement('details'),rulesTitle=document.createElement('summary');
    rulesTitle.textContent='GAME RULES & LEVEL PROGRESSION';rulesDetails.append(rulesTitle);keyboardBody.append(rulesDetails);
    const milestones=document.createElement('table'),heading=document.createElement('caption');
    heading.textContent='What changes as you advance';milestones.append(heading);
    const header=document.createElement('tr');
    for(const text of ['Level','Banner','Change']) {const th=document.createElement('th');th.scope='col';th.textContent=text;header.append(th);}milestones.append(header);
    for(const feature of featuresForSettings(game.changeSettings,game.flags,game.lossMinLevel,game.balance)) {
      const row=document.createElement('tr');
      for(const text of [feature.level,feature.banner,feature.summary()]) {const cell=document.createElement('td');cell.textContent=text;row.append(cell);}milestones.append(row);
    }
    rulesDetails.append(milestones);
    const q=document.createElement('p');q.textContent=`Each level adds one corridor leg, up to ${game.levelCap}. Repeated re-coupling requests can recover more pieces before they expire. Once HEAT is active, new requests are blocked while overheating. Returning inside cools you immediately. A request already in progress finishes; refused requests use no quota. Lost cubes cost 100 potential points each. Once LOSS is active, portals carry only your surviving pieces onward. Retrying restores the body you entered the level with. Bonus pieces earn points without refilling your normal body. Your run score stays.`;rulesDetails.append(q);
    const shutterHelp=document.createElement('p');shutterHelp.textContent=`CHANGE begins at level ${Math.max(1,game.changeSettings.change_1_min_level)}. This level uses ${shutterGateCount(game.level,game.changeSettings,5,game.flags)} different gates per sequence, one gate at a time in one leg. Zap starts are ${shutterStepInterval(game.changeSettings)} seconds apart; each closure lasts ${game.changeSettings.change_1_closed_seconds} seconds. Allow at least ${shutterInterval(game.changeSettings)} seconds from the last zap to the next sequence's first. A hit costs ${Math.round(game.changeSettings.change_1_damage_fraction*100)}% of remaining cubes, rounded down, with ${game.changeSettings.change_1_damage_cooldown} seconds of grid-damage protection. ${game.flags.change_1_no_repeat_leg?'Complete sequences alternate revealed legs; a lone leg finishes its sequence, then waits.':'Another sequence may use the same leg.'} ${game.flags.change_4_pattern?'Four-gate order: inner, far end, opposite end, other inner. The exact centre gate stays out of this pattern.':''}`;rulesDetails.append(shutterHelp);
    const bonusRules=document.createElement('p');bonusRules.textContent=`PICKING UP THE PIECES · Bonus round 001 follows level ${BONUS_SCHEDULE.firstLevel}, then every ${BONUS_SCHEDULE.interval} levels before the final level cap. Roll on a solid floor using WASD / arrow keys; Shift rushes. Collect the scattered pieces and take the ramp to the portal within ${PIECES_RULES.seconds} seconds. Each piece banks ${PIECES_RULES.pointsPerPiece} bonus points only if you escape. Running out of time forfeits this bonus; your existing score is kept and the next level follows. C and the corridor heat/entropy rules do not apply.`;rulesDetails.append(bonusRules);
    const rules=game.difficulty,current=document.createElement('p');
    current.textContent=`Level ${game.level}: ${rules.timed?`${rules.secondsPerLeg.toFixed(1)} seconds per leg`:'no timer'} · ${Math.round(rules.recouplingRate*100)}% re-coupling yield per request · ${rules.overheatGraceSeconds.toFixed(1)} seconds before overheating outside. Heat re-coupling restriction: ${game.flags.overheat_blocks_recoupling?(rules.heat?'active':'not yet active'):'disabled'}.`;rulesDetails.append(current);
    const rescueHelp=document.createElement('p');rescueHelp.textContent=`PANIC can be used throughout a normal leg. It flashes immediately on overheating. The console setting panic_show_inactive hides it while safe when off: it appears after ${game.panicOutsideSeconds} seconds continuously outside, or immediately on overheating. Keyboard/controller activation still works while hidden. V / Xbox B / the shedding-cube button returns your surviving shape to the start of the furthest leg physically reached. The prison opens toward that leg after a short tractor pull and confinement; its timer restarts. The old corridor stays sealed. The beam requests normal lossy Recouple for still-recoverable fragments; no fresh body or points are granted. Cooldown: ${game.panicCooldownSeconds} seconds during play, paused in Help and menus. Unavailable in bonus rounds. Options → ALLOW PANIC BUTTON is on by default.`;rulesDetails.append(rescueHelp);
    const options=createVisualOptions(document,game,write);options.prepend(createMobileOptions(document,mobile));
    body.append(createHelpTabs(document,[
      {id:'keyboard',label:'KEYBOARD',body:keyboardBody},
      {id:'controller',label:'CONTROLLER',body:controllerHelp(inBonus)},
      {id:'touch',label:'TOUCH',body:createTouchHelp(document,inBonus,releaseAssetURL('../assets/touch-controls.svg',import.meta.url).href)},
      {id:'options',label:'OPTIONS',body:options}
    ],section==='options'?'options':mobile.enabled?'touch':controller.enabled&&controller.connected?'controller':'keyboard'));
    const creditBlock=document.createElement('footer');creditBlock.className='help-credits';body.append(creditBlock);
    const credits=document.createElement('p');credits.className='version-note';
    credits.append(`CUBE LIBRE v${release.version} | By FlyingFathead | `);
    const authorLink=document.createElement('a');authorLink.href='https://github.com/FlyingFathead';authorLink.textContent='github.com/FlyingFathead';authorLink.target='_blank';authorLink.rel='noopener';credits.append(authorLink);creditBlock.append(credits);
    const copyright=document.createElement('p');copyright.className='version-note';copyright.textContent='© 2024–2026 FlyingFathead';creditBlock.append(copyright);
    const version=document.createElement('p');version.className='version-note';version.textContent=`Web version · Based on PyGame v${release.upstream.version}`;creditBlock.append(version);
    modal('help','CUBE LIBRE · HELP',body,[['Back to game (H)',closeModal]]);
  }
  function menu() {
    if(game.state==='title') {
      modal('quit','END SESSION?','You can close this browser tab, or stay for another run.',[['Stay (N / Esc)',closeModal],['End session (Y)',()=>{closeModal();audio.stopAll();audio.pause(true);game.setState('ended');}]]);
    } else modal('menu','EXIT TO MAIN MENU?','The current run will end. Your best escape and highest level are saved in this browser.',[
      ['Keep playing (N / Esc)',closeModal],['Main menu (Y)',()=>{closeModal();game.title();syncAudio();}]
    ]);
  }
  function reset() {
    modal('reset','RESTART / RETRY',`Current level: ${game.level} · Score: ${game.score}`,[
      ['Cancel (Esc)',closeModal],['1 · Start at level one',()=>{closeModal();game.newRun();syncAudio();}],
      ['2 · Retry current level',()=>{closeModal();game.retry();syncAudio();}]
    ]);
  }
  async function mute(value) {
    audio.mute(typeof value==='boolean'?value:undefined);write('cube-libre-muted-v1',audio.muted);
    if(!audio.muted) {try{await audio.unlock();audioWarning=audio.failed.length?'Some audio could not load.':'';}catch{audioWarning='Audio unavailable. The game will play silently.';audio.mute(true);}}
    syncAudio();
  }
  async function fullscreen() {
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if($('game').requestFullscreen) await $('game').requestFullscreen();
      else modal('fullscreen','PLAYING ON THIS DEVICE','You can play in this browser view. On iPhone, Safari → Share → Add to Home Screen → Open as Web App gives an app-style view.',[['Continue',closeModal]]);
    } catch {audioWarning='Fullscreen unavailable; you can keep playing in this view.';}
    clearInput();
  }
  const log=[];const history=[];let historyIndex=0;
  function consoleLog(text) {
    const lines=String(text).split('\n'),limit=Math.max(250,lines.length);
    log.push(...lines);if(log.length>limit)log.splice(0,log.length-limit);
    $('console-log').textContent=log.join('\n');$('console-log').scrollTop=$('console-log').scrollHeight;
  }
  function openConsole() {
    if($('modal').open) closeModal();
    consolePaused=game.paused;game.paused=true;clearInput();syncAudio();
    $('console').showModal();$('console-input').focus();
    if(!log.length) consoleLog('Cube Libre debug console. Type help for commands or viewconfig for all settings.');
  }
  function closeConsole() {if(!$('console').open)return;$('console').close();game.paused=consolePaused;clearInput();syncAudio();focusGame();}
  $('console-form').onsubmit=e=>{
    e.preventDefault();const value=$('console-input').value.trim();if(!value)return;
    history.push(value);historyIndex=history.length;$('console-input').value='';
    if(['clear','cls'].includes(value.toLowerCase())) {log.length=0;$('console-log').textContent='';return;}
    consoleLog(`> ${value}`);
    try {
      const previousStages=Object.fromEntries(['change_2','change_3','change_4','change_4_pattern','loss','loss_grey','route_outline','end_portal'].map(key=>[key,game.flags[key]]));
      const previousPanic=game.flags.panic,previousPanicVisible=game.flags.panic_show_inactive;
      const previousShake=game.flags.shake,previousSpin=game.flags.spin,previousLight=game.flags.portal_white_light,previousCulling=game.flags.culling,previousShocks=game.flags.rotation_shocks,previousGravity=game.flags.microgravity,previousHeatLock=game.flags.overheat_blocks_recoupling,previousChange=game.flags.change_1,previousRandom=game.flags.change_1_random_per_leg,previousStars=game.starPattern,previousPreview=game.flags.preview_outline,previousNoRepeat=game.flags.change_1_no_repeat_leg;
      consoleLog(game.command(value));
      if(game.flags.panic_show_inactive!==previousPanicVisible)write('cube-libre-panic-show-inactive-v1',game.flags.panic_show_inactive);
      if(game.flags.panic!==previousPanic)write('cube-libre-panic-v1',game.flags.panic);
      if(game.flags.shake!==previousShake)write('cube-libre-shake-v1',game.flags.shake);
      if(game.flags.spin!==previousSpin)write('cube-libre-spin-v1',game.flags.spin);
      if(game.flags.portal_white_light!==previousLight)write('cube-libre-portal-white-light-v1',game.flags.portal_white_light);
      if(game.flags.culling!==previousCulling)write('cube-libre-culling-v1',game.flags.culling);
      if(game.flags.rotation_shocks!==previousShocks)write('cube-libre-rotation-shocks-v1',game.flags.rotation_shocks);
      if(game.flags.microgravity!==previousGravity)write('cube-libre-microgravity-v1',game.flags.microgravity);
      if(game.flags.overheat_blocks_recoupling!==previousHeatLock)write('cube-libre-overheat-blocks-recoupling-v1',game.flags.overheat_blocks_recoupling);
      if(game.flags.change_1!==previousChange)write('cube-libre-change-1-v1',game.flags.change_1);
      if(game.flags.change_1_random_per_leg!==previousRandom)write('cube-libre-change-1-random-per-leg-v1',game.flags.change_1_random_per_leg);
      if(game.flags.preview_outline!==previousPreview)write('cube-libre-preview-outline-v1',game.flags.preview_outline);
      if(game.starPattern!==previousStars)write('cube-libre-star-pattern-v1',game.starPattern);
      if(game.flags.change_1_no_repeat_leg!==previousNoRepeat)write('cube-libre-change-1-no-repeat-leg-v1',game.flags.change_1_no_repeat_leg);
      for(const [key,previous] of Object.entries(previousStages))if(game.flags[key]!==previous)write(`cube-libre-${key.replaceAll('_','-')}-v1`,game.flags[key]);
      if(/^(thank_you_note|view_end_anim_v1|view_bonus_001|test\s+(end_portal|ending_1|bonus_round_1|change_\d+|loss|thank_you_note)|bonus(?:\s+\S+)?)$/i.test(value)) { closeConsole();game.paused=false;game.help=false;syncAudio();focusGame();if(!audio.muted)audio.unlock().then(syncAudio,()=>{});return; }
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
  $('start').onclick=()=>startOrContinue();$('new-run').onclick=requestNewRun;$('next').onclick=()=>{clearInput();if(game.state==='ended')start();else game.continue();};
  $('settings').onclick=()=>help('options');
  $('pause').onclick=pause;$('help').onclick=help;$('mute').onclick=mute;$('fullscreen').onclick=fullscreen;$('menu').onclick=menu;
  $('locate').onclick=()=>{game.locate=!game.locate;game.messageSet(`LOCATE ${game.locate?'ON':'OFF'}${game.autoLocate?' · AUTO TRACKING ACTIVE':''}`);};
  const keyCodes=new Set(['KeyA','KeyD','KeyW','KeyS','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','ControlLeft','ControlRight']);
  window.addEventListener('keydown',e=>{
    const code=e.code;
    if(e.metaKey) return;
    if(['update','mobile'].includes(modalKind)&&code==='Space') {e.preventDefault();if(!e.repeat){if(modalKind==='mobile')$('modal-actions').firstElementChild.click();else closeModal();}return;}
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
      e.preventDefault();if(game.state==='title')startOrContinue();else if(game.state==='ended'){game.title();start();}else {clearInput();game.continue();}
    } else if(code==='KeyC') {e.preventDefault();game.requestRecouple();}
    else if(code==='KeyV'&&!e.ctrlKey) {e.preventDefault();if(game.requestPanic())clearInput();}
    else if(code==='KeyP')pause();else if(code==='KeyH')help();else if(code==='KeyM')mute();
    else if(code==='KeyL')$('locate').click();else if(code==='Escape'){e.preventDefault();menu();}
  });
  window.addEventListener('keyup',e=>keyboard.delete(e.code));
  window.addEventListener('blur',()=>{clearInput();if(game.state!=='title'&&game.state!=='ended'&&!game.paused)pause();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdates();if(document.hidden){clearInput();if(game.state!=='title'&&game.state!=='ended'&&!game.paused)pause();}syncAudio();});
  $('scene').addEventListener('pointerdown',()=>focusGame());
  $('ending').addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();if(e.detail>1)return;
    clearInput();game.continue();focusGame();syncAudio();
  });
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();game.paused=true;syncAudio();cancelAnimationFrame(raf);fail(Error('The graphics context was lost. Reload to restart'));});
  const titleLayout=observeTitleLayout(renderer,{canvas:$('scene'),start:$('title-actions'),info:document.querySelector('.title-info'),title:$('title')});
  let portrait=renderer.height>=renderer.width;
  window.addEventListener('resize',()=>{
    renderer.resize();mobile.resize();titleLayout.invalidate();
    const next=renderer.height>=renderer.width;
    if(next!==portrait&&mobile.canPlay())pause();portrait=next;
  });
  window.addEventListener('orientationchange',()=>{clearInput();if(mobile.enabled&&['playing','bonus_playing'].includes(game.state)&&!game.paused)pause();});
  document.addEventListener('fullscreenchange',()=>{clearInput();renderer.resize();mobile.resize();titleLayout.invalidate();if(mobile.enabled&&!document.fullscreenElement&&['playing','bonus_playing'].includes(game.state)&&!game.paused)pause();});

  function updateController(now,dt) {
    const frame=controller.poll(now/1000,{focused:!document.hidden&&document.hasFocus(),bonus:game.state.startsWith('bonus_')});
    controllerMovement=frame.movement;
    if(controller.enabled&&frame.disconnected&&!game.paused&&!['title','ended'].includes(game.state)) {
      clearInput();pause();
      $('modal-title').textContent='CONTROLLER DISCONNECTED';
      $('modal-body').firstElementChild.textContent='Reconnect your controller or use the keyboard. Resume when you are ready.';
      return;
    }
    if(!controller.enabled||!frame.connected||document.hidden||!document.hasFocus())return;
    const action=frame.actions;
    controllerAction=true;
    try {
      if($('console').open) {
        controllerMovement=emptyMovement();
        if(action.back||action.pause)closeConsole();
        else $('console-log').scrollTop+=frame.scroll*550*Math.min(dt,.1)+frame.menuStep*200;
        return;
      }
      if($('modal').open) {
        controllerMovement=emptyMovement();
        if(action.back||action.pause&&modalKind==='pause'||action.help&&modalKind==='help'){closeModal();return;}
        navigateControllerMenu($('modal'),frame,document,dt);return;
      }
      if(action.pause&&game.state!=='title'){pause();return;}
      if(action.help){help();return;}
      if(action.back){if(game.state==='playing'){if(game.requestPanic())clearInput();}else menu();return;}
      if(game.state==='title') {
        const focused=document.activeElement;
        if(action.confirm&&(focused===$('start')||!focused?.matches('button, a[href], input'))){void startOrContinue({controller:true});return;}
        navigateControllerMenu($('game'),frame,document,dt);return;
      }
      if(action.confirm) {
        clearInput();
        if(game.state==='ended'){void start({controller:true});return;}
        game.continue();syncAudio();return;
      }
      if(action.locate)$('locate').click();
      if(action.recouple)game.requestRecouple();
    } finally {controllerAction=false;}
  }
  function input() {
    const combined=mergeMovement(controllerMovement,mobile.movement());
    const held=new Set([...keyboard,...pointers.values()]),has=(...keys)=>keys.some(k=>held.has(k));
    if(game.state.startsWith('bonus_'))return mergeMovement({x:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),z:Number(has('KeyS','ArrowDown','KeyQ'))-Number(has('KeyW','ArrowUp','KeyE')),rush:has('ShiftLeft','ShiftRight')},combined);
    const ctrl=has('ControlLeft','ControlRight');
    let z=Number(has('KeyQ'))-Number(has('KeyE'));
    if(ctrl&&z===0)z=Number(has('KeyA','ArrowLeft'))-Number(has('KeyD','ArrowRight'));
    return mergeMovement({x:ctrl?0:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),
      y:Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown')),z,rush:has('ShiftLeft','ShiftRight')},combined);
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
  let lastSummary=null;
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
    const ending=['ascension','ascension_white','ascension_title','thank_you_note','run_summary'].includes(s);
    $('opening').hidden=!opening;
    $('bottom-ui').hidden=opening||ending;
    $('ending').hidden=!(s==='ascension_title'||s==='thank_you_note'||s==='run_summary');
    $('ascension-copy').hidden=s!=='ascension_title';
    $('thank-you-copy').hidden=s!=='thank_you_note';
    $('thank-you-copy').style.opacity=String(s==='thank_you_note'?thankYouOpacity(game.stateTime):0);
    $('run-summary').hidden=s!=='run_summary';
    $('ending-next').hidden=!(s==='thank_you_note'&&game.stateTime>=THANK_YOU_TIMING.continueAfter||s==='run_summary'&&game.stateTime>=ASCENSION_TIMING.summaryInputDelay);
    $('ending-next').textContent=s==='run_summary'?'A / Space / Enter / click to return to the main menu':'A / Space / Enter / click to see your stats';
    if(s==='ascension_title') {
      const fade=1-smooth((game.stateTime-ASCENSION_TIMING.titleFadeOutStarts)/ASCENSION_TIMING.titleFadeOutSeconds);
      $('ascension-title').style.opacity=String(smooth(game.stateTime/ASCENSION_TIMING.titleFadeSeconds)*fade);
      $('ascension-subtitle').style.opacity=String(smooth((game.stateTime-ASCENSION_TIMING.subtitleStarts)/ASCENSION_TIMING.subtitleFadeSeconds)*fade);
    }
    if(s==='run_summary'&&game.runSummary!==lastSummary) {
      lastSummary=game.runSummary;
      const r=lastSummary,total=Math.floor(r.playSeconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
      const duration=`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
      const rows=[['Total score',r.score.toLocaleString()],['Best score',r.bestScore.toLocaleString()],
        ['Levels cleared this run',`${r.levelsCleared} / ${game.levelCap}`],['Final level',r.finalLevel],
        ['Cubes at the final portal',`${r.finalCubes} / 125`],['Best escape',`${r.bestEscape} / 125`],
        ['Time in play',duration],['Deaths / reassemblies',r.deaths],['Pieces re-coupled',r.recoupledCubes],
        ['Bonus rounds played',r.bonusRounds],['Bonus pieces banked',r.bonusPieces],['Bonus points',r.bonusScore.toLocaleString()]];
      if(r.endPortalPreview)rows.unshift(['Preview','END PORTAL · no points or records awarded']);
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
    $('locate').setAttribute('aria-pressed',String(game.locate||game.autoLocate));
    $('pause').textContent=game.paused?'Resume':'Pause';
    $('fullscreen').textContent=document.fullscreenElement?'Windowed':'Fullscreen';
    mobile.sync();
    $('bonus-instructions').textContent=mobile.enabled?'Drag to roll · Beyond ring: rush · Collect pieces and reach the ramp': 'WASD / arrows: roll · Shift: rush · Collect pieces, then take the ramp to the portal';
    $('audio-status').textContent=loadingStart?audioProgress:audioWarning;
    if(title) {
      const connected=controller.enabled&&controller.connected;
      const status=controller.status==='disabled'?'Controller input disabled · H for Help':controller.status==='unavailable'?'Controller input unavailable in this browser':controller.status==='unmapped'?'Controller detected; Xbox-style button mapping unavailable. Try reconnecting by USB.':connected?'CONTROLLER: A start · LB / X re-couple · B panic · RB rush · View help':'Keyboard or controller · Press and release a controller button to connect';
      if($('controller-status').textContent!==status)$('controller-status').textContent=status;
      const resume=!!campaignStore.value,action=resume?'CONTINUE':'NEW RUN';
      const label=resume?`Continue from level ${campaignStore.value.level}`:'Start a new run';
      $('start').setAttribute('aria-label',label);$('start-label').textContent=label;
      $('new-run').hidden=!resume;$('new-run').disabled=loadingStart;
      $('save-note').textContent=campaignStore.note;
      dots(loadingStart?'LOADING AUDIO - PLEASE WAIT':`${mobile.enabled?'TAP':connected?'A / SPACE / ENTER':'SPACE / ENTER'} = ${action}`,game.t);
      $('title-stats').textContent=`Score ${game.score} · Best escape ${game.stats.best_escape}/125 · TOP LEVEL: ${game.stats.highest_level}/${game.levelCap}`;
    }
    const phase=s.endsWith('_intro')&&!opening&&!bonusIntro,ready=s==='level_ready',result=s==='result_overlay',rebuild=['reassembly','loss_assembly'].includes(s),ended=s==='ended';
    $('card').hidden=!(phase||ready||result||rebuild||ended||bonusIntro||bonusResult);
    $('card').className=ready?'ready':rebuild?'rebuilding':ended?'ready':'';
    $('card').style.color='';$('card').style.opacity='1';$('card-subtitle').style.opacity='1';$('card-detail').style.opacity='1';$('next').hidden=!(result||ended||bonusResult);$('next').textContent=ended?'A / Start a new run':'A / Space / Enter = next level';
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
      $('next').textContent=game.bonusPreview?`A / Space / Enter / click for level ${game.previewReturn.nextLevel}`:'A / Space / Enter / click for the next level';
      $('next').hidden=game.stateTime<.4;
    } else if(s==='resume_intro') {
      const t=game.stateTime;
      $('card-title').textContent=`Continuing from level ${game.level} ...`;
      $('card-subtitle').textContent='Welcome back.';$('card-detail').textContent='';
      $('card').style.opacity=String(smooth(t/RESUME_TIMING.lineFade)*(1-smooth((t-RESUME_TIMING.fadeOutStarts)/RESUME_TIMING.fadeOutSeconds)));
      $('card-subtitle').style.opacity=String(smooth((t-RESUME_TIMING.welcomeStarts)/RESUME_TIMING.welcomeFade));
    } else if(phase) {
      const card=introductionCard(s,game.level,game.flags,game.changeSettings,game.lossMinLevel,game.balance);
      $('card-title').textContent=card.title;$('card-subtitle').textContent=card.subtitle;$('card-detail').textContent=card.detail;
      $('card').style.opacity=String(smooth(game.stateTime/1.1)*(1-smooth((game.stateTime/5-.86)/.14)));
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
        $('card-detail').textContent=`SCORE +${game.lastEscape*100} · TOTAL ${game.score}\nBEST ESCAPE ${game.stats.best_escape}/125 · TOP LEVEL: ${game.stats.highest_level}/${game.levelCap}`;
        $('card').style.opacity=String(1-smooth((game.stateTime/4.25-.56)/.40));
      } else if(rebuild) {
        const incomplete=game.lossActive&&game.missingEntryCells.length>0;
        $('card-title').textContent=incomplete&&game.stateTime>=2.45?'ONLY PARTIAL REASSEMBLY SUCCEEDED':game.stateTime>3.25?'REASSEMBLED':'REASSEMBLY IN PROGRESS';
        $('card-subtitle').textContent=incomplete&&game.stateTime>=2.45?`${game.entryCells.length} / 125 · WHAT REMAINS`:'';$('card-detail').textContent='';
      } else if(ended) {
        $('card-title').textContent='SESSION ENDED';$('card-subtitle').textContent='You can close this tab.';$('card-detail').textContent='Space / Enter = new run';
      }
    }
    if(lastHUD>=0&&performance.now()-lastHUD<100)return;lastHUD=performance.now();
    const n=game.player.alive.size;
    $('cube-count').textContent=`LVL ${String(game.level).padStart(2,'0')} · CUBES ${String(n).padStart(3,'0')}/125`;
    $('score').textContent=`INTEGRITY ${(n/125*100).toFixed(1)}% · SCORE ${game.score}`;
    $('records').textContent=`BEST ESCAPE ${game.stats.best_escape}/125 · TOP LEVEL: ${game.stats.highest_level}/${game.levelCap}`;
    $('integrity-warning').textContent=n<=18?'CRITICAL: STRUCTURE FAILING':n<=42?'WARNING: STRUCTURE FAILING':'';
    if(bonusPlaying) {
      const b=game.bonus;
      $('cube-count').textContent='BONUS ROUND 001';
      $('score').textContent=`PIECES ${b.collected} / ${b.rules.pieces} · BONUS ${b.potentialScore}`;
      $('records').textContent=game.bonusPreview?'PREVIEW · Reach the portal to finish':'Reach the portal to bank your bonus';
      $('integrity-warning').textContent='';
    }
    $('timer').textContent=`${clock.toFixed(1)}s\n${bonus?'BONUS':`LEG ${game.timedModule+1}/${game.course.modules.length}`}`;
    const timeUrgency=1-clamp(clock/10);
    $('timer').style.color=`hsl(${48*(1-timeUrgency)}, 100%, ${85-30*timeUrgency}%)`;
    $('notice').textContent=playing?(game.messageTime>0?game.message:game.endPortalPreview?'END PORTAL TEST · no records or points awarded':''):preview?'COURSE MATERIALIZING':'';
    const fragments=game.player.fragments,remaining=fragments.length?Math.min(...fragments.map(f=>8-f.age)):0;
    const recovering=game.recoupling.length>0;
    $('recovery').hidden=!(playing&&(fragments.length||recovering||game.cooldown>0));
    $('recovery').textContent=game.cooldown>0?`RE-COUPLING ON COOLDOWN · ${game.cooldown.toFixed(1)}s`:recovering?`RE-COUPLING ${game.recoupling.length} CELLS · ${Math.round(clamp(game.recoupleTime/1.18)*100)}%`:
      game.recouplingBlockedByHeat?`TOO HOT TO RE-COUPLE · RETURN INSIDE\n${fragments.length} LOOSE · EXPIRING IN ${remaining.toFixed(1)}s`:
      `${remaining<1.75?'LAST CHANCE! ':''}${mobile.enabled?'TAP RECOUPLE':'PRESS C / LB / X TO RE-COUPLE'} · ${fragments.length} LOOSE\nCELLS EXPIRING IN ${remaining.toFixed(1)}s`;
    $('danger').hidden=!(playing&&game.outside);$('danger').className=game.heat>0?'hot':'';
    $('danger').textContent=game.heat>0?'OVERHEATING · RETURN TO COURSE':'DANGER · OUT OF BOUNDS';
  }
  $('boot').hidden=true;focusGame();
  if(mobileBrowser) {
    let seen=false;try{seen=sessionStorage.getItem('cube-libre-mobile-beta-notice-v1')==='1';sessionStorage.setItem('cube-libre-mobile-beta-notice-v1','1');}catch{}
    if(!seen)modal('mobile','MOBILE BROWSER DETECTED',MOBILE_NOTICE,[
      ['TRY MOBILE BETA',()=>{mobile.setMode(1);closeModal();}],
      ['USE KEYBOARD / CONTROLLER',()=>{mobile.setMode(2);closeModal();}]
    ]);
  }
  checkUpdates();setInterval(checkUpdates,UPDATE_INTERVAL_MS);
  // Fixed simulation steps preserve laser collision and quota timing on high-refresh displays.
  // A background tab pauses instead of accruing catch-up damage or timer loss.
  let previous=performance.now(),accumulator=0;
  function frame(now) {
    try {
      const dt=Math.min((now-previous)/1000,.1);previous=now;
      updateController(now,dt);mobile.sync();
      if(game.paused||document.hidden)accumulator=0;
      else {accumulator+=dt;while(accumulator>=1/120){const prison=game.panic;game.tick(1/120,input());if(prison&&!game.panic)clearInput();accumulator-=1/120;}}
      audio.update(game);ui();titleLayout.update();renderer.render(game);mobile.sync();mobile.draw();
      if(renderer.reassemblyLabel) {
        $('card').style.setProperty('--reassembly-label-x',`${renderer.reassemblyLabel.x}px`);
        $('card').style.setProperty('--reassembly-label-y',`${renderer.reassemblyLabel.y}px`);
      }
      raf=requestAnimationFrame(frame);
    } catch(error) {game.paused=true;audio.pause(true);fail(error);}
  }
  raf=requestAnimationFrame(frame);
}
main().catch(fail);
