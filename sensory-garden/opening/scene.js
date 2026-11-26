import * as T from './three.module.js';
import {createAtmosphere} from './effects.js';
import {createEntrance} from './entrance.js';
import {createWhiteBeam} from './white-beam.js';
import {beamPostShader} from './beam-post.js';
import {buildRoseBouquet} from './rose-bouquet.js';
import {replaceOpeningModel} from './imported-chair.js';
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;document.body.appendChild(renderer.domElement);
const scene=new T.Scene();
const skyCanvas=document.createElement('canvas');skyCanvas.width=32;skyCanvas.height=1024;
const skyContext=skyCanvas.getContext('2d'),skyGradient=skyContext.createLinearGradient(0,0,0,1024);
[[0,'#000000'],[1,'#000000']].forEach(([t,color])=>skyGradient.addColorStop(t,color));
skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,32,1024);
const skyTexture=new T.CanvasTexture(skyCanvas);skyTexture.colorSpace=T.SRGBColorSpace;scene.background=skyTexture;scene.backgroundIntensity=.85;scene.fog=new T.FogExp2('#000000',.042);
const camera=new T.PerspectiveCamera(34,1,.1,100);const root=new T.Group();scene.add(root);
let seed=329;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const mat=(color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const chrome=mat('#cab7a0',.24,.92),wood=mat('#d8b4a2',.38,.12),rubber=mat('#151e17',.9),stemMat=mat('#596b31',.7),leafMats=['#596b32','#78864a','#344c28','#8b9055'].map(c=>mat(c,.65));
function mesh(g,m,p,parent=root){const o=new T.Mesh(g,m);if(p)o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function tube(points,r=.035,m=chrome,parent=root){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,48,r,10,false),m,null,parent)}
function rounded(w,h,r){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s}
const chair=new T.Group();root.add(chair);
const seat=mesh(new T.ExtrudeGeometry(rounded(2.05,1.72,.23),{depth:.09,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:4,steps:1}),wood,[0,1.91,.04],chair);seat.rotation.x=-Math.PI/2;
const back=mesh(new T.ExtrudeGeometry(rounded(1.91,1.17,.16),{depth:.07,bevelEnabled:true,bevelThickness:.028,bevelSize:.028,bevelSegments:4}),wood,[0,3.14,-.72],chair);back.rotation.x=-.1;
for(const x of [-.87,.87]){
 tube([[x*1.22,.10,.97],[x*1.13,.9,.79],[x,1.8,.61],[x,1.91,.40]],.038,chrome,chair);
 tube([[x*1.17,.1,-.94],[x*1.07,1.05,-.77],[x,1.9,-.70],[x,2.5,-.77],[x,3.64,-.80]],.037,chrome,chair);
 for(const z of [.97,-.94]){const f=mesh(new T.CylinderGeometry(.056,.069,.115,16),rubber,[x*(z>0?1.22:1.17),.08,z],chair);}
}
tube([[-.88,3.55,-.8],[-.88,3.72,-.8],[-.70,3.78,-.8],[.70,3.78,-.8],[.88,3.7,-.8],[.88,3.55,-.8]],.038,chrome,chair);
tube([[-.87,1.78,-.6],[0,1.78,-.6],[.87,1.78,-.6]],.026,chrome,chair);
// A rose petal is a broad cup sector with a rounded, rolled lip, not a pointed leaf.
function roseSurface(u,t){
 const spread=.10+.86*Math.sin(t*Math.PI*.5),angle=u*spread;
 const r=(.12+.88*Math.sin(t*Math.PI*.5))*(1.-.38*u*u*t)*(1.+.12*u*t);
 const z=.66*t-.25*Math.pow(t,6)+.16*u*u*Math.pow(t,4)-.10*u*Math.pow(t,5);
 return new T.Vector3(Math.sin(angle)*r,Math.cos(angle)*r,z);
}
function petalGeometry(){const g=new T.BufferGeometry(),v=[],uv=[],ix=[];const nx=28,ny=26;
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const t=j/ny,u=i/nx*2-1,p=roseSurface(u,t);v.push(p.x,p.y,p.z);uv.push(i/nx,t)}
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;ix.push(a,a+1,a+nx+2,a,a+nx+2,a+nx+1)}
 g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g}
const petalG=petalGeometry();const petalMats=['#f20723','#db001c','#ff1830','#c90019','#ed0824'].map(c=>{let m=new T.MeshPhysicalMaterial({color:c,roughness:.62,metalness:0,clearcoat:.08,clearcoatRoughness:.30,emissive:c,emissiveIntensity:.035,side:T.DoubleSide});m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.42+.58*smoothstep(.12,.94,vUv.y);')};m.defines={USE_UV:''};return m});const pollen=mat('#dca95a',.68);
const flowers=new T.Group();root.add(flowers);
// Keep each bloom's location and all subsequent vine/layout random choices unchanged.
const dewGeometry=new T.SphereGeometry(1,10,8);
const dewMaterial=new T.MeshPhysicalMaterial({color:'#eef6ff',metalness:.08,roughness:.045,transparent:true,opacity:.82,clearcoat:1,clearcoatRoughness:.02,ior:1.333});
const dewGlint=new T.MeshBasicMaterial({color:'#fff7f0',toneMapped:false});
function flower(pos,size,tilt=0){
 let roseSeed=seed;const roseRand=()=>{roseSeed=(roseSeed*1664525+1013904223)>>>0;return roseSeed/4294967296};
 const ry=-.3+rand()*.6,rz=rand()*6.28;for(let i=0;i<142;i++)rand();
 const f=new T.Group();f.position.set(...pos);f.rotation.set(tilt,ry,rz);f.scale.setScalar(.92);flowers.add(f);
 const beads=[],highlights=[];const dummy=new T.Object3D();
 for(let layer=0;layer<7;layer++){
  const count=layer<3?5:layer<5?4:3;
  for(let i=0;i<count;i++){
   const p=mesh(petalG,petalMats[(i+layer*2)%5],null,f);
   const angle=i/count*Math.PI*2+layer*2.399;
   p.rotation.set(-.08+layer*.022,0,angle);p.castShadow=false;p.receiveShadow=false;
   const scale=size*Math.pow(.74,layer);p.scale.set(scale*(1.+.06*Math.sin(i*3.1+layer)),scale,scale);
   p.position.set(0,0,size*.46*(1.-Math.pow(.72,layer)));p.updateMatrix();
   for(let j=0;j<3;j++){
    const t=.32+roseRand()*.56,u=(roseRand()-.5)*1.3;
    const v=roseSurface(u,t);v.z+=.014;v.applyMatrix4(p.matrix);
    const r=size*(.014+roseRand()*.015);beads.push({v,r});
    if(j===0)highlights.push({v:v.clone().add(new T.Vector3(-r*.25,r*.36,r*.75)),r:r*.21});
   }
  }
 }
 const dew=new T.InstancedMesh(dewGeometry,dewMaterial,beads.length);dew.castShadow=false;f.add(dew);
 beads.forEach(({v,r},i)=>{dummy.position.copy(v);dummy.scale.set(r,r,r*.80);dummy.updateMatrix();dew.setMatrixAt(i,dummy.matrix)});
 const glints=new T.InstancedMesh(dewGeometry,dewGlint,highlights.length);f.add(glints);
 highlights.forEach(({v,r},i)=>{dummy.position.copy(v);dummy.scale.setScalar(r);dummy.updateMatrix();glints.setMatrixAt(i,dummy.matrix)});
 return f;
}
const leafG=new T.SphereGeometry(1,10,8);leafG.scale(.065,.17,.015);
const layout=[[-.62,3.56,-.39,.26],[.18,3.72,-.36,.27],[.69,3.55,-.30,.32],[.93,3.13,-.20,.34],[.74,2.78,-.12,.25],[-.84,2.83,-.24,.23],[-.61,2.49,.04,.27],[-.66,2.28,.67,.23],[-.20,2.28,.80,.25],[.30,2.24,1.02,.22],[.52,1.72,1.26,.18],[.12,1.32,1.26,.16]];
function vine(points,count=20){tube(points,.013,stemMat,flowers);const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));for(let i=1;i<count;i++){const t=i/count,p=curve.getPoint(t);const side=i%2?1:-1;const end=p.clone().add(new T.Vector3(side*(.11+rand()*.1),.045,.03));const blocked=layout.some(([x,y,z,r])=>y<2.6&&Math.hypot((end.x-x)/(r+.12),(end.y-y)/(r+.12),(end.z-z)/.23)<1.2);if(blocked)continue;tube([p.toArray(),end.toArray()],.005,stemMat,flowers);const l=mesh(leafG,leafMats[i%4],end.toArray(),flowers);l.rotation.set(rand()*.9,rand(),side*(-.6-rand()*.55));l.scale.setScalar(.8+rand()*.6)}}
vine([[-.78,3.62,-.53],[-.3,3.79,-.48],[.63,3.57,-.44],[.85,2.95,-.36],[.62,2.47,-.14],[.22,2.23,.65],[.27,2.11,1.07],[.27,1.82,1.16],[.18,1.38,1.14],[.18,.85,1.12],[.37,.07,1.14]],54);
vine([[-.6,3.48,-.51],[-.92,2.97,-.45],[-.75,2.51,-.25],[-.76,2.08,.56],[-.3,2.14,.89],[.3,2.12,.97]],30);
vine([[.72,3.58,-.5],[.97,3.19,-.39],[1.02,2.75,-.26],[.73,2.52,-.13]],20);

for(const [x,y,z,s] of layout){flower([x,y,z],s,-.12+rand()*.35);if(y<1.9)tube([[.22,y+.035,1.15],[(x+.22)/2,y+.025,1.19],[x,y,z-.04]],.009,stemMat,flowers);}
for(let i=0;i<8;i++){const p=mesh(petalG,petalMats[i%5],[rand()*1.8-.65,.018,rand()*1.4+.6]);p.rotation.set(-Math.PI/2,0,rand()*6.28);p.scale.setScalar(.12+rand()*.06)}
buildRoseBouquet(flowers,petalG,petalMats);
const floor=mesh(new T.PlaneGeometry(200,200),mat('#25241c',.96),[0,0,0],scene);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
scene.add(new T.HemisphereLight('#c9d0d1','#24201c',.70));
function area(color,intensity,pos){const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l}
const key=area('#ffe4cd',.9,[-3,6,4]);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=5;
area('#efd2ce',.5,[4,3,-2]);area('#b4d1c0',.5,[-2,3,-4]);
const glow=new T.PointLight('#ffffff',.25,6);glow.position.set(.6,3.8,0);scene.add(glow);
// Floating prismatic fragments, each an actual translucent plane in the scene.
const fragments=new T.Group();root.add(fragments);

// A shared painted field: warped pastel cloud boundaries, never rainbow stripes.
function spectrum(){
 const c=document.createElement('canvas');c.width=c.height=512;
 const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);
 const palette=[[.54,.58,.85],[.60,.67,.89],[.92,.61,.57],[.96,.82,.57],[.66,.67,.90],[.54,.64,.87]];
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const u=x/512,v=y/512;
  const warp=.17*Math.sin(u*9+Math.sin(v*6)*1.8)+.065*Math.sin(u*24-v*11)+.025*Math.sin(u*64+v*39);
  const t=((v*2.2+warp+.12*Math.sin(u*4+v*9))%1+1)%1;
  const f=t*(palette.length-1),i=Math.floor(f),j=Math.min(i+1,palette.length-1);
  let m=Math.max(0,Math.min(1,(f-i-.30)/.4));m=m*m*(3-2*m);
  const grain=(rand()-.5)*.065,idx=(y*512+x)*4;
  for(let k=0;k<3;k++)image.data[idx+k]=255*Math.max(0,Math.min(1,palette[i][k]*(1-m)+palette[j][k]*m+grain));
  image.data[idx+3]=255;
 }
 ctx.putImageData(image,0,0);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.MirroredRepeatWrapping;return tex;
}
const tex=spectrum();
const blockFlow={value:0};
const fragPositions=[[-.87,3.43,-.15,.35,.38],[-.55,3.15,-.04,.5,.45],[-.18,3.46,-.1,.37,.28],[.66,4.04,-.4,.44,.42],[.91,4.25,-.4,.34,.3],[1.13,3.84,-.24,.65,.52],[1.28,3.48,-.15,.61,.57],[1.52,3.65,-.16,.29,.38],[-1.12,2.67,.03,.32,.35],[.68,2.45,.25,.36,.44],[-.45,1.94,1.03,.4,.24],[-.27,1.8,1.07,.27,.3],[.55,1.27,1.02,.29,.28],[.37,1.1,1.04,.29,.17],[-.7,1.28,.58,.12,.17],[1.39,2.82,.15,.17,.19]];
const outlines=[[[0,0],[.76,0],[.76,.2],[1,.2],[1,.78],[.82,.78],[.82,1],[.22,1],[.22,.86],[0,.86]],[[.18,0],[.82,0],[.82,.18],[1,.18],[1,.68],[.82,.68],[.82,1],[0,1],[0,.3],[.18,.3]],[[0,0],[1,0],[1,1],[0,1]]];
fragPositions.forEach(([x,y,z,w,h],i)=>{
 // Keep the front rose-covering cluster beyond the left edge of the flowers.
 if(i<=2||i===8){x-=.95;z-=.18;}else if(i>=3&&i<=7){x+=.22;z-=.12;}
 const outline=outlines[i%3],shape=new T.Shape();outline.forEach(([u,v],j)=>{shape[j?'lineTo':'moveTo']((u-.5)*w,(v-.5)*h)});shape.closePath();
 const geometry=new T.ShapeGeometry(shape),uv=geometry.attributes.uv,pos=geometry.attributes.position;
 for(let j=0;j<uv.count;j++)uv.setXY(j,(pos.getX(j)+x+1.8)/3.6,(pos.getY(j)+y)/4.8);
 const material=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.42,side:T.DoubleSide,depthWrite:false,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.uniforms.blockTime=blockFlow;shader.uniforms.blockPhase={value:i*1.7};
  shader.fragmentShader='uniform float blockTime,blockPhase;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec2 flowUV=vMapUv;
    flowUV.x+=blockTime*.010+.037*sin(vMapUv.y*8.+blockTime*.34+blockPhase)+.012*sin(vMapUv.x*13.-blockTime*.22);
    flowUV.y+=blockTime*.006+.030*sin(vMapUv.x*6.-blockTime*.27+blockPhase*.5);
    diffuseColor*=texture2D(map,flowUV);
   #endif
  `);
 };
 const p=mesh(geometry,material,[x,y,z],fragments);p.userData={y,phase:i*1.7};p.castShadow=false;
 // Broad, low-opacity halation follows the stepped silhouette.
 const c=document.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');ctx.filter='blur(12px)';ctx.fillStyle=i%2?'#c5cadb':'#efc393';ctx.beginPath();outline.forEach(([u,v],j)=>ctx[j?'lineTo':'moveTo'](32+u*128,32+(1-v)*128));ctx.closePath();ctx.fill();
 const halo=mesh(new T.PlaneGeometry(w*1.5,h*1.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,opacity:.13,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),[0,0,-.015],p);halo.castShadow=false;
});
const whiteBeam=createWhiteBeam(scene,renderer);
// Depth-aware white light scattering, optical halation and film grain.
const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});const postScene=new T.Scene(),postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
const post=new T.ShaderMaterial({uniforms:{...whiteBeam.uniforms,sceneDepth:{value:target.depthTexture},beamProjectionInverse:{value:camera.projectionMatrixInverse},beamCameraWorld:{value:camera.matrixWorld},image:{value:target.texture},resolution:{value:new T.Vector2()},time:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position,1.);}',fragmentShader:`uniform sampler2D image;uniform vec2 resolution;uniform float time,journeyVeil,journeyBeam;varying vec2 v;
${beamPostShader}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 c=texture2D(image,v).rgb;float airBeam=whiteBeamVolume(v);float surfaceDepth=texture2D(sceneDepth,v).r;vec4 surfaceView=beamProjectionInverse*vec4(v*2.-1.,surfaceDepth*2.-1.,1.);surfaceView/=surfaceView.w;vec3 surfaceWorld=(beamCameraWorld*surfaceView).xyz;float airOnly=surfaceDepth>.99999||surfaceWorld.y<.065?1.:0.;c+=beamTint*airBeam*2.15*airOnly*journeyBeam;vec3 bloom=vec3(0.);float weight=0.;for(int x=-3;x<=3;x++){for(int y=-3;y<=3;y++){vec2 d=vec2(float(x),float(y));float w=exp(-dot(d,d)/5.);vec3 b=texture2D(image,v+d*4./resolution).rgb;bloom+=max(b-vec3(.45),0.)*w;weight+=w;}}c+=bloom/weight*.65;float vig=smoothstep(.85,.15,length((v-.5)*vec2(1.,.8)));c*=.63+.37*vig;c+=vec3((hash(gl_FragCoord.xy+fract(time)*935.)-.5)*.047);float fogCloud=.5+.25*sin(v.x*8.+time*.17+sin(v.y*7.-time*.11))+.25*sin(v.y*9.-time*.13+v.x*3.);vec3 softFog=mix(vec3(.045,.055,.14),vec3(.11,.075,.19),fogCloud);c=mix(c,softFog,journeyVeil*(.94+.06*fogCloud));gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),post));
let width,height;function resize(){width=innerWidth;height=innerHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();const d=renderer.getPixelRatio();target.setSize(width*d,height*d);post.uniforms.resolution.value.set(width*d,height*d)}addEventListener('resize',resize);resize();
const bareOpening=new URLSearchParams(location.search).get('stage')==='bare';
if(!bareOpening) await replaceOpeningModel({scene,root,chair,flowers,petalGeometry:petalG,renderer});
else {flowers.visible=false;root.children.filter(o=>o.isMesh&&o.geometry===petalG).forEach(o=>o.visible=false);chrome.color.set('#292e29');chrome.metalness=.25;}

const atmosphere=createAtmosphere({scene,renderer,camera,floor,flowers,petalGeometry:petalG,skyTexture});
const journey=createEntrance({scene,camera,root,fragments,atmosphere,petalGeometry:petalG,renderer,post,beam:whiteBeam});
const hover=new T.Vector2();addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){hover.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1)}},{passive:true});
const raycaster=new T.Raycaster(),pointer=new T.Vector2();let pressX=0,pressY=0,pressTime=0;
renderer.domElement.addEventListener('pointerdown',e=>{pressX=e.clientX;pressY=e.clientY;pressTime=performance.now()});
renderer.domElement.addEventListener('pointerup',e=>{if(journey.locked)return;if(Math.hypot(e.clientX-pressX,e.clientY-pressY)>7||performance.now()-pressTime>550)return;pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);const hits=flowers.children.some(b=>b.userData.rigidSource)?[]:raycaster.intersectObjects(flowers.children,true);const point=hits.length?hits[0].point:new T.Vector3(0,2.7,.5);if(!bareOpening) atmosphere.burst(point);!bareOpening && false /* entrance belongs to parent journey */});
let previousFrame=0;
let drag=false,last=0,orbit=0,desired=0;renderer.domElement.addEventListener('pointerdown',e=>{drag=true;last=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});addEventListener('pointerup',()=>drag=false);addEventListener('pointercancel',()=>drag=false);addEventListener('pointermove',e=>{if(drag&&!journey.locked&&!journey.isVerticalGesture(e)){desired-=(e.clientX-last)*.004;last=e.clientX}});renderer.domElement.addEventListener('dblclick',()=>{if(journey.state!=='idle')return;start=performance.now();desired=0});
let start=performance.now();const look=new T.Vector3(0,2.08,0);const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(now){requestAnimationFrame(animate);let t=(now-start)/1000;let u=reduce?1:Math.min(t/5.5,1);let e=1-Math.pow(1-u,3);let angle=(1-e)*2.36+e*.28;let distance= u<.38?T.MathUtils.lerp(21,7.9,1-Math.pow(1-u/.38,3)):T.MathUtils.lerp(7.9,8.8,(u-.38)/.62);if(camera.aspect<1)distance*=1.25;orbit+=(desired-orbit)*.045;angle+=orbit;camera.position.set(Math.sin(angle)*distance,2.95+(1-e)*3.2,Math.cos(angle)*distance);if(!journey.locked){camera.position.x+=hover.x*.055;camera.position.y-=hover.y*.035}camera.lookAt(look);for(const f of fragments.children){f.position.y=f.userData.y+Math.sin(now*.00035+f.userData.phase)*.018;f.quaternion.copy(camera.quaternion);const size=reduce?1:1+.13*Math.sin(now*.00066+f.userData.phase)+.035*Math.sin(now*.00107+f.userData.phase*.63);f.scale.setScalar(size)}blockFlow.value=reduce?0:now*.001;post.uniforms.time.value=now*.001;const dt=Math.min(.05,(now-previousFrame)/1000||.016);previousFrame=now;atmosphere.update(now*.001,dt);whiteBeam.update(now*.001);journey.update(now*.001);renderer.domElement.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(4)).join(',');whiteBeam.setReflectionMode(true);atmosphere.renderReflection();whiteBeam.setReflectionMode(false);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCam)}requestAnimationFrame(animate);
window.sceneDebug={scene,camera,renderer,chair,flowers,fragments,atmosphere,whiteBeam,journey};



// The parent controls scene lifecycle. The opening accepts wheel and touch entry directly.
if(bareOpening){
 let touchY=null;
 addEventListener('wheel',e=>{if(e.deltaY>4){e.preventDefault();parent.postMessage({type:'enter-map'},location.origin)}},{passive:false});
 addEventListener('keydown',e=>{if(['ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();parent.postMessage({type:'enter-map'},location.origin)}});
 addEventListener('touchstart',e=>touchY=e.touches[0]?.clientY,{passive:true});
 addEventListener('touchend',e=>{if(touchY!==null&&touchY-e.changedTouches[0].clientY>45)parent.postMessage({type:'enter-map'},location.origin);touchY=null},{passive:true});
}
