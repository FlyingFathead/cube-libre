// Shared rescue tuning and presentation; simulation owns activation and progress.
export const PANIC=Object.freeze({outsideSeconds:3,cooldownSeconds:30,scorePenaltyPercent:5,warningSeconds:10,pullSeconds:.65,holdSeconds:1.2,openSeconds:.9});

export function panicStatus(game) {
  const active=game.flags.panic&&game.state==='playing'&&game.player.alive.size>0;
  const outside=game.outside&&(game.outsideTime>=game.panicOutsideSeconds||game.heat>0);
  const visible=active&&(game.flags.panic_show_inactive||outside);
  const seconds=Math.ceil(game.panicCooldown);
  const enabled=Boolean(active&&!game.panic&&!game.paused&&!game.help&&seconds===0);
  const deadline=game.difficulty.timed&&game.legTime>0&&game.legTime<=PANIC.warningSeconds;
  return {visible:Boolean(visible),enabled,
    warning:Boolean(visible&&enabled&&(game.outside&&game.heat>0||deadline)),text:seconds>0?`COOLDOWN ${seconds} s`:''};
}

// A visibility hint can point at an unreached leg while drifting in space.
// Only physical corridor/junction containment advances the rescue checkpoint.
export function reachedLeg(course,point) {
  const joint=course.jointAt(point);
  if(joint>=0)return joint+1;
  let reached=-1;
  for(const module of course.nearby(point).modules) {
    const local=module.local(point),[start,end]=course.span(module);
    if(local.x>=start&&local.x<=end&&Math.abs(local.y)<=7&&Math.abs(local.z)<=7)
      reached=Math.max(reached,module.index);
  }
  return reached;
}
