// Browser presentation only: no simulation settings or automatic fullscreen.
const OFF='Off. Portrait and landscape both work. Rotating the device pauses play.';
const UNSUPPORTED='This browser cannot lock orientation. Use your device’s rotation lock, or keep playing with automatic rotation.';
const TYPES=['portrait-primary','portrait-secondary','landscape-primary','landscape-secondary'];

export class MobileOrientation {
  constructor({document,screen=document.defaultView?.screen,element=document.getElementById('game')}) {
    Object.assign(this,{document,screen,element});
    this.available=false;this.locked=false;this.busy=false;this.offerFullscreen=false;
    this.unsupported=typeof screen?.orientation?.lock!=='function';
    this.target=null;this.serial=0;this.message=this.unsupported?UNSUPPORTED:OFF;
    this.onChange=null;
    document.addEventListener?.('fullscreenchange',()=>{
      if(!document.fullscreenElement&&(this.locked||this.busy))this.release('Orientation lock released after leaving fullscreen.');
    });
    document.addEventListener?.('visibilitychange',()=>{
      if(document.hidden&&(this.locked||this.busy))this.release('Orientation lock released while the page was hidden. Enable it again when ready.');
    });
    document.defaultView?.addEventListener('pagehide',()=>this.release());
    screen?.orientation?.addEventListener?.('change',()=>{
      if(this.locked&&!this.matchesTarget())this.release('The browser released the orientation lock. Enable it again when ready.');
    });
  }
  notify(){this.onChange?.();}
  setAvailable(value){
    if(!value&&(this.locked||this.busy))this.release();
    this.available=Boolean(value);this.notify();
  }
  current() {
    const type=this.screen?.orientation?.type;
    if(TYPES.includes(type))return type;
    const view=this.document.defaultView;
    return view?.innerHeight>=view?.innerWidth?'portrait':'landscape';
  }
  matchesTarget(){
    const type=this.current();return type===this.target||type.startsWith(this.target+'-');
  }
  canFullscreen(){return !this.document.fullscreenElement&&this.document.fullscreenEnabled!==false&&typeof this.element?.requestFullscreen==='function';}
  unlock(){try{this.screen?.orientation?.unlock?.();}catch{}}
  release(message=OFF){
    const owned=this.locked||this.busy;
    this.serial++;this.locked=false;this.offerFullscreen=false;this.target=null;
    this.message=this.unsupported?UNSUPPORTED:message;
    if(owned)this.unlock();
    this.notify();
  }
  async request(enterFullscreen=false) {
    if(!this.available||this.busy||this.locked)return;
    if(this.unsupported){this.message=UNSUPPORTED;this.notify();return;}
    if(this.document.hidden)return;
    const serial=++this.serial;
    // Remember the physical orientation BEFORE fullscreen can rotate the screen.
    this.target=this.current();this.busy=true;this.offerFullscreen=false;
    this.message=enterFullscreen?'Entering fullscreen and locking…':'Locking orientation…';this.notify();
    let stage='fullscreen';
    try {
      if(enterFullscreen&&!this.document.fullscreenElement){
        if(!this.canFullscreen())throw Error('Fullscreen unavailable');
        await this.element.requestFullscreen();
      }
      if(serial!==this.serial)return;
      stage='lock';
      await this.screen.orientation.lock(this.target);
      if(serial!==this.serial){this.unlock();return;}
      this.locked=true;
      this.message=`Locked in ${this.target.startsWith('portrait')?'portrait':'landscape'} for this visit. Uncheck to allow rotation.`;
    } catch(error) {
      if(serial!==this.serial)return;
      this.locked=false;
      if(stage==='lock'&&error?.name==='NotSupportedError')this.unsupported=true;
      this.offerFullscreen=stage==='lock'&&!this.unsupported&&this.canFullscreen();
      this.message=this.unsupported?UNSUPPORTED:this.offerFullscreen?
        'Not locked yet. This browser may require fullscreen. Tap “Fullscreen & lock” to try.':
        'Orientation is not locked. Use your device’s rotation lock, or keep playing with automatic rotation.';
    } finally {this.busy=false;this.notify();}
  }
}

export function createOrientationOptions(document,orientation) {
  const body=document.createElement('div'),heading=document.createElement('h3');heading.textContent='SCREEN ORIENTATION';body.append(heading);
  const row=document.createElement('label');row.className='shake-setting';
  const input=document.createElement('input');input.type='checkbox';input.dataset.setting='orientation_lock';
  input.setAttribute('aria-describedby','orientation-status');
  row.append(input,'Lock current orientation');body.append(row);
  const status=document.createElement('p');status.id='orientation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
  const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.textContent='Fullscreen & lock';body.append(fullscreen);
  const update=()=>{
    body.hidden=!orientation.available;
    input.checked=orientation.locked;input.disabled=orientation.busy||orientation.unsupported;
    status.textContent=orientation.message;fullscreen.hidden=!orientation.offerFullscreen;fullscreen.disabled=orientation.busy;
  };
  // Help is rebuilt each time; retain only the current panel's observer.
  orientation.onChange=update;
  input.addEventListener('change',()=>{if(input.checked)void orientation.request();else orientation.release();update();});
  fullscreen.addEventListener('click',()=>{void orientation.request(true);});
  update();return body;
}
