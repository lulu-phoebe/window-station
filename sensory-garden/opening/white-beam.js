import * as T from './three.module.js';

export function createWhiteBeam(scene,renderer){
 const source=new T.Vector3(3.6,7.9,-.25),end=new T.Vector3(-1.3,.03,.65);
 const axis=end.clone().sub(source).normalize(),length=source.distanceTo(end),radius=2.15;
 const center=source.clone().add(end).multiplyScalar(.5),bound=Math.hypot(length*.5,radius);
 const U=new T.Vector3().crossVectors(axis,new T.Vector3(0,0,1)).normalize(),V=new T.Vector3().crossVectors(axis,U).normalize();
 const light=new T.SpotLight('#fff5eb',88,24,Math.atan(radius/length),.65,2);light.position.copy(source);light.target.position.copy(end);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.near=.2;light.shadow.camera.far=24;light.shadow.normalBias=.035;light.shadow.bias=-.0002;light.shadow.radius=4;scene.add(light,light.target);
 // Dust is suspended in the shaft, independent of the click-driven petals.
 const count=500,data=new Float32Array(count*4),positions=new Float32Array(count*3);let seed=4703;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<count;i++){data.set([random(),random()*6.283,Math.sqrt(random())*.86,.7+random()*1.1],i*4)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('aDust',new T.BufferAttribute(data,4));
 const material=new T.ShaderMaterial({uniforms:{time:{value:0},source:{value:source},axis:{value:axis},U:{value:U},V:{value:V},beamLength:{value:length},radius:{value:radius},pixelRatio:{value:renderer.getPixelRatio()}},
  vertexShader:`attribute vec4 aDust;uniform float time,beamLength,radius,pixelRatio;uniform vec3 source,axis,U,V;varying float opacity;
  void main(){float t=.03+.92*fract(aDust.x+time*.006);float angle=aDust.y+sin(time*.18+aDust.x*31.)*.12;float r=mix(.09,radius,t)*aDust.z;vec3 p=source+axis*t*beamLength+U*(cos(angle)*r+.015*sin(time*.5+aDust.y))+V*(sin(angle)*r+.015*cos(time*.35+aDust.y));vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aDust.w*14./max(1.,-mv.z),1.1,3.0)*pixelRatio;opacity=(.60+.55*pow(sin(time*.65+aDust.y*3.),2.))*(1.-aDust.z*.40);}`,
  fragmentShader:`varying float opacity;void main(){vec2 p=gl_PointCoord-.5;float light=exp(-dot(p,p)*16.);gl_FragColor=vec4(vec3(1.),light*opacity);}`,
  transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const dust=new T.Points(geometry,material);dust.frustumCulled=false;dust.renderOrder=2;scene.add(dust);
 const poolCanvas=document.createElement('canvas');poolCanvas.width=poolCanvas.height=128;const ctx=poolCanvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(82,145,255,.8)');g.addColorStop(.45,'rgba(65,117,255,.25)');g.addColorStop(1,'rgba(65,117,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const pool=new T.Mesh(new T.PlaneGeometry(radius*2.4,radius*2.4),new T.MeshBasicMaterial({map:new T.CanvasTexture(poolCanvas),transparent:true,opacity:.025,depthWrite:false,blending:T.AdditiveBlending}));pool.position.set(end.x,.032,end.z);pool.rotation.x=-Math.PI/2;scene.add(pool);
 return {uniforms:{beamTint:{value:new T.Vector3(.12,.38,1.)},beamSource:{value:source},beamAxis:{value:axis},beamLength:{value:length},beamRadius:{value:radius},beamCenter:{value:center},beamBound:{value:bound}},update(time){material.uniforms.time.value=time;},setReflectionMode(hidden){dust.visible=pool.visible=!hidden;},light,dust};
}
