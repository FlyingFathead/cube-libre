// Ending 001: one white cube leaves the grid and becomes a star.
import * as T from '../vendor/three.module.min.js';
import {ASCENSION_TIMING as timing,V,smooth,mix} from './core.mjs';

export const ASCENSION_STAGE=Object.freeze({floorY:-8,starCount:900});
export const arrivalOutlineOpacity=time=>1-smooth((time-timing.arrivalHoldSeconds)/timing.arrivalFadeSeconds);
export function ascensionPose(time,aspect=16/9) {
  const rise=smooth((time-timing.riseStarts)/timing.riseSeconds);
  const merge=smooth((time-timing.starStarts)/timing.starSeconds);
  const follow=smooth((time-timing.riseStarts)/(timing.riseSeconds+.8));
  const wide=Math.max(1,.8/aspect),scale=2.8;
  return {
    position:new V(0,mix(ASCENSION_STAGE.floorY+.46*scale,42,rise),-120*rise**1.3),
    scale:scale*(1-.55*rise)*(1-merge),angle:rise*160,alpha:1-merge,
    camera:new V(mix(7,3,follow)*wide,mix(4,10,follow),mix(30,38,follow)*wide),
    target:new V(0,mix(-.5,17,follow),mix(-8,-55,follow)),
    gridOpacity:.92*(1-.8*follow),starOpacity:merge,
    starSize:mix(8,2.6,smooth((time-timing.starStarts-timing.starSeconds)/.8)),
    white:Math.max(1-smooth((time-timing.arrivalSeconds)/timing.sceneFadeSeconds),smooth((time-timing.fadeStarts)/timing.fadeSeconds)),
  };
}

function points(positions,sizes,brightness,color) {
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('pointSize',new T.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('brightness',new T.Float32BufferAttribute(brightness,1));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{pointScale:{value:1},pixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,2)},
      opacity:{value:1},tint:{value:new T.Color(color)}},
    vertexShader:`attribute float pointSize; attribute float brightness;
      uniform float pointScale; uniform float pixelRatio; varying float light;
      void main(){light=brightness;gl_PointSize=pointSize*pointScale*pixelRatio;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float opacity; uniform vec3 tint; varying float light;
      void main(){float radius=length(gl_PointCoord-vec2(.5))*2.0;
        if(radius>1.0)discard;
        gl_FragColor=vec4(tint*light,opacity*(1.0-smoothstep(.25,1.0,radius)));}`,
  });
  return new T.Points(geometry,material);
}

export class AscensionScene {
  constructor(parent) {
    this.group=new T.Group();this.group.visible=false;parent.add(this.group);
    this.floor=new T.Mesh(new T.PlaneGeometry(2400,2400),new T.MeshBasicMaterial({
      color:0x00030b,transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide,
    }));
    this.floor.rotation.x=-Math.PI/2;this.floor.position.y=ASCENSION_STAGE.floorY-.025;
    this.group.add(this.floor);
    this.grid=new T.GridHelper(1200,300,0x259cff,0x166dca);
    this.grid.position.y=ASCENSION_STAGE.floorY;
    this.grid.material.dispose();
    this.grid.material=new T.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{opacity:{value:1}},
      vertexShader:`attribute vec3 color; varying vec3 tint; varying vec3 location;
        void main(){tint=color;location=position;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float opacity; varying vec3 tint; varying vec3 location;
        void main(){float fade=1.0-smoothstep(100.0,560.0,length(location.xz));
          gl_FragColor=vec4(tint,opacity*fade);}`,
    });
    this.group.add(this.grid);
    // Fixed, reusable buffers: the entire sky is one points draw, not 900 meshes.
    const positions=[],sizes=[],brightness=[];let seed=7193;
    const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<ASCENSION_STAGE.starCount;i++) {
      positions.push((rng()*2-1)*230,9+rng()*170,-35-rng()*390);
      sizes.push(.9+rng()**3*2.2);brightness.push(.45+rng()*.55);
    }
    this.stars=points(positions,sizes,brightness,0xe8f2ff);this.group.add(this.stars);
    this.spark=points([0,0,0],[1],[1],0xffffff);this.spark.frustumCulled=false;
    this.group.add(this.spark);
  }
  update(pose) {
    this.grid.material.uniforms.opacity.value=pose.gridOpacity;
    this.floor.material.opacity=pose.gridOpacity*.75;
    this.spark.position.set(pose.position.x,pose.position.y,pose.position.z);
    this.spark.visible=pose.starOpacity>0;
    this.spark.material.uniforms.opacity.value=pose.starOpacity;
    this.spark.material.uniforms.pointScale.value=pose.starSize;
  }
}
