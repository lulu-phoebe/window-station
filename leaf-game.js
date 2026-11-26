const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score');
const timeLabel = document.querySelector('#time');
const panel = document.querySelector('.panel');
const startButton = document.querySelector('#start');
const soundButton = document.querySelector('#sound');
const message = document.querySelector('#message');
const width = canvas.width, height = canvas.height;
const floor = 390, halfBasket = 42, seconds = 30;
const palette = ['#ebaa68', '#e7cc78', '#c8847d', '#a9ba87'];
const notes = [261.63, 329.63, 392, 523.25];
const keys = new Set();
const held = new Map();
let leaves = [], basket = width/2, score = 0, elapsed = 0, nextLeaf = 0;
let playing = false, previous = null, frame = 0, drag = null, audio, sound = true;

function enableAudio() {
  if (!sound) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audio ||= new Context();
  audio.resume().catch(() => {});
}

function note(frequency, delay = 0) {
  if (!sound || audio?.state !== 'running') return;
  const when = audio.currentTime + delay;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'sine';
  tone.frequency.value = frequency;
  volume.gain.setValueAtTime(.001, when);
  volume.gain.exponentialRampToValueAtTime(.15, when + .017);
  volume.gain.exponentialRampToValueAtTime(.001, when + .27);
  tone.connect(volume).connect(audio.destination);
  tone.start(when);
  tone.stop(when + .28);
}

function moveBasket(x) {
  basket = Math.max(halfBasket, Math.min(width-halfBasket, x));
}

function spawn() {
  const type = Math.floor(Math.random()*palette.length);
  leaves.push({x:36+Math.random()*(width-72), y:-20, speed:96+Math.random()*83,
    phase:Math.random()*Math.PI*2, type});
}

const sky = ctx.createLinearGradient(0,0,0,height);
sky.addColorStop(0,'#99c4cd');
sky.addColorStop(.65,'#f6dfb4');
sky.addColorStop(1,'#f1c699');
function drawLeaf(leaf) {
  ctx.save();
  ctx.translate(leaf.x,leaf.y);
  ctx.rotate(Math.sin(leaf.phase+leaf.y*.026)*.85);
  ctx.fillStyle = palette[leaf.type];
  ctx.beginPath();
  ctx.moveTo(-12,7);
  ctx.quadraticCurveTo(-15,-11,14,-10);
  ctx.quadraticCurveTo(9,10,-12,7);
  ctx.fill();
  ctx.strokeStyle = '#634837aa';
  ctx.beginPath();
  ctx.moveTo(-14,9);
  ctx.lineTo(9,-7);
  ctx.stroke();
  ctx.restore();
}
function draw() {
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = '#f7d4a6aa';
  ctx.beginPath();
  ctx.arc(502,87,38,0,Math.PI*2);
  ctx.fill();
  for (let i=0;i<3;i++) {
    ctx.fillStyle = ['#a9bca4','#95aa84','#78976e'][i];
    ctx.beginPath();
    ctx.moveTo(0,height);
    for(let x=0;x<=width;x+=8) {
      ctx.lineTo(x,246+i*39+Math.sin(x/115+i)*22+Math.cos(x/63)*8);
    }
    ctx.lineTo(width,height);
    ctx.fill();
  }
  ctx.fillStyle = '#577b5f';
  ctx.fillRect(0,416,width,24);
  for(let i=0;i<47;i++){
    const x=(i*67+13)%width, y=417+(i*11)%19;
    ctx.strokeStyle=i%3===0?'#bcba85':'#486a59';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(i)*6,y-4-i%5);ctx.stroke();
  }
  leaves.forEach(drawLeaf);
  ctx.fillStyle = '#bf8b5f';
  ctx.beginPath();
  ctx.moveTo(basket-halfBasket,floor);
  ctx.lineTo(basket+halfBasket,floor);
  ctx.lineTo(basket+31,floor+24);
  ctx.lineTo(basket-31,floor+24);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#714b3c';
  for(let x=-40;x<=40;x+=8) {
    ctx.beginPath();
    ctx.moveTo(basket+x,floor);
    ctx.lineTo(basket+x+7,floor+24);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#f1bb7b';
  ctx.fillRect(basket-halfBasket,floor-3,halfBasket*2,5);
}

function loop(now) {
  if (!playing) return;
  const dt = previous === null ? 0 : Math.min((now-previous)/1000,.05);
  previous = now;
  elapsed += dt;
  timeLabel.textContent = Math.max(0,Math.ceil(seconds-elapsed));
  if (elapsed >= seconds) {
    playing = false;
    keys.clear();
    held.clear();
    drag = null;
    message.textContent = '这次接住了 '+score+' 片叶子。';
    startButton.textContent = '再玩一次';
    panel.hidden = false;
    startButton.focus();
    [329.63,392,523.25].forEach((pitch,i)=>note(pitch,i*.11));
    return;
  }
  if (elapsed >= nextLeaf) {
    spawn();
    nextLeaf = elapsed + Math.max(.35,.78-elapsed*.012);
  }
  const arrows = [...held.values()];
  const direction = Number(keys.has('ArrowRight') || arrows.includes(1)) -
    Number(keys.has('ArrowLeft') || arrows.includes(-1));
  moveBasket(basket+direction*330*dt);
  leaves = leaves.filter(leaf => {
    const y = leaf.y;
    leaf.y += leaf.speed*dt;
    leaf.x += Math.cos(leaf.phase+leaf.y*.025)*41*dt;
    if (y < floor && leaf.y >= floor && Math.abs(leaf.x-basket) <= halfBasket) {
      scoreLabel.textContent = ++score;
      note(notes[leaf.type]);
      return false;
    }
    return leaf.y < height+20;
  });
  draw();
  frame = requestAnimationFrame(loop);
}

function start() {
  enableAudio();
  cancelAnimationFrame(frame);
  leaves = [];
  basket = width/2;
  score = elapsed = nextLeaf = 0;
  previous = null;
  scoreLabel.textContent = 0;
  timeLabel.textContent = seconds;
  panel.hidden = true;
  playing = true;
  draw();
  frame = requestAnimationFrame(loop);
}

function dragBasket(event) {
  const bounds = canvas.getBoundingClientRect();
  moveBasket((event.clientX-bounds.left)*width/bounds.width);
}
canvas.addEventListener('pointerdown', event => {
  if (!playing || drag !== null) return;
  drag = event.pointerId;
  canvas.setPointerCapture(drag);
  dragBasket(event);
});
canvas.addEventListener('pointermove', event => { if (playing && event.pointerId === drag) dragBasket(event); });
canvas.addEventListener('lostpointercapture', event => { if (event.pointerId === drag) drag = null; });
document.querySelectorAll('[data-direction]').forEach(button => {
  const direction = Number(button.dataset.direction);
  button.addEventListener('pointerdown', event => {
    if (!playing) return;
    button.setPointerCapture(event.pointerId);
    held.set(event.pointerId,direction);
    moveBasket(basket+direction*16);
  });
  button.addEventListener('lostpointercapture', event => held.delete(event.pointerId));
  button.addEventListener('click', event => { if (playing && event.detail === 0) moveBasket(basket+direction*28); });
});
window.addEventListener('keydown', event => {
  if (!playing || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  keys.add(event.key);
});
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('blur', () => { keys.clear(); held.clear(); previous = null; });
soundButton.addEventListener('click', () => {
  sound = !sound;
  soundButton.textContent = sound ? '声音 · 开' : '声音 · 关';
  soundButton.setAttribute('aria-pressed',String(sound));
  if (sound) { enableAudio(); note(392); }
});
startButton.addEventListener('click',start);
draw();
