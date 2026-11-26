import * as THREE from 'three';

export function makeGestureParticles(roses) {
  let seed = 76139;
  const random = () => {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  const bounds = new THREE.Vector2(1.4,2.1);
  const tilt=1.10, cosine=Math.cos(tilt), sine=Math.sin(tilt);
  function orbit(packet,time) {
    if (packet.halo) return {x:packet.nx*bounds.x,y:packet.ny*bounds.y,z:packet.depth,tx:1,ty:0};
    const major=Math.min(bounds.y*.84,bounds.x*1.95);
    // Keep the spiral pattern together. Radius-dependent angular speed was
    // winding the arms into a featureless disk after a few minutes.
    const pattern=time*.025;
    const breathing=.040*Math.sin(time*.22+packet.radius*2.8)
      +.012*Math.sin(time*.41+packet.angle*2.);
    const angle=packet.angle+pattern+breathing;
    const x=Math.cos(angle)*packet.radius*major;
    const y=Math.sin(angle)*packet.radius*major*.52;
    const tx=-Math.sin(angle)*cosine-Math.cos(angle)*.52*sine;
    const ty=-Math.sin(angle)*sine+Math.cos(angle)*.52*cosine;
    const length=Math.hypot(tx,ty);
    return {x:x*cosine-y*sine,y:x*sine+y*cosine,z:y*.42+packet.depth,tx:tx/length,ty:ty/length};
  }
  const fields = roses.map(({geometry}) => {
    const count = geometry.getAttribute('position').count;
    const positions = new Float32Array(count*3);
    const offsets = new Float32Array(count*3);
    const flights = new Float32Array(count*4);
    const ordering=Array.from({length:count},(_,index)=>index);
    for (let i=count-1;i>0;i--) {
      const other=Math.floor(random()*(i+1));
      [ordering[i],ordering[other]]=[ordering[other],ordering[i]];
    }
    const packets=[];
    for (let i=0;i<count;i+=48) packets.push(ordering.slice(i,i+48));
    // A source star cluster feeds many different parts of a flower, so the
    // intermediate shape is a continuous point cloud rather than moving tiles.
    const groups=packets.map(members=>{
      const halo=random()<.11;
      const core=random()<.23;
      const radius=core ? Math.pow(random(),1.3)*.23 : .12+Math.pow(random(),.70)*.98;
      const angle=core ? random()*Math.PI*2 : Math.floor(random()*2)*Math.PI
        +radius*4.4+(random()-.5)*(.25+radius*.75);
      const packet={members,halo,radius,angle,nx:(random()-.5)*2.2,ny:(random()-.5)*2.2,
        depth:(random()-.5)*(halo?1.8:.07),dx:0,dy:0,vx:0,vy:0,agitation:0};
      const origin=orbit(packet,0);
      const tier=random(), phase=random();
      const diameter=tier>.965 ? 28+random()*12 : tier>.76 ? 11+random()*8 : 4.5+random()*4.5;
      const hero=members[Math.floor(random()*members.length)];
      for (const i of members) {
        const spread=(halo?.055:.045+radius*.090);
        const dx=(random()+random()+random()-1.5)*spread;
        const dy=(random()+random()+random()-1.5)*spread;
        const dz=(random()-.5)*spread;
        offsets.set([dx,dy,dz],i*3);
        positions.set([origin.x+dx,origin.y+dy,origin.z+dz],i*3);
        flights.set([Number(i===hero),diameter,phase,halo?1.2:radius],i*4);
      }
      return packet;
    });
    const attribute = new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFloat',attribute);
    geometry.setAttribute('aFlight',new THREE.BufferAttribute(flights,4));
    return {positions,offsets,groups,attribute};
  });
  let palm = null;
  function push(x,y,stamp,radius=.65) {
    const point = {x:(x-.5)*bounds.x*2,y:(.5-y)*bounds.y*2,stamp,radius};
    const gap = palm ? (stamp-palm.stamp)*.001 : 1;
    point.vx = gap>.008 && gap<.20 ? THREE.MathUtils.clamp((point.x-palm.x)/gap,-4,4) : 0;
    point.vy = gap>.008 && gap<.20 ? THREE.MathUtils.clamp((point.y-palm.y)/gap,-4,4) : 0;
    palm=point;
  }
  function update(dt,time,stamp) {
    if (!(dt>0)) return;
    const damping = Math.exp(-dt*2.7);
    const influence = palm ? Math.max(0,1-(stamp-palm.stamp)/220) : 0;
    for (const field of fields) {
      const {positions:p,offsets,groups}=field;
      for (let i=0;i<groups.length;i++) {
        const packet=groups[i];
        const origin=orbit(packet,time);
        packet.vx += (Math.sin(time*.37+i*.73)*.005-packet.dx*5.0)*dt;
        packet.vy += (Math.cos(time*.29+i*.61)*.005-packet.dy*5.0)*dt;
        const mobility=packet.halo ? .85 : .16+.84*THREE.MathUtils.smoothstep(packet.radius,.05,.40);
        let excitement=0;
        if (influence) {
          const dx=origin.x+packet.dx-palm.x, dy=origin.y+packet.dy-palm.y;
          const d2=dx*dx+dy*dy;
          const weight=Math.exp(-d2/(palm.radius*palm.radius))*influence;
          const length=Math.sqrt(d2)+.12;
          const motion=Math.min(1.0,Math.max(0,Math.hypot(palm.vx,palm.vy)-.06)/.8);
          excitement=weight*mobility*motion;
          packet.vx += (palm.vx*2.6+dx/length*.30*motion)*weight*dt*mobility;
          packet.vy += (palm.vy*2.6+dy/length*.30*motion)*weight*dt*mobility;
        }
        const scatterRate=excitement>packet.agitation ? 11.0 : 1.7;
        packet.agitation+=(excitement-packet.agitation)*(1.-Math.exp(-dt*scatterRate));
        packet.vx=THREE.MathUtils.clamp(packet.vx*damping,-1.15,1.15);
        packet.vy=THREE.MathUtils.clamp(packet.vy*damping,-1.15,1.15);
        packet.dx+=packet.vx*dt;
        packet.dy+=packet.vy*dt;
        const major=Math.min(bounds.y*.84,bounds.x*1.95);
        const tangentialLimit=major*.16*mobility,normalLimit=major*.075*mobility;
        const along=THREE.MathUtils.clamp(packet.dx*origin.tx+packet.dy*origin.ty,-tangentialLimit,tangentialLimit);
        const across=THREE.MathUtils.clamp(-packet.dx*origin.ty+packet.dy*origin.tx,-normalLimit,normalLimit);
        packet.dx=along*origin.tx-across*origin.ty;
        packet.dy=along*origin.ty+across*origin.tx;
        // A swipe loosens individual stars around their moving orbit. The
        // expansion relaxes independently of the cluster's spring return.
        const spread=1.+packet.agitation*1.8;
        for (const member of packet.members) {
          const k=member*3;
          p[k]=origin.x+packet.dx+offsets[k]*spread;
          p[k+1]=origin.y+packet.dy+offsets[k+1]*spread;
          p[k+2]=origin.z+offsets[k+2]*(1.+packet.agitation*2.6);
        }
      }
      field.attribute.needsUpdate=true;
    }
  }
  function resize(width,height) {
    for (const {positions,offsets,attribute,groups} of fields) {
      for (let i=0;i<positions.length;i+=3) {
        positions[i]*=width/bounds.x;
        positions[i+1]*=height/bounds.y;
        offsets[i]*=width/bounds.x;offsets[i+1]*=height/bounds.y;
      }
      for (const packet of groups) {packet.dx*=width/bounds.x;packet.dy*=height/bounds.y;}
      attribute.needsUpdate=true;
    }
    bounds.set(width,height);
    palm=null;
  }
  return {push,update,resize,particleCount:fields.reduce((sum,field)=>sum+field.positions.length/3,0)};
}
