import * as T from './three.module.js';
import {referenceMotion} from './reference-motion.js';
import {createWaterImpacts} from './water-impacts.js';

export function createAtmosphere({scene,renderer,camera,floor,flowers,petalGeometry,skyTexture}){
 const reflection=new T.WebGLRenderTarget(1024,1024,{type:T.HalfFloatType});
 const transmission=new T.WebGLRenderTarget(1024,1024,{type:T.HalfFloatType});
 const mirrorCamera=new T.PerspectiveCamera();const textureMatrix=new T.Matrix4();
 const bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 const ripples=Array.from({length:12},()=>new T.Vector4(0,0,-100,0));let rippleIndex=0;
 const waterMat=new T.ShaderMaterial({uniforms:{skyGradient:{value:skyTexture},screenSize:{value:new T.Vector2()},reflection:{value:reflection.texture},transmission:{value:transmission.texture},textureMatrix:{value:textureMatrix},time:{value:0},waterOrigin:{value:new T.Vector3()},eye:{value:new T.Vector3()},ripples:{value:ripples}},
 vertexShader:`uniform mat4 textureMatrix;varying vec3 world;varying vec4 reflected;void main(){vec4 w=modelMatrix*vec4(position,1.);world=w.xyz;reflected=textureMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform sampler2D reflection;uniform sampler2D transmission;uniform sampler2D skyGradient;uniform vec2 screenSize;uniform float time;uniform vec3 eye;uniform vec3 waterOrigin;uniform vec4 ripples[12];varying vec3 world;varying vec4 reflected;
vec2 waveSlope(vec2 p,float t){
 // Wind-driven swells and capillary wavelets travel coherently with soft gusts.
 p-=vec2(.085,.035)*t;
 float gust=.78+.22*sin(dot(p,vec2(.38,-.21))-t*.47);
 float warp=.32*sin(dot(p,vec2(.67,-.74))*1.7-t*.32);
 vec2 s=vec2(.93,.36)*.042*cos(dot(p,vec2(.93,.36))*2.3-t*.72);
 s+=vec2(.78,.63)*.021*cos(dot(p,vec2(.78,.63))*4.7-t*1.05+warp);
 s+=vec2(.96,.28)*.059*cos(dot(p,vec2(.96,.28))*9.4-t*1.65+warp)*gust;
 s+=vec2(.87,.49)*.034*cos(dot(p,vec2(.87,.49))*17.8-t*2.05+warp*1.4)*gust;
 s+=vec2(-.38,.92)*.012*cos(dot(p,vec2(-.38,.92))*13.2-t*1.24);
 s+=vec2(.98,.20)*.013*cos(dot(p,vec2(.98,.20))*31.3-t*2.6+warp)*gust;
 s+=vec2(.76,.65)*.006*cos(dot(p,vec2(.76,.65))*52.1-t*3.1);
 return s;
}
// Broad reflected illumination, shaped in world space so it stays on the water
// while the viewer orbits. The wind normals break its edges into moving ribbons.
float waterHash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
// Water-bound glints remain visible around the orbit, rather than using one light direction.
vec3 starGlints(vec2 p,float t){
 vec2 grid=(p+vec2(.012*sin(t*.6+p.y),.012*cos(t*.43+p.x)))*3.6;
 vec2 cell=floor(grid),point=fract(grid)-.5;
 float seed=waterHash(cell);
 vec2 jitter=vec2(waterHash(cell+17.),waterHash(cell+43.))-.5;
 vec2 d=point-jitter*.62;
 float pixel=clamp(length(fwidth(grid))*.65,.015,.075);
 float core=exp(-dot(d,d)/(pixel*pixel)*2.5);
 float rays=exp(-abs(d.x)/pixel*5.-abs(d.y)/(pixel*3.2))
           +exp(-abs(d.y)/pixel*5.-abs(d.x)/(pixel*3.2));
 float flicker=pow(max(0.,sin(t*(.75+seed*.8)+seed*45.+p.x*.4)),6.);
 float mask=step(.68,seed)*exp(-dot(p,p)*.009);
 return mix(vec3(.40,.53,1.),vec3(.90,.86,1.),seed)*(core*.8+rays*.24)*(.16+flicker*2.4)*mask;
}
vec3 waterLighting(vec3 ray,vec3 at){
 float facing=smoothstep(-.02,.20,-ray.z);
 float travel=(-5.-at.z)/min(ray.z,-.02);
 vec2 hit=(at+ray*max(0.,travel)).xy;
 float pinkPanel=exp(-pow(abs((hit.x-.35)/1.10),4.)-pow(abs((hit.y-3.7)/1.15),4.))*facing;
 float lilacPanel=exp(-pow(abs((hit.x+1.0)/3.8),4.)-pow(abs((hit.y-4.)/5.5),4.))*facing;
 float warmEdge=exp(-pow((hit.x-.15)/.70,2.)-pow((hit.y-4.9)/1.4,2.))*facing;
 return vec3(.075,.095,.30)*lilacPanel+vec3(.85,.95,2.8)*pinkPanel+vec3(.45,.18,.85)*warmEdge;
}
void main(){
 vec2 p=world.xz;float t=time;vec2 slope=waveSlope(p,t);
 // Ring waves change surface normals and reflected light; they are not painted lines.
 for(int j=0;j<3;j++){float k=float(j);vec2 delta=p-vec2(sin(k*3.7)*1.25,cos(k*4.1)*1.1+.5);float d=length(delta);float age=mod(t*.72+k*3.83,12.);float radius=age*.32;float envelope=exp(-pow((d-radius)*2.6,2.))*exp(-age*.20)*smoothstep(0.,.65,age);slope+=delta/max(d,.01)*cos(d*19.-age*6.08)*envelope*.115;}
 for(int i=0;i<12;i++){float age=t-ripples[i].z;vec2 delta=p-ripples[i].xy;float d=length(delta);if(age>0.&&age<7.){float envelope=exp(-pow((d-age*.34)*3.3,2.))*exp(-age*.48)*ripples[i].w;slope+=delta/max(d,.01)*cos(d*33.-age*12.)*envelope*.060;}}
 vec3 N=normalize(vec3(-slope.x,1.,-slope.y));vec3 V=normalize(eye-world);float nDotV=max(dot(N,V),.001);
 float fresnel=.020+.98*pow(1.-nDotV,5.);
 vec2 uv=clamp(reflected.xy/reflected.w+slope*.13,vec2(.002),vec2(.998));
 vec3 mirror=texture2D(reflection,uv).rgb*.5;
 mirror+=texture2D(reflection,uv+vec2(.0008,.0003)).rgb*.25;
 mirror+=texture2D(reflection,uv-vec2(.0008,.0003)).rgb*.25;
 vec3 R=reflect(-V,N);
 // Large, soft studio sources fragment naturally across the capillary waves.
 vec3 H=normalize(V+normalize(vec3(-.22,.36,-.91)));
 float spec=pow(max(dot(N,H),0.),240.);
 vec3 H2=normalize(V+normalize(vec3(.5,.42,-.76)));
 float spec2=pow(max(dot(N,H2),0.),95.);
 float broad=pow(max(dot(R,normalize(vec3(-.12,.40,-.91))),0.),22.);
 // Real scene transmission with refraction, absorption and angle-dependent reflection.
 vec2 refractUV=clamp(gl_FragCoord.xy/screenSize+slope*.018,vec2(.002),vec2(.998));
 vec3 through=texture2D(transmission,refractUV).rgb;
 vec3 attenuation=exp(-vec3(.42,.18,.12)*(.22+.035*length(p)));
 vec3 body=through*attenuation+vec3(.012,.027,.026)*(vec3(1.)-attenuation);
 vec3 illumination=waterLighting(R,world-waterOrigin);
 // Dark gaps between reflected light ribbons remain transparent.
 vec3 color=body*(1.-fresnel)+mirror*(.23+.92*fresnel);
 color+=illumination*(.23+.97*fresnel);
 // A subdued cool environment keeps wave facets legible from side and rear views.
 color+=vec3(.035,.045,.13)*(.25+fresnel)*(.5+.5*pow(max(N.y,0.),16.));
 color+=starGlints(p-waterOrigin.xz,t);
 float sheen=pow(max(dot(N,normalize(V+normalize(vec3(-.35,.62,.70)))),0.),110.);
 color+=vec3(.24,.18,.30)*sheen*.12;
 // Small moving facets catch the broad light as discrete silver-pink glints.
 float facets=pow(max(0.,sin(p.x*47.+p.y*29.-t*1.5)*sin(p.x*23.-p.y*53.+t*.9)),14.);
 float lit=clamp(dot(illumination,vec3(.3,.5,.2)),0.,1.);
 color+=vec3(.58,.70,1.)*facets*lit*.32;
 color+=vec3(.28,.34,.67)*spec*.92+vec3(.15,.23,.24)*spec2*.16+vec3(.045,.035,.12)*broad;
 float dist=length(eye-world);vec3 skyColor=texture2D(skyGradient,gl_FragCoord.xy/screenSize).rgb*.85;color=mix(color,skyColor,1.-exp(-dist*dist*.0017));
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`});
 const water=new T.Mesh(new T.PlaneGeometry(200,200),waterMat);water.rotation.x=-Math.PI/2;water.position.y=.026;scene.add(water);floor.position.y=-.22;floor.material.color.set('#11131e');floor.visible=false;
 const waterImpacts=createWaterImpacts(scene);
 function ripple(x,z,time,strength=1){ripples[rippleIndex++%ripples.length].set(x,z,time,strength);if(strength>=.25)waterImpacts.spawn(x,z,time,strength);}


 // Reference timeline (15 s content, excluding screen-recording playback chrome):
 // Immediate first petals, then a sustained, staggered shower through 8.3 s;
 // 8.6–11 s: last drops reach the surface; 11–15 s: settle and fade.
 const particles=[],floatingPetals=[];let clock=0,cycleStart=-100,burstSerial=0;
 const blooms=flowers.children.filter(o=>o.isGroup),baseRotations=blooms.map(b=>b.rotation.z);
 const right=new T.Vector3();const emitterGlow=[];
 const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');
 const glow=ctx.createRadialGradient(32,32,0,32,32,31);glow.addColorStop(0,'rgba(255,252,240,1)');glow.addColorStop(.12,'rgba(255,243,232,.95)');glow.addColorStop(.35,'rgba(255,222,211,.28)');glow.addColorStop(1,'rgba(255,230,215,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);const glowTexture=new T.CanvasTexture(c);
 let seed=329;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
 for(const bloom of blooms){if(bloom.userData.rigidSource)continue;for(let j=0;j<5;j++){const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:j%3?'#fff0e5':'#e4e4ff',transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:0}));sprite.position.set(Math.cos(j*1.256)*.11,Math.sin(j*1.256)*.11,.10);sprite.scale.setScalar(.055+random()*.05);bloom.add(sprite);emitterGlow.push({sprite,phase:random()*6.28});}}
 function removeParticle(p){scene.remove(p.o,p.halo,p.trail,p.aura);p.aura.geometry.dispose();p.aura.material.dispose();p.o.material.dispose();p.halo.material.dispose();p.trail.geometry.dispose();p.trail.material.dispose();particles.splice(particles.indexOf(p),1)}
 function burst(){
  // A click restarts one complete reference-length sequence, rather than stacking explosions.
  for(const p of [...particles])removeParticle(p);cycleStart=clock;seed=329+burstSerial++*19;
  flowers.updateMatrixWorld(true);right.setFromMatrixColumn(camera.matrixWorld,0).normalize();
  for(let i=0;i<220;i++){
   // Every birth is bound to an actual vertex of a visible modeled flower petal.
   const bloom=blooms[i%blooms.length];
   const candidates=bloom.children.filter(o=>o.isMesh&&(o.geometry===petalGeometry||o.userData.rosePetal));
   const source=candidates[(i*7+Math.floor(i/blooms.length))%candidates.length];
   const vertexIndex=source.userData.emitterIndices?source.userData.emitterIndices[(i*47)%source.userData.emitterIndices.length]:Math.floor(source.geometry.attributes.position.count*.55)+(i*17)%Math.floor(source.geometry.attributes.position.count*.38);
   const sourcePoint=new T.Vector3().fromBufferAttribute(source.geometry.attributes.position,vertexIndex);
   const origin=source.localToWorld(sourcePoint.clone());
   const motion=referenceMotion.tracks[(i*17)%referenceMotion.tracks.length];
   const drop=origin.y-.057;const flight=drop/motion.speed;
   const r=random();const delay=i<18?i*.008:Math.max(.15,9.8-flight)*r;
   const color=i%3===0?'#ff0926':i%3===1?'#f00020':'#e6001c';
   const material=new T.MeshStandardMaterial({color,roughness:.63,metalness:0,emissive:color,emissiveIntensity:.55,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false});
   const o=new T.Mesh(source.userData.fallGeometry||source.geometry,material);o.scale.setScalar(.070+random()*.065);o.position.copy(origin);o.rotation.set(.10+random()*.7,(random()-.5)*1.2,random()*6);o.visible=false;scene.add(o);
   const halo=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color,transparent:true,blending:T.AdditiveBlending,opacity:0,depthWrite:false}));halo.scale.setScalar(.13+random()*.07);halo.visible=false;scene.add(halo);
   const trail=new T.Line(new T.BufferGeometry().setFromPoints([origin,origin,origin,origin]),new T.LineBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));trail.visible=false;scene.add(trail);
   const trailColor=new T.Color(i%4===0?'#f4c8df':'#ffe2b3'),colors=[];for(const f of [1,.45,.12,0])colors.push(trailColor.r*f,trailColor.g*f,trailColor.b*f);trail.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));trail.material.vertexColors=true;trail.material.color.set('#ffffff');
   const ribbonGeometry=new T.BufferGeometry();const ribbonPositions=new Float32Array(18*3),ribbonUV=[],ribbonIndices=[];for(let j=0;j<9;j++){ribbonUV.push(0,j/8,1,j/8);if(j<8){let k=j*2;ribbonIndices.push(k,k+1,k+3,k,k+3,k+2);}}ribbonGeometry.setAttribute('position',new T.BufferAttribute(ribbonPositions,3));ribbonGeometry.setAttribute('uv',new T.Float32BufferAttribute(ribbonUV,2));ribbonGeometry.setIndex(ribbonIndices);
   const aura=new T.Mesh(ribbonGeometry,new T.ShaderMaterial({uniforms:{tint:{value:trailColor},strength:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;uniform float strength;varying vec2 v;void main(){float core=exp(-pow((v.x-.5)*3.8,2.));float taper=pow(1.-v.y,1.8);gl_FragColor=vec4(tint,core*taper*strength);}',transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));aura.frustumCulled=false;aura.visible=false;scene.add(aura);
   const down=motion.speed,gravity=0;
   const particle={keepOnWater:i%29===0,o,halo,trail,aura,origin,source,sourcePoint,released:false,delay,down,gravity,flight,motion,drop,left:right.clone().multiplyScalar(Math.max(-.32,Math.min(.19,origin.x*.15-.075+(((i*7)%19)/18-.5)*.20))),side:right.clone(),sway:.08+random()*.13,frequency:1.3+random()*1.8,phase:random()*6.28,landed:false,tail:.26+random()*.46};
   // A weak spatially varying breeze, with a leftward mean once combined
   // with the reference drift. Air drag eases the petal into the airflow.
   particle.breezeSpeed=T.MathUtils.clamp(origin.dot(right)*.38-.03+(random()-.5)*.10,-.36,.36);
   particle.breezeDrag=.85+random()*.25;
   particles.push(particle);

  }
 }

 function positionAt(p,age,out){
  const u=T.MathUtils.clamp(age/p.flight,0,1),samples=p.motion.points,f=u*(samples.length-1),index=Math.min(samples.length-2,Math.floor(f)),blend=f-index;
  const ax=T.MathUtils.lerp(samples[index][0],samples[index+1][0],blend),ay=T.MathUtils.lerp(samples[index][1],samples[index+1][1],blend);
  out.copy(p.origin).addScaledVector(p.side,-ax*p.drop);
  const q=Math.max(0,age),tau=p.breezeDrag;
  const windDistance=p.breezeSpeed*(q-tau*(1-Math.exp(-q/tau)));
  out.addScaledVector(p.side,windDistance);out.y=p.origin.y-ay*p.drop;return out;
 }

 function leaveOnWater(p,time){
  const petal=p.o.clone();petal.material=p.o.material.clone();petal.material.emissiveIntensity=.045;petal.material.roughness=.58;petal.material.opacity=0;petal.material.depthWrite=true;
  petal.position.y=.046;petal.rotation.set(-Math.PI/2+.06,0,p.phase);petal.visible=true;scene.add(petal);
  floatingPetals.push({o:petal,anchor:petal.position.clone(),born:time,phase:p.phase,nextRipple:time+8});
  while(floatingPetals.length>8){const old=floatingPetals.shift();scene.remove(old.o);old.o.material.dispose();}
 }
 const temp=new T.Vector3(),ribbonRight=new T.Vector3();
 function update(time,dt){renderer.getDrawingBufferSize(waterMat.uniforms.screenSize.value);renderer.domElement.dataset.waterImpacts=String(waterImpacts.update(time));ribbonRight.setFromMatrixColumn(camera.matrixWorld,0);clock=time;waterMat.uniforms.time.value=time;waterMat.uniforms.eye.value.copy(camera.position);const cycleAge=time-cycleStart;renderer.domElement.dataset.floatingPetals=String(floatingPetals.length);
  for(const f of floatingPetals){const age=time-f.born;f.o.position.set(f.anchor.x+.025*(Math.sin(age*.15+f.phase)-Math.sin(f.phase)),.046+Math.sin(time*1.1+f.phase)*.0025,f.anchor.z+.035*(Math.cos(age*.13+f.phase)-Math.cos(f.phase)));f.o.rotation.x=-Math.PI/2+.06+Math.sin(time*.8+f.phase)*.016;f.o.rotation.z=f.phase+Math.sin(age*.2)*.035;f.o.material.opacity=.90*Math.min(1,age/.55);if(time>f.nextRipple){ripple(f.o.position.x,f.o.position.z,time,.07);f.nextRipple=time+10;}}
  renderer.domElement.dataset.unboundEmitters=String(particles.filter(p=>!p.source||!(p.source.geometry===petalGeometry||p.source.userData.rosePetal)||p.source.parent?.parent!==flowers).length);renderer.domElement.dataset.effectSeconds=(cycleAge>=0&&cycleAge<15?cycleAge:-1).toFixed(2);renderer.domElement.dataset.airborneCount=String(particles.filter(p=>cycleAge>=p.delay&&cycleAge<p.delay+p.flight).length);
  if(!blooms.some(b=>b.userData.rigidSource))flowers.rotation.z=.010+.007*(.5+.5*Math.sin(time*.9));blooms.forEach((b,i)=>{if(!b.userData.rigidSource)b.rotation.z=baseRotations[i]+.012+.009*Math.sin(time*1.25+i*.7)});
  const active=cycleAge>=0&&cycleAge<11;const lightEnvelope=active?Math.min(1,cycleAge/.25)*Math.min(1,(11-cycleAge)/1.2):0;
  for(const g of emitterGlow)g.sprite.material.opacity=lightEnvelope*(.10+.23*Math.pow(Math.sin(time*4+g.phase),4.));
  for(const p of [...particles]){
   const age=cycleAge-p.delay;
   if(age<0){p.o.visible=p.halo.visible=p.trail.visible=p.aura.visible=false;continue;}
   if(cycleAge>=15){removeParticle(p);continue;}
   if(!p.released){p.source.updateWorldMatrix(true,false);p.origin.copy(p.sourcePoint);p.source.localToWorld(p.origin);p.drop=p.origin.y-.057;p.flight=p.drop/p.motion.speed;p.released=true;}
   p.o.visible=p.halo.visible=true;
   if(age<p.flight){positionAt(p,age,p.o.position);p.o.rotation.x+=dt*(.45+.35*Math.sin(age*2+p.phase));p.o.rotation.y+=dt*.35;p.o.rotation.z+=dt*(.24+.3*Math.cos(age*1.7+p.phase));
    const fade=.72+.28*Math.min(1,age*12);p.o.material.opacity=fade*.95;p.o.material.emissiveIntensity=.45+.18*Math.pow(Math.sin(time*4+p.phase),2.);p.halo.material.opacity=fade*(.55+.30*Math.pow(Math.sin(time*5+p.phase),4.));p.halo.position.copy(p.o.position);
    p.trail.visible=age>.07;const attr=p.trail.geometry.attributes.position;
    for(let j=0;j<4;j++){positionAt(p,Math.max(0,age-p.tail/(p.down+p.gravity*age)*j/3),temp);attr.setXYZ(j,temp.x,temp.y,temp.z);}attr.needsUpdate=true;p.trail.material.opacity=fade*.62;
    p.aura.visible=p.trail.visible;p.aura.material.uniforms.strength.value=fade*.28;const ribbon=p.aura.geometry.attributes.position;
    for(let j=0;j<9;j++){const u=j/8;positionAt(p,Math.max(0,age-p.tail/(p.down+p.gravity*age)*u),temp);const w=.018*(1.-u*.8);ribbon.setXYZ(j*2,temp.x-ribbonRight.x*w,temp.y-ribbonRight.y*w,temp.z-ribbonRight.z*w);ribbon.setXYZ(j*2+1,temp.x+ribbonRight.x*w,temp.y+ribbonRight.y*w,temp.z+ribbonRight.z*w);}ribbon.needsUpdate=true;
   }else{
    if(!p.landed){p.landed=true;positionAt(p,p.flight,p.o.position);p.o.position.y=.057;p.o.rotation.set(-Math.PI/2,0,p.phase);ripple(p.o.position.x,p.o.position.z,time,.3);if(p.keepOnWater)leaveOnWater(p,time);}
    const settle=age-p.flight,fade=Math.max(0,1-settle/.85);p.trail.visible=p.aura.visible=false;p.o.material.opacity=fade*.6;p.halo.position.copy(p.o.position);p.halo.material.opacity=fade*.26;p.o.visible=p.halo.visible=fade>0;
   }
  }
 }
 const submergedClip=new T.Plane(new T.Vector3(0,-1,0),.026);
 const clip=new T.Plane(new T.Vector3(0,1,0),-.03);const look=new T.Vector3(),dir=new T.Vector3();
 function renderReflection(){water.visible=false;mirrorCamera.copy(camera);mirrorCamera.position.copy(camera.position);mirrorCamera.position.y=.052-camera.position.y;camera.getWorldDirection(dir);look.copy(camera.position).add(dir);look.y=.052-look.y;mirrorCamera.up.set(0,-1,0);mirrorCamera.lookAt(look);mirrorCamera.updateMatrixWorld();textureMatrix.copy(bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
  const previous=renderer.getRenderTarget(),clips=renderer.clippingPlanes;
  // Capture submerged scenery without changing the contact plane for petals.
  floor.visible=true;renderer.clippingPlanes=[submergedClip];renderer.setRenderTarget(transmission);renderer.render(scene,camera);floor.visible=false;renderer.clippingPlanes=clips;
const auto=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;renderer.clippingPlanes=[clip];renderer.setRenderTarget(reflection);renderer.render(scene,mirrorCamera);renderer.setRenderTarget(previous);renderer.clippingPlanes=clips;renderer.shadowMap.autoUpdate=auto;water.visible=true;
 }
 return {update,renderReflection,burst,water,ripple,get floatingObjects(){return floatingPetals.map(f=>f.o)},get particleCount(){return particles.length}};
}






