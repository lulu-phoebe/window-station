import * as THREE from './three.module.js';
const $=selector=>document.querySelector(selector);
const titles=['窗外细雨','翻书声','拍立得快门'];
const seek=$('#position'), play=$('#play'), counter=$('#counter'), status=$('#status');
const display=$('#signal'), graph=display.getContext('2d');
let context,buffer,analyser,toneData,source,offset=0,started=0,request=0,wantsPlayback=false;

function prepare(){
  const Audio=window.AudioContext??window.webkitAudioContext;
  context=new Audio();
  analyser=context.createAnalyser();analyser.fftSize=256;
  analyser.connect(context.destination);toneData=new Uint8Array(analyser.fftSize);
  const rate=context.sampleRate;
  buffer=context.createBuffer(1,rate*18,rate);
  const samples=buffer.getChannelData(0);
  let low=0;
  for(let i=0;i<samples.length;i++){
    const t=i/rate,part=Math.floor(t/6),phase=t%2;
    const noise=Math.random()*2-1;
    low=.84*low+.16*noise;
    if(part===0)samples[i]=low*.25+noise*.028;
    if(part===1&&phase<.66)samples[i]=low*Math.sin(phase*Math.PI/.66)*.63;
    if(part===2&&phase<.22)samples[i]=noise*(Math.exp(-phase*57)+.52*Math.exp(-Math.abs(phase-.087)*108))*.52;
    samples[i]*=Math.min(1,(t%6)*25,(6-t%6)*25);
  }
}
function position(){return source?Math.min(18,offset+context.currentTime-started):offset;}
function pause(){
  request++;wantsPlayback=false;
  if(source){
    offset=position();source.onended=null;source.stop();source.disconnect();source=null;
  }
  play.textContent='播放';
}
async function start(){
  const token=++request;wantsPlayback=true;
  try {
    if(!buffer)prepare();
    await context.resume();
    if(token!==request)return;
    if(offset>=18)offset=0;
    source=context.createBufferSource();source.buffer=buffer;source.connect(analyser);
    started=context.currentTime;source.start(0,offset);
    source.onended=()=>{source.disconnect();source=null;offset=18;wantsPlayback=false;play.textContent='重播';};
    play.textContent='暂停';
  } catch {if(token===request){wantsPlayback=false;status.textContent='声音暂时无法播放，请再试一次。';}}
}
function move(value){
  const playing=wantsPlayback;
  pause();
  offset=THREE.MathUtils.clamp(value,0,18);
  if(playing&&offset<18)start();
}
play.onclick=()=>wantsPlayback?pause():start();
seek.oninput=()=>move(Number(seek.value));
$('#back').onclick=()=>move(Math.max(0,Math.floor(Math.max(0,position()-.1)/6)*6-(position()%6<.15?6:0)));
$('#next').onclick=()=>move(Math.min(12,(Math.floor(position()/6)+1)*6));
addEventListener('pagehide',pause);

function drawSignal(){
  const positionNow=position();
  if(document.activeElement!==seek)seek.value=positionNow;
  counter.value=positionNow.toFixed(1)+' / 18 秒';
  const title=titles[Math.min(2,Math.floor(positionNow/6))];
  if(status.textContent!==title&&(!status.textContent.startsWith('声音')||source))status.textContent=title;
  graph.clearRect(0,0,display.width,display.height);
  graph.strokeStyle='#f1cf87';graph.lineWidth=2;
  if(source&&toneData)analyser.getByteTimeDomainData(toneData);
  graph.beginPath();
  for(let i=0;i<256;i++){
    const sample=source&&toneData?(toneData[i]-128)/128:0;
    const x=i/255*display.width,y=display.height*(.5-sample*2.2);
    if(i===0)graph.moveTo(x,y);else graph.lineTo(x,y);
  }
  graph.stroke();return positionNow;
}

function model(){
  const host=$('#tape-model');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{
    host.textContent='当前浏览器无法展示 3D 模型。';return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,50);
  camera.position.set(0,0,7.5);
  scene.add(new THREE.HemisphereLight('#fff0d8','#566b78',2.1));
  const light=new THREE.DirectionalLight('#ffe2b6',2.4);light.position.set(-3,4,6);scene.add(light);
  const rim=new THREE.DirectionalLight('#c8f4ff',1.6);rim.position.set(4,-2,3);scene.add(rim);
  const tape=new THREE.Group();
  tape.rotation.set(-.16,.23,-.045);scene.add(tape);
  const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.38});
  const blue=material('#527f83'), ivory=material('#ead5a6'), dark=material('#193139'), copper=material('#a7734b',.35), steel=material('#d7c3a1',.5);
  function mesh(geometry,finish,x,y,z,parent=tape){
    const object=new THREE.Mesh(geometry,finish);object.position.set(x,y,z);parent.add(object);return object;
  }
  function box(w,h,d,finish,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),finish,x,y,z);}
  box(3.65,2.26,.32,blue,0,0,0);
  box(3.34,1.54,.052,ivory,0,.15,.17);
  box(2.86,.85,.06,dark,0,.13,.21);
  box(2.5,.28,.09,blue,0,-.87,.2);
  box(2.05,.09,.025,dark,0,-.87,.255);
  for(const x of [-1.66,1.66])for(const y of [-.94,.94]){
    const screw=mesh(new THREE.CylinderGeometry(.062,.062,.035,18),steel,x,y,.18);screw.rotation.x=Math.PI/2;
    box(.083,.012,.01,dark,x,y,.204);
  }
  const hubs=[];
  for(const x of [-.88,.88]){
    const reel=new THREE.Group();reel.position.set(x,.13,.246);tape.add(reel);hubs.push(reel);
    mesh(new THREE.TorusGeometry(.335,.053,10,40),copper,0,0,0,reel);
    mesh(new THREE.TorusGeometry(.18,.045,9,32),steel,0,0,.018,reel);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const spoke=mesh(new THREE.BoxGeometry(.12,.06,.056),ivory,.234*Math.cos(a),.234*Math.sin(a),0,reel);
      spoke.rotation.z=a;
    }
  }
  const resize=()=>{camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);};
  new ResizeObserver(resize).observe(host);resize();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),canvas=renderer.domElement;
  let drag;
  canvas.onpointerdown=event=>{
    if(event.button!==0||drag)return;
    const bounds=canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
    ray.setFromCamera(pointer,camera);
    const winding=ray.intersectObjects(hubs,true).length>0;
    drag={id:event.pointerId,winding,x:event.clientX,y:event.clientY,offset:position(),resume:Boolean(source)};
    if(winding)pause();
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove=event=>{
    if(drag?.id!==event.pointerId)return;
    if(drag.winding)offset=THREE.MathUtils.clamp(drag.offset+(event.clientX-drag.x)*.055,0,18);
    else{
      tape.rotation.y=THREE.MathUtils.clamp(tape.rotation.y+(event.clientX-drag.x)*.012,-1.13,1.13);
      tape.rotation.x=THREE.MathUtils.clamp(tape.rotation.x+(event.clientY-drag.y)*.011,-.9,.9);
      drag.x=event.clientX;drag.y=event.clientY;
    }
  };
  canvas.onlostpointercapture=event=>{
    if(drag?.id!==event.pointerId)return;
    if(drag.winding&&drag.resume&&offset<18)start();
    drag=null;
  };
  return time=>{
    hubs[0].rotation.z=-time*3.2;hubs[1].rotation.z=-time*2.6;
    renderer.render(scene,camera);
  };
}
const render=model();
function frame(){const time=drawSignal();render?.(time);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
