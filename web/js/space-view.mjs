import * as T from '../vendor/three.module.min.js';
import {V,smooth} from './core.mjs';

export function detailWindow(g,preview=false) {
  const c=g.course,location=c.location(g.player.origin),reveal=c.revealIndex(g.player.origin);
  const overview=preview&&g.stateTime/7<.78,full=!g.flags.culling||g.level<3;
  return {location,reveal,overview,
    first:preview?0:full?0:Math.max(0,location.index-1),
    last:preview?(overview?-1:Math.min(1,c.modules.length-1)):full?c.modules.length-1:Math.min(c.modules.length-1,Math.max(location.index+1,reveal+1))};
}

export function overviewZoom(course) {
  const b=course.bounds,radius=Math.hypot(b[1]-b[0],b[3]-b[2],b[5]-b[4])*.5;
  return Math.max(48,radius/Math.sin(Math.PI/8)*1.12);
}

export class RouteGuide {
  constructor(parent,course) {
    this.course=course;this.group=new T.Group();parent.add(this.group);
    const positions=[],legs=[];
    const box=(map,lo,hi,index)=>{
      for(let axis=0;axis<3;axis++)for(const a of [0,1])for(const b of [0,1]) {
        const j=(axis+1)%3,k=(axis+2)%3,start=[...lo],end=[...lo];
        start[j]=end[j]=(a?hi:lo)[j];start[k]=end[k]=(b?hi:lo)[k];end[axis]=hi[axis];
        positions.push(...map(...start).array(),...map(...end).array());legs.push(index,index);
      }
    };
    for(const m of course.modules) {const [a,b]=course.span(m);box((x,y,z)=>m.world(x,y,z),[a,-7,-7],[b,7,7],m.index);}
    for(const j of course.joints)box((x,y,z)=>j.center.add(new V(x,y,z)),[-7,-7,-7],[7,7,7],j.index);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('leg',new T.Float32BufferAttribute(legs,1));
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{active:{value:0},trail:{value:0},opacity:{value:1},detailFirst:{value:0},detailLast:{value:-1}},
      vertexShader:`attribute float leg; uniform float active; uniform float trail;
        uniform float detailFirst; uniform float detailLast; varying float alpha;
        void main(){alpha=leg<active-2.0?0.0:leg<active-1.0?1.0-trail:1.0;
          if(leg>=detailFirst&&leg<=detailLast)alpha=0.0;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float opacity; varying float alpha;
        void main(){gl_FragColor=vec4(.46,.5,.57,alpha*opacity*.3);}`,
    });
    this.lines=new T.LineSegments(geometry,material);this.group.add(this.lines);
    const end=course.portal.world(20),markerGeo=new T.BufferGeometry();
    markerGeo.setAttribute('position',new T.Float32BufferAttribute(end.array(),3));
    this.marker=new T.Points(markerGeo,new T.PointsMaterial({color:0xb5fff0,size:7,
      sizeAttenuation:false,transparent:true,depthTest:false,depthWrite:false}));
    this.group.add(this.marker);
  }
  update(g,window,preview) {
    this.group.visible=true;
    this.lines.visible=preview||!g.flags.culling;
    const u=this.lines.material.uniforms;
    u.active.value=preview?0:window.location.index;
    u.trail.value=preview?0:this.course.distanceFade(window.location.index-2,g.player.origin);
    u.opacity.value=preview?(.28+.72*smooth(g.stateTime/7))*(1-smooth((g.stateTime/7-.8)/.2)):1;
    u.detailFirst.value=window.first;u.detailLast.value=window.last;
    this.marker.visible=true;this.marker.material.opacity=preview?smooth(g.stateTime/2):.8;
  }
  dispose() {
    this.group.removeFromParent();
    for(const object of [this.lines,this.marker]) {object.geometry.dispose();object.material.dispose();}
  }
}

export function createInfiniteStarfield(parent) {
  const positions=[],colors=[],count=1600,radius=1000;
  // Uniform sphere: a fixed sky at infinity, independent of course coordinates.
  for(let i=0;i<count;i++) {
    const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),angle=i*2.399963229728653;
    positions.push(Math.cos(angle)*r*radius,y*radius,Math.sin(angle)*r*radius);
    const brightness=.45+.55*((i*67%101)/100);colors.push(brightness,brightness,brightness);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const stars=new T.Points(geometry,new T.PointsMaterial({color:0xffffff,vertexColors:true,size:1.7,
    sizeAttenuation:false,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
  stars.renderOrder=-100;stars.frustumCulled=false;parent.add(stars);return stars;
}
export function positionInfiniteStarfield(stars,camera,rotation) {
  stars.position.copy(camera.position);stars.rotation.copy(rotation);
}
