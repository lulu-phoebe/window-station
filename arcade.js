const $ = selector => document.querySelector(selector);
const board = $('#board'), status = $('#status'), list = $('#library'), play = $('#play');
const games = [
 ['cat','小猫向下 100 层','🐈','左右移动，从平台边缘跳到下一层。漏过平台会摔下去。',cat],
 ['leaf','接住窗外的风','🍂'],
 ['mines','月面扫雷','☾','数字表示周围的雷数。右键或用插旗模式标记。',mines],
 ['memory','窗边相册','▧','翻开两张照片，找出六对相同图案。',memory],
 ['lights','晚安小屋','⌂','点一扇窗会切换它和相邻窗户。把灯都关掉。',lights],
 ['slide','碎片拼图','▦','点击空格旁边的碎片，把数字从 1 排到 8。',slide],
 ['echo','听风回声','♫','记住亮起的顺序，再照着点。',echo],
 ['glow','萤火一瞬','✦','等光点亮起再点击，看看你的反应有多快。',glow],
 ['odd','找一颗星','✧','在星群里找出形状不同的那一颗。',odd]
];
let active, session, titleButton;
let audio;
function tone(pitch=440){
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)return;
 try {
  audio ||= new Audio();
  if(audio.state==='suspended')audio.resume().catch(()=>{});
  const now=audio.currentTime, oscillator=audio.createOscillator(), gain=audio.createGain();
  oscillator.frequency.value=pitch;
  gain.gain.setValueAtTime(.08,now);
  gain.gain.exponentialRampToValueAtTime(.001,now+.23);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now+.24);
 } catch {}
}
function button(label, parent, click, className=''){
 const el=document.createElement('button');
 el.type='button';el.textContent=label;el.className=className;
 el.addEventListener('click',click);parent.append(el);return el;
}
for(const game of games){
 if(game[0]==='leaf'){
  const a=document.createElement('a');a.href='./leaf-game.html';a.className='tile';$('#titles').append(a);
  fillTile(a,game);
 }else{
  const el=button('', $('#titles'),()=>{titleButton=el;open(game)},'tile');
  fillTile(el,game);
 }
}
function fillTile(el,game){
 el.dataset.game=game[0];
 const icon=document.createElement('span'), label=document.createElement('strong');
 icon.className='icon';icon.setAttribute('aria-hidden','true');icon.textContent=game[2];
 label.textContent=game[1];el.append(icon,label);
}
function open(game){
 session?.abort();
 session=new AbortController();
 active=game;list.hidden=true;play.hidden=false;$('#menu').hidden=false;
 $('#name').textContent=game[1];$('#help').textContent=game[3];
 play.dataset.game=game[0];board.replaceChildren();status.textContent='';game[4](session.signal);
 $('#reset').focus();
}
$('#menu').onclick=()=>{
 session?.abort();board.replaceChildren();play.hidden=true;list.hidden=false;$('#menu').hidden=true;titleButton?.focus();
};
$('#reset').onclick=()=>open(active);
function grid(cols,count,click){
 const wrap=document.createElement('div');
 wrap.className='grid'; wrap.style.setProperty('--cols',cols);board.append(wrap);
 return Array.from({length:count},(_,i)=>button('',wrap,()=>click(i),'cell'));
}
function shuffle(items){
 for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
 return items;
}
function delay(signal, callback, ms){
 const timer=setTimeout(()=>{if(!signal.aborted)callback()},ms);
 signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
}
function neighbors(i,size,diagonal=false){
 const x=i%size,y=Math.floor(i/size),out=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!(dx||dy)||(!diagonal&&dx&&dy))continue;
  if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size)out.push((y+dy)*size+x+dx);
 }
 return out;
}

function mines(){
 const size=8,total=size*size,amount=10;
 const mines=new Set(),flags=new Set(),opened=new Set();
 let done=false,flagMode=false;
 const mode=button('插旗模式：关',board,()=>{
  flagMode=!flagMode;mode.textContent='插旗模式：'+(flagMode?'开':'关');mode.setAttribute('aria-pressed',String(flagMode));
 });
 mode.setAttribute('aria-pressed','false');
 mode.style.marginBottom='.6rem';
 const cells=grid(size,total,i=>flagMode?flag(i):reveal(i));
 function count(i){return neighbors(i,size,true).filter(n=>mines.has(n)).length}
 function flag(i){
  if(done||opened.has(i))return;
  if(flags.has(i))flags.delete(i);else if(flags.size<amount)flags.add(i);
  paint();
 }
 function paint(){
  cells.forEach((cell,i)=>{
   const open=opened.has(i),marked=flags.has(i),bomb=done&&mines.has(i);
   cell.className='cell'+(open?' open':'')+(marked?' flag':'')+(bomb?' mine':'');
   cell.dataset.count = open && !bomb ? String(count(i)) : '';
   cell.textContent=bomb?'✹':open?(count(i)||''):marked?'⚑':'';
   cell.setAttribute('aria-label', '第 '+(i+1)+' 格，'+(bomb?'雷':open?'周边 '+count(i)+' 雷':marked?'已插旗':'未翻开'));
  });
 }
 function reveal(i){
  if(done||flags.has(i)||opened.has(i))return;
  if(!mines.size){
   const safe=new Set([i,...neighbors(i,size,true)]);
   shuffle(cells.map((_,j)=>j).filter(j=>!safe.has(j))).slice(0,amount).forEach(j=>mines.add(j));
  }
  if(mines.has(i)){done=true;status.textContent='踩到月尘雷了。';tone(165);paint();return;}
  const queue=[i];
  while(queue.length){
   const next=queue.pop();
   if(opened.has(next)||flags.has(next)||mines.has(next))continue;
   opened.add(next);
   if(!count(next))queue.push(...neighbors(next,size,true));
  }
  if(opened.size===total-amount){done=true;status.textContent='月面清理完成！';tone(660);}
  else status.textContent='已翻开 '+opened.size+' / '+(total-amount)+' 格';
  paint();
 }
 cells.forEach((cell,i)=>cell.addEventListener('contextmenu',event=>{event.preventDefault();flag(i)}));
 status.textContent='10 颗雷';paint();
}

function cat(signal){
 const canvas=document.createElement('canvas');canvas.width=500;canvas.height=410;board.append(canvas);
 canvas.setAttribute('aria-label','小猫与向下延伸的平台');
 const controls=document.createElement('div');controls.className='motion';board.append(controls);
 const pressed=new Set(),touching=new Map();
 let x=250,y=-12,fall=0,on=0,lowest=0,last=null,frame,done=false;
 const step=65,catSize=12;
 const platforms=Array.from({length:101},(_,i)=>{
  const middle=i===0?250:250+Math.sin(i*1.42)*147;
  return {left:middle-83,right:middle+83,y:i*step};
 });
 const ctx=canvas.getContext('2d');
 const sky=ctx.createLinearGradient(0,0,0,410);sky.addColorStop(0,'#a4c8df');sky.addColorStop(.57,'#f1d8cc');sky.addColorStop(1,'#ffe8b5');
 for(const [arrow,dir] of [['←',-1],['→',1]]){
  const key=button(arrow,controls,e=>{if(e.detail===0)x=Math.max(14,Math.min(486,x+dir*24))});
  key.setAttribute('aria-label',dir===-1?'向左移动':'向右移动');
  key.onpointerdown=e=>{key.setPointerCapture(e.pointerId);touching.set(e.pointerId,dir);x=Math.max(14,Math.min(486,x+dir*9))};
  key.onlostpointercapture=e=>touching.delete(e.pointerId);
 }
 addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();pressed.add(e.key);
 },{signal});
 addEventListener('keyup',e=>pressed.delete(e.key),{signal});
 addEventListener('blur',()=>{pressed.clear();touching.clear();last=null},{signal});
 signal.addEventListener('abort',()=>cancelAnimationFrame(frame),{once:true});
 function draw(){
  ctx.fillStyle=sky;ctx.fillRect(0,0,500,410);
  ctx.fillStyle='#fff7db';ctx.beginPath();ctx.arc(396,89,39,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff9ec8a';
  for(let i=0;i<6;i++){
   const x=(i*99+26)%500, y=35+i%3*62;
   ctx.beginPath();ctx.ellipse(x,y,37,8,0,0,Math.PI*2);ctx.ellipse(x+12,y-4,23,9,0,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#fff6d5';
  for(let i=0;i<37;i++)ctx.fillRect((i*61+32)%500,(i*i*29+3)%407,2+i%2,2);
  const camera=y-110;
  for(const p of platforms){
   const py=p.y-camera;if(py<0||py>410)continue;
   ctx.fillStyle='#8f7169';ctx.fillRect(p.left,py+3,p.right-p.left,12);
   ctx.fillStyle='#efd4a4';ctx.fillRect(p.left,py,p.right-p.left,6);
   ctx.fillStyle='#ba956e';ctx.fillRect(p.left,py+6,p.right-p.left,4);
   ctx.fillStyle='#704e50';
   for(let x=p.left+13;x<p.right-7;x+=27)ctx.fillRect(x,py+11,11,2);
  }
  ctx.save();ctx.translate(x,110);ctx.lineCap='round';
  ctx.strokeStyle='#bb765f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-9,-1);ctx.quadraticCurveTo(-25,0,-24,-11);ctx.stroke();
  ctx.fillStyle='#ce875c';ctx.beginPath();ctx.moveTo(-13,-4);ctx.lineTo(-11,-20);ctx.lineTo(-3,-13);ctx.lineTo(4,-13);ctx.lineTo(12,-20);ctx.lineTo(14,-4);ctx.ellipse(0,-2,14,11,0,0,Math.PI);ctx.fill();
  ctx.fillStyle='#fff0c9';ctx.beginPath();ctx.ellipse(0,1,10,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#573e42';ctx.fillRect(-7,-6,2,3);ctx.fillRect(5,-6,2,3);ctx.fillRect(-1,-3,2,2);
  ctx.fillStyle='#944f57';ctx.fillRect(-9,7,18,3);ctx.fillStyle='#ffe598';ctx.fillRect(-1,8,3,2);
  ctx.restore();
 }
 function end(text){done=true;status.textContent=text;tone(lowest===100?660:165);}
 function tick(now){
  const dt=last===null?0:Math.min(.04,(now-last)/1000);last=now;
  const dirs=[...touching.values()];
  x=Math.max(14,Math.min(486,x+230*dt*(Number(pressed.has('ArrowRight')||dirs.includes(1))-Number(pressed.has('ArrowLeft')||dirs.includes(-1)))));
  if(on!==null&&(x+7<platforms[on].left||x-7>platforms[on].right)){on=null;fall=0;}
  if(on===null){
   const foot=y+catSize;fall+=390*dt;y+=fall*dt;
   const i=Math.ceil((foot+.001)/step),p=platforms[i];
   if(p&&foot<=p.y&&y+catSize>=p.y&&x+7>=p.left&&x-7<=p.right){
    if(i-lowest>3){end('落得太远了，再试一次。');return;}
    y=p.y-catSize;on=i;fall=0;lowest=i;
    status.textContent='第 '+lowest+' / 100 层';tone(261.63+(lowest%6)*32);
    if(lowest===100){draw();end('到达第 100 层！');return;}
   }else if(y>(lowest+4)*step){end('小猫没踩到平台，再试一次。');return;}
  }
  draw();if(!done)frame=requestAnimationFrame(tick);
 }
 status.textContent='第 0 / 100 层';draw();frame=requestAnimationFrame(tick);
}

function memory(signal){
 const value=shuffle(['✦','☾','☂','❋','♧','♫'].flatMap(x=>[x,x]));
 const matched=new Set();let first=null,busy=false;
 const cells=grid(4,12,i=>{
  if(busy||matched.has(i)||first===i)return;
  cells[i].textContent=value[i];cells[i].classList.add('open');
  if(first===null){first=i;return;}
  const other=first;first=null;
  if(value[other]===value[i]){
   matched.add(i);matched.add(other);cells[i].disabled=cells[other].disabled=true;
   status.textContent='已找到 '+matched.size/2+' / 6 对';tone(523);
  }else{
   busy=true;delay(signal,()=>{for(const j of [i,other]){cells[j].textContent='?';cells[j].classList.remove('open')}busy=false;},650);
  }
 });
 cells.forEach((cell,i)=>{cell.textContent='?';cell.setAttribute('aria-label','翻开照片 '+(i+1))});
 status.textContent='已找到 0 / 6 对';
}

function lights(){
 const lit=Array(25).fill(false);let moves=0,won=false;
 const flip=i=>[i,...neighbors(i,5)].forEach(j=>{lit[j]=!lit[j]});
 for(const i of shuffle(lit.map((_,i)=>i)).slice(0,7))flip(i);
 const cells=grid(5,25,i=>{
  if(won)return;flip(i);moves++;won=!lit.some(Boolean);paint();
 });
 function paint(){
  cells.forEach((cell,i)=>{cell.classList.toggle('lit',lit[i]);cell.textContent=lit[i]?'✦':'·';cell.setAttribute('aria-label','窗户 '+(i+1)+(lit[i]?'亮':'暗'))});
  status.textContent=won?'晚安，灯都关了。':'移动 '+moves+' 次';
 }
 paint();
}

function slide(){
 const pieces=[1,2,3,4,5,6,7,8,0];let blank=8,moves=0,won=false;
 function swap(i){[pieces[blank],pieces[i]]=[pieces[i],pieces[blank]];blank=i;}
 for(let i=0;i<47;i++)swap(shuffle(neighbors(blank,3))[0]);
 const cells=grid(3,9,i=>{if(won||!neighbors(blank,3).includes(i))return;swap(i);moves++;paint();});
 function paint(){
  won=pieces.every((v,i)=>v===(i+1)%9);
  cells.forEach((cell,i)=>{cell.textContent=pieces[i]||'';cell.disabled=i===blank||won;cell.classList.toggle('blank',i===blank);cell.setAttribute('aria-label',pieces[i]?'碎片 '+pieces[i]:'空格')});
  status.textContent=won?'拼好了！':'移动 '+moves+' 次';
 }
 paint();
}

function echo(signal){
 const sequence=[];let index=0,ready=false,ended=false;
 const cells=grid(2,4,i=>{
  if(!ready||ended)return;
  flash(i);
  if(sequence[index]!==i){ended=true;status.textContent='回声断了，记住了 '+(sequence.length-1)+' 轮。';return;}
  if(++index===sequence.length){ready=false;delay(signal,round,630);}
 });
 cells.forEach((cell,i)=>{cell.textContent=['✦','☾','☂','❋'][i]});
 function flash(i){cells[i].classList.add('lit');tone([261,329,392,523][i]);delay(signal,()=>cells[i].classList.remove('lit'),240);}
 function round(){
  sequence.push(Math.floor(Math.random()*4));index=0;
  status.textContent='第 '+sequence.length+' 轮 · 先看顺序';
  sequence.forEach((v,i)=>delay(signal,()=>flash(v),i*530));
  delay(signal,()=>{ready=true;status.textContent='轮到你了'},sequence.length*530);
 }
 const start=button('播放第一组',board,()=>{start.remove();round()},'big');
 status.textContent='准备好后开始';
}

function glow(signal){
 let begun=false,started=null,attempt=0;
 const trigger=button('开始',board,()=>{
  if(!begun){arm();return;}
  if(started===null){attempt++;begun=false;trigger.textContent='再试一次';status.textContent='太早啦，等光点亮起。';return;}
  status.textContent=Math.round(performance.now()-started)+' 毫秒';
  tone(523);begun=false;trigger.textContent='再试一次';trigger.classList.remove('lit');
 },'cell big');
 function arm(){
  begun=true;started=null;const id=++attempt;
  trigger.textContent='·';status.textContent='等一等…';
  delay(signal,()=>{if(attempt!==id)return;started=performance.now();trigger.textContent='✦';trigger.classList.add('lit');status.textContent='现在点！';},1000+Math.random()*2600);
 }
 status.textContent='点击开始';
}

function odd(){
 let found=0,target=-1;
 const cells=grid(5,25,i=>{
  if(found>=5)return;
  if(i!==target){status.textContent='再看仔细一点。';return;}
  found++;tone(329+found*38);if(found<5)round();else status.textContent='五颗星都找到了！';
 });
 function round(){
  target=(target+1+Math.floor(Math.random()*24))%25;
  cells.forEach((cell,i)=>{cell.textContent=i===target?'✧':'✦';cell.setAttribute('aria-label','第 '+(i+1)+' 颗 '+cell.textContent)});
  status.textContent='找到 '+found+' / 5 颗';
 }
 round();
}
