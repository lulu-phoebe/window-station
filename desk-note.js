const words=document.querySelector('#words');
const canvas=document.querySelector('#drawing');
const context=canvas.getContext('2d');
const undo=document.querySelector('#undo');
const eraser=document.querySelector('#eraser');
const key='desk-scratch-note';
let strokes=[], pointer=null, erasing=false;
try{
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  words.value=typeof saved.text==='string'?saved.text:'';
  strokes=Array.isArray(saved.strokes)?saved.strokes:[];
}catch{}
function save(){
  try{localStorage.setItem(key,JSON.stringify({text:words.value,strokes}));}
  catch{document.querySelector('#status').textContent='这次无法保存到浏览器。';}
}
function draw(stroke){
  context.globalCompositeOperation=stroke.erase?'destination-out':'source-over';
  context.strokeStyle=stroke.color;
  context.lineWidth=stroke.erase?21:3;
  context.lineCap=context.lineJoin='round';
  const [first,...rest]=stroke.points;
  context.beginPath();context.moveTo(...first);
  if(!rest.length)context.lineTo(first[0]+.01,first[1]);
  for(const point of rest)context.lineTo(...point);
  context.stroke();
}
function render(){
  context.clearRect(0,0,canvas.width,canvas.height);
  strokes.forEach(draw);
  undo.disabled=!strokes.length;
}
function position(event){
  const box=canvas.getBoundingClientRect();
  return [(event.clientX-box.left)*canvas.width/box.width,(event.clientY-box.top)*canvas.height/box.height];
}
canvas.onpointerdown=event=>{
  if(event.button!==0||pointer!==null)return;
  pointer=event.pointerId;
  canvas.setPointerCapture(pointer);
  strokes.push({color:document.querySelector('#ink').value,erase:erasing,points:[position(event)]});
  render();
};
canvas.onpointermove=event=>{
  if(event.pointerId!==pointer)return;
  const points=strokes.at(-1).points;
  const point=position(event);
  draw({...strokes.at(-1),points:[points.at(-1),point]});
  points.push(point);
};
function finish(event){
  if(event.pointerId!==pointer)return;
  pointer=null;save();
}
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=finish;
undo.onclick=()=>{if(pointer===null){strokes.pop();render();save();}};
eraser.onclick=()=>{erasing=!erasing;eraser.setAttribute('aria-pressed',String(erasing));};
words.oninput=save;
render();
