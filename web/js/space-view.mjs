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
    const positions=[],legs=[],routePositions=[];
    // Four longitudinal exterior edges per leg; no wall lattice, caps, joint
    // boxes, gates or generated meshes. Fifty legs are only 200 line segments.
    for(const m of course.modules) {
      const [a,b]=course.span(m);
      for(const y of [-7,7])for(const z of [-7,7]) {
        positions.push(...m.world(a,y,z).array(),...m.world(b,y,z).array());
        legs.push(m.index,m.index);routePositions.push(m.index,m.index+1);
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('leg',new T.Float32BufferAttribute(legs,1));
    geometry.setAttribute('routePosition',new T.Float32BufferAttribute(routePositions,1));
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{active:{value:0},trail:{value:0},opacity:{value:1},detailFirst:{value:0},detailLast:{value:-1},previewMode:{value:0},fadeAfter:{value:2},previewCount:{value:50},farOpacity:{value:.12},routeFadeAfter:{value:1},routeCount:{value:3},routeFarOpacity:{value:.25}},
      vertexShader:`attribute float leg; attribute float routePosition;
        uniform float previewMode; uniform float fadeAfter; uniform float previewCount; uniform float farOpacity; uniform float active; uniform float trail;
        uniform float detailFirst; uniform float detailLast; varying float alpha;
        uniform float routeFadeAfter; uniform float routeCount; uniform float routeFarOpacity;
        void main(){alpha=leg<active-2.0?0.0:leg<active-1.0?1.0-trail:1.0;
          if(leg>=detailFirst&&leg<=detailLast)alpha=0.0;
          if(previewMode>0.5)alpha*=mix(1.0,farOpacity,clamp((routePosition-fadeAfter)/max(1.0,previewCount-fadeAfter),0.0,1.0));
          else alpha*=mix(1.0,routeFarOpacity,clamp((routePosition-active-1.0-routeFadeAfter)/max(1.0,routeCount-routeFadeAfter),0.0,1.0));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float opacity; varying float alpha;
        void main(){gl_FragColor=vec4(.60,.60,.62,alpha*opacity);}`,
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
    const settings=g.previewSettings,count=Math.min(this.course.modules.length,settings.preview_max_legs);
    const route=g.routeOutlineSettings,first=window.location.index+1;
    const ahead=Math.max(0,Math.min(route.route_outline_ahead_legs,this.course.modules.length-first));
    this.lines.visible=preview?g.flags.preview_outline&&count>0:g.flags.route_outline&&ahead>0;
    this.lines.geometry.setDrawRange(preview?0:first*8,(preview?count:ahead)*8);
    const u=this.lines.material.uniforms;
    u.previewMode.value=preview?1:0;u.fadeAfter.value=settings.preview_fade_after_legs;
    u.previewCount.value=count;u.farOpacity.value=settings.preview_far_opacity;
    u.active.value=preview?0:window.location.index;
    u.trail.value=preview?0:this.course.distanceFade(window.location.index-2,g.player.origin);
    u.opacity.value=preview?settings.preview_opacity*(.28+.72*smooth(g.stateTime/7))*(1-smooth((g.stateTime/7-.8)/.2)):route.route_outline_opacity;
    u.routeFadeAfter.value=route.route_outline_fade_after_legs;u.routeCount.value=route.route_outline_ahead_legs;u.routeFarOpacity.value=route.route_outline_far_opacity;
    u.detailFirst.value=window.first;u.detailLast.value=window.last;
    this.marker.visible=true;this.marker.material.opacity=preview?smooth(g.stateTime/2):.8;
  }
  dispose() {
    this.group.removeFromParent();
    for(const object of [this.lines,this.marker]) {object.geometry.dispose();object.material.dispose();}
  }
}

function starPatternData(pattern) {
  const positions=[],colors=[],sizes=[],count=1600,radius=1000;
  // Reproducible random sky: chance clusters and gaps, with no spiral/lattice.
  // Keep its buffers fixed and its center on the camera, even on fifty-leg maps.
  let seed=0xC0BE2026;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  for(let i=0;i<count;i++) {
    const y=pattern===1?1-2*(i+.5)/count:1-2*random(),r=Math.sqrt(1-y*y),angle=pattern===1?i*2.399963229728653:random()*Math.PI*2;
    positions.push(Math.cos(angle)*r*radius,y*radius,Math.sin(angle)*r*radius);
    if(pattern===1) {
      const brightness=.45+.55*((i*67%101)/100);colors.push(brightness,brightness,brightness);sizes.push(1);continue;
    }
    const bright=random(),brightness=.28+.72*bright**2.2,tint=random();
    const color=tint<.12?[.80,.88,1]:tint>.92?[1,.90,.77]:[.96,.97,1];
    colors.push(...color.map(v=>v*brightness));sizes.push(.65+1.25*bright**3);
  }
  return {positions,colors,sizes};
}
export function createInfiniteStarfield(parent,pattern=2) {
  const {positions,colors,sizes}=starPatternData(pattern===1?1:2);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute('starScale',new T.Float32BufferAttribute(sizes,1));
  const stars=new T.Points(geometry,new T.PointsMaterial({color:0xffffff,vertexColors:true,size:1.7,
    sizeAttenuation:false,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
  stars.material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float starScale;')
      .replace('gl_PointSize = size;','gl_PointSize = size * starScale;');
  };
  stars.userData.pattern=pattern===1?1:2;
  stars.renderOrder=-100;stars.frustumCulled=false;parent.add(stars);return stars;
}
export function setStarPattern(stars,pattern) {
  if(pattern===0){stars.visible=false;return;}
  if(stars.userData.pattern===pattern)return;
  const data=starPatternData(pattern);
  for(const [attribute,key] of [['position','positions'],['color','colors'],['starScale','sizes']]) {
    stars.geometry.attributes[attribute].array.set(data[key]);stars.geometry.attributes[attribute].needsUpdate=true;
  }
  stars.userData.pattern=pattern;
}
export function positionInfiniteStarfield(stars,camera,rotation) {
  stars.position.copy(camera.position);stars.rotation.copy(rotation);
}
