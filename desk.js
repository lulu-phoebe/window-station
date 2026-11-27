import {addNanjingWeather} from './nanjing-weather.js?v=34';

const dialog = document.querySelector('#details');
const held = dialog.querySelector('.held');
const cutout = dialog.querySelector('.held-cutout');
const envelope = dialog.querySelector('.envelope');
const envelopeDetail = document.querySelector('#envelope-detail');
const viewport = document.querySelector('#viewport');
const orbit = document.querySelector('#orbit');
const weather = document.querySelector('#weather');
const season = document.querySelector('#season');
season.onchange=()=>viewer?.setSeason(season.value);
const roomScroll = document.querySelector('#room-scroll');
const hotspots = document.querySelector('#hotspots');
const menu = document.querySelector('#item-menu');
const status = document.querySelector('#status');
const room = document.querySelector('.room');
const framing = 1672 / 941;

// Silhouettes traced over the approved room illustration, in percentages.
const items = {
  mirror: ['桌面镜',null],
  cassette: ['磁带', [[14.3,57.5],[14.9,54],[20.4,54],[20.9,54.8],[20.3,58.1],[19.4,59],[14.3,59]]],
  drink: ['马克杯',null],
  camera: ['拍立得相机', [[30.1,49],[30.6,47.8],[36.5,47.6],[37.5,48.8],[38,59.5],[37.1,60.8],[30.5,61.2],[29.9,59.4]]],
  notebook: ['笔记本', [[10.4,60.7],[19.3,60.6],[20,61.5],[17.5,73.1],[16.8,74],[7.7,74],[7.6,72.2]]],
  note: ['手写便签', [[11.1,73.8],[16.2,73.5],[18.7,75],[12.1,77.7]]],
  pencil: ['铅笔', [[21.7,62.6],[22.4,62.8],[20.5,74.7],[20,74.2],[20.6,71.2]]],
  photos: ['拍立得照片', [[22.8,67.2],[27.5,65.1],[28.2,66.3],[28.3,64.4],[33,63.7],[33.6,65.8],[34.2,64.8],[39.1,66.8],[37.2,76.6],[32.3,74.3],[28.8,74.6],[24.4,76.6]]],
  computer: ['小电脑', [[45.6,37.1],[53.6,37.1],[55.5,40],[55.9,57.5],[55.6,62.9],[54.6,63.7],[44.1,63.6],[43.4,62.6],[43.5,42],[44.2,38.5]]],
  keyboard: ['键盘', [[42.3,64.6],[57.2,64.5],[58.2,71.3],[57.4,72.5],[42.2,72.5],[41.5,71.5]]],
  rose: ['红玫瑰', [[59.2,33.1],[60.7,31.6],[60.4,29.7],[61.6,27],[63.1,26.4],[65.6,27.6],[66.4,29.7],[66.2,32.4],[64.9,34],[63.8,34.7],[63.2,38.1],[65.7,39.7],[67.5,42],[67.1,45.5],[65.8,46.5],[64.2,46],[64.2,48.4],[63.3,50.1],[61,50.1],[59.9,46.9],[58,47.3],[57.8,45.6],[59.6,43.7],[58.9,42],[58.1,41],[56.5,38.8],[56.6,35.5],[57.6,33.9]]],
  vase: ['陶瓷花瓶', [[60.7,49.5],[63.6,49.4],[63.5,50.7],[64,52],[64.7,54],[64.5,57.1],[63.7,58.6],[61.1,59],[59.8,58],[59.7,55],[60.7,52.1]]],
  star: ['星星键帽', [[60.2,69.1],[60.8,68.2],[62.8,68.1],[63.6,69.5],[63.8,72.6],[60.1,72.8]]],
  letter: ['火漆信封', [[67.1,65],[80.1,65],[82.5,73.9],[68.5,74.2]]],
  lamp: ['台灯', [[75.6,41.4],[76.8,37.7],[78.7,34.5],[81.4,32.8],[82.2,31.7],[82.5,30.4],[83.6,30.4],[84,32.2],[86.7,34.6],[88,37.7],[88.4,44.8],[85.9,45.5],[85.4,51.2],[84.3,55.5],[86.7,56.5],[87.6,58.8],[87.2,61.8],[85.8,63],[80.8,63.8],[78.7,62.5],[77.9,60.7],[78.4,57.7],[80.2,56],[82.6,55.7],[83.7,52.7],[84.4,47.6],[84.4,45.3],[82.7,45],[81.6,45],[80.4,43.4],[76.9,43]]]
};

function geometry(polygon) {
  const xs = polygon.map(([x]) => x), ys = polygon.map(([,y]) => y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  const clip = 'polygon(' + polygon.map(([a,b]) => ((a-x)*100/w).toFixed(2) + '% ' + ((b-y)*100/h).toFixed(2) + '%').join(',') + ')';
  return {x,y,w,h,clip};
}

const story = document.querySelector('#book-story');
let storyNavigation;
function openStory() {
  if (story.open) return;
  menu.open = false;
  story.showModal();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    storyNavigation = setTimeout(() => {
      if (story.open) location.assign(story.querySelector('a').href);
    }, 1450);
  }
}
story.addEventListener('close', () => {
  clearTimeout(storyNavigation);
  if (viewerActive) viewer.pick(undefined);
});
window.addEventListener('pageshow', event => {
  if (event.persisted && story.open) story.close();
});

function openLetters() {
  location.assign(new URL('./dear-u/?window=32', document.baseURI));
}

function openArcade() {
  location.assign(new URL('./arcade.html?glow=36', document.baseURI));
}

function openPhotoRoom(id) {
  location.assign(new URL('./photo-room.html?view=38'+(id==='photos'?'#album':''),document.baseURI));
}

const deskPlayPages = {cassette:'desk-tape.html?view=40',note:'desk-note.html',pencil:'desk-note.html'};
function openDeskPlay(id) {
  location.assign(new URL('./'+deskPlayPages[id],document.baseURI));
}
function showItem(id) {
  if (deskPlayPages[id]) return openDeskPlay(id);
  if (id==='camera'||id==='photos') return openPhotoRoom(id);
  if (id === 'computer') return openArcade();
  if (id === 'letter') return openLetters();
  if (id === 'notebook') return openStory();
  const item = items[id];
  if (!item?.[1]) return;
  const [label, polygon] = item;
  const {x,y,w,h,clip} = geometry(polygon);
  dialog.querySelector('h2').textContent = label;
  cutout.style.backgroundSize = (10000/w) + '% ' + (10000/h) + '%';
  cutout.style.backgroundPosition = (x*100/(100-w)) + '% ' + (y*100/(100-h)) + '%';
  cutout.style.clipPath = clip;
  cutout.style.setProperty('--hold-ratio', w*framing/h);
  cutout.style.setProperty('--hold-width', Math.min(350,Math.max(140,140+12*w)) + 'px');
  held.hidden = false;
  envelope.hidden = true;
  envelopeDetail.hidden = id !== 'letter';
  envelopeDetail.textContent = '看火漆细节';
  envelopeDetail.setAttribute('aria-pressed','false');
  menu.open = false;
  if (!dialog.open) dialog.showModal();
}
envelopeDetail.onclick = () => {
  const show = envelope.hidden;
  envelope.hidden = !show;
  held.hidden = show;
  envelopeDetail.textContent = show ? '回到信封' : '看火漆细节';
  envelopeDetail.setAttribute('aria-pressed', String(show));
};
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

for (const [id,[label,polygon]] of Object.entries(items)) {
  const menuButton = document.createElement('button');
  menuButton.textContent = label;
  menuButton.onclick = () => { menu.open = false; if (!viewerActive || !viewer.pick(id)) showItem(id); };
  menu.querySelector('nav').append(menuButton);
  if (!polygon) {
    menuButton.dataset.modelOnly = '';
    menuButton.hidden = true;
    continue;
  }
  const {x,y,w,h} = geometry(polygon);
  const button = document.createElement('button');
  const name = document.createElement('span');
  button.className = 'hotspot';
  button.dataset.item = id;
  button.style.cssText = 'left:' + x + '%;top:' + y + '%;width:' + w + '%;height:' + h + '%;';
  button.setAttribute('aria-label','拿起' + label);
  name.textContent = label;
  name.setAttribute('aria-hidden','true');
  button.append(name);
  button.onclick = () => showItem(id);
  hotspots.append(button);

}

function centerRoom() {
  roomScroll.scrollLeft = (roomScroll.scrollWidth - roomScroll.clientWidth) / 2;
  roomScroll.scrollTop = (roomScroll.scrollHeight - roomScroll.clientHeight) / 2;
}
centerRoom();

window.addEventListener('orientationchange', () => requestAnimationFrame(centerRoom));

function setWeather(on) {
  weather.setAttribute('aria-pressed', String(on));
  weather.title = on ? '暂停窗边动效' : '播放窗边动效';
  room.classList.toggle('still', !on);
}
setWeather(!matchMedia('(prefers-reduced-motion: reduce)').matches);
weather.onclick = () => setWeather(weather.getAttribute('aria-pressed') !== 'true');


let viewer;
let nanjingWeather=null;
addNanjingWeather(value=>{nanjingWeather=value;viewer?.setLiveWeather(value);});
let viewerActive = false;
let show3D = true;
let initializing;
const inspection = document.querySelector('#inspection');
const detailButton = document.querySelector('#inspect-detail');
const guide = '移动或拖动鼠标转视角 · 指向小物看它浮起 · 按住窗帘向中间拉';
let selected;

function onInspect(id) {
  if (deskPlayPages[id]) return openDeskPlay(id);
  if (id==='camera'||id==='photos') return openPhotoRoom(id);
  if (id === 'computer') return openArcade();
  if (id === 'letter') return openLetters();
  if (id === 'notebook') return openStory();
  if (id === 'rose') {
    viewer?.setActive(false);
    status.textContent = '正在打开粒子玫瑰…';
    location.assign(new URL('./rose-music/?bloom=1&ready=30',document.baseURI));
    return;
  }
  if (id === 'mirror') {
    viewer?.setActive(false);
    status.textContent = '正在打开浴室水雾页…';
    location.assign(new URL('./bathroom-mirror.html?drops=22',document.baseURI));
    return;
  }
  selected = id;
  inspection.hidden = !id;
  detailButton.hidden = id !== 'letter';
  if (id) inspection.querySelector('span').textContent = items[id][0];
}
function onHover(id) {
  if (viewerActive && deskPlayPages[id]) {
    status.textContent=id==='cassette'?'磁带 · 点击听声音':'便签 · 点击写字或画画';
    return;
  }
  if (viewerActive && (id==='camera'||id==='photos')) {
    status.textContent=id==='camera'?'拍立得 · 点击进入显影室':'拍立得照片 · 点击翻看相册';
    return;
  }
  if (viewerActive && id === 'computer') {
    status.textContent = '小电脑 · 点击打开游戏列表';
    return;
  }
  if (viewerActive && id === 'letter') {
    status.textContent = '火漆信封 · 点击选信';
    return;
  }
  if (viewerActive && id === 'notebook') {
    status.textContent = '笔记本 · 点击翻开';
    return;
  }
  if (viewerActive && id === 'rose') {
    status.textContent = '红玫瑰 · 点击打开粒子音乐页';
    return;
  }
  if (viewerActive && id === 'mirror') {
    status.textContent = '桌面镜 · 点击进入浴室水雾页';
    return;
  }
  status.textContent = viewerActive && id ? items[id][0] + ' · 点击可拿起' : guide;
}
document.querySelector('#put-back').onclick = () => viewer?.pick(undefined);
detailButton.onclick = () => showItem(selected);
window.addEventListener('keydown',event => {
  if (event.key === 'Escape' && !dialog.open && selected) viewer?.pick(undefined);
});
weather.addEventListener('click',() => viewer?.setWind(weather.getAttribute('aria-pressed') === 'true'));

function showPicture(message) {
  show3D = false;
  viewerActive = false;
  menu.querySelectorAll('[data-model-only]').forEach(button=>button.hidden=true);
  viewer?.setActive(false);
  onInspect(undefined);
  viewport.hidden = true;
  season.disabled = true;
  roomScroll.hidden = false;
  orbit.disabled = false;
  orbit.setAttribute('aria-pressed','true');
  orbit.textContent = '进入 3D';
  status.textContent = message || '效果图 · 点击小物查看';
}

async function enterRoom() {
  show3D = true;
  orbit.disabled = true;
  status.textContent = '正在载入 3D 房间…';
  try {
    initializing ||= import('./viewer.js?v=21').then(({createViewer}) =>
      createViewer(viewport,onInspect,onHover));
    viewer = await initializing;
    if (!show3D) return;
    viewerActive = true;
    menu.querySelectorAll('[data-model-only]').forEach(button=>button.hidden=false);
    viewport.hidden = false;
    viewer.setWind(weather.getAttribute('aria-pressed') === 'true');
    viewer.setActive(true);
    season.disabled = false;
    viewer.setSeason(season.value);
    viewer.setLiveWeather(nanjingWeather);
    roomScroll.hidden = true;
    orbit.setAttribute('aria-pressed','false');
    orbit.textContent = '效果图';
    orbit.disabled = false;
    status.textContent = guide;
  } catch (error) {
    initializing = null;
    showPicture('当前浏览器暂时无法打开 3D，已显示效果图。');
    console.error(error);
  }
}

orbit.onclick = () => viewerActive ? showPicture() : enterRoom();

enterRoom();
window.addEventListener('pageshow',event=>{
  if(event.persisted && viewerActive) {
    viewer.pick(undefined);
    viewer.setActive(true);
    status.textContent=guide;
  }
});
