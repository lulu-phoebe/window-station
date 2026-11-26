// Reference: 30 fps recording, approximately 6.42–6.95 s.
// Distinct arrivals, fast flights, brief alignment; no global swirling path.
export const GATHER_DURATION=900;
export function gatherSchedule(distances){const order=distances.map((distance,index)=>({distance,index})).sort((a,b)=>a.distance-b.distance);const max=Math.max(1,...distances),result=[];order.forEach(({distance,index},rank)=>result[index]={delay:rank*7,duration:580+140*distance/max});return result}
export function gatherProgress(elapsed,schedule){const p=Math.max(0,Math.min(1,(elapsed-schedule.delay)/schedule.duration));return {p,position:p<.82?Math.pow(p/.82,2.6)*.94:.94+.06*(1-Math.pow(1-(p-.82)/.18,2)),rotation:p<.82?Math.pow(p/.82,2.1)*.96:.96+.04*(1-Math.pow(1-(p-.82)/.18,2))}}
