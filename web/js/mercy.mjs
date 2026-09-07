// Quiet protection from a rapid series of real hits near the end of a body.
// This clock advances only during normal play, alongside ordinary hazards.
export const MERCY_ENABLED=true;
export const MERCY_NUMBERS=Object.freeze({
  mercy_seconds:{value:1.5,min:0,max:10},
  mercy_cube_threshold:{value:20,min:1,max:125,integer:true},
  mercy_damage_window_seconds:{value:.5,min:0,max:5},
  mercy_cooldown_seconds:{value:15,min:0,max:300},
});

export class Mercy {
  constructor() {
    this.time=0;
    this.until=0;
    this.readyAt=0;
    this.lastHit=null;
  }
  get active() { return this.time<this.until; }
  tick(dt) { this.time+=dt; }
  cancel() {
    this.until=0;
    this.lastHit=null;
    // Disabling the feature must not remove a cooldown already incurred.
  }
  limitLoss(count,loss,enabled,settings) {
    if(!enabled||loss<=0||count<=0)return loss;
    if(this.active)return 0;
    const rapid=this.lastHit!==null&&this.time-this.lastHit<=settings.mercy_damage_window_seconds;
    const trigger=rapid&&count-loss<=settings.mercy_cube_threshold&&
      this.time>=this.readyAt&&settings.mercy_seconds>0;
    this.lastHit=this.time;
    if(!trigger)return loss;
    this.until=this.time+settings.mercy_seconds;
    this.readyAt=this.until+settings.mercy_cooldown_seconds;
    this.lastHit=null;
    // Apply the triggering hit, but retain the last existing cube if it would
    // otherwise be fatal. No replacement cells or deferred damage are created.
    return Math.min(loss,count-1);
  }
}
