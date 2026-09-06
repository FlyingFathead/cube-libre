import * as T from '../vendor/three.module.min.js';

// Include every cell's possible rotation and its small depth oscillation.
export function titleBounds(cells) {
  const box=new T.Box3();
  for(const cell of cells) {
    const radius=.46*Math.sqrt(3)*cell.scale;
    box.expandByPoint(new T.Vector3(cell.pos[0]-radius,cell.pos[1]-radius,cell.pos[2]-radius-.12));
    box.expandByPoint(new T.Vector3(cell.pos[0]+radius,cell.pos[1]+radius,cell.pos[2]+radius+.12));
  }
  const center=box.getCenter(new T.Vector3()),half=box.getSize(new T.Vector3()).multiplyScalar(.5),corners=[];
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])corners.push(new T.Vector3(x*half.x,y*half.y,z*half.z));
  return {center,corners};
}

export function titleSafeArea(canvas,start,info) {
  const gap=Math.max(10,Math.min(24,canvas.width*.02));
  const top=Math.max(gap,start.bottom-canvas.top+gap);
  const bottom=Math.min(canvas.height-gap,info.top-canvas.top-gap);
  return {x:gap,y:top,width:Math.max(0,canvas.width-2*gap),height:Math.max(0,bottom-top)};
}

export function frameTitle(camera,bounds,rotation,width,height,area) {
  const tanY=Math.tan(camera.fov*Math.PI/360),aspect=width/height;
  const fitX=tanY*aspect*(area.width/width)*.94,fitY=tanY*(area.height/height)*.94;
  let distance=12;
  for(const corner of bounds.corners) {
    const p=corner.clone().applyEuler(rotation).multiplyScalar(.88*1.035);
    distance=Math.max(distance,p.z+Math.abs(p.x)/fitX,p.z+Math.abs(p.y)/fitY);
  }
  // Shift the optical center into the free area without tilting the title.
  const offsetX=width/2-(area.x+area.width/2),offsetY=height/2-(area.y+area.height/2),view=camera.view;
  if(!view?.enabled||view.fullWidth!==width||view.fullHeight!==height||view.offsetX!==offsetX||view.offsetY!==offsetY)
    camera.setViewOffset(width,height,offsetX,offsetY,width,height);
  camera.position.set(0,0,distance);camera.lookAt(0,0,0);
}

// Read layout only on entry, resize or changed text wrapping, not every frame.
export function observeTitleLayout(renderer,{canvas,start,info,title},Observer=globalThis.ResizeObserver) {
  let dirty=true,visible=false;
  const invalidate=()=>{dirty=true;};
  const observer=Observer?new Observer(invalidate):null;
  for(const element of [canvas,start,info])observer?.observe(element);
  return {invalidate,update(){
    if(title.hidden) {visible=false;return;}
    if(!visible)dirty=true;visible=true;
    if(!dirty&&observer)return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    if(renderer.width!==canvas.clientWidth||renderer.height!==canvas.clientHeight)renderer.resize();
    renderer.titleArea=titleSafeArea(rect,start.getBoundingClientRect(),info.getBoundingClientRect());
    dirty=false;
  }};
}
