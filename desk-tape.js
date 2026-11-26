const selector=document.querySelector('#track');
const player=document.querySelector('#play');
const status=document.querySelector('#status');
const cassette=document.querySelector('.cassette');
const titles=['窗外细雨','翻书声','拍立得快门'];
let audio, source, request=0;
function pause(){
  request++;
  if(source){source.onended=null;source.stop();source=null;}
  cassette.classList.remove('playing');
  player.textContent='播放';
}
function select(index){
  pause();
  selector.value=Math.max(0,Math.min(titles.length-1,index));
  status.textContent=titles[Number(selector.value)];
}
async function play(){
  if(source){pause();return;}
  const current=++request;
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    audio ||= new Context();
    await audio.resume();
    if(current!==request)return;
    const track=Number(selector.value);
    const buffer=audio.createBuffer(1,audio.sampleRate*6,audio.sampleRate);
    const samples=buffer.getChannelData(0);
    let low=0;
    for(let i=0;i<samples.length;i++){
      const t=i/audio.sampleRate;
      const noise=Math.random()*2-1;
      low=.84*low+.16*noise;
      if(track===0) samples[i]=.14*low+.014*noise;
      if(track===1){
        const page=t%2;
        samples[i]=page<.65 ? low*Math.sin(Math.PI*page/.65)*.42 : 0;
      }
      if(track===2){
        const click=t%2;
        samples[i]=click<.22 ? noise*(Math.exp(-click*62)+.5*Math.exp(-Math.abs(click-.085)*105))*.33 : 0;
      }
    }
    source=audio.createBufferSource();
    source.buffer=buffer;source.loop=true;source.connect(audio.destination);source.start();
    cassette.classList.add('playing');player.textContent='暂停';
  }catch{status.textContent='暂时无法播放声音';}
}
player.onclick=play;
selector.oninput=()=>select(Number(selector.value));
document.querySelector('#back').onclick=()=>select(Number(selector.value)-1);
document.querySelector('#next').onclick=()=>select(Number(selector.value)+1);
addEventListener('pagehide',pause);
