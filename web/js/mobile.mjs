import {panicStatus} from './panic.mjs';
import {RECOUPLING} from './recoupling.mjs';
// Touch movement and shared action circles. Movement uses the ordinary simulation.
import {emptyMovement} from './gamepad.mjs';
import {MobileOrientation,createOrientationOptions} from './orientation.mjs';

export const TOUCH_RULES=Object.freeze({rushRadius:56,deadzone:6,grabRadius:44,pixelRatio:1.25});
export const MOBILE_NOTICE='A DESKTOP COMPUTER WITH A KEYBOARD\nOR GAME CONTROLLER IS RECOMMENDED.\n\nTRY MOBILE TOUCH CONTROLS — BETA\nGrab a labelled side of the cube and pull.\nDrag beyond the grey ring to rush.\n\nChoose below. Space tries the mobile beta.\nYou can switch later in Help → Options.';
export function detectMobile(nav=globalThis.navigator,media=globalThis.matchMedia) {
  return Boolean(nav?.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent||'')||
    /Macintosh/i.test(nav?.userAgent||'')&&nav?.maxTouchPoints>1||media?.('(pointer: coarse)')?.matches);
}
export const touchEnabled=(mode,detected)=>mode===1||mode===0&&detected;
const clamp=(n,a=-1,b=1)=>Math.max(a,Math.min(b,n));

export class DragStick {
  constructor(rules=TOUCH_RULES){this.rules=rules;this.reset();}
  reset(){this.id=null;this.x=this.y=this.dx=this.dy=0;this.rush=false;}
  start(id,x,y){if(this.id!==null||![x,y].every(Number.isFinite))return false;this.id=id;this.x=x;this.y=y;this.dx=this.dy=0;this.rush=false;return true;}
  move(id,x,y,vertical=false){
    if(id!==this.id||![x,y].every(Number.isFinite))return;
    this.dx=vertical?0:x-this.x;this.dy=y-this.y;
    const d=Math.hypot(this.dx,this.dy),radius=this.rules.rushRadius;
    this.rush=d>=(this.rush?radius-10:radius);
  }
  end(id){if(id===this.id)this.reset();}
  axes(){
    const d=Math.hypot(this.dx,this.dy),dead=this.rules.deadzone;
    if(this.id===null||d<=dead)return {x:0,y:0,rush:false};
    const magnitude=clamp((d-dead)/(this.rules.rushRadius*.72-dead),0,1);
    return {x:this.dx/d*magnitude,y:-this.dy/d*magnitude,rush:this.rush};
  }
}

// View-space thrust uses an orthonormal camera basis supplied by the renderer.
// Limit the combined length so adding depth cannot multiply the analog speed.
export function touchMovement(move,depth,basis,bonus=false){
  if(bonus)return {x:move.x,y:0,z:-move.y,rush:move.rush};
  if(!basis)return emptyMovement();
  const size=Math.max(1,Math.hypot(move.x,move.y,depth.y)),result={rush:move.rush||depth.rush};
  for(const axis of ['x','y','z'])result[axis]=clamp((basis.right[axis]*move.x+basis.up[axis]*move.y+basis.forward[axis]*depth.y)/size);
  return result;
}

// Six forgiving grab points remain around the collective even if its cells vanish.
// Fan overlapping projected axes apart; a view-aligned axis needs a visible handle.
export function axisHandles(view,grabRadius=TOUCH_RULES.grabRadius){
  if(!view?.basis)return [];
  const radius=Math.max(grabRadius+18,view.radius+30),handles=[];
  for(const [i,axis] of ['x','y','z'].entries()){
    const dx=view.basis.right[axis],dy=-view.basis.up[axis];
    const angle=Math.hypot(dx,dy)>.12?Math.atan2(dy,dx):-Math.PI/2+i*.5;
    for(const sign of [1,-1])handles.push({axis,sign,angle:angle+(sign<0?Math.PI:0)});
  }
  // Only the displayed handles separate; the chosen physical axis stays exact.
  for(let step=0;step<12;step++)for(let i=0;i<handles.length;i++)for(let j=i+1;j<handles.length;j++){
    const a=handles[i],b=handles[j],d=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
    if(Math.abs(d)<.63){const shift=(.63-Math.abs(d))*.5,sign=d>=0?1:-1;a.angle-=sign*shift;b.angle+=sign*shift;}
  }
  return handles.map(h=>({...h,dx:Math.cos(h.angle),dy:Math.sin(h.angle),x:view.x+Math.cos(h.angle)*radius,y:view.y+Math.sin(h.angle)*radius}));
}

export function selectPull(view,x,y,grabRadius=TOUCH_RULES.grabRadius){
  const r=Math.max(grabRadius+18,view.radius+30),distance=Math.hypot(x-view.x,y-view.y);
  const handles=axisHandles(view,grabRadius);
  const handle=handles.reduce((best,h)=>Math.hypot(h.x-x,h.y-y)<Math.hypot(best.x-x,best.y-y)?h:best,handles[0]);
  if(handle&&Math.hypot(handle.x-x,handle.y-y)<=26)return {hit:true,axis:handle};
  if(distance>r)return {hit:false,axis:null};
  return {hit:true,axis:distance>r*.4?handle:null};
}

export function recoupleStatus(game){
  if(game.state!=='playing'||game.paused||game.help||game.panic)return {enabled:false,text:'UNAVAILABLE'};
  if(game.recouplingBlockedByHeat)return {enabled:false,text:'TOO HOT'};
  const wait=game.recoupleWait;
  if(wait>0)return {enabled:false,text:`COOLDOWN ${Math.ceil(wait)} s`};
  if(game.recoupling.length)return {enabled:false,text:'COUPLING…'};
  const count=Math.min(RECOUPLING.capacity-game.player.alive.size,game.recoverableFragments.length);
  return {enabled:count>0,text:count?`${count} LOOSE`:'NO PIECES'};
}

// Busy presses retain the same quota cost as C / LB / X. Cooldown presses
// only give rejection feedback. Both states look dim, with no urgency pulse.
const acceptsRecouplePress=game=>{const status=recoupleStatus(game);return status.enabled||status.text==='COUPLING…'||status.text.startsWith('COOLDOWN ');};

export function createTouchHelp(document,inBonus,diagramURL){
  const section=document.createElement('div'),heading=document.createElement('h3');heading.textContent='TOUCH CONTROLS · BETA';section.append(heading);
  const p=document.createElement('p');p.textContent=inBonus?'Drag the cube to roll on the floor. Up goes toward the ramp. Collect pieces by contact; depth, re-coupling and Panic controls are hidden.':'Grab a labelled side of the cube’s area and pull along its line. Cyan X, gold Y and pink Z are the three movement axes. The chosen axis lights up and stays selected until you release. The grab points surround your surviving pieces, even a single cube.';section.append(p);
  const image=document.createElement('img');image.src=diagramURL;image.alt='Touch map: six labelled X/Y/Z grab points surround the cube. Grab a side to pull along that axis. Grab the centre to steer freely on screen. A grey ring marks rush. Tap the whole-cube RECOUPLE button on the right to recover pieces, or the shedding-cube PANIC button on the left for recall.';image.className='touch-help-map';image.width=900;image.height=430;section.append(image);
  for(const text of [
    'The grey ring stays where you first touched. Cross it to rush; move back inside to slow down. Release to coast. Drag the opposite way to brake.',
    'Grab the centre for free dragging in the screen plane. Optional extra drag/depth areas are available in Options if you prefer them. DEPTH: up moves away from the camera, down moves toward it.',
    inBonus?'Re-coupling is automatic by contact in this bonus round.':'RECOUPLE lights up when pieces can be recovered. Its circle and labels pulse orange-red during the last chance to recover loose pieces, only while the button is usable. A dim button means no loose pieces, an active recovery, overheating or cooldown; its small status label explains which.',
    inBonus?'Panic is unavailable in bonus rounds.':`PANIC works throughout a normal leg. Its circle and labels pulse orange-red on overheating or in the final 10 seconds, only while usable. Tap the shedding-cube icon to return your survivors to the start of the furthest reached leg. A white tractor beam brings you into a laser-bar prison and requests normal Recouple for any recoverable pieces. The bars open forward, then the fresh leg timer runs. Cooldown: 30 seconds of play. Options can disable it. The optional score penalty is off by default; the console can enable and tune it. It affects the current run only.`,
    'Portrait and landscape are both supported. Play whichever way feels right to you. Pause before changing grip. Fullscreen is optional; system navigation gestures can still leave the game.',
    'Options → Lock current orientation keeps your current portrait or landscape view where supported. It starts off each visit. If the browser needs fullscreen, use Fullscreen & lock; otherwise use your device’s rotation lock. Unlocked rotation still pauses play.',
    'Help → Options → Input mode switches between automatic detection, touch and keyboard/controller. Keyboard and controller inputs remain available in touch mode.'
  ]){const line=document.createElement('p');line.textContent=text;section.append(line);}return section;
}

export function createMobileOptions(document,mobile){
  const body=document.createElement('div'),title=document.createElement('h3');title.textContent='INPUT MODE';body.append(title);
  const note=document.createElement('p');note.textContent='Choose your controls. This does not change the game rules.';body.append(note);
  const group=document.createElement('div');group.className='input-mode-options';group.setAttribute('role','group');group.setAttribute('aria-label','Input mode');
  const buttons=[];
  for(const [value,label] of [[0,'Automatic'],[1,'Touch · beta'],[2,'Keyboard / controller']]){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(mobile.mode===value));
    b.addEventListener('click',()=>{mobile.setMode(value);buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===value)));});
    buttons.push(b);group.append(b);
  }
  body.append(group);
  const helpers=document.createElement('button');helpers.type='button';helpers.textContent='Extra drag / depth areas';helpers.setAttribute('aria-pressed',String(mobile.helpers));
  helpers.addEventListener('click',()=>{mobile.setHelpers(!mobile.helpers);helpers.setAttribute('aria-pressed',String(mobile.helpers));});body.append(helpers);
  const hint=document.createElement('p');hint.textContent='Optional thumb areas, in addition to grabbing the cube. Off by default.';body.append(hint);
  if(mobile.orientation)body.append(createOrientationOptions(document,mobile.orientation));
  return body;
}

export class MobileControls {
  constructor({document,game,renderer,detected,read,write,focus}){
    Object.assign(this,{document,game,renderer,detected,write,focus});this.$=id=>document.getElementById(id);
    this.rules={...TOUCH_RULES};this.mode=read('cube-libre-input-mode-v1',0);if(![0,1,2].includes(this.mode))this.mode=0;
    this.helpers=read('cube-libre-touch-helpers-v1',false)===true;this.pullAxis=null;
    this.move=new DragStick(this.rules);this.depth=new DragStick(this.rules);this.captures=new Map();
    this.view=null;this.active=false;this.lastState=null;this.bonus=false;
    this.orientation=new MobileOrientation({document});
    this.install();this.applyMode();this.resize();
  }
  get enabled(){return touchEnabled(this.mode,this.detected);}
  canAct(){return this.game.state==='playing'&&!this.game.paused&&!this.game.help&&!this.document.hidden;}
  canPlay(){return !this.game.panic&&this.enabled&&['playing','bonus_playing'].includes(this.game.state)&&!this.game.paused&&!this.game.help&&!this.document.hidden;}
  setMode(value){
    const n=Number(value);if(![0,1,2].includes(n))throw Error('mobile_mode expects 0 (automatic), 1 (touch) or 2 (keyboard/controller)');
    this.mode=n;this.reset();this.write('cube-libre-input-mode-v1',n);this.applyMode();return n;
  }
  setHelpers(value){this.helpers=Boolean(value);this.reset();this.write('cube-libre-touch-helpers-v1',this.helpers);}
  applyMode(){
    this.orientation.setAvailable(this.detected||this.enabled);
    this.$('game').dataset.mobileMode=String(this.enabled);
    this.renderer.pixelRatioCap=this.enabled?this.rules.pixelRatio:2;this.renderer.resize();
    this.$('title-touch-tip').hidden=!this.enabled;
    this.$('scene').setAttribute('aria-label',this.enabled?'Cube Libre. Grab a labelled side of the orb and pull along its axis. Drag beyond the grey ring to rush. Settings opens touch help.':'Cube Libre. A/D move X, W/S move Y, Q/E move Z. Press H for help.');
  }
  reset(){
    this.move.reset();this.depth.reset();this.pullAxis=null;
    for(const [id,element] of this.captures){try{if(element.hasPointerCapture(id))element.releasePointerCapture(id);}catch{}}
    this.captures.clear();this.$('touch-guide').hidden=true;
    for(const id of ['touch-steer','touch-depth','touch-c'])this.$(id).classList.remove('held');
  }
  resize(){this.reset();this.rect=this.$('scene').getBoundingClientRect();}
  capture(element,e){try{element.setPointerCapture(e.pointerId);this.captures.set(e.pointerId,element);}catch{this.reset();}}
  install(){
    for(const [id,stick,grab] of [['scene',this.move,true],['touch-steer',this.move,false],['touch-depth',this.depth,false]]){
      const element=this.$(id);
      element.addEventListener('pointerdown',e=>{
        if(!this.canPlay()||e.button>0||stick===this.depth&&this.bonus)return;
        let selection=null;
        if(grab){const v=this.view;if(!v?.visible)return;
          const x=e.clientX-this.rect.left,y=e.clientY-this.rect.top;
          if(this.bonus){if(Math.hypot(x-v.x,y-v.y)>Math.max(this.rules.grabRadius,v.radius+16))return;}
          else {selection=selectPull(v,x,y,this.rules.grabRadius);if(!selection.hit)return;}
        } else if(!this.helpers)return;
        if(!stick.start(e.pointerId,e.clientX,e.clientY))return;
        if(stick===this.move)this.pullAxis=selection?.axis||null;
        e.preventDefault();this.focus();element.classList.add('held');this.capture(element,e);
      });
      element.addEventListener('pointermove',e=>{if(!this.canPlay()){this.reset();return;}if(stick.id===e.pointerId){
        e.preventDefault();let x=e.clientX,y=e.clientY;
        if(stick===this.move&&this.pullAxis){const a=this.pullAxis,d=(x-stick.x)*a.dx+(y-stick.y)*a.dy;x=stick.x+d*a.dx;y=stick.y+d*a.dy;}
        stick.move(e.pointerId,x,y,stick===this.depth);
      }});
      const end=e=>{if(stick.id===e.pointerId){stick.end(e.pointerId);if(stick===this.move)this.pullAxis=null;element.classList.remove('held');}this.captures.delete(e.pointerId);};
      for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,end);
    }
    const button=this.$('touch-c');
    button.addEventListener('pointerdown',e=>{
      if(e.button>0||!this.canAct()||!acceptsRecouplePress(this.game))return;
      e.preventDefault();this.game.requestRecouple();
    });
    button.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&this.canAct()&&acceptsRecouplePress(this.game))this.game.requestRecouple();});
    const panic=this.$('panic-button');
    panic.addEventListener('pointerdown',e=>{
      if(e.button>0||!this.canAct()||!panicStatus(this.game).enabled)return;
      e.preventDefault();if(this.game.requestPanic()){this.reset();this.focus();}
    });
    panic.addEventListener('click',e=>{
      e.preventDefault();if(e.detail===0&&this.canAct()&&this.game.requestPanic()){this.reset();this.focus();}
    });
    for(const el of [this.$('scene'),this.$('touch-controls'),this.$('game-actions')])el.addEventListener('contextmenu',e=>{if(this.enabled)e.preventDefault();});
  }
  movement(){
    if(!this.canPlay())return emptyMovement();
    if(this.pullAxis&&this.move.id!==null){
      const a=this.pullAxis,m=this.move.axes(),result=emptyMovement();
      result[a.axis]=(m.x*a.dx-m.y*a.dy)*a.sign;result.rush=m.rush;return result;
    }
    return touchMovement(this.move.axes(),this.depth.axes(),this.view?.basis,this.bonus);
  }
  sync(){
    const active=this.canPlay(),state=this.game.state;
    if(!active||state!==this.lastState)this.reset();
    this.active=active;this.lastState=state;this.bonus=state==='bonus_playing';
    // Optional gesture areas and action buttons have independent visibility.
    // Desktop keeps the action HUD through setup and pause, with disabled states.
    this.$('touch-controls').hidden=!active||!this.helpers;
    this.$('touch-steer').hidden=!active||!this.helpers;this.$('touch-depth').hidden=!active||this.bonus||!this.helpers;
    const desktopScene=!this.enabled&&['level_ready','course_materialize','playing','reassembly_flash'].includes(state);
    this.$('game-actions').hidden=this.document.hidden||!(desktopScene||this.canAct());
    this.$('touch-recoup-wrap').hidden=this.bonus;
    for(const id of ['panic-key','recouple-key'])this.$(id).hidden=this.enabled;
    const panic=panicStatus(this.game),panicButton=this.$('panic-button');
    this.$('panic-wrap').hidden=!(panic.visible||desktopScene&&this.game.flags.panic&&this.game.flags.panic_show_inactive);panicButton.disabled=!panic.enabled;
    // Shared warm pulse covers the circle and its labels, only when usable.
    const pulse=Math.sin(this.game.t*Math.PI*3)>0;
    this.$('panic-wrap').classList.toggle('action-alert',panic.warning&&pulse);
    panicButton.setAttribute('aria-label',`Panic: ${panic.text||'emergency return to leg '+(this.game.panicLeg+1)}`);
    this.$('panic-status').textContent=panic.text;
    {const status=recoupleStatus(this.game),button=this.$('touch-c');
      const lastChance=status.enabled&&this.game.recoverableFragments.some(f=>8-f.age<1.75);
      button.disabled=!acceptsRecouplePress(this.game);button.setAttribute('aria-label',`Re-couple: ${status.text.toLowerCase()}`);
      button.setAttribute('aria-disabled',String(!status.enabled));
      button.setAttribute('aria-busy',String(this.game.recoupling.length>0));
      this.$('touch-recouple-status').textContent=status.text;
      this.$('touch-recoup-wrap').classList.toggle('action-disabled',!status.enabled);
      this.$('touch-recoup-wrap').classList.toggle('action-alert',lastChance&&pulse);
      this.$('touch-recoup-wrap').classList.toggle('action-rejected',this.canAct()&&!this.game.panic&&this.game.recoupleWait>0&&this.game.recoupleDeniedTime>0&&Math.cos((RECOUPLING.deniedSeconds-this.game.recoupleDeniedTime)*Math.PI*8)>0);
    }
  }
  draw(){
    if(!this.active)return;
    this.view=this.renderer.touchView(this.game);
    const svg=this.$('touch-guide'),v=this.view,move=this.move,depth=this.depth;
    const stick=move.id!==null?move:depth.id!==null?depth:null;
    svg.hidden=!v?.visible&&!stick;
    const set=(id,attrs)=>{const el=this.$(id);for(const [k,value] of Object.entries(attrs))el.setAttribute(k,String(value));return el;};
    const grab=set('touch-grab',{cx:v.x,cy:v.y,r:this.bonus?Math.max(this.rules.grabRadius,v.radius+16):Math.max(this.rules.grabRadius+18,v.radius+30)});grab.style.display=v.visible?'':'none';
    const axes=this.$('touch-axes');axes.style.display=v.visible&&!this.bonus?'':'none';
    if(!this.bonus)axisHandles(v,this.rules.grabRadius).forEach((h,i)=>{
      const line=set(`touch-axis-line-${i}`,{x1:v.x,y1:v.y,x2:h.x,y2:h.y});
      const dot=set(`touch-axis-dot-${i}`,{cx:h.x,cy:h.y});
      const text=set(`touch-axis-text-${i}`,{x:h.x,y:h.y+4});text.textContent=`${h.sign<0?'−':'+'}${h.axis.toUpperCase()}`;
      const selected=this.pullAxis?.axis===h.axis;for(const el of [line,dot,text])el.classList.toggle('selected',selected);
    });
    const ring=this.$('touch-ring'),tether=this.$('touch-tether'),knob=this.$('touch-knob'),label=this.$('touch-rush-label');
    for(const el of [ring,tether,knob,label])el.style.display=stick?'':'none';
    if(stick){
      const x=stick.x-this.rect.left,y=stick.y-this.rect.top,dx=stick.dx,dy=stick.dy;
      set('touch-ring',{cx:x,cy:y,r:this.rules.rushRadius});set('touch-tether',{x1:v.x,y1:v.y,x2:x+dx,y2:y+dy});set('touch-knob',{cx:x+dx,cy:y+dy});
      set('touch-rush-label',{x,y:y-this.rules.rushRadius-10});label.textContent=(this.pullAxis?`${this.pullAxis.axis.toUpperCase()} AXIS · `:'')+(stick.rush?'RUSH':'RUSH BEYOND RING');
      svg.classList.toggle('rushing',stick.rush);
    }
    this.$('touch-depth').classList.toggle('held',depth.id!==null);
  }
}
