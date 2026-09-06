// Standard Gamepad layout: https://w3c.github.io/gamepad/#remapping
// Poll fresh objects every animation frame; Firefox does not supply a reliable timestamp.
export const GAMEPAD_RULES=Object.freeze({enabled:true,deadzone:.18,triggerDeadzone:.06,menuThreshold:.55,menuDelay:.36,menuRepeat:.12});
const clamp=(n,min=-1,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
export const emptyMovement=()=>({x:0,y:0,z:0,rush:false});
export function deadzoneAxis(value,deadzone=GAMEPAD_RULES.deadzone) {
  value=clamp(value);return Math.abs(value)<=deadzone?0:Math.sign(value)*(Math.abs(value)-deadzone)/(1-deadzone);
}
const buttonValue=(pad,index)=>{
  const b=pad.buttons?.[index];return typeof b==='number'?clamp(b,0,1):clamp(b?.value??(b?.pressed?1:0),0,1);
};

export class GamepadInput {
  constructor({getGamepads=()=>{if(!globalThis.navigator?.getGamepads)throw Error("Gamepad API unavailable");return globalThis.navigator.getGamepads();},enabled=GAMEPAD_RULES.enabled}={}) {
    this.getGamepads=getGamepads;this.enabled=enabled;this.deadzone=GAMEPAD_RULES.deadzone;
    this.identity=null;this.index=null;this.connected=false;this.id='';this.status='waiting';
    this.suspend();
  }
  setDeadzone(value) {
    const n=Number(value);
    if(value===undefined||String(value).trim()===''||!Number.isFinite(n)||n<0||n>.8)throw Error('controller_deadzone expects a number from 0 to 0.8');
    this.deadzone=n;this.suspend();return n;
  }
  suspend() {this.waitingForNeutral=true;this.previousButtons=[];this.navigation=0;this.nextRepeat=0;this.movement=emptyMovement();}
  poll(now,{focused=true,bonus=false}={}) {
    let pads=[],failed=false;
    try {pads=Array.from(this.getGamepads()||[]).filter(p=>p&&p.connected!==false);}catch{failed=true;}
    const standard=pads.filter(p=>p.mapping==='standard'&&p.axes?.length>=2&&p.buttons?.length>=16);
    // Keep one player assigned to one pad until it disconnects. Never combine controllers.
    const pad=standard.find(p=>`${p.index}:${p.id}`===this.identity)??standard[0];
    const identity=pad?`${pad.index}:${pad.id}`:null;
    const disconnected=this.identity!==null&&this.identity!==identity;
    if(identity!==this.identity){this.identity=identity;this.suspend();}
    this.connected=Boolean(pad);this.index=pad?.index??null;this.id=pad?.id??'';
    this.status=!this.enabled?'disabled':failed?'unavailable':pad?'connected':pads.length?'unmapped':'waiting';
    const frame={movement:emptyMovement(),actions:{},menuStep:0,scroll:0,connected:this.connected,disconnected,status:this.status};
    this.movement=frame.movement;
    if(!pad||!this.enabled||!focused) {this.suspend();return frame;}
    const held=Array.from({length:17},(_,i)=>buttonValue(pad,i)>.5||pad.buttons[i]?.pressed===true);
    const x=deadzoneAxis(pad.axes[0],this.deadzone),y=-deadzoneAxis(pad.axes[1],this.deadzone);
    const scroll=deadzoneAxis(pad.axes[3]??0,this.deadzone);
    const left=deadzoneAxis(buttonValue(pad,6),GAMEPAD_RULES.triggerDeadzone),right=deadzoneAxis(buttonValue(pad,7),GAMEPAD_RULES.triggerDeadzone);
    // Require a release after focus changes, modal transitions and hotplug. The button
    // that reveals a controller to Firefox must not also confirm a menu by accident.
    if(this.waitingForNeutral) {
      if(!held.some(Boolean)&&x===0&&y===0&&scroll===0&&left===0&&right===0)this.waitingForNeutral=false;
      this.previousButtons=held;return frame;
    }
    const pressed=i=>held[i]&&!this.previousButtons[i];
    frame.actions={confirm:pressed(0),back:pressed(1),recouple:pressed(4)||pressed(2),locate:pressed(3),help:pressed(8),pause:pressed(9)};
    const horizontal=clamp(x+Number(held[15])-Number(held[14]));
    const vertical=clamp(y+Number(held[12])-Number(held[13]));
    frame.movement=bonus?{x:horizontal,y:0,z:-vertical,rush:held[5]}:{x:horizontal,y:vertical,z:clamp(left-right),rush:held[5]};
    const direction=held[12]||held[14]?-1:held[13]||held[15]?1:
      Math.abs(y)>GAMEPAD_RULES.menuThreshold?(y>0?-1:1):Math.abs(x)>GAMEPAD_RULES.menuThreshold?Math.sign(x):0;
    if(direction!==this.navigation){this.navigation=direction;this.nextRepeat=now+GAMEPAD_RULES.menuDelay;frame.menuStep=direction;}
    else if(direction&&now>=this.nextRepeat){frame.menuStep=direction;this.nextRepeat=now+GAMEPAD_RULES.menuRepeat;}
    frame.scroll=scroll;this.previousButtons=held;this.movement=frame.movement;
    return frame;
  }
}

export function mergeMovement(keyboard,controller) {
  return {x:clamp((keyboard.x||0)+(controller.x||0)),y:clamp((keyboard.y||0)+(controller.y||0)),
    z:clamp((keyboard.z||0)+(controller.z||0)),rush:Boolean(keyboard.rush||controller.rush)};
}

export function navigateControllerMenu(root,frame,document,dt) {
  const scrollTarget=root.querySelector?.('[role="tabpanel"]:not([hidden])')||root;
  if(frame.scroll)scrollTarget.scrollTop+=frame.scroll*Math.min(dt,.1)*550;
  const choices=[...root.querySelectorAll('button, input, a[href], summary')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length);
  let current=choices.indexOf(document.activeElement);
  if(frame.menuStep&&choices.length) {
    current=current<0?(frame.menuStep>0?0:choices.length-1):(current+frame.menuStep+choices.length)%choices.length;
    choices[current].focus({preventScroll:true});choices[current].scrollIntoView({block:'nearest'});
  }
  if(frame.actions.confirm&&choices.length) {
    // Select a safe first action if focus is outside the dialog. A second press confirms.
    if(current<0){choices[0].focus({preventScroll:true});choices[0].scrollIntoView({block:'nearest'});}
    else choices[current].click();
  }
}
