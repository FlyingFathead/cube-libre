// Presentation of absent cells. These poses never enter the physical player or debris lists.
export const LOSS_ASSEMBLY=Object.freeze({seconds:3.75,scatterAt:2.45,fadeEnds:3.65});
export const LOSS_COLOUR=Object.freeze({onset:.025,exponent:2});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function lossGreyAmount(level,start=44,cap=50) {
  start=Math.max(1,start);
  if(level<start)return 0;
  const progress=cap<=start?1:clamp((level-start)/(cap-start));
  return LOSS_COLOUR.onset+(1-LOSS_COLOUR.onset)*progress**LOSS_COLOUR.exponent;
}
export function lossBodyColor(color,amount) {
  const grey=color[0]*.2126+color[1]*.7152+color[2]*.0722;
  return color.map(value=>value+(grey-value)*amount);
}
export function lossGhostPose(cell,index,time,shake=true) {
  const appear=smooth((time-.6)/.8),flight=Math.max(0,time-LOSS_ASSEMBLY.scatterAt);
  const fade=1-smooth(flight/(LOSS_ASSEMBLY.fadeEnds-LOSS_ASSEMBLY.scatterAt));
  const raw=cell.map((v,k)=>v+Math.sin(index*1.71+k*2.3)*.35),length=Math.hypot(...raw)||1;
  const direction=raw.map(v=>v/length);
  const jitter=shake&&time>1.15&&flight===0?.13*smooth((time-1.15)/1.3):0;
  return {position:cell.map((v,k)=>v+direction[k]*(flight*7+flight*flight*5)+jitter*Math.sin(time*(63+k*9)+index*2.1)),
    alpha:appear*fade*.85,scale:(.2+.8*appear)*(1-.6*(1-fade)),
    color:[.38,.38,.38],axis:direction,angle:flight*(180+index%17*9)};
}
