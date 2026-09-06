import * as T from '../vendor/three.module.min.js';
import {C,V,smooth} from './core.mjs';

export function portalWhiteLightPose(g) {
  if(!g.flags.portal_white_light)return null;
  let position,distance,width;
  if(g.state==='bonus_playing') {
    const b=g.bonus,r=b.rules;position=new V(0,r.rampHeight+4,r.portalZ);
    distance=Math.hypot(b.x,b.z-r.portalZ);width=24;
  } else if(['playing','course_materialize','reassembly_flash','portal_warp'].includes(g.state)) {
    position=g.course.portal.world(20);distance=g.player.origin.sub(position).length();width=C.PORTAL_SIZE*2;
  } else return null;
  const strength=smooth(1-distance/22);
  return strength>0?{position,strength,size:width*(.65+.5*strength)}:null;
}

let glowTexture;
export function createPortalWhiteLight(parent) {
  if(!glowTexture) {
    const size=64,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1,r=Math.hypot(dx,dy);
      const core=.7*Math.exp(-r*r*36),halo=.3*Math.exp(-r*r*5);
      const rays=.12*Math.exp(-Math.min(Math.abs(dx),Math.abs(dy))*45)*Math.exp(-r*r*5);
      const alpha=(core+halo+rays)*(1-smooth((r-.75)/.25)),i=(y*size+x)*4;
      data.set([255,255,255,Math.round(Math.min(1,alpha)*255)],i);
    }
    glowTexture=new T.DataTexture(data,size,size);glowTexture.needsUpdate=true;
    glowTexture.magFilter=T.LinearFilter;glowTexture.minFilter=T.LinearFilter;
  }
  const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:0xffffff,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0}));
  sprite.visible=false;sprite.renderOrder=3;parent.add(sprite);return sprite;
}

export function updatePortalWhiteLight(renderer,g) {
  const pose=portalWhiteLightPose(g);
  if(pose&&!renderer.portalWhiteLight)renderer.portalWhiteLight=createPortalWhiteLight(renderer.world);
  const light=renderer.portalWhiteLight;if(!light)return;
  light.visible=!!pose;
  if(pose) {
    light.position.set(...pose.position.array());light.scale.set(pose.size,pose.size,1);
    light.material.opacity=pose.strength*.85;
  }
}
