import * as THREE from 'three';

export function makeMusicCurrent(roses) {
  const width=17,extent=.78,step=extent*2/(width-1),nodeCount=width*width;
  const random=(seed,salt)=>{const value=Math.sin(seed*127.1+salt*311.7)*43758.5453;return value-Math.floor(value);};
  let rootY=Infinity,tipY=-Infinity;
  for(const {geometry,center} of roses) {
    const positions=geometry.getAttribute('position').array,meta=geometry.getAttribute('aData').array;
    for(let i=0;i<positions.length/3;i++)if(meta[i*4+2]===2)rootY=Math.min(rootY,positions[i*3+1]);
    tipY=Math.max(tipY,center?.y??0);
  }
  if(!Number.isFinite(rootY))rootY=-1.82;
  const stemHeight=Math.max(.5,tipY-rootY);
  const bendAt=y=>{const h=THREE.MathUtils.clamp((y-rootY)/stemHeight,0,1);return h*h*(.65+.35*h);};
  const fields=roses.map(({geometry,center},index)=>{
    const home=geometry.getAttribute('position').array;
    const metadata=geometry.getAttribute('aData').array;
    const pointCount=home.length/3,points=[];
    for(let i=0;i<pointCount;i++)if(metadata[i*4+2]<1.5)points.push(i);
    const count=points.length,weights=new Float32Array(count*4),nodes=new Uint16Array(count);
    const factors=new Float32Array(count),rest=new Float32Array(count*2);
    const individual=new Float32Array(count*3),individualVelocity=new Float32Array(count*3);
    const directionA=new Float32Array(count*3),directionB=new Float32Array(count*3);
    const response=new Float32Array(count),springFactor=new Float32Array(count),drag=new Float32Array(count),turn=new Float32Array(count);
    let cx=0,cy=0;
    for(const point of points){cx+=home[point*3];cy+=home[point*3+1];}
    cx/=Math.max(1,count);cy/=Math.max(1,count);
    let xx=0,xy=0,yy=0;
    for(let i=0;i<count;i++) {
      const point=points[i],x=home[point*3],y=home[point*3+1];
      const gx=THREE.MathUtils.clamp((x-(center?.x??cx)+extent)/step,0,width-1.00001);
      const gy=THREE.MathUtils.clamp((y-(center?.y??cy)+extent)/step,0,width-1.00001);
      const ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy;
      nodes[i]=iy*width+ix;
      weights.set([(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty],i*4);
      factors[i]=(.76+.36*metadata[point*4+3])*(metadata[point*4+2]===1?.78:1);
      const seed=metadata[point*4+3],angle=random(seed,2.)*Math.PI*2;
      const depth=(random(seed,3.)-.5)*.95,normal=1/Math.sqrt(1+depth*depth);
      directionA.set([Math.cos(angle)*normal,Math.sin(angle)*normal,depth*normal],i*3);
      directionB.set([-Math.sin(angle),Math.cos(angle),(random(seed,4.)-.5)*.50],i*3);
      const tier=random(seed,5.);
      response[i]=(tier<.67?.045+.14*tier/.67:tier<.93?.65+(tier-.67)/.26*.90:1.90+(tier-.93)/.07*.60)
        *(metadata[point*4+2]===1?.72:1);
      springFactor[i]=.65+1.10*random(seed,6.);
      drag[i]=1.05+.55*random(seed,7.);
      turn[i]=(random(seed,8.)>.5?1:-1)*(.9+2.1*random(seed,9.));
      rest[i*2]=x-cx;rest[i*2+1]=y-cy;
      xx+=(x-cx)**2;xy+=(x-cx)*(y-cy);yy+=(y-cy)**2;
    }
    const offsets=new Float32Array(pointCount*3);
    const attribute=new THREE.BufferAttribute(offsets,3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aMusicOffset',attribute);
    const stemOffsets=new Float32Array(pointCount*3),stemWeights=new Float32Array(pointCount);
    for(let i=0;i<pointCount;i++) {
      const type=metadata[i*4+2];
      if(type<1.5)stemWeights[i]=bendAt(center?.y??cy);
      else if(type===2)stemWeights[i]=bendAt(home[i*3+1]);
    }
    const stemAttribute=new THREE.BufferAttribute(stemOffsets,3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aStemOffset',stemAttribute);
    return {index,points,weights,nodes,factors,rest,xx,xy,yy,determinant:Math.max(1e-8,xx*yy-xy*xy),
      individual,individualVelocity,directionA,directionB,response,springFactor,drag,turn,
      stemOffsets,stemWeights,stemAttribute,
      displacement:new Float32Array(nodeCount*3),velocity:new Float32Array(nodeCount*3),offsets,attribute};
  });
  let lastStamp=performance.now(),previousBeat=0,previousBass=0,phase=0,maxOffset=0,awake=false;
  let elapsed=0,lastOnset=-1,cadence=.70;
  let stemX=0,stemZ=0,stemVX=0,stemVZ=0;
  function update(audio,active,stepOverride) {
    const now=performance.now();
    const dt=stepOverride??Math.max(.001,Math.min(.05,(now-lastStamp)*.001));
    lastStamp=now;
    const energy=active?audio.energy:0;
    const onset=active?Math.max(0,audio.beat-previousBeat)*.90+Math.max(0,audio.bass-previousBass)*.28:0;
    previousBeat=audio.beat;previousBass=audio.bass;
    if(!awake&&energy<.0005&&onset<.0005)return 0;
    if(!awake){lastOnset=-1;cadence=.70;}
    awake=true;
    elapsed+=dt;
    if(onset>.045&&elapsed-lastOnset>.13) {
      const gap=elapsed-lastOnset;
      if(lastOnset>=0&&gap<1.8)cadence+=(gap-cadence)*.22;
      lastOnset=elapsed;
    }
    phase+=onset*1.25+dt*(active?audio.mid*.30+audio.treble*.16:0);
    const spring=THREE.MathUtils.clamp(18/(cadence*cadence),24,105);
    const damping=Math.exp(-dt*1.2*Math.sqrt(spring));
    let maxNode=0,maxSpeed=0;
    const stemSpring=spring*.48+9.,stemDamping=1/(1+dt*Math.sqrt(stemSpring)*1.35);
    stemVX=(stemVX+onset*.65*Math.sin(phase*.72)+(energy*.18*Math.sin(phase)-stemX*stemSpring)*dt)*stemDamping;
    stemVZ=(stemVZ+onset*.18*Math.cos(phase*.61)-stemZ*stemSpring*dt)*stemDamping;
    stemX=THREE.MathUtils.clamp(stemX+stemVX*dt,-.090,.090);
    stemZ=THREE.MathUtils.clamp(stemZ+stemVZ*dt,-.040,.040);
    maxNode=Math.max(Math.abs(stemX),Math.abs(stemZ));
    maxSpeed=Math.max(Math.abs(stemVX),Math.abs(stemVZ));
    for(const field of fields) {
      const {displacement:d,velocity:v,index}=field;
      const localPhase=phase+index*1.71;
      for(let iy=0;iy<width;iy++)for(let ix=0;ix<width;ix++) {
        const k=(iy*width+ix)*3,x=ix*step-extent,y=iy*step-extent;
        // This smooth curl field carries neighboring grains in shared lanes.
        // It is driven by measured onsets, not by a track's BPM label.
        const shared=.35*Math.cos((x+y)*8.-localPhase*.60);
        const dx=Math.cos(y*7.+localPhase)+shared;
        const dy=-Math.sin(x*7.-localPhase*.83)-shared;
        const dz=.32*Math.sin((x-y)*6.+localPhase*.67);
        const flow=active?(energy*.18+audio.mid*.32)*2.4*spring/34.:0;
        const kick=onset*.85*Math.sqrt(spring/34.);
        const direction=[dx,dy,dz];
        for(let axis=0;axis<3;axis++) {
          v[k+axis]=(v[k+axis]+kick*direction[axis]
            +(flow*direction[axis]-d[k+axis]*spring)*dt)*damping;
          d[k+axis]+=v[k+axis]*dt;
          maxNode=Math.max(maxNode,Math.abs(d[k+axis]));
          maxSpeed=Math.max(maxSpeed,Math.abs(v[k+axis]));
        }
      }
      const c=Math.cos(localPhase*.72),s=Math.sin(localPhase*.72);
      const kick=onset*1.45*Math.sqrt(spring/34.);
      const level=active?(energy*.12+audio.mid*.22)*spring/34.:0;
      for(let i=0;i<field.points.length;i++) {
        const k=i*3,stiffness=spring*field.springFactor[i];
        const friction=1/(1+dt*field.drag[i]*Math.sqrt(stiffness)*(energy<.005?1.35:1));
        const oldVX=field.individualVelocity[k],oldVY=field.individualVelocity[k+1];
        for(let axis=0;axis<3;axis++) {
          const direction=field.directionA[k+axis]*c+field.directionB[k+axis]*s;
          let velocity=field.individualVelocity[k+axis];
          velocity=(velocity+kick*direction*field.response[i]
            +(level*direction-field.individual[k+axis]*stiffness
              +field.turn[i]*(.30+.70*Math.min(1,energy*5))*(axis===0?oldVY:axis===1?-oldVX:0))*dt)*friction;
          field.individualVelocity[k+axis]=velocity;
          field.individual[k+axis]+=velocity*dt;
          maxNode=Math.max(maxNode,Math.abs(field.individual[k+axis]));
          maxSpeed=Math.max(maxSpeed,Math.abs(velocity));
        }
        const length=Math.hypot(field.individual[k],field.individual[k+1],field.individual[k+2]);
        if(length>.23){const factor=.23/length;for(let axis=0;axis<3;axis++){field.individual[k+axis]*=factor;field.individualVelocity[k+axis]*=.65;}}
      }
    }
    if(energy<.0005&&maxNode<.000015&&maxSpeed<.00015) {
      for(const field of fields) {
        field.displacement.fill(0);field.velocity.fill(0);field.offsets.fill(0);field.attribute.needsUpdate=true;
        field.individual.fill(0);field.individualVelocity.fill(0);field.stemOffsets.fill(0);field.stemAttribute.needsUpdate=true;
      }
      stemX=stemZ=stemVX=stemVZ=0;
      maxOffset=0;awake=false;return 0;
    }
    maxOffset=0;
    for(const field of fields) {
      const {points,weights,nodes,factors,rest,displacement:d,offsets:o}=field;
      const mean=[0,0,0],crossX=[0,0,0],crossY=[0,0,0];
      for(let i=0;i<points.length;i++) {
        const n=nodes[i],w=i*4,p=points[i]*3,f=factors[i];
        for(let axis=0;axis<3;axis++)o[p+axis]=.22*f*(d[n*3+axis]*weights[w]
          +d[(n+1)*3+axis]*weights[w+1]+d[(n+width)*3+axis]*weights[w+2]
          +d[(n+width+1)*3+axis]*weights[w+3])+field.individual[i*3+axis];
        for(let axis=0;axis<3;axis++) {
          mean[axis]+=o[p+axis];
          crossX[axis]+=o[p+axis]*rest[i*2];crossY[axis]+=o[p+axis]*rest[i*2+1];
        }
      }
      const count=Math.max(1,points.length);
      const linearX=[],linearY=[];
      for(let axis=0;axis<3;axis++) {
        mean[axis]/=count;
        linearX[axis]=(crossX[axis]*field.yy-crossY[axis]*field.xy)/field.determinant;
        linearY[axis]=(crossY[axis]*field.xx-crossX[axis]*field.xy)/field.determinant;
      }
      let largest=0;
      for(let i=0;i<points.length;i++) {
        const p=points[i]*3,x=rest[i*2],y=rest[i*2+1];
        // Remove the whole-flower affine motion (including scale, shear and
        // tilt), retaining only the local particle currents.
        for(let axis=0;axis<3;axis++)o[p+axis]-=mean[axis]+linearX[axis]*x+linearY[axis]*y;
        largest=Math.max(largest,Math.hypot(o[p],o[p+1],o[p+2]));
      }
      if(largest>.24) {
        const scale=.24/largest;
        for(const point of points){const p=point*3;o[p]*=scale;o[p+1]*=scale;o[p+2]*=scale;}
        largest=.24;
      }
      for(let i=0;i<field.stemWeights.length;i++) {
        field.stemOffsets[i*3]=stemX*field.stemWeights[i];
        field.stemOffsets[i*3+2]=stemZ*field.stemWeights[i];
      }
      field.stemAttribute.needsUpdate=true;
      maxOffset=Math.max(maxOffset,largest);
      field.attribute.needsUpdate=true;
    }
    return maxOffset;
  }
  return {update};
}
