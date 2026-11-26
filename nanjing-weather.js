const endpoint='https://api.open-meteo.com/v1/forecast?latitude=32.06&longitude=118.8&current=wind_speed_10m,cloud_cover,precipitation&timezone=Asia%2FShanghai';

export function addNanjingWeather(apply) {
  const button=document.querySelector('#nanjing-weather');
  const data=document.querySelector('#nanjing-data');
  const status=document.querySelector('#nanjing-status');
  const updated=document.querySelector('#nanjing-updated');
  let active=true, controller, timer;

  async function refresh() {
    const request=new AbortController();
    controller=request;
    const timeout=setTimeout(()=>request.abort(),9000);
    try {
      const response=await fetch(endpoint,{signal:request.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Weather request failed');
      const {current}=await response.json();
      if(!active||controller!==request)return;
      const {wind_speed_10m:wind,cloud_cover:cloud,precipitation:rain,time}=current;
      if(![wind,cloud,rain].every(Number.isFinite)||typeof time!=='string')throw new Error('Missing weather values');
      apply({wind,cloud,rain});
      status.textContent='风速 '+wind.toFixed(1)+' km/h · 云量 '+cloud+'% · 降水 '+rain.toFixed(1)+' mm';
      updated.textContent='更新于 '+time.slice(11,16)+'（北京时间）';
    } catch {
      if(!active||controller!==request)return;
      apply(null);
      updated.textContent='';
      status.textContent='天气暂时无法读取，已恢复手动季节。可关闭后再试。';
    } finally {
      clearTimeout(timeout);
      if(active&&controller===request)timer=setTimeout(refresh,600000);
    }
  }
  refresh();
  button.addEventListener('click',()=>{
    active=!active;
    button.setAttribute('aria-pressed',String(active));
    data.hidden=!active;
    if(active){updated.textContent='';status.textContent='正在读取南京天气…';refresh();}
    else {controller?.abort();controller=undefined;clearTimeout(timer);apply(null);}
  });
}
