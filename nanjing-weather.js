const endpoint='https://api.open-meteo.com/v1/forecast?latitude=32.06&longitude=118.8&current=wind_speed_10m,cloud_cover,precipitation&timezone=Asia%2FShanghai';
const backupEndpoint='https://wttr.in/Nanjing?format=j1';

const sources=[
  {
    url:endpoint, name:'Open-Meteo', link:'https://open-meteo.com/en/docs',
    read({current}) {
      const {wind_speed_10m:wind,cloud_cover:cloud,precipitation:rain,time}=current??{};
      return {wind,cloud,rain,time};
    },
  },
  {
    url:backupEndpoint, name:'wttr.in', link:'https://wttr.in/Nanjing',
    read({current_condition}) {
      const current=current_condition?.[0]??{};
      const number=value=>typeof value==='string'&&value.trim()?Number(value):NaN;
      return {
        wind:number(current.windspeedKmph),
        cloud:number(current.cloudcover),
        rain:number(current.precipMM),
        time:typeof current.localObsDateTime==='string'?current.localObsDateTime.replace(' ','T'):undefined,
        observed:typeof current.observation_time==='string'?current.observation_time:undefined,
      };
    },
  },
];

async function readWeather(signal) {
  for(const source of sources) {
    if(signal.aborted)throw signal.reason;
    const timeout=AbortSignal.timeout(6500);
    try {
      const response=await fetch(source.url,{signal:AbortSignal.any([signal,timeout]),cache:'no-store'});
      if(!response.ok)continue;
      const weather=source.read(await response.json());
      if(![weather.wind,weather.cloud,weather.rain].every(Number.isFinite))continue;
      if(weather.wind<0||weather.cloud<0||weather.cloud>100||weather.rain<0)continue;
      const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(weather.time??'')
        ? weather.time.slice(5,10)+' '+weather.time.slice(11,16)+'（北京时间）'
        : /^\d{2}:\d{2} (AM|PM)$/.test(weather.observed??'')?weather.observed+'（来源时间）':'';
      if(!timestamp)continue;
      return {weather,source,timestamp};
    } catch {
      if(signal.aborted)throw signal.reason;
    }
  }
  throw new Error('No weather source returned usable data');
}

export function addNanjingWeather(apply) {
  const button=document.querySelector('#nanjing-weather');
  const data=document.querySelector('#nanjing-data');
  const status=document.querySelector('#nanjing-status');
  const updated=document.querySelector('#nanjing-updated');
  const attribution=data.querySelector('a');
  let active=true, controller, timer, last;

  async function refresh() {
    const request=new AbortController();
    controller=request;
    let delay=600000;
    try {
      const {weather,source,timestamp}=await readWeather(request.signal);
      if(!active||controller!==request)return;
      const {wind,cloud,rain}=weather;
      last={timestamp,received:Date.now()};
      apply({wind,cloud,rain});
      status.textContent='风速 '+wind.toFixed(1)+' km/h · 云量 '+cloud+'% · 降水 '+rain.toFixed(1)+' mm';
      updated.textContent='数据时间 '+timestamp;
      attribution.href=source.link;
      attribution.textContent=source.name;
      attribution.setAttribute('aria-label','天气数据来源 '+source.name);
    } catch {
      if(!active||controller!==request)return;
      delay=60000;
      if(last&&Date.now()-last.received<1800000){
        updated.textContent='暂用 '+last.timestamp+' 的数据，正在重试';
      } else {
        last=undefined;
        apply(null);
        updated.textContent='';
        status.textContent='天气暂时无法读取，已恢复手动季节。一分钟后自动重试。';
      }
    } finally {
      if(active&&controller===request)timer=setTimeout(refresh,delay);
    }
  }
  refresh();
  button.addEventListener('click',()=>{
    active=!active;
    button.setAttribute('aria-pressed',String(active));
    data.hidden=!active;
    if(active){updated.textContent='';status.textContent='正在读取南京天气…';refresh();}
    else {controller?.abort();controller=undefined;clearTimeout(timer);last=undefined;apply(null);}
  });
}

