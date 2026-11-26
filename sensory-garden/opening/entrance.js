import * as T from './three.module.js';

const clamp=T.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const ease=x=>x*x*x*(x*(x*6-15)+10);

export function createEntrance({scene,camera,root,fragments,atmosphere,petalGeometry,renderer,post,beam}){
 const screen=renderer.domElement,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let state='idle',firstAt=0,startedAt=0,elapsed=0,starts=0,route=null,swipe=null;
 const duration=7.4,eye=new T.Vector3(),ahead=new T.Vector3(),direction=new T.Vector3(),initialLook=new T.Vector3(),finalEye=new T.Vector3(0,1.6,-12.5),finalLook=new T.Vector3(0,1.5,-24);
 const baseFog=scene.fog.color.clone(),arrivalFog=new T.Color('#10122d'),beamIntensity=beam.light.intensity;
 const veil={value:0},beamFade={value:1};post.uniforms.journeyVeil=veil;post.uniforms.journeyBeam=beamFade;
 const environment=new T.Group();environment.name='Entrance — petal path';scene.add(environment);
 const arrivalSky={value:0};
 const sky=new T.Mesh(new T.SphereGeometry(85,24,16),new T.ShaderMaterial({uniforms:{strength:arrivalSky},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float strength;varying vec3 p;void main(){float horizon=exp(-abs(normalize(p).y)*6.);vec3 c=mix(vec3(.004,.007,.025),vec3(.035,.030,.085),horizon);gl_FragColor=vec4(c,strength);}',side:T.BackSide,transparent:true,depthWrite:false}));sky.position.z=-20;sky.renderOrder=-100;environment.add(sky);
 const fades=[],motes=[],guide=[],floorPetals=root.children.filter(o=>o.isMesh&&o.geometry===petalGeometry&&o.position.y<.10);
 let seed=9703;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function fadeMaterial(material,opacity){fades.push({material,opacity});material.opacity=0;return material;}
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
 const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
 gradient.addColorStop(0,'rgba(220,225,255,1)');gradient.addColorStop(.12,'rgba(141,167,255,.7)');gradient.addColorStop(.43,'rgba(118,88,220,.20)');gradient.addColorStop(1,'rgba(60,60,150,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const glowTexture=new T.CanvasTexture(glowCanvas);
 // Prebuilt light path. No network assets are loaded during the transition.
 for(let i=0;i<60;i++){
  const z=-2-i*.65,x=Math.sin((z+12)*.13)*(.25+Math.max(0,-z-14)*.035);
  const mat=fadeMaterial(new T.MeshBasicMaterial({map:glowTexture,color:i%3?'#5269d5':'#9670d8',transparent:true,depthWrite:false,blending:T.AdditiveBlending}),.17);
  const patch=new T.Mesh(new T.PlaneGeometry(2.3,2.3),mat);patch.rotation.x=-Math.PI/2;patch.position.set(x,.039,z);environment.add(patch);
 }
 const redPetal=new T.MeshStandardMaterial({color:'#f52a48',roughness:.65,depthWrite:false,emissive:'#ff3865',emissiveIntensity:.16,transparent:true,side:T.DoubleSide});
 const resting=new T.InstancedMesh(petalGeometry,fadeMaterial(redPetal,.88),160),dummy=new T.Object3D();
 for(let i=0;i<160;i++){const z=-14-rand()*28,x=Math.sin((z+12)*.13)*(.25+Math.max(0,-z-14)*.035)+(rand()-.5)*2;
  dummy.position.set(x,.055,z);dummy.rotation.set(-Math.PI/2+(rand()-.5)*.2,rand()*6.28,rand()*6.28);dummy.scale.setScalar(.065+rand()*.06);dummy.updateMatrix();resting.setMatrixAt(i,dummy.matrix);
 }environment.add(resting);
 // Distant translucent, stepped shapes echo the original floating blocks.
 const stepped=new T.Shape();[[0,0],[.7,0],[.7,.18],[1,.18],[1,.75],[.8,.75],[.8,1],[.2,1],[.2,.8],[0,.8]].forEach(([x,y],i)=>stepped[i?'lineTo':'moveTo'](x-.5,y-.5));stepped.closePath();
 const blockG=new T.ShapeGeometry(stepped);
 for(let i=0;i<30;i++){
  const mat=fadeMaterial(new T.MeshBasicMaterial({color:i%3===0?'#b4a2d9':i%3===1?'#839fd3':'#d9b6cc',transparent:true,depthWrite:false,side:T.DoubleSide}),.17+rand()*.17);
  const o=new T.Mesh(blockG,mat);o.position.set((i%2?1:-1)*(3.8+rand()*7),.6+rand()*4.6,-17-rand()*30);o.scale.setScalar(.4+rand()*1.7);environment.add(o);motes.push({o,y:o.position.y,phase:rand()*6.28,block:true});
 }
 const count=300,positions=new Float32Array(count*3),dust=new T.BufferGeometry();
 for(let i=0;i<count;i++){positions[i*3]=(rand()-.5)*20;positions[i*3+1]=.2+rand()*6;positions[i*3+2]=-13-rand()*38;}
 dust.setAttribute('position',new T.BufferAttribute(positions,3));
 const dustMat=fadeMaterial(new T.PointsMaterial({color:'#cbd0ff',size:.035,map:glowTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),.7);
 const dustCloud=new T.Points(dust,dustMat);environment.add(dustCloud);
 // Slender distant luminous stems frame the space without adding a full garden or map.
 for(let i=0;i<18;i++){
  const x=(i%2?1:-1)*(3+rand()*6),z=-22-rand()*24,h=1.2+rand()*4;
  const curve=new T.CatmullRomCurve3([new T.Vector3(x,.05,z),new T.Vector3(x-.25,h*.5,z-.1),new T.Vector3(x+Math.sin(i)*.5,h,z)]);
  const mat=fadeMaterial(new T.MeshBasicMaterial({color:i%2?'#4e6894':'#795f9d',transparent:true,depthWrite:false}),.32);
  environment.add(new T.Mesh(new T.TubeGeometry(curve,20,.012,5,false),mat));
 }
 // An accessible one-time invitation, never an interactive overlay.
 const style=document.createElement('style');style.textContent=`
 #petal-invitation{position:fixed;top:13%;left:5%;right:5%;text-align:center;z-index:12;color:#eeebff;font:300 clamp(16px,1.5vw,23px)/1.8 "PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.13em;text-shadow:0 2px 24px #656ab0;opacity:0;transform:translateY(10px);transition:opacity 1.7s ease,transform 1.7s ease;pointer-events:none}
 #petal-invitation.show{opacity:1;transform:translateY(0)}
 #petal-invitation .scroll-cue{width:13px;height:22px;border:1px solid #b5b6d477;border-radius:10px;margin:15px auto 0;position:relative}
 #petal-invitation .scroll-cue:after{content:"";width:3px;height:5px;position:absolute;left:4px;top:4px;background:#e8e5ff;border-radius:3px;animation:petal-cue 2.4s ease-in-out infinite}
 @keyframes petal-cue{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(7px);opacity:1}}
 @media(prefers-reduced-motion:reduce){#petal-invitation .scroll-cue:after{animation:none}}
 `;document.head.appendChild(style);
 const invitation=document.createElement('div');invitation.id='petal-invitation';invitation.setAttribute('aria-hidden','true');invitation.setAttribute('role','status');invitation.setAttribute('aria-live','polite');
 const message=document.createElement('span');message.textContent='向前，看看花瓣去了哪里。';invitation.appendChild(message);
 const cue=document.createElement('div');cue.className='scroll-cue';cue.setAttribute('aria-hidden','true');invitation.appendChild(cue);document.body.appendChild(invitation);
 const blockOrigins=fragments.children.map(o=>o.position.clone());
 function publishState(){screen.dataset.journeyState=state;screen.dataset.transitionStarts=String(starts);screen.dataset.journeySeconds=elapsed.toFixed(2);}
 publishState();
 function notifyClick(time){if(state!=='idle')return;state='invited';firstAt=time;publishState();}
 function begin(time=performance.now()/1000){
  if(state!=='invited'||time-firstAt<1.5)return false;
  state='transition';starts++;startedAt=time;invitation.classList.remove('show');invitation.setAttribute('aria-hidden','true');document.body.style.cursor='default';
  const points=[camera.position.clone()],radius=Math.max(4.8,Math.hypot(camera.position.x,camera.position.z));
  const angle=Math.atan2(camera.position.x,camera.position.z),targetAngle=-.92;
  let delta=((targetAngle-angle+Math.PI*3)%(Math.PI*2))-Math.PI;
  // Orbit outside the whole bouquet before taking the clear left-hand corridor.
  for(let i=1;i<=5;i++){const u=i/5,a=angle+delta*smooth(0,1,u),r=T.MathUtils.lerp(radius,4.8,u);points.push(new T.Vector3(Math.sin(a)*r,T.MathUtils.lerp(camera.position.y,2.5,u),Math.cos(a)*r));}
  points.push(new T.Vector3(-3.9,2.4,1.6),new T.Vector3(-3.6,2.2,-1.2),new T.Vector3(-2.7,1.95,-4),new T.Vector3(-1.2,1.7,-7.5),new T.Vector3(0,1.6,-10),finalEye.clone());
  route=new T.CatmullRomCurve3(points,false,'centripetal');camera.getWorldDirection(direction);initialLook.copy(camera.position).addScaledVector(direction,7);
  const available=[...atmosphere.floatingObjects,...floorPetals].filter(o=>o.visible).slice(0,8);
  available.forEach((source,i)=>{
   source.updateWorldMatrix(true,false);const from=new T.Vector3();source.getWorldPosition(from);
   const material=new T.MeshStandardMaterial({color:'#ff4a67',emissive:'#ff527d',emissiveIntensity:.65,roughness:.5,transparent:true,opacity:.9,side:T.DoubleSide});
   const o=new T.Mesh(source.geometry,material);source.getWorldScale(o.scale);source.getWorldQuaternion(o.quaternion);o.position.copy(from);scene.add(o);source.visible=false;
   guide.push({o,from,phase:i*1.7,index:i});
  });
  publishState();return true;
 }
 addEventListener('wheel',event=>{if(state==='idle')return;event.preventDefault();if(event.deltaY>2)begin();},{passive:false});
 addEventListener('pointerdown',e=>{if(e.pointerType==='touch')swipe={x:e.clientX,y:e.clientY,id:e.pointerId};},{passive:true});
 addEventListener('pointerup',e=>{if(!swipe||swipe.id!==e.pointerId)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(dy<-48&&Math.abs(dy)>Math.abs(dx)*1.3)begin();},{passive:true});
 addEventListener('pointercancel',()=>{swipe=null;},{passive:true});
 // Keyboard equivalents retain the quiet, button-free presentation.
 addEventListener('keydown',e=>{if(state==='invited'&&['ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();begin();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now()/1000;else if(hiddenAt!==null){const pause=performance.now()/1000-hiddenAt;if(state==='transition')startedAt+=pause;if(state==='invited')firstAt+=pause;hiddenAt=null;}});
 let hiddenAt=null;
 function update(time){
  if(state==='invited'&&time-firstAt>1.1){invitation.classList.add('show');invitation.setAttribute('aria-hidden','false');}
  for(const m of motes){m.o.quaternion.copy(camera.quaternion);m.o.position.y=m.y+Math.sin(time*.25+m.phase)*.08;}
  dustCloud.position.x=Math.sin(time*.08)*.10;
  if(state!=='transition'&&state!=='arrived')return;
  elapsed=state==='arrived'?duration:Math.min(duration,Math.max(0,time-startedAt));
  const u=elapsed/duration,s=ease(u),reveal=smooth(3.5,6.7,elapsed),cover=smooth(2.7,4.5,elapsed)*(1-smooth(5.3,7.2,elapsed));
  veil.value=cover*.98;beamFade.value=1-smooth(2.7,4.7,elapsed);beam.light.intensity=beamIntensity*beamFade.value;
  arrivalSky.value=reveal;scene.fog.color.copy(baseFog).lerp(arrivalFog,reveal);scene.fog.density=T.MathUtils.lerp(.042,.032,reveal);
  for(const f of fades)f.material.opacity=f.opacity*smooth(3.0,6.4,elapsed);
  atmosphere.water.material.uniforms.waterOrigin.value.set(0,0,-12.5*reveal);
  root.visible=elapsed<4.8;
  fragments.children.forEach((o,i)=>{o.position.x=blockOrigins[i].x+(blockOrigins[i].x<0?-1:1)*smooth(2.1,4.7,elapsed)*2.4;});
  route.getPointAt(s,eye);route.getPointAt(Math.min(1,s+.055),ahead);direction.copy(ahead).sub(eye);
  if(direction.lengthSq()<.00001)direction.set(0,0,-1);direction.normalize();
  const forward=eye.clone().addScaledVector(direction,5);forward.y=T.MathUtils.lerp(2.05,1.48,s);
  const aim=initialLook.clone().lerp(forward,smooth(.06,.48,u));
  aim.lerp(finalLook,smooth(.82,1,u));camera.position.copy(eye);camera.lookAt(aim);
  const landing=smooth(5.9,7.4,elapsed);
  for(const g of guide){
   const goal=eye.clone().addScaledVector(direction,T.MathUtils.lerp(3.0+g.index*.15,6.2+g.index*.25,landing));goal.x+=Math.sin(time*.9+g.phase)*T.MathUtils.lerp(.32,.018,landing);goal.y=.55+.22*Math.sin(time*.8+g.phase);
   goal.y=T.MathUtils.lerp(goal.y,.055,landing);
   const launch=new T.Vector3(-2.4+Math.sin(g.phase)*.25,.60+Math.sin(time+g.phase)*.12,.6-g.index*.12);
   goal.lerp(launch,1-smooth(1.1,2.7,elapsed));
   g.o.position.copy(g.from).lerp(goal,smooth(0,1.45,elapsed));g.o.rotation.x=T.MathUtils.lerp(-.3+Math.sin(time+g.phase)*.15,-Math.PI/2,landing);g.o.rotation.z+=.002*(1-landing);
  }
  if(elapsed>=duration){state='arrived';camera.position.copy(finalEye);camera.lookAt(finalLook);veil.value=0;root.visible=false;invitation.hidden=true;}
  for(const m of motes)m.o.quaternion.copy(camera.quaternion);
  publishState();
 }
 return {notifyClick,begin,update,get state(){return state;},get locked(){return state==='transition'||state==='arrived';},isVerticalGesture(e){return !!swipe&&state==='invited'&&Math.abs(e.clientY-swipe.y)>Math.abs(e.clientX-swipe.x)*1.3;}};
}
