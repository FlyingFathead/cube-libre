// Gathering every bonus piece earns one replacement body. Live protection is never saved.
export const BACKUP_NUMBERS=Object.freeze({
  backup_invincibility_seconds:{value:4,min:0,max:30},
});
export const BACKUP_REASSEMBLY_SECONDS=3.75;
export const BACKUP_AWARD_SECONDS=6;

export function perfectBonusGather(bonus) {
  return bonus.collected===bonus.rules.pieces&&
    bonus.pieces.length===bonus.rules.pieces&&bonus.pieces.every(piece=>piece.collected);
}

export class BackupProtection {
  constructor() {this.remaining=0;this.duration=0;}
  start(seconds) {this.remaining=this.duration=seconds;}
  tick(dt) {this.remaining=Math.max(0,this.remaining-dt);}
  get active() {return this.remaining>1e-9;}
  get glow() {
    if(!this.active)return 0;
    const fadeSeconds=Math.min(1.5,this.duration),fade=Math.min(1,this.remaining/fadeSeconds);
    if(fade===1)return 1;
    const flicker=.3+.7*Math.sin((this.duration-this.remaining)*Math.PI*8)**2;
    return fade*flicker;
  }
}

export function backupStatus(game) {
  const remaining=Math.max(0,BACKUP_REASSEMBLY_SECONDS-game.stateTime);
  const visible=Boolean(game.flags.backup_cubes_enabled&&game.backupCubes>0&&
    game.state==='reassembly'&&remaining>0&&!game.endPortalPreview);
  return {visible,enabled:visible&&!game.paused&&!game.help,remaining};
}

export function backupHelpText(game) {
  return `BACKUP CUBES: ${game.backupCubes}. Collect all 124 loose pieces (100%) in a bonus round to earn one Backup Cube. The reward is awarded at the end of that round, even if the timer beats you to the exit. Escape is required to bank bonus points. They stack for this run. During death reassembly, tap or click USE BACKUP CUBE at the top, press Space / Enter, or press Xbox A before reassembly finishes. One charge restores all 125 cubes, including pieces lost through LOSS, and returns you to the start of the furthest leg physically reached with a fresh leg timer. The white glow protects you from damage for ${game.backupSettings.backup_invincibility_seconds} seconds and flickers away as protection ends. The leg timer still runs. A later death starts the map again unless you spend another charge. Your reserve and each use are saved. New runs start with zero. ${game.flags.backup_flawless_levels?'Exiting a normal level through its portal with all 125 pieces intact also earns one Backup Cube. ':''}${game.flags.bonus_before_final?'An extra bonus also runs immediately before the final level.':''}`;
}
