import { musicTracks } from './music-tracks.js';

export function makeMusicPlayer() {
  const panel=document.querySelector('#music-panel');
  const audio=document.querySelector('#soundtrack');
  const list=document.querySelector('#music-tracks');
  const playButton=document.querySelector('#music-play');
  const micButton=document.querySelector('#music-mic');
  const seek=document.querySelector('#music-seek');
  const volume=document.querySelector('#music-volume');
  const caption=document.querySelector('#music-caption');
  const meter=[...document.querySelectorAll('#music-meter i')];
  const state={bass:0,mid:0,treble:0,beat:0,energy:0,time:0};
  const urls=new Map();
  let packed,context,analyser,gain,frequency,waveform,selected=-1,loaded=-1;
  let visible=false,loading=false,token=0,previousStamp=performance.now(),beat=0;
  let micStream,micSource,micAnalyser,micMonitor,micPending=false,micStarted=0;
  let previousBass=0,previousRms=0,lastBeat=-1;
  const format=value=>{
    const seconds=Math.max(0,Math.floor(Number(value)||0));
    return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  };
  const clamp=value=>Math.max(0,Math.min(1,value));
  const note=text=>{if(caption.textContent!==text)caption.textContent=text;};
  for(const [index,track] of musicTracks.entries()) {
    const button=document.createElement('button');
    button.type='button';button.className='music-track';button.dataset.index=String(index);
    button.setAttribute('aria-label',`${track.title}，${track.mood}，${track.bpm} BPM`);
    button.setAttribute('aria-pressed','false');
    button.innerHTML=`<span class="track-number">0${index+1}</span><span class="track-copy"><strong>${track.title}</strong><small>${track.mood} · ${track.bpm} BPM</small></span><span class="track-indicator" aria-hidden="true">♪</span>`;
    button.addEventListener('click',()=>{
      if(selected===index&&loaded===index&&!audio.paused)pause();
      else play(index);
    });
    list.append(button);
  }
  document.querySelector('#music-credit-tracks').innerHTML=musicTracks.map(track=>
    `<p><a href="${track.source}" target="_blank" rel="noopener">${track.title}</a> — Kevin MacLeod · <a href="${track.license}" target="_blank" rel="noopener">${track.licenseName}</a></p>`).join('');
  function refresh() {
    const playing=!audio.paused&&!audio.ended;
    panel.dataset.playing=String(playing);
    playButton.textContent=playing?'Ⅱ':'▶';
    playButton.setAttribute('aria-label',playing?'暂停音乐':'播放音乐');
    for(const [index,button] of [...list.children].entries()) {
      const current=index===selected;
      button.classList.toggle('is-current',current);
      button.setAttribute('aria-pressed',String(current));
      button.querySelector('.track-indicator').textContent=current&&playing?'Ⅱ':'♪';
    }
  }
  async function setup() {
    if(!context) {
      const AudioContext=window.AudioContext??window.webkitAudioContext;
      if(!AudioContext)throw new Error('AudioContext unavailable');
      context=new AudioContext({latencyHint:'interactive'});
      analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.55;
      analyser.minDecibels=-85;analyser.maxDecibels=-15;
      frequency=new Uint8Array(analyser.frequencyBinCount);
      waveform=new Float32Array(analyser.fftSize);
      gain=context.createGain();gain.gain.value=Number(volume.value);
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(gain);gain.connect(context.destination);
    }
    if(context.state!=='running')await context.resume();
  }
  function releaseMic() {
    micSource?.disconnect();
    micAnalyser?.disconnect();
    micMonitor?.disconnect();
    const stream=micStream;
    micSource=micAnalyser=micMonitor=micStream=undefined;
    stream?.getTracks().forEach(track=>track.stop());
    micPending=false;
    micButton.textContent='使用麦克风';
    micButton.setAttribute('aria-pressed','false');
    seek.disabled=false;
    previousBass=previousRms=beat=0;
  }
  async function toggleMic() {
    if(micPending||micStream){pause();note('麦克风已关闭 · 可以选一首歌');return;}
    pause();
    const request=++token;
    micPending=true;
    micButton.textContent='取消麦克风';
    note('正在等待麦克风授权…');
    let stream;
    try {
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone unavailable');
      await setup();
      if(request!==token||!visible)return;
      stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      if(request!==token||!visible){stream.getTracks().forEach(track=>track.stop());return;}
      micStream=stream;
      micSource=context.createMediaStreamSource(stream);
      micAnalyser=context.createAnalyser();
      micAnalyser.fftSize=analyser.fftSize;
      micAnalyser.smoothingTimeConstant=analyser.smoothingTimeConstant;
      micAnalyser.minDecibels=analyser.minDecibels;
      micAnalyser.maxDecibels=analyser.maxDecibels;
      micMonitor=context.createGain();
      micMonitor.gain.value=0;
      micSource.connect(micAnalyser);
      micAnalyser.connect(micMonitor);
      micMonitor.connect(context.destination);
      micPending=false;micStarted=performance.now();
      seek.disabled=true;
      micButton.textContent='关闭麦克风';
      micButton.setAttribute('aria-pressed','true');
      note('麦克风已开启 · 试着说话或拍手');
      for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>{
        if(micStream===stream){pause();note('麦克风已断开 · 可重新开启');}
      });
    } catch(error) {
      if(request!==token)return;
      releaseMic();
      note(error.name==='NotAllowedError'?'麦克风未获授权 · 仍可播放音乐':'暂时无法开启麦克风 · 仍可播放音乐');
    }
  }
  micButton.addEventListener('click',toggleMic);
  function sourceURL(track) {
    if(urls.has(track.id))return urls.get(track.id);
    if(packed===undefined)packed=JSON.parse(document.querySelector('#music-assets').textContent);
    if(!packed[track.id])return `./assets/music/${track.asset}`;
    const binary=atob(packed[track.id]),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
    urls.set(track.id,url);return url;
  }
  async function play(index) {
    if(!visible)return;
    const request=++token;
    if(micPending||micStream)releaseMic();
    selected=index;loading=true;note('正在准备音乐…');refresh();
    try {
      await setup();
      if(request!==token||!visible)return;
      if(loaded!==index) {
        audio.pause();audio.src=sourceURL(musicTracks[index]);audio.load();loaded=index;
        previousBass=0;previousRms=0;beat=0;
      }
      await audio.play();
      if(request!==token||!visible)return;
      loading=false;note('粒子正在随音乐流动');refresh();
    } catch {
      if(request!==token)return;
      loading=false;audio.pause();note('暂时无法播放，请重新点选歌曲');refresh();
    }
  }
  function pause() {
    ++token;loading=false;if(micPending||micStream)releaseMic();audio.pause();note('已暂停 · 点选歌曲继续');refresh();
  }
  playButton.addEventListener('click',()=>{
    if(!audio.paused)pause();else play(Math.max(0,selected));
  });
  seek.addEventListener('input',()=>{
    if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number(seek.value)/1000*audio.duration;
  });
  volume.addEventListener('input',()=>{
    if(gain&&context)gain.gain.setTargetAtTime(Number(volume.value),context.currentTime,.035);
  });
  audio.addEventListener('playing',refresh);
  audio.addEventListener('pause',refresh);
  audio.addEventListener('ended',()=>{if(visible&&!micStream&&!micPending)play((selected+1)%musicTracks.length);});
  audio.addEventListener('error',()=>{loading=false;if(!micPending&&!micStream)note('音频加载失败，请重新点选歌曲');refresh();});
  function setVisible(value) {
    if(visible===value)return;
    visible=value;panel.hidden=!value;
    if(!value)pause();else if(selected<0)note('选一首，让粒子随音乐流动');
  }
  function band(low,high) {
    const resolution=context.sampleRate/analyser.fftSize;
    const start=Math.max(1,Math.floor(low/resolution));
    const end=Math.min(frequency.length,Math.ceil(high/resolution));
    let sum=0;for(let i=start;i<end;i++)sum+=frequency[i];
    return sum/Math.max(1,end-start)/255;
  }
  function update() {
    const now=performance.now(),dt=Math.max(.001,Math.min(.10,(now-previousStamp)*.001));
    previousStamp=now;
    const target={bass:0,mid:0,treble:0,energy:0};
    beat*=Math.exp(-dt/0.17);
    const input=micAnalyser??analyser;
    if(input&&(micStream||(!audio.paused&&!audio.ended&&!loading))&&context.state==='running') {
      input.getByteFrequencyData(frequency);input.getFloatTimeDomainData(waveform);
      let rms=0;for(const sample of waveform)rms+=sample*sample;
      rms=Math.sqrt(rms/waveform.length);
      if(rms>.0015) {
        target.bass=clamp((band(40,190)-.12)*1.8);
        target.mid=clamp((band(190,3400)-.10)*1.9);
        target.treble=clamp((band(3400,12000)-.035)*2.1);
        target.energy=clamp((rms-.0015)*4.6);
        const onset=Math.max(0,target.bass-previousBass)*.72+Math.max(0,rms-previousRms)*1.8;
        if(onset>.035&&now-lastBeat>150) {beat=Math.max(beat,clamp(onset*7.0));lastBeat=now;}
      }
      previousBass+=(target.bass-previousBass)*(1-Math.exp(-dt/.085));
      previousRms+=(rms-previousRms)*(1-Math.exp(-dt/.085));
    } else {previousBass=0;previousRms=0;}
    for(const key of ['bass','mid','treble','energy']) {
      const tau=target[key]>state[key] ? .035 : .16;
      state[key]+=(target[key]-state[key])*(1-Math.exp(-dt/tau));
      if(state[key]<.0005)state[key]=0;
    }
    state.beat=beat<.0005 ? 0 : beat;
    state.time=micStream ? (now-micStarted)/1000 : Number(audio.currentTime)||0;
    const levels=[state.bass,state.mid,state.treble,Math.max(state.beat,state.energy)];
    levels.forEach((level,index)=>meter[index].style.height=`${2+level*15}px`);
    for(const key of ['bass','mid','treble','beat','energy'])panel.dataset[key]=state[key].toFixed(4);
    if(visible) {
      const duration=Number.isFinite(audio.duration) ? audio.duration : musicTracks[Math.max(0,selected)].duration;
      document.querySelector('#music-time').textContent=micStream ? `麦克风 · ${format(state.time)}` : `${format(audio.currentTime)} / ${format(duration)}`;
      if(document.activeElement!==seek)seek.value=String(duration>0?audio.currentTime/duration*1000:0);
    }
    return state;
  }
  window.addEventListener('pagehide',event=>{
    pause();if(event.persisted)return;
    context?.close();for(const url of urls.values())URL.revokeObjectURL(url);
  });
  return {setVisible,update};
}
