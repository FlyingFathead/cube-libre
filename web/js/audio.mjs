import {clamp,smooth,portalMetrics} from './core.mjs';
const root=new URL('../assets/audio/',import.meta.url);
const volumes={crash:.70,structure_alert:.48,portal:.88,laser_reveal:.64,laser_dissipate:.62,
  materialize:.62,death:.74,reassembly:.60,recouple:.62,collapse:.82,time_buzzer:.78};
const cooldowns={recouple:.18,crash:.075,structure_alert:.65,laser_reveal:.35,laser_dissipate:.28,collapse:.12,time_buzzer:.82};

export class GameAudio {
  constructor(onProgress=()=>{}) {
    this.onProgress=onProgress; this.buffers=new Map(); this.channels=new Map(); this.last=new Map();
    this.muted=false; this.ctx=null; this.ready=false; this.failed=[]; this.stopped=false;
    this.preferred=document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"')?'ogg':'mp3';
    this.encoded=new Map();
    // Fetch is independent of the gesture that unlocks sound. Never autoplay audio.
    this.preload=this.fetchAll(); this.preload.catch(()=>{});
  }
  async fetchAll() {
    const response=await fetch(new URL('manifest.json',root),{signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw Error(`Audio manifest: HTTP ${response.status}`);
    this.manifest=await response.json(); const names=Object.keys(this.manifest); let done=0;
    await Promise.all(names.map(async name=>{
      try {
        const res=await fetch(new URL(`${name}.${this.preferred}`,root),{signal:AbortSignal.timeout(30000)});
        if(!res.ok) throw Error(`HTTP ${res.status}`);
        this.encoded.set(name,await res.arrayBuffer());
      } catch {this.failed.push(name);}
      this.onProgress(++done,names.length);
    }));
  }
  async unlock() {
    if(!this.ctx) {
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx) throw Error('Web Audio is unavailable');
      this.ctx=new AudioCtx(); this.master=this.ctx.createGain(); this.master.gain.value=this.muted?0:.85; this.master.connect(this.ctx.destination);
    }
    await this.ctx.resume();
    if(this.ready) return;
    if(!this.decoding) this.decoding=this.decode();
    await this.decoding;
  }
  async decode() {
    await this.preload; this.failed=[];
    await Promise.all(Object.keys(this.manifest).map(async name=>{
      try {
        let data=this.encoded.get(name),buffer;
        try { if(!data) throw Error('Missing preferred codec'); buffer=await this.ctx.decodeAudioData(data.slice(0)); }
        catch {
          const fallback=this.preferred==='ogg'?'mp3':'ogg';
          const res=await fetch(new URL(`${name}.${fallback}`,root),{signal:AbortSignal.timeout(15000)});
          if(!res.ok) throw Error(`HTTP ${res.status}`);
          buffer=await this.ctx.decodeAudioData(await res.arrayBuffer());
        }
        this.buffers.set(name,buffer);
      } catch {this.failed.push(name);}
    }));
    this.encoded.clear(); this.ready=true;
  }
  mute(value=!this.muted) {
    this.muted=value;
    if(this.master) this.master.gain.setTargetAtTime(value?0:.85,this.ctx.currentTime,.02);
    return value;
  }
  pause(paused) {
    if(!this.ctx) return;
    if(paused&&this.ctx.state==='running') this.ctx.suspend().catch(()=>{});
    else if(!paused&&this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
  }
  stop(channel,fade=.15) {
    const item=this.channels.get(channel); if(!item) return;
    this.channels.delete(channel);
    const now=this.ctx.currentTime; item.gain.gain.cancelScheduledValues(now); item.gain.gain.setTargetAtTime(0,now,Math.max(.005,fade/4));
    try {item.source.stop(now+fade);} catch {}
  }
  stopAll() {for(const channel of [...this.channels.keys()]) this.stop(channel);}
  sound(name,volume=volumes[name]??.6,channel=name,loop=false) {
    if(!this.ready||!this.buffers.has(name)) return;
    const now=this.ctx.currentTime,existing=this.channels.get(channel);
    if(loop&&existing?.name===name) {existing.gain.gain.setTargetAtTime(volume,now,.1); return;}
    if(!loop&&now-(this.last.get(name)??-999)<(cooldowns[name]||0)) return;
    this.last.set(name,now); this.stop(channel,.025);
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    source.buffer=this.buffers.get(name); source.loop=loop;
    source.loopEnd=Math.min(source.buffer.duration,this.manifest[name].duration);
    source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(loop?0:volume,now);
    if(loop) gain.gain.setTargetAtTime(volume,now,.2);
    const item={source,gain,name}; this.channels.set(channel,item);
    source.onended=()=>{if(this.channels.get(channel)===item)this.channels.delete(channel);source.disconnect();gain.disconnect();};
    source.start();
  }
  update(g) {
    for(const event of g.events.splice(0)) {
      if(event.name==='stop') this.stopAll(); else this.sound(event.name);
    }
    if(!this.ready) return;
    const desired=new Map(),s=g.state,title=s==='title',playing=s==='playing',construct=s==='course_materialize';
    const bonusPlaying=s==='bonus_playing';
    const clock=bonusPlaying?g.bonus.timeLeft:g.legTime;
    const ambience=s.startsWith('bonus_')||['title','quit_confirm','opening_intro','level_ready','course_materialize','playing','result_overlay','space_intro','time_intro','entropy_intro','heat_intro'].includes(s);
    const metric=playing?portalMetrics(g.course,g.player):{charge:0,overlap:0,ratio:0};
    if(ambience) {
      desired.set('ambient',[title?.34:s==='level_ready'?.28:construct?.20:s==='result_overlay'?.17:s.endsWith('_intro')?.20:.15+.05*metric.charge,'ambient']);
      desired.set('gamelan',[(title?.26:s==='level_ready'?.22:construct?.205:s==='result_overlay'?.18:s.endsWith('_intro')?.16:.19)*10**(5/20),'gamelan']);
    }
    if(construct||playing) desired.set('field',[.18+.12*(1-g.player.alive.size/125)+.08*metric.charge,'field']);
    if(playing&&g.player.alive.size<=18&&g.player.alive.size>0) desired.set('critical',[.48,'critical']);
    if(playing&&metric.overlap>0) {
      const u=Math.max(smooth(metric.overlap/Math.max(1,g.player.alive.size)/.5)*.45,smooth((metric.ratio-.5)/.5));
      desired.set('portal_wou',[.16+.34*u,'portal_wou']);
    }
    if(bonusPlaying||g.difficulty.timed&&(playing||s==='time_intro')) {
      const urgency=1-clamp(clock/8); desired.set('time_tick',[.20+.18*urgency,'time_tick']);
      if((playing||bonusPlaying)&&clock>0&&clock<=10) this.sound('time_buzzer',.62+.24*(1-clock/10));
      if((playing||bonusPlaying)&&clock>0&&clock<=5) desired.set('time_siren',[.42+.26*(1-clock/5),'time_siren']);
    }
    for(const name of ['ambient','gamelan','field','critical','portal_wou','time_tick','time_siren']) {
      if(desired.has(name)) this.sound(name,desired.get(name)[0],name,true); else this.stop(name,.3);
    }
  }
}
