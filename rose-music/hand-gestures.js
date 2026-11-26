// MediaPipe identifies landmarks; joint geometry distinguishes open and closed hands.
export function classifyHand(points) {
  if (!points || points.length!==21) return 'unknown';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
  let extended=0,curled=0;
  for (const base of [5,9,13,17]) {
    const m=points[base],p=points[base+1],tip=points[base+3];
    const ax=p.x-m.x,ay=p.y-m.y,az=(p.z??0)-(m.z??0);
    const bx=tip.x-p.x,by=tip.y-p.y,bz=(tip.z??0)-(p.z??0);
    const straight=(ax*bx+ay*by+az*bz)/(Math.hypot(ax,ay,az)*Math.hypot(bx,by,bz)+1e-8);
    const ratio=distance(tip,points[0])/(distance(p,points[0])+1e-8);
    if (straight>.60 && ratio>1.12) extended++;
    if (straight<.20 || ratio<.97) curled++;
  }
  return extended>=3 ? 'open' : curled>=3 && extended===0 ? 'fist' : 'unknown';
}

function decode(base64) {
  const binary=atob(base64),bytes=new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

const handRoot=new URL('./vendor/hand-tracking/',import.meta.url);
const hints=new Set();
export function warmHandAssets(root=handRoot){
  if (!/^https?:$/.test(location.protocol) || navigator.connection?.saveData) return;
  for(const path of ['vision_bundle.mjs','vision_wasm_internal.js','vision_wasm_internal.wasm','hand_landmarker.task']){
    const href=new URL(path,root).href;
    if(hints.has(href)) continue;
    hints.add(href);
    const link=document.createElement('link');
    link.rel='prefetch';link.href=href;
    document.head.append(link);
  }
}
let assetsPromise;
export async function loadHandDetector() {
  if (!assetsPromise) assetsPromise=(async()=>{
    const packed=JSON.parse(document.querySelector('#hand-assets').textContent);
    const blobURL=(data,type)=>URL.createObjectURL(new Blob([decode(data)],{type}));
    let vision,fileset,model;
    if (packed.bundle) {
      vision=await import(blobURL(packed.bundle,'text/javascript'));
      fileset={wasmLoaderPath:blobURL(packed.loader,'text/javascript'),
        wasmBinaryPath:blobURL(packed.wasm,'application/wasm')};
      model={modelAssetBuffer:decode(packed.model)};
    } else {
      vision=await import('./vendor/hand-tracking/vision_bundle.mjs');
      fileset=await vision.FilesetResolver.forVisionTasks('./vendor/hand-tracking');
      model={modelAssetPath:'./vendor/hand-tracking/hand_landmarker.task'};
    }
    return {vision,fileset,model};
  })().catch(error=>{assetsPromise=null;throw error;});
  const {vision,fileset,model}=await assetsPromise;
  const options={baseOptions:{...model,delegate:'GPU'},runningMode:'VIDEO',numHands:1,
    minHandDetectionConfidence:.60,minHandPresenceConfidence:.60,minTrackingConfidence:.55};
  try {return await vision.HandLandmarker.createFromOptions(fileset,options);}
  catch {return vision.HandLandmarker.createFromOptions(fileset,
    {...options,baseOptions:{...model,delegate:'CPU'}});}
}

export function makeHandGestures({onPose,onMove,onState}) {
  const button=document.querySelector('#gesture');
  const video=document.querySelector('#hand-video');
  const cursor=document.querySelector('#hand-cursor');
  let detector,stream,running=false,frame=0,lastFrame=-1,lastInference=0;
  let candidate='unknown',candidateSince=0,stable='unknown',lastSeen=0;
  const note=text=>{
    const label=document.querySelector('#gesture-status');
    if (label.textContent!==text) label.textContent=text;
  };
  function stop() {
    generation++;
    running=false;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track=>track.stop());
    stream=null;
    video.srcObject=null;
    video.hidden=true;
    cursor.hidden=true;
    button.textContent='开启手势';
    button.setAttribute('aria-pressed','false');
    stable=candidate='unknown';
    note('张掌拨动银河 · 握拳成花');
    onState?.(false);
  }
  function loop(stamp) {
    if (!running) return;
    if (video.readyState>=2 && video.currentTime!==lastFrame && stamp-lastInference>=50) {
      lastInference=stamp;
      lastFrame=video.currentTime;
      try {
        const result=detector.detectForVideo(video,stamp);
        const points=result.landmarks[0];
        if (points) {
          lastSeen=stamp;
          const pose=classifyHand(points);
          const center=[0,5,9,13,17].reduce((p,i)=>({x:p.x+points[i].x/5,y:p.y+points[i].y/5}),{x:0,y:0});
          const x=1-center.x,y=center.y;
          cursor.hidden=false;
          cursor.style.left=`${x*100}%`;
          cursor.style.top=`${y*100}%`;
          cursor.dataset.pose=pose;
          if (pose==='open') onMove(x,y,stamp);
          if (pose!==candidate) {candidate=pose;candidateSince=stamp;}
          if (candidate!=='unknown' && candidate!==stable && stamp-candidateSince>(candidate==='fist'?180:300)) {
            stable=candidate;
            onPose(stable);
          }
          note(pose==='fist'?'握拳 · 银河化作玫瑰':pose==='open'?'张掌 · 左右拨动星光':'请张开手掌或握拳');
        } else {
          candidate='unknown';candidateSince=stamp;
          if (stamp-lastSeen>450) {cursor.hidden=true;stable='unknown';note('把手放进镜头 · 张掌拨动，握拳成花');}
        }
      } catch {
        stop();note('手势识别已停止，请重新开启；也可移动鼠标拨动粒子');
        return;
      }
    }
    frame=requestAnimationFrame(loop);
  }
  button.addEventListener('pointerenter',()=>warmHandAssets(),{once:true});
  button.addEventListener('focus',()=>warmHandAssets(),{once:true});
  const warm=()=>warmHandAssets();
  if('requestIdleCallback' in window) requestIdleCallback(warm,{timeout:4500});
  else setTimeout(warm,2500);
  let generation=0;
  button.addEventListener('click',async()=>{
    if (running) {stop();return;}
    const ticket=++generation;
    button.disabled=true;
    note('正在开启摄像头…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const ready=detector ? Promise.resolve(detector) : loadHandDetector().then(result=>{
        if(ticket!==generation){result.close();return null;}
        detector=result; return result;
      });
      void ready.catch(()=>{});
      const input=await navigator.mediaDevices.getUserMedia({audio:false,
        video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}});
      if(ticket!==generation){input.getTracks().forEach(track=>track.stop());return;}
      stream=input;
      video.srcObject=stream;
      await video.play();
      video.hidden=false;
      note('正在准备手势识别…');
      const prepared=await ready;
      if(ticket!==generation || !prepared) return;
      detector=prepared;
      running=true;lastFrame=-1;lastInference=0;
      button.textContent='关闭手势';button.setAttribute('aria-pressed','true');
      onState?.(true);
      frame=requestAnimationFrame(loop);
    } catch (error) {
      if(ticket!==generation) return;
      stop();
      note(error.name==='NotAllowedError'?'摄像头未开启；可用鼠标拨动，点击下方按钮成花':
        error.name==='NotFoundError'?'没有找到摄像头；可用鼠标拨动，点击下方按钮成花':
        '暂时无法开启手势；可用鼠标拨动，点击下方按钮成花');
    } finally {button.disabled=false;}
  });
  window.addEventListener('pagehide',()=>{stop();detector?.close();detector=null;});
  return {stop};
}
