import * as T from './three.module.js';

// One short-lived splash per real petal/water contact, using a bounded pool.
export function createWaterImpacts(scene){
 const slots=[],capacity=64,geometry=new T.PlaneGeometry(1,1);let cursor=0;
 const vertexShader=`varying vec2 v;void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const fragmentShader=`precision highp float;uniform float age;uniform float phase;uniform float intensity;varying vec2 v;
 float bell(float x,float w){return exp(-x*x/(w*w));}
 void main(){
  float t=age;float d=length(v);float a=atan(v.y,v.x);float life=exp(-t*1.8)*(1.-smoothstep(1.3,1.9,t));
  float radius=.025+.215*sqrt(max(t,0.));float width=.0045+.002*t;
  float broken=.25+.75*smoothstep(-.45,.6,sin(a*7.+phase)+.45*sin(a*13.-phase));
  float ring=bell(d-radius,width)*broken;
  float secondary=bell(d-max(.005,radius-.037),width*.65)*.27;
  vec3 blue=vec3(.035,.45,2.1),pink=vec3(1.65,.12,.65),gold=vec3(1.8,1.05,.16);
  vec3 tint=mix(blue,gold,smoothstep(.72,.94,.5+.5*sin(a*2.7+phase)));tint=mix(tint,pink,.12+.10*sin(a*4.-phase));
  vec3 color=tint*(ring+secondary)*life;
  for(int i=0;i<7;i++){float k=float(i);float theta=k*.8976+phase*.31;
   vec2 center=vec2(cos(theta),sin(theta))*radius;vec2 q=v-center;
   float twinkle=.45+.55*pow(max(0.,sin(t*13.+k*2.3+phase)),3.);
   float dotGlow=exp(-dot(q,q)/.00018);
   float star=bell(q.x,.002)*bell(q.y,.013)+bell(q.y,.002)*bell(q.x,.013);
   color+=mix(blue,gold,.5+.5*sin(k+phase))*(dotGlow*.45+star*.42)*life*twinkle;
  }
  float flash=exp(-t*23.)*exp(-dot(v,v)/.0013);color+=vec3(1.2,1.05,.86)*flash;
  float alpha=clamp(max(max(color.r,color.g),color.b)*intensity,0.,1.);
  gl_FragColor=vec4(color*intensity,1.);
 }`;
 for(let i=0;i<capacity;i++){
  const material=new T.ShaderMaterial({uniforms:{age:{value:99},phase:{value:0},intensity:{value:1}},vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
  const ring=new T.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.position.y=.036;ring.visible=false;scene.add(ring);slots.push({ring,born:-100,phase:0,x:0,z:0,scale:1});
 }
 const drops=new T.InstancedMesh(new T.IcosahedronGeometry(.009,1),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.75,depthWrite:false}),capacity*5);drops.frustumCulled=false;scene.add(drops);
 const dummy=new T.Object3D();const palette=['#a3dbff','#f4c4db','#fff1c1'].map(c=>new T.Color(c).multiplyScalar(1.35));
 for(let i=0;i<capacity*5;i++){dummy.scale.setScalar(0);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);drops.setColorAt(i,palette[i%3]);}
 function spawn(x,z,time,strength){const slot=slots[cursor++%capacity];slot.born=time;slot.phase=Math.random()*6.283;slot.x=x;slot.z=z;slot.scale=.80+Math.random()*.35;slot.ring.position.set(x,.036,z);slot.ring.scale.setScalar(slot.scale);slot.ring.material.uniforms.phase.value=slot.phase;slot.ring.material.uniforms.intensity.value=.72+Math.min(.4,strength);slot.ring.visible=true;}
 function update(time){let active=0;
  slots.forEach((s,i)=>{const age=time-s.born;s.ring.visible=age>=0&&age<1.9;if(s.ring.visible){active++;s.ring.material.uniforms.age.value=age;}
   for(let j=0;j<5;j++){const k=i*5+j;const t=age-j*.012;const a=s.phase+j*1.256;
    if(t>=0&&t<.44){const travel=.10*t;dummy.position.set(s.x+Math.cos(a)*travel,.035+(.37+j*.015)*t-.95*t*t,s.z+Math.sin(a)*travel);dummy.scale.setScalar(Math.max(0,(1-t/.44))*(.6+j*.13));}
    else dummy.scale.setScalar(0);dummy.updateMatrix();drops.setMatrixAt(k,dummy.matrix);
   }
  });drops.instanceMatrix.needsUpdate=true;return active;
 }
 return {spawn,update};
}


