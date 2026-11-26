const $=selector=>document.querySelector(selector);
const names=['玻璃前','绿色沙发','翻开一页','花旁边','粉色花灯','午餐时光'];
const path=index=>'./instant-photos/photo-'+(index+1)+'.jpg';
const paper=$('#paper'), image=$('#developing'), shutter=$('#shutter'), status=$('#photo-status');
const label=$('#print-label'), large=$('#large');
const key='window-desk-developed-photos';
const unlocked=new Set();
try {
  for(const i of JSON.parse(localStorage.getItem(key)||'[]'))if(Number.isInteger(i)&&i>=0&&i<names.length)unlocked.add(i);
} catch {}
const basin=$('#water-basin'), surface=$('.water-surface'), hang=$('#hang-photo');
const prints=$('#floating-prints'), net=$('#scoop-net');
const afloat=new Map();
let index=-1,sound,drag=null,lastRipple=0,developed=false;
const motion=matchMedia('(prefers-reduced-motion: reduce)');

function shutterSound(){
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    sound ||= new Context();
    sound.resume().catch(()=>{});
    const buffer=sound.createBuffer(1,Math.round(sound.sampleRate*.105),sound.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++){
      const t=i/samples.length;
      samples[i]=(Math.random()*2-1)*(Math.exp(-t*17)+.44*Math.exp(-Math.abs(t-.37)*37))*.35;
    }
    const click=sound.createBufferSource();click.buffer=buffer;click.connect(sound.destination);click.start();
  }catch{}
}

function viewPhoto(i){
  $('#large-image').src=path(i);$('#large-image').alt=names[i];
  $('#large-label').textContent=names[i];
  if(!large.open)large.showModal();
}
large.addEventListener('click',event=>{if(event.target===large)large.close();});

function paintAlbum(){
  const line=$('#line');
  line.replaceChildren();
  $('#album-empty').hidden=unlocked.size>0;
  $('#tally').textContent=unlocked.size+' / '+names.length;
  for(let i=0;i<names.length;i++){
    if(!unlocked.has(i)){
      const empty=document.createElement('span');
      empty.className='mini empty';empty.setAttribute('aria-hidden','true');
      line.append(empty);
      continue;
    }
    const button=document.createElement('button');
    button.type='button';button.className='mini';button.setAttribute('aria-label','放大照片：'+names[i]);
    const photo=document.createElement('img');photo.src=path(i);photo.alt='';photo.loading='lazy';
    button.append(photo);
    button.addEventListener('click',()=>viewPhoto(i));
    line.append(button);
  }
}

function splash(x,y){
  const rect=surface.getBoundingClientRect();
  if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom||motion.matches)return;
  const ring=document.createElement('i');
  ring.className='water-ring';ring.style.left=(x-rect.left)+'px';ring.style.top=(y-rect.top)+'px';
  surface.append(ring);
  setTimeout(()=>ring.remove(),750);
}
basin.addEventListener('pointermove',event=>{
  if(performance.now()-lastRipple<130)return;
  lastRipple=performance.now();splash(event.clientX,event.clientY);
});
const spots=[[24,34,-12],[74,36,11],[49,73,-6]];
function netAt(event){
  if(event.pointerType==='touch'&&!drag)return;
  const area=basin.getBoundingClientRect();
  net.style.left=(event.clientX-area.left)+'px';
  net.style.top=(event.clientY-area.top)+'px';
  net.hidden=false;
}
basin.addEventListener('pointermove',netAt);
basin.addEventListener('pointerleave',()=>{if(!drag)net.hidden=true;});

function updatePrompt(){
  if(index>=0)return;
  const count=afloat.size;
  shutter.disabled=count>0;
  shutter.textContent=count?'相纸在水里':'再拍一组';
  status.textContent=count?'还有 '+count+' 张在漂，挑一张往上捞。':'这一组捞完了，可以再拍一组。';
}
function addFloating(photo,slot){
  const [left,top,angle]=spots[slot];
  const button=document.createElement('button');
  button.type='button';button.className='floating-print';
  button.style.left=left+'%';button.style.top=top+'%';
  button.style.setProperty('--angle',angle+'deg');
  button.style.setProperty('--stagger',slot*-.72+'s');
  button.setAttribute('aria-label','捞第 '+(slot+1)+' 张相片');
  const preview=document.createElement('img');
  preview.src=path(photo);preview.alt='';preview.draggable=false;
  button.append(preview);
  let ignoreClick=false;
  button.addEventListener('pointerdown',event=>{
    ignoreClick=false;
    if(index>=0||drag||event.button!==0)return;
    drag={id:event.pointerId,button,start:event.clientY,distance:0};
    button.setPointerCapture(event.pointerId);button.classList.add('caught');
    net.classList.add('scooping');netAt(event);
    splash(event.clientX,event.clientY);
  });
  button.addEventListener('pointermove',event=>{
    if(drag?.button!==button||drag.id!==event.pointerId)return;
    drag.distance=Math.max(0,drag.start-event.clientY);
    button.style.setProperty('--pull',-Math.min(drag.distance,90)+'px');
    netAt(event);
  });
  function release(event){
    if(drag?.button!==button||drag.id!==event.pointerId)return;
    const lifted=event.type==='pointerup'&&drag.distance>=37;
    drag=null;button.classList.remove('caught');button.style.removeProperty('--pull');
    net.classList.remove('scooping');net.hidden=true;
    if(lifted){ignoreClick=true;scoop(photo);}
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  button.addEventListener('click',event=>{
    if(ignoreClick){ignoreClick=false;return;}
    if(event.detail===0)scoop(photo);
  });
  afloat.set(photo,button);
  prints.append(button);
}
function scoop(photo){
  if(index>=0||!afloat.has(photo))return;
  index=photo;
  afloat.get(photo).remove();afloat.delete(photo);
  for(const button of afloat.values())button.disabled=true;
  developed=false;
  image.src=path(photo);image.alt=names[photo];
  paper.classList.add('raised','developing');
  paper.setAttribute('aria-disabled','true');
  paper.hidden=false;
  label.textContent='相片正在显影…';
  status.textContent='相片出水了，等画面慢慢浮现。';
  startDevelopment(photo);
  if(motion.matches)return;
  const area=basin.getBoundingClientRect(),rect=paper.getBoundingClientRect();
  for(let i=0;i<6;i++){
    const drop=document.createElement('i');
    drop.className='water-drop';
    drop.style.left=(rect.left-area.left+rect.width*(.24+.1*i))+'px';
    drop.style.top=(rect.bottom-area.top-17+(i%3)*6)+'px';
    drop.style.animationDelay=(i*.045)+'s';basin.append(drop);
    setTimeout(()=>drop.remove(),900);
  }
}
async function startDevelopment(photo){
  try{await image.decode();}catch{
    if(index!==photo)return;
    label.textContent='相片读取失败';
    status.textContent='点一下相纸重试。';
    paper.removeAttribute('aria-disabled');
    return;
  }
  if(index!==photo)return;
  paper.classList.add('revealing');
  setTimeout(()=>{
    if(index!==photo)return;
    developed=true;
    paper.classList.remove('developing','revealing');
    paper.removeAttribute('aria-disabled');
    label.textContent=names[photo]+' · 点击放大';
    hang.hidden=false;
    status.textContent='显影完成。可以放大，或挂到相片绳。';
  },motion.matches?180:2400);
}
paper.addEventListener('click',()=>{
  if(index<0)return;
  if(developed)viewPhoto(index);
  else if(!paper.hasAttribute('aria-disabled')){
    paper.setAttribute('aria-disabled','true');
    label.textContent='相片正在显影…';
    image.src=path(index);
    startDevelopment(index);
  }
});
hang.addEventListener('click',()=>{
  if(index<0||!developed)return;
  unlocked.add(index);
  try{localStorage.setItem(key,JSON.stringify([...unlocked]));}catch{}
  paintAlbum();index=-1;paper.hidden=true;hang.hidden=true;
  for(const button of afloat.values())button.disabled=false;
  updatePrompt();
  (afloat.values().next().value??shutter).focus();
});
shutter.addEventListener('click',()=>{
  if(afloat.size||index>=0)return;
  shutterSound();
  const all=names.map((_,i)=>i);
  const remaining=all.filter(i=>!unlocked.has(i));
  const pool=remaining.length ? remaining : all;
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];
  }
  pool.slice(0,spots.length).forEach(addFloating);
  updatePrompt();
  afloat.values().next().value?.focus();
});
paintAlbum();
