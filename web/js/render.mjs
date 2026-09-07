import {PANIC} from './panic.mjs';
import {RECOUPLING} from './recoupling.mjs';
import * as T from '../vendor/three.module.min.js';
import {VISUAL_EFFECTS,END_PORTAL} from './config.mjs';
import {lossGreyAmount,lossBodyColor,lossGhostPose} from './loss.mjs';
import {PIECES_RULES,recoveredShape,rotateQ,multiplyQ,bonusHeat} from './bonus.mjs';
import {AscensionScene,ascensionPose,drawArrivalWaves} from './ending.mjs';
import {titleBounds,frameTitle} from './title-layout.mjs';
import {updatePortalWhiteLight,isEndPortal} from './portal-light.mjs';
import {RouteGuide,detailWindow,viewLocation,overviewZoom,createInfiniteStarfield,positionInfiniteStarfield,setStarPattern} from './space-view.mjs';
import { ASCENSION_TIMING,C,V,cells,cellColor,clamp,smooth,mix,lerp,rotate,radians,portalMetrics } from './core.mjs';

const vec=p=>new T.Vector3(p.x,p.y,p.z);
const white=[1,1,1],cyan=[0,1,.95],red=[1,.05,.03];
const colorMix=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
function heatedColor(color,t,heat,flashing=true) {
  if(heat<=0)return color;
  const h=clamp(heat),pulse=flashing?.5+.5*Math.sin(t*Math.PI*2*(5+5.5*h)):.25;
  const ember=[1,.025+.22*pulse,.008];
  const hot=colorMix(ember,[1,.88,.32],flashing?.5*h*pulse**6:0);
  return colorMix(color,hot,(.7+.28*h)*(flashing?.72+.28*pulse:1));
}
// Deterministic visual displacement: pause freezes it, and collisions never see it.
function overheatTremor(t,heat,cell=null) {
  if(heat<=0)return new V();
  const h=clamp(heat),phase=cell===null?0:cell*2.399;
  const amplitude=cell===null?VISUAL_EFFECTS.overheatBodyAmplitude*(.3+.7*h):VISUAL_EFFECTS.overheatCellAmplitude*h;
  return new V(
    .72*Math.sin(t*145+phase)+.28*Math.sin(t*89+phase),
    .72*Math.cos(t*139+phase)+.28*Math.sin(t*97+phase),
    .72*Math.sin(t*157+phase)+.28*Math.cos(t*113+phase),
  ).mul(amplitude);
}
export function hsv(h,s=1,v=1) {
  h=((h%1)+1)%1; const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];
}
const boxCorners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const edgeIndices=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

class Lines {
  constructor(parent,capacity=40000) {
    this.count=0; this.capacity=capacity;
    this.positions=new Float32Array(capacity*3); this.colors=new Float32Array(capacity*4);
    this.geo=new T.BufferGeometry();
    this.geo.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('rgba',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));
    this.mat=new T.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:'attribute vec4 rgba; varying vec4 vColor; void main(){vColor=rgba;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec4 vColor; void main(){gl_FragColor=vColor;}' });
    this.mesh=new T.LineSegments(this.geo,this.mat); this.mesh.frustumCulled=false; this.mesh.renderOrder=2; parent.add(this.mesh);
  }
  reset() {this.count=0;}
  line(a,b,color=cyan,alpha=1) {
    if(alpha<=.002||this.count+2>this.capacity) return;
    for(const p of [a,b]) {
      this.positions.set(p.array(),this.count*3); this.colors.set([...color,alpha],this.count*4); this.count++;
    }
  }
  loop(pts,col,alpha) { for(let i=0;i<pts.length;i++) this.line(pts[i],pts[(i+1)%pts.length],col,alpha); }
  finish() {this.geo.setDrawRange(0,this.count); this.geo.attributes.position.needsUpdate=true; this.geo.attributes.rgba.needsUpdate=true;}
}

// All nearby electric sheets share one small reusable geometry and draw call.
class ShutterPanels {
  constructor(parent,capacity=30) {
    this.count=0;this.capacity=capacity;this.positions=new Float32Array(capacity*18);this.colors=new Float32Array(capacity*24);
    this.geo=new T.BufferGeometry();
    this.geo.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('rgba',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));
    this.mesh=new T.Mesh(this.geo,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
      vertexShader:'attribute vec4 rgba; varying vec4 vColor; void main(){vColor=rgba;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec4 vColor; void main(){gl_FragColor=vColor;}'}));
    this.mesh.frustumCulled=false;this.mesh.renderOrder=1;parent.add(this.mesh);
  }
  reset(){this.count=0;}
  add(corners,color,alpha) {
    if(this.count>=this.capacity||alpha<=.002)return;
    [0,1,2,0,2,3].forEach((i,j)=>{const n=this.count*6+j;this.positions.set(corners[i].array(),n*3);this.colors.set([...color,alpha],n*4);});
    this.count++;
  }
  finish(){this.geo.setDrawRange(0,this.count*6);this.geo.attributes.position.needsUpdate=true;this.geo.attributes.rgba.needsUpdate=true;}
}

class Cubes {
  constructor(parent,lines,capacity=600) {
    this.lines=lines; this.count=0; this.capacity=capacity;
    const geo=new T.BoxGeometry(.92,.92,.92);
    const shade=[]; const normals=geo.attributes.normal;
    for(let i=0;i<normals.count;i++) {
      const n=new T.Vector3().fromBufferAttribute(normals,i);
      const v=.56+.28*Math.max(0,n.y)+.16*Math.max(0,n.x)+.10*Math.max(0,n.z);
      shade.push(v,v,v);
    }
    geo.setAttribute('color',new T.Float32BufferAttribute(shade,3));
    this.alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);
    geo.setAttribute('instanceAlpha',this.alpha);
    const mat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    mat.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceAlpha; varying float vAlpha;').replace('#include <begin_vertex>','#include <begin_vertex>\nvAlpha=instanceAlpha;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vAlpha;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    this.mesh=new T.InstancedMesh(geo,mat,capacity); this.mesh.frustumCulled=false; this.mesh.renderOrder=1;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); parent.add(this.mesh);
    this.dummy=new T.Object3D(); this.col=new T.Color();
  }
  reset() {this.count=0;}
  cube(pos,color,scale=1,axis=new V(0,1,0),angle=0,alpha=1,wire=false,outline=null,quaternion=null) {
    if(this.count>=this.capacity||alpha<.005||scale<.001) return;
    const d=this.dummy; d.position.copy(vec(pos)); d.scale.setScalar(scale);
    if(quaternion)d.quaternion.fromArray(quaternion);else d.quaternion.setFromAxisAngle(vec(axis.norm()),radians(angle)); d.updateMatrix();
    if(!wire) {
      this.mesh.setMatrixAt(this.count,d.matrix); this.col.setRGB(...color); this.mesh.setColorAt(this.count,this.col);
      this.alpha.setX(this.count,alpha); this.count++;
    }
    const corners=boxCorners.map(c=>{
      const p=new T.Vector3(...c).multiplyScalar(.46).applyMatrix4(d.matrix); return new V(p.x,p.y,p.z);
    });
    const edgeColor=outline||(wire?color:color.map(v=>v*.20));
    for(const [i,j] of edgeIndices) this.lines.line(corners[i],corners[j],edgeColor,alpha);
  }
  finish() {
    this.mesh.count=this.count; this.mesh.instanceMatrix.needsUpdate=true;
    if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate=true;
    this.alpha.needsUpdate=true;
  }
}

export class Renderer {
  constructor(canvas,fx,titleCells) {
    this.canvas=canvas; this.fx=fx; this.ctx=fx.getContext('2d'); this.titleCells=titleCells;
    this.gl=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.gl.outputColorSpace=T.LinearSRGBColorSpace; this.gl.setPixelRatio(Math.min(devicePixelRatio||1,2));
    this.scene=new T.Scene(); this.camera=new T.PerspectiveCamera(45,1,.1,12000);
    this.rotator=new T.Group(); this.world=new T.Group(); this.rotator.add(this.world); this.scene.add(this.rotator);
    this.lines=new Lines(this.world); this.cubes=new Cubes(this.world,this.lines);
    this.shutterPanels=new ShutterPanels(this.world);
    this.stars=createInfiniteStarfield(this.scene);this.createBonusArena();this.resize();
  }
  createBonusArena() {
    const r=PIECES_RULES;this.bonusArena=new T.Group();this.world.add(this.bonusArena);this.bonusArena.visible=false;
    const slab=(w,h,d,x,y,z,color)=>{
      const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({color}));
      m.position.set(x,y,z);this.bonusArena.add(m);return m;
    };
    slab(r.floorHalfWidth*2,1,r.floorNearZ-r.floorFarZ,0,-.5,(r.floorNearZ+r.floorFarZ)/2,0x122431);
    const geo=new T.BoxGeometry(r.rampHalfWidth*2,1,r.floorFarZ-r.rampEndZ),a=geo.attributes.position;
    for(let i=0;i<a.count;i++) {
      const z=a.getZ(i)+(r.floorFarZ+r.rampEndZ)/2;
      a.setXYZ(i,a.getX(i),a.getY(i)>0?(r.floorFarZ-z)/(r.floorFarZ-r.rampEndZ)*r.rampHeight:-1,z);
    }
    geo.computeVertexNormals();
    this.bonusArena.add(new T.Mesh(geo,new T.MeshBasicMaterial({color:0x28485b})));
    slab(r.rampHalfWidth*2,r.rampHeight+1,r.rampEndZ-r.landingEndZ,0,(r.rampHeight-1)/2,(r.rampEndZ+r.landingEndZ)/2,0x345368);
    const glow=new T.Mesh(new T.PlaneGeometry(12,8),new T.MeshBasicMaterial({color:0xd5fff7,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}));
    glow.position.set(0,r.rampHeight+4,r.portalZ);this.bonusArena.add(glow);
  }
  bonus(g) {
    const b=g.bonus,r=b.rules,t=g.stateTime;
    const failing=g.state==='bonus_escape'&&b.result==='timeout';
    const heat=g.state==='bonus_playing'?bonusHeat(b.timeLeft):0;
    // Solid slabs provide occlusion; fine lines reveal the surface and ramp slope.
    for(let x=-24;x<=24;x+=2)this.lines.line(new V(x,.012,r.floorFarZ),new V(x,.012,r.floorNearZ),[.22,.48,.61],.32);
    for(let z=r.floorFarZ;z<=r.floorNearZ;z+=2)this.lines.line(new V(-24,.012,z),new V(24,.012,z),[.22,.48,.61],.32);
    const rail=(x1,z1,x2,z2)=>this.lines.line(new V(x1,b.ground(x1,z1)+.18,z1),new V(x2,b.ground(x2,z2)+.18,z2),[.38,.88,.95],.85);
    rail(-24,22,24,22);rail(-24,22,-24,-14);rail(24,22,24,-14);
    rail(-24,-14,-7,-14);rail(7,-14,24,-14);
    for(const x of [-7,7]) {rail(x,-14,x,-26);rail(x,-26,x,r.landingEndZ);}
    rail(-7,r.landingEndZ,7,r.landingEndZ);
    // Direction chevrons lead up the ramp and toward the portal.
    for(let z=-14;z>=r.landingEndZ;z-=2) {
      const h=b.ground(0,z)+.025;
      this.lines.line(new V(-6,h,z),new V(6,h,z),cyan,.20);
      this.lines.line(new V(-.6,h,z+.6),new V(0,h+.02,z),white,.65);
      this.lines.line(new V(.6,h,z+.6),new V(0,h+.02,z),white,.65);
    }
    for(let ring=0;ring<5;ring++) {
      const d=ring*.12,z=r.portalZ+Math.sin(g.t*2+ring)*.08;
      this.lines.loop([new V(-6-d,6-d,z),new V(6+d,6-d,z),new V(6+d,14+d,z),new V(-6-d,14+d,z)],hsv(g.t*.035+ring*.055,.45,1),.85-ring*.12);
    }
    for(let i=0;i<22;i++) {
      const a=i*2.399+g.t*.65,k=(i/22+g.t*.15)%1;
      this.cubes.cube(new V(Math.cos(a)*5*k,10+Math.sin(a)*3*k,r.portalZ-.2),[.7,1,.94],.08+.12*k);
    }
    const smash=g.state==='bonus_smash',impact=t-r.impactAt,q=clamp(impact/(r.smashSeconds-r.impactAt));
    if(smash&&impact<0) {
      const f=clamp(t/r.impactAt),center=new V(-7*(1-f),2.46+18*(1-f*f),r.spawnZ);
      for(let i=0;i<cells.length;i++)this.cubes.cube(center.add(rotate(V.of(cells[i]),new V(0,0,1),30*(1-f))),cellColor(i),1,new V(0,0,1),30*(1-f));
    } else {
      for(const p of b.pieces)if(!p.collected) {
        let pos=new V(p.x,.46,p.z),angle=0;
        if(smash) {
          const index=p.id>=62?p.id+1:p.id,start=new V(r.spawnX,2.46,r.spawnZ).add(V.of(cells[index]));
          pos=lerp(start,pos,smooth(q));pos.y+=Math.sin(q*Math.PI)*p.arc;
          angle=p.spin*q*Math.sin(q*Math.PI);
        }
        this.cubes.cube(pos,cellColor(p.id),1,new V(1,.7,.4),angle);
        this.lines.loop([new V(p.x-.5,.025,p.z-.5),new V(p.x+.5,.025,p.z-.5),new V(p.x+.5,.025,p.z+.5),new V(p.x-.5,.025,p.z+.5)],[.4,.65,.75],.2);
      }
      const escape=g.state==='bonus_escape'&&b.result==='escaped'?smooth(t/2):0;
      const tremor=new V(Math.sin(g.t*145)*.22,Math.cos(g.t*139)*.09,Math.sin(g.t*157)*.18).mul(g.flags.shake?heat:0);
      const hero=new V(b.x,b.y+(smash?Math.sin(q*Math.PI)*2:0)+escape*2,b.z-escape*5).add(tremor);
      for(const [i,offset] of (failing?[]:recoveredShape(b.bodyCount)).entries()) {
        const pos=hero.add(V.of(rotateQ(offset,b.orientation)));
        const color=heatedColor(i===0?[1,.96,.73]:cellColor(i),g.t,heat,g.flags.shake);
        this.cubes.cube(pos,color,1-escape*.8,new V(0,1,0),0,1-escape,false,i===0?[.7,.9,1]:null,b.orientation);
      }
      if(heat>0)for(let i=0;i<26;i++) {
        const a=i*2.399,radius=b.side*.55,pos=hero.add(new V(Math.cos(a)*radius,Math.sin(a)*radius,Math.sin(i*3.12)*radius));
        this.lines.line(pos,pos.add(new V(Math.sin(g.t*13+i)*.3,.6+heat*.9,0)),[1,.3,.015],heat*.7);
      }
      if(failing)for(const part of b.explosion) {
        const dissolve=smooth(t/r.explosionSeconds),travel=(1-Math.exp(-.18*t))/.18;
        const pos=part.origin.add(part.vel.mul(travel));
        const angle=radians(part.spin*t)/2,sin=Math.sin(angle),axis=part.axis;
        const orientation=multiplyQ([axis.x*sin,axis.y*sin,axis.z*sin,Math.cos(angle)],part.orientation);
        const color=colorMix(heatedColor(part.color,g.t,1-dissolve,g.flags.shake),white,smooth(t/.8));
        this.cubes.cube(pos,color,1-.9*dissolve,part.axis,0,1-dissolve,false,null,orientation);
        this.lines.line(pos,pos.sub(part.vel.mul(.055)),[1,.5+.5*dissolve,.2+.8*dissolve],1-dissolve);
      }
      // A bright contact ring keeps the one-piece player legible among the wreckage.
      const pts=[];for(let i=0;i<32;i++){const a=i*Math.PI/16,rad=.9+b.side*.55;const x=b.x+Math.cos(a)*rad,z=b.z+Math.sin(a)*rad;pts.push(new V(x,b.ground(x,z)+.035,z));}
      this.lines.loop(pts,[1,.92,.45],failing?0:.9*(1-escape));
      for(const p of b.pickupFlashes) {
        const f=p.age/.45,start=new V(p.x,.7,p.z),pos=lerp(start,hero,smooth(f));pos.y+=Math.sin(f*Math.PI)*2;
        this.cubes.cube(pos,[.85,1,.7],.6*(1-f));this.lines.line(start,pos,[.9,1,.7],1-f);
      }
    }
    // Establish the arena during the crash, then follow from its near side.
    // The camera moves, but never orbits past the player's left/right controls.
    const follow=smash?smooth((t-1.5)/2.1):1,wide=Math.max(1,.95/this.camera.aspect);
    const target=new V(b.x*.72*follow,1+b.ground(b.x,b.z)*follow,mix(-3,b.z-5,follow));
    const shake=!g.flags.shake?0:smash?Math.exp(-Math.max(0,impact)*10)*(impact>=0?Math.sin(impact*95)*.7:0):
      failing?Math.sin(g.t*145)*.6*Math.exp(-t*4):Math.sin(g.t*145)*heat*.1;
    this.camera.position.set(mix(15,b.x*.72+5,follow)+shake,mix(48,29,follow)*wide+target.y,mix(36,b.z+27,follow)*wide);
    this.camera.lookAt(target.x,target.y,target.z);
  }
  resize() {
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if(w<=0||h<=0)return;
    this.gl.setPixelRatio(Math.min(devicePixelRatio||1,this.pixelRatioCap??2));
    this.width=w; this.height=h; this.gl.setSize(w,h,false); this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    const ratio=Math.min(devicePixelRatio||1,this.pixelRatioCap??2); this.fx.width=Math.round(w*ratio); this.fx.height=Math.round(h*ratio);
    this.ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  touchView(g) {
    this.camera.updateMatrixWorld();this.world.updateWorldMatrix(true,false);
    const inv=this.world.getWorldQuaternion(new T.Quaternion()).invert();
    const cameraRotation=this.camera.getWorldQuaternion(new T.Quaternion());
    const axis=(x,y,z)=>new T.Vector3(x,y,z).applyQuaternion(cameraRotation).applyQuaternion(inv);
    const basis={right:axis(1,0,0),up:axis(0,1,0),forward:axis(0,0,-1)};
    const positions=g.state==='bonus_playing'?[new T.Vector3(g.bonus.x,g.bonus.y,g.bonus.z)]:[...g.player.alive].map(i=>vec(g.player.pos(i)));
    const center=new T.Vector3();for(const point of positions)center.add(point);center.multiplyScalar(1/Math.max(1,positions.length));
    const project=point=>point.clone().applyMatrix4(this.world.matrixWorld).project(this.camera);
    const p=project(center),x=(p.x+1)*this.width/2,y=(1-p.y)*this.height/2;
    let radius=0;for(const point of positions){const q=project(point);radius=Math.max(radius,Math.hypot((q.x-p.x)*this.width/2,(q.y-p.y)*this.height/2));}
    return {x,y,radius:Math.min(radius+8,100),basis,visible:positions.length>0&&p.z>=-1&&p.z<=1&&x>=0&&x<=this.width&&y>=0&&y<=this.height};
  }
  box(map,x0,x1,y0,y1,z0,z1,color,alpha) {
    const pts=boxCorners.map(c=>map(c[0]<0?x0:x1,c[1]<0?y0:y1,c[2]<0?z0:z1));
    for(const [a,b] of edgeIndices) this.lines.line(pts[a],pts[b],color,alpha);
  }
  course(g,preview=false) {
    const c=g.course,p=g.player.origin,t=g.t,window=detailWindow(g,preview),{location,reveal,first,last}=window;
    if(this.routeGuide?.course!==c) {this.routeGuide?.dispose();this.routeGuide=new RouteGuide(this.world,c);}
    this.routeGuide.update(g,window,preview);
    const progress=preview?smooth(g.stateTime/7):1;
    for(const m of c.modules.slice(first,last+1)) {
      const i=m.index;
      const fade=preview?0:c.fade(i,p,t),alpha=(1-fade)*(fade>.01?.58+.42*(.5+.5*Math.sin(t*Math.PI*22+i)) : 1);
      const future=!preview&&g.level>=g.balance.spaceStartLevel&&i>reveal;
      const col=future?[.45,.48,.52]:[.25,.62,.8];
      const [x0,x1]=c.span(m),map=(x,y,z)=>m.world(x,y,z);
      this.box(map,x0,x1,-7,7,-7,7,col,alpha*(future?.22:.48)*(.18+.82*progress));
      for(let x=Math.ceil(x0/2)*2;x<=x1;x+=2) {
        this.lines.loop([map(x,-7,-7),map(x,7,-7),map(x,7,7),map(x,-7,7)],col,alpha*.14*progress);
      }
      for(let v=-6;v<=6;v+=2) for(const side of [-7,7]) {
        this.lines.line(map(x0,side,v),map(x1,side,v),col,alpha*.12*progress);
        this.lines.line(map(x0,v,side),map(x1,v,side),col,alpha*.12*progress);
      }
    }
    const joints=last<first?[]:c.joints.slice(Math.max(0,first-1),last+1);
    joints.forEach(j=>{
      const i=j.index;
      const alpha=(1-(preview||c.rescueJoint===i?0:c.fade(i,p,t)))*progress;
      const map=(x,y,z)=>j.center.add(new V(x,y,z));
      this.box(map,-7,7,-7,7,-7,7,[.3,.65,.85],alpha*.4);
      for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
        if(j.open.some(d=>d[axis]===sign)) continue;
        const a=(axis+1)%3,b=(axis+2)%3;
        for(let v=-6;v<=6;v+=2) for(const k of [a,b]) {
          const other=k===a?b:a,s=[0,0,0],e=[0,0,0]; s[axis]=e[axis]=7*sign;
          s[k]=e[k]=v; s[other]=-7; e[other]=7;
          this.lines.line(j.center.add(V.of(s)),j.center.add(V.of(e)),[.3,.65,.85],alpha*.13);
        }
      }
      const start=c.collapsed.get(i);
      if(!preview&&start!==undefined&&t-start<1.35) {
        const m=c.modules[i],a=(1-(t-start)/1.35)*(.3+.7*Math.abs(Math.sin(t*41)));
        for(let n=-7;n<=7;n++) this.lines.line(m.world(23,-7,n),m.world(23,7,n),[.6,.92,1],a);
      }
    });
    if(g.panic||c.rescueChamber)this.panicPrison(g);
    if(preview)return; // The overview introduces the field, never its cutting grids.
    for(const l of c.moduleLasers.slice(first,last+1).flat()) {
      const i=l.module.index;
      const fade=preview?0:c.fade(i,p,t); if(fade>=.995) continue;
      const future=!preview&&g.level>=g.balance.spaceStartLevel&&i>reveal;
      const rp=preview?smooth((progress-.24-i*.045)/.48):c.revealProgress(i,t);
      if(preview&&rp<=0) continue;
      this.laser(l,t,future,(1-fade)*(future?.22:rp),fade,g.shutterState(l));
    }
  }
  panicPrison(g) {
    const {module,center,time}=g.panic||{...g.course.rescueChamber,time:PANIC.pullSeconds+PANIC.holdSeconds+PANIC.openSeconds},opening=smooth((time-PANIC.pullSeconds-PANIC.holdSeconds)/PANIC.openSeconds);
    const map=(x,y,z)=>center.add(module.bx.mul(x)).add(module.by.mul(y)).add(module.bz.mul(z));
    const color=[.65,.86,1];
    this.box(map,-6,6,-6,6,-6,6,color,.8);
    if(time<PANIC.pullSeconds) {
      const body=g.player.origin,alpha=.7*(1-time/PANIC.pullSeconds);
      this.lines.line(body,center,[1,1,1],alpha);
      for(let i=0;i<8;i++) {
        const angle=i*Math.PI/4,offset=module.by.mul(Math.cos(angle)*3.5).add(module.bz.mul(Math.sin(angle)*3.5));
        this.lines.line(body.add(offset),center,[.9,.97,1],alpha*.6);
      }
    }
    // Five fixed faces; the forward bars retract upward into the frame.
    for(const x of [-6,6])for(let z=-5;z<=5;z+=2)
      this.lines.line(map(x,x>0?-6+12*opening:-6,z),map(x,6,z),color,.85);
    for(const z of [-6,6])for(let x=-5;x<=5;x+=2)
      this.lines.line(map(x,-6,z),map(x,6,z),color,.65);
    for(const y of [-6,6])for(let z=-5;z<=5;z+=2)
      this.lines.line(map(-6,y,z),map(6,y,z),color,.5);
  }
  laser(l,t,future=false,alpha=1,fade=0,shutter=null) {
    const m=l.module,local=(y,z)=>{
      const r=rotate(new V(0,y,z),l.axis,l.angle(t));
      return l.center.add(m.bx.mul(r.x)).add(m.by.mul(r.y)).add(m.bz.mul(r.z));
    };
    const closed=!future&&shutter?.closed,warning=!future&&shutter?.warning;
    const h=l.half,[gy,gz]=l.gap(t),safe=closed?0:l.safe;
    const color=future?[.5,.53,.58]:closed?[.55,.83,1]:colorMix(red,[.4,.35,.3],fade);
    this.lines.loop([local(-h,-h),local(h,-h),local(h,h),local(-h,h)],color,alpha*.6);
    if(!closed)this.lines.loop([local(gy-safe,gz-safe),local(gy+safe,gz-safe),local(gy+safe,gz+safe),local(gy-safe,gz+safe)],future?color:warning?[1,.65,.05]:cyan,alpha*(warning?.65+.35*shutter.charge:.48));
    if(future) return;
    if(closed) {
      const corners=[local(-h,-h),local(h,-h),local(h,h),local(-h,h)];
      this.shutterPanels?.add(corners,color,alpha*(.22+.06*Math.sin(t*35)**2));
      for(const sign of [-1,1])for(let j=0;j<14;j++) {
        const y=-h+2*h*j/14,next=-h+2*h*(j+1)/14;
        const z=sign*y+(j===0?0:.35*Math.sin(j*19+t*70));
        const nz=sign*next+(j===13?0:.35*Math.sin((j+1)*19+t*70));
        this.lines.line(local(y,clamp(z,-h,h)),local(next,clamp(nz,-h,h)),white,alpha*.85);
      }
    }
    const emit=(y1,z1,y2,z2)=>{
      if(Math.abs(y2-y1)+Math.abs(z2-z1)<.03) return;
      this.lines.line(local(y1,z1),local(y2,z2),color,alpha*.95);
      // Tiny parallel glow reproduces the legacy wide red beams without a postprocessing dependency.
      this.lines.line(local(y1+.035,z1+.035),local(y2+.035,z2+.035),color,alpha*.2);
    };
    for(let z=-h;z<=h+1e-6;z+=l.spacing) {
      if(z>=gz-safe&&z<=gz+safe) {emit(-h,z,Math.max(-h,gy-safe),z);emit(Math.min(h,gy+safe),z,h,z);}
      else emit(-h,z,h,z);
    }
    for(let y=-h;y<=h+1e-6;y+=l.spacing) {
      if(y>=gy-safe&&y<=gy+safe) {emit(y,-h,y,Math.max(-h,gz-safe));emit(y,Math.min(h,gz+safe),y,h);}
      else emit(y,-h,y,h);
    }
  }
  portal(g) {
    const t=g.t,m=g.course.portal,charge=g.state==='playing'?portalMetrics(g.course,g.player).charge:0;
    const final=isEndPortal(g),scale=final?END_PORTAL.frameScale:1;
    const local=(x,y,z)=>m.world(20+x,y,z),half=C.PORTAL_SIZE/2*scale;
    for(let ring=0;ring<7;ring++) {
      const h=half+ring*(.13+.16*charge)*scale,depth=Math.sin(t*2+ring*.7)*.12;
      this.lines.loop([local(depth,-h,-h),local(depth,h,-h),local(depth,h,h),local(depth,-h,h)],
        final?white:hsv(.48+ring*.04+t*.045,.8,1),(final?1:.7)-ring*.075);
    }
    for(let k=0;k<14;k++) {
      const pts=[],phase=t*(.5+charge*1.8)+k*Math.PI*2/14;
      for(let n=0;n<20;n++) {
        const r=half*n/20,a=phase+r*(1.1+charge*1.3);
        pts.push(local(.04+Math.sin(r+t)*.05,Math.cos(a)*r,Math.sin(a)*r));
      }
      for(let n=1;n<pts.length;n++) this.lines.line(pts[n-1],pts[n],final?white:hsv(t*.08+k/30,.75,1),final?.6+charge*.4:.24+charge*.5);
    }
    for(let k=0;k<8;k++) {
      const a=k*Math.PI/4+t*.22,r=half+.2+charge*2.4;
      this.lines.loop([local(0,Math.cos(a)*half,Math.sin(a)*half),local(-charge,Math.cos(a-.17)*r,Math.sin(a-.17)*r),
        local(-charge,Math.cos(a+.17)*r,Math.sin(a+.17)*r)],final?white:hsv(k/8+t*.08,.8,1),final?.65+.35*charge:.35+.5*charge);
    }
  }
  player(g) {
    const p=g.player,t=g.t;
    const bodyRotation=new T.Quaternion().fromArray(p.spinQuaternion);
    const recoil=g.flags.rotation_shocks&&g.rotationShock.angle.length()>0;
    const shockRotation=recoil?new T.Quaternion().setFromEuler(new T.Euler(...g.rotationShock.angle.array().map(radians),'ZYX')):null;
    if(recoil)bodyRotation.premultiply(shockRotation);
    const bodyOrientation=bodyRotation.toArray();
    const heat=g.state==='playing'&&g.flags.shake?g.heat:0,bodyTremor=overheatTremor(t,heat);
    const visualPosition=i=>{
      let pos=p.pos(i);
      if(recoil) {const offset=vec(pos.sub(p.origin)).applyQuaternion(shockRotation);pos=p.origin.add(new V(offset.x,offset.y,offset.z));}
      return pos.add(bodyTremor).add(overheatTremor(t,heat,i));
    };
    for(const i of p.alive) {
      const pos=p.pos(i),l=g.course.portal.local(pos);
      if(['playing','portal_warp'].includes(g.state)&&l.x-20>=C.PORTAL_ABSORB_X-C.PORTAL_VISUAL_ABSORB_LEAD&&Math.max(Math.abs(l.y),Math.abs(l.z))<=C.PORTAL_CAPTURE_HALF) continue;
      let color=this.lossColor(g,cellColor(i)),scale=1;
      if(g.heat>0) color=heatedColor(color,t,g.heat,g.flags.shake);
      else if(g.cool>0) color=colorMix(color,[.1,.5,1],g.cool);
      if(g.hitTime>0&&g.heat<=0&&Math.sin(t*17*Math.PI*2)>0) color=g.lastHit==='laser'?[1,.2,.1]:[.4,.85,1];
      if(g.state==='course_materialize') scale=smooth((g.stateTime/7-i/125*.22)/.72);
      this.cubes.cube(visualPosition(i),color,scale,null,0,1,false,null,bodyOrientation);
    }
    for(const f of p.fragments) {
      const lost=f.lostAge!==undefined,wire=lost&&f.lostAge>=RECOUPLING.wireframeAfterSeconds,expiry=RECOUPLING.fragmentSeconds-f.age,alpha=(1-f.age/RECOUPLING.fragmentSeconds)*(lost?1-smooth(f.lostAge/RECOUPLING.debrisSeconds):1);
      const color=lost?colorMix([.55,.55,.55],[.025,.025,.025],smooth(f.lostAge/RECOUPLING.debrisSeconds)):colorMix(f.color,[.55,.55,.55],smooth(f.age/RECOUPLING.fragmentSeconds));
      if(!lost&&expiry<1.75&&Math.sin(t*(12+20*(1-expiry/1.75)))<0) continue;
      this.cubes.cube(f.pos,!lost&&f.heat?colorMix(color,[1,.16,.01],f.heat*alpha):color,1,f.axis,f.angle,alpha,wire);
    }
    for(const part of g.recoupling) {
      const q=smooth((g.recoupleTime/1.18-part.delay)/(1-part.delay)),target=visualPosition(part.target);
      const pos=lerp(part.start,target,q).add(new V(0,Math.sin(q*Math.PI)*2,0));
      const orientation=new T.Quaternion().setFromAxisAngle(vec(part.axis),radians(part.angle+q*720));
      orientation.slerp(bodyRotation,smooth((q-.65)/.35));
      this.cubes.cube(pos,colorMix(part.color,this.lossColor(g,cellColor(part.target)),q),part.scale,part.axis,0,1,false,null,orientation.toArray());
      this.lines.line(pos,target,cyan,.3*(1-q));
    }
    if(g.heat>0) for(let i=0;i<26;i++) {
      const a=i*2.399,pos=p.origin.add(bodyTremor).add(new V(Math.cos(a)*2.6,Math.sin(a)*2.6,Math.sin(i*3.12)*2.4));
      this.lines.line(pos,pos.add(new V(Math.sin(t*13+i)*.3,.6+g.heat*.9,0)),[1,.3,.015],g.heat*.7);
    }
  }
  lossColor(g,color) {return g.flags.loss_grey?lossBodyColor(color,lossGreyAmount(g.level,Math.max(1,g.lossGreyMinLevel),g.levelCap)):color;}
  reassemble(g) {
    const dissolve=g.state==='death_dissolve',q=clamp(g.stateTime/(dissolve?.48:3.75));
    for(const part of g.reassembly||[]) {
      const phase=smooth((q-part.delay*.35)/.72);
      const pos=dissolve?lerp(part.origin,part.star,smooth(q)):lerp(part.star,part.target,phase);
      const bodyColor=this.lossColor(g,part.color);
      const color=dissolve?colorMix(bodyColor,white,smooth(q)):colorMix([.8,.8,.8],bodyColor,smooth((q-.5)/.3));
      this.cubes.cube(pos,color,dissolve?1-q*.65:mix(.2,1,phase),part.axis,part.phase+phase*720,1);
    }
    if(!dissolve&&g.lossActive)for(const i of g.missingEntryCells) {
      const pose=lossGhostPose(cells[i],i,g.stateTime,g.flags.shake);
      if(pose.alpha>.001)this.cubes.cube(V.of(C.START_ORIGIN).add(V.of(pose.position)),pose.color,pose.scale,V.of(pose.axis),pose.angle,pose.alpha);
    }
  }
  reassemblyCaption() {
    this.camera.updateMatrixWorld();this.world.updateWorldMatrix(true,false);
    const center=new T.Vector3(...C.START_ORIGIN),half=2+.46*Math.sqrt(3);
    let bottom=0;
    for(const corner of boxCorners) {
      const p=new T.Vector3(...corner).multiplyScalar(half).add(center).applyMatrix4(this.world.matrixWorld).project(this.camera);
      bottom=Math.max(bottom,(1-p.y)*this.height/2);
    }
    center.applyMatrix4(this.world.matrixWorld).project(this.camera);
    return {x:(center.x+1)*this.width/2,y:bottom+Math.max(10,Math.min(18,this.height*.015))};
  }
  title(t) {
    for(let i=0;i<this.titleCells.length;i++) {
      const item=this.titleCells[i],p=V.of(item.pos); p.z+=Math.sin(t*2.6+item.phase*.017)*.12;
      const color=item.kind==='hot'?hsv(t*.12+i*.021,.85,1):item.color;
      this.cubes.cube(p,color,item.scale,V.of(item.axis),t*(28+i%11*3)+item.phase,item.kind==='glass'?.42:.96,item.kind==='wire');
    }
  }
  effects(g) {
    const ctx=this.ctx,w=this.width,h=this.height; ctx.clearRect(0,0,w,h);
    if(g.state==='ascension'&&g.stateTime<ASCENSION_TIMING.arrivalSeconds)drawArrivalWaves(ctx,w,h,g.stateTime);
    if(g.state==='bonus_smash') {
      const t=g.stateTime-g.bonus.rules.impactAt;
      if(t>=0&&t<.35){ctx.fillStyle=`rgba(255,255,255,${.65*(1-t/.35)})`;ctx.fillRect(0,0,w,h);}
    }
    if(g.state==='bonus_escape') {
      const b=g.bonus,t=g.stateTime;
      const alpha=b.result==='timeout'?Math.max(.6*(1-smooth(t/.18)),smooth((t-b.rules.explosionFadeStarts)/(b.rules.explosionSeconds-b.rules.explosionFadeStarts))):smooth(t/2);
      ctx.fillStyle=`rgba(255,255,255,${alpha})`;ctx.fillRect(0,0,w,h);
    }
    if(g.state==='ascension'&&g.stateTime>=ASCENSION_TIMING.arrivalSeconds) {
      const fade=ascensionPose(g.stateTime).white;
      ctx.fillStyle=`rgba(255,255,255,${fade})`;ctx.fillRect(0,0,w,h);
    }
    if(g.state==='level_ready'&&g.openingTransition&&g.stateTime<.75) {
      ctx.fillStyle=`rgba(255,255,255,${1-smooth(g.stateTime/.75)})`;ctx.fillRect(0,0,w,h);
    }
    if(g.state==='death_dissolve') { ctx.fillStyle=`rgba(255,255,255,${smooth(g.stateTime/.48)})`; ctx.fillRect(0,0,w,h); }
    if(g.state==='reassembly_flash') {
      const q=g.stateTime/1.1; ctx.fillStyle=`rgba(255,255,255,${(1-q)*(.4+.6*Math.abs(Math.sin(q*34)))})`;ctx.fillRect(0,0,w,h);
    }
    if(g.state==='portal_warp') {
      const q=clamp(g.stateTime/3.4),cx=w/2,cy=h/2;
      ctx.fillStyle=`rgba(0,0,0,${.75*(1-q)})`; ctx.fillRect(0,0,w,h);
      for(let k=0;k<38;k++) {
        const r=((k/38+q*2)%1)**2*Math.max(w,h),a=q*2+k*.06;
        ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=`hsla(${k*13+g.t*50},100%,75%,${.15+.6*q})`;ctx.lineWidth=1+q*3;
        ctx.strokeRect(-r,-r,r*2,r*2);ctx.restore();
      }
      ctx.fillStyle=`rgba(255,255,255,${smooth((q-.58)/.42)})`;ctx.fillRect(0,0,w,h);
    }
  }
  render(g) {
    this.lines.reset(); this.cubes.reset();
    this.shutterPanels?.reset();
    this.reassemblyLabel=null;
    const title=['title','quit_confirm'].includes(g.state),phase=g.state.endsWith('_intro'),preview=g.state==='course_materialize';
    if(!title&&this.camera.view?.enabled)this.camera.clearViewOffset();
    const arrival=g.state==='ascension'&&g.stateTime<ASCENSION_TIMING.arrivalSeconds;
    const ascending=g.state==='ascension'&&!arrival,endWhite=arrival||['ascension_white','ascension_title','thank_you_note','run_summary'].includes(g.state);
    const bonusScene=['bonus_smash','bonus_playing','bonus_escape'].includes(g.state),bonusResult=g.state==='bonus_result';
    const rebuilding=['reassembly','loss_assembly'].includes(g.state);
    const whiteVoid=phase||g.state==='result_overlay'||bonusResult||rebuilding||endWhite;
    const blank=phase||g.state==='result_overlay'||bonusResult||g.state==='level_ready'||ascending||endWhite;
    if(this.bonusArena)this.bonusArena.visible=bonusScene;
    if(g.state==='ascension'&&!this.ascensionScene)this.ascensionScene=new AscensionScene(this.world);
    if(this.ascensionScene)this.ascensionScene.group.visible=ascending;
    if(this.routeGuide)this.routeGuide.group.visible=false;
    updatePortalWhiteLight(this,g);
    this.gl.setClearColor(whiteVoid?0xffffff:0x000000,1);
    if(this.stars.geometry)setStarPattern(this.stars,g.starPattern);
    this.stars.visible=g.starPattern!==0&&!blank&&!bonusScene; this.stars.material.color.setHex(whiteVoid?0x444444:0xffffff);
    this.world.position.set(0,0,0); this.rotator.rotation.set(0,0,0); this.rotator.scale.setScalar(1);
    if(title) {
      this.titleFrame??=titleBounds(this.titleCells);
      this.world.position.copy(this.titleFrame.center).multiplyScalar(-1);
      this.rotator.rotation.set(radians(Math.sin(g.t*.8)*8),radians(Math.sin(g.t*.55)*18),radians(Math.sin(g.t*.4)*5));
      const area=this.titleArea||{x:this.width*.04,y:this.height*.12,width:this.width*.92,height:this.height*.58};
      this.rotator.scale.setScalar(.88*(1+.035*Math.sin(g.t*2.4)));
      if(area.width>0&&area.height>0) {
        frameTitle(this.camera,this.titleFrame,this.rotator.rotation,this.width,this.height,area);this.title(g.t);
      }
    } else if(bonusScene) {
      this.bonus(g);
    } else if(arrival) {
      // White arrival with faint ocean contours on the effects canvas; no cube.
      this.camera.position.set(0,0,18*Math.max(1,.8/this.camera.aspect));
    } else if(ascending) {
      const pose=ascensionPose(g.stateTime,this.camera.aspect);this.ascensionScene.update(pose);
      this.camera.position.copy(vec(pose.camera));this.camera.lookAt(pose.target.x,pose.target.y,pose.target.z);
      if(pose.scale>.001)this.cubes.cube(pose.position,white,pose.scale,new V(1,.7,.25),pose.angle,pose.alpha);
    } else if(!blank) {
      let center=(g.locate||g.autoLocate)?g.player.origin:g.course.center,zoom=(g.locate||g.autoLocate)?48:g.course.zoom;
      if(preview) {
        const q=g.stateTime/7,out=smooth((q-.08)/.48),settle=smooth((q-.8)/.2);
        center=lerp(lerp(g.player.origin,g.course.center,out),center,settle);
        zoom=mix(mix(27.5,overviewZoom(g.course),out),zoom,settle);
      }
      if(rebuilding) {center=V.of(C.START_ORIGIN);zoom=32;}
      this.world.position.copy(vec(center).multiplyScalar(-1));
      this.rotator.rotation.set(...g.angles.map(radians));
      this.camera.position.set(g.flags.shake&&g.shake?Math.sin(g.t*145)*g.shake*.8:0,g.flags.shake&&g.shake?Math.cos(g.t*139)*g.shake*.8:0,zoom*Math.max(1,.9/this.camera.aspect));
      if(!rebuilding) {
        this.course(g,preview);
        if(preview||!g.flags.culling||viewLocation(g.course,g.player.origin).index>=g.course.modules.length-2)this.portal(g);
        if(g.state!=='death_dissolve') this.player(g);
        for(const p of g.particles) this.lines.line(p.pos,p.pos.sub(p.vel.mul(.035)),p.color,1-p.age/p.life);
        for(const p of g.impacts) {
          const a=1-p.age/.22,col=p.type==='laser'?[1,.65,.55]:[.6,.92,1],d=.4+a*.35;
          for(const axis of [new V(d,0,0),new V(0,d,0),new V(0,0,d)]) this.lines.line(p.pos.sub(axis),p.pos.add(axis),col,a);
        }
      }
      if(rebuilding||g.state==='death_dissolve') this.reassemble(g);
    }
    if(!bonusScene&&!ascending)this.camera.lookAt(0,0,0);
    if(rebuilding&&this.width>0&&this.height>0)this.reassemblyLabel=this.reassemblyCaption();
    if(this.stars.visible)positionInfiniteStarfield(this.stars,this.camera,this.rotator.rotation);
    this.lines.finish(); this.cubes.finish();this.shutterPanels?.finish(); this.gl.render(this.scene,this.camera); this.effects(g);
  }
}
