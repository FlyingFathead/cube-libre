// Recovery rules shared by the simulation, HUD and debris renderer.
// A failed piece is spent, never a candidate for a later request.
export const RECOUPLING=Object.freeze({
  capacity:125,fragmentSeconds:8,eligibleSeconds:7.95,travelSeconds:1.18,
  debrisSeconds:.9,wireframeAfterSeconds:.25,
  requestLimit:5,requestWindowSeconds:10,deniedSeconds:.6,
});

export function recoverableFragments(player) {
  if(player.alive.size<=0||player.alive.size>=RECOUPLING.capacity)return [];
  return player.fragments.filter(f=>f.age<RECOUPLING.eligibleSeconds&&f.lostAge===undefined);
}

export const recentRequests=game=>game.requests.filter(t=>t>game.t-RECOUPLING.requestWindowSeconds);
export function cooldownRemaining(game) {
  const requests=recentRequests(game);
  return requests.length>=RECOUPLING.requestLimit?Math.max(0,requests[0]+RECOUPLING.requestWindowSeconds-game.t):0;
}

export function selectRecovery(player,rate,targetCells) {
  const usable=recoverableFragments(player).sort((a,b)=>a.age-b.age||a.pos.sub(player.origin).length()-b.pos.sub(player.origin).length());
  const maximum=Math.min(RECOUPLING.capacity-player.alive.size,usable.length);
  if(maximum<=0)return [];
  const desired=maximum*rate;
  const count=Math.max(1,Math.min(maximum,Math.floor(desired)+(player.rng()<desired%1?1:0)));
  const targets=targetCells(player,count),selected=usable.slice(0,targets.length);
  const returning=new Set(selected);
  for(const fragment of usable)if(!returning.has(fragment))fragment.lostAge=0;
  player.fragments=player.fragments.filter(f=>!returning.has(f));
  return selected.map((f,i)=>({...f,start:f.pos,target:targets[i],delay:player.rng()*.2,scale:.8+player.rng()*.28}));
}
