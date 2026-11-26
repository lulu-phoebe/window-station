// Screen-space decoration only; never intercept scene clicks or drag gestures.
const canvas=document.createElement('canvas');canvas.id='cursor-trail';canvas.setAttribute('aria-hidden','true');
Object.assign(canvas.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'20',width:'100%',height:'100%'});document.body.appendChild(canvas);
const ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let ratio=1,width=0,height=0,lastTime=0,lastMove=-10,frame=0,inside=false,previous=null;
const path=[],stars=[],limit=1900;let randomSeed=1723;
const random=()=>{randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;};
function resize(){ratio=Math.min(devicePixelRatio,1.5);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);path.length=stars.length=0;previous=null;}
addEventListener('resize',resize);resize();
function wake(){if(!frame){lastTime=performance.now()/1000;frame=requestAnimationFrame(draw);}}
addEventListener('pointermove',e=>{
 if(e.pointerType==='touch')return;
 const now=performance.now()/1000,p={x:e.clientX,y:e.clientY,t:now};inside=true;lastMove=now;
 const distance=previous?Math.hypot(p.x-previous.x,p.y-previous.y):0;
 if(distance>Math.max(width,height)*.65){path.length=0;previous=null;}
 const steps=previous?Math.min(150,Math.max(1,Math.ceil(distance/2.5))):1;
 for(let j=1;j<=steps;j++){
  const u=j/steps,x=previous?previous.x+(p.x-previous.x)*u:p.x,y=previous?previous.y+(p.y-previous.y)*u:p.y;
  path.push({x,y,t:now});
  for(let dust=0;dust<(reduce?1:3);dust++){const angle=random()*Math.PI*2,speed=5+random()*24;
   stars.push({x:x+(random()+random()-1)*14,y:y+(random()+random()-1)*14,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed+4,t:now,life:(reduce?.28:.85)+random()*.75,size:.45+random()*1.25,phase:random()*6.28,frequency:8+random()*9,star:random()<.075});
  }
 }
 if(path.length>260)path.splice(0,path.length-260);if(stars.length>limit)stars.splice(0,stars.length-limit);
 previous=p;wake();
},{passive:true});
document.documentElement.addEventListener('pointerleave',()=>{inside=false;previous=null;});
addEventListener('blur',()=>{inside=false;previous=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;path.length=stars.length=0;previous=null;inside=false;ctx.clearRect(0,0,width,height);}});
const glowSprites=[200,220,242,266].map(hue=>{
 const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d'),gradient=g.createRadialGradient(24,24,0,24,24,24);
 gradient.addColorStop(0,`hsla(${hue},100%,92%,1)`);gradient.addColorStop(.13,`hsla(${hue},100%,76%,.7)`);gradient.addColorStop(.40,`hsla(${hue},100%,64%,.18)`);gradient.addColorStop(1,`hsla(${hue},100%,60%,0)`);
 g.fillStyle=gradient;g.fillRect(0,0,48,48);return c;
});
function starShape(x,y,r,alpha,color,rotation=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;ctx.fillStyle=color;
 ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rad=i%2?r*.18:r*(i%4===0?1:1.15);const px=Math.cos(a)*rad,py=Math.sin(a)*rad;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.restore();
}
function draw(ms){
 frame=0;const now=ms/1000,dt=Math.min(.04,now-lastTime);lastTime=now;ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
 const life=reduce?.24:1.05;
 while(path.length&&now-path[0].t>life)path.shift();
 // A soft broken haze of light, never a solid line or rigid dotted rails.
 for(let i=0;i<path.length;i+=5){
  const p=path[i],fade=Math.max(0,Math.min(1,1-(now-p.t)/life)),spread=10+14*(1-fade);
  ctx.globalAlpha=fade*.045;
  ctx.drawImage(glowSprites[Math.min(3,Math.floor((1-fade)*4))],p.x-spread,p.y-spread,spread*2,spread*2);
 }
 for(let i=stars.length-1;i>=0;i--){const s=stars[i],age=Math.max(0,now-s.t);if(age>s.life){stars.splice(i,1);continue;}
  s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=Math.exp(-dt*.8);s.vy+=dt*2;
  const fade=Math.pow(1-age/s.life,1.4),twinkle=reduce?.65:.30+.70*Math.pow(.5+.5*Math.sin(age*s.frequency+s.phase),3),alpha=fade*twinkle;
  const hue=205+58*Math.min(1,age/s.life),color=`hsl(${hue} 100% 85%)`;
  ctx.globalAlpha=alpha*.65;const halo=s.size*3.3;
  ctx.drawImage(glowSprites[Math.min(3,Math.floor(age/s.life*4))],s.x-halo,s.y-halo,halo*2,halo*2);
  ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(s.x-s.size*.4,s.y-s.size*.4,s.size*.8,s.size*.8);
  if(s.star)starShape(s.x,s.y,s.size*(2.6+twinkle*1.6),alpha,color,s.phase*.10);
 }
 const head=previous,headFade=inside&&head?1:0;
 if(head&&headFade>0){const pulse=reduce?1:.88+.12*Math.sin(now*8),r=24*pulse;
  const halo=ctx.createRadialGradient(head.x,head.y,0,head.x,head.y,r*1.7);halo.addColorStop(0,'rgba(180,250,255,.75)');halo.addColorStop(.17,'rgba(65,195,255,.48)');halo.addColorStop(.45,'rgba(45,105,255,.20)');halo.addColorStop(1,'rgba(85,40,255,0)');
  ctx.globalAlpha=headFade;ctx.fillStyle=halo;ctx.fillRect(head.x-r*1.7,head.y-r*1.7,r*3.4,r*3.4);
  starShape(head.x,head.y,12*pulse,headFade,'#79eaff',.12);starShape(head.x,head.y,7*pulse,headFade,'#efffff',.12);
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';canvas.dataset.trailParticles=String(stars.length);
 if(path.length||stars.length||(inside&&previous))frame=requestAnimationFrame(draw);
}
