import * as THREE from './three.module.js';

export function roomMirror(renderer,scene,glass) {
  const target = new THREE.WebGLRenderTarget(384,256,{
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true
  });
  const reflection = new THREE.PerspectiveCamera();
  const projection = new THREE.Matrix4();
  const normal = new THREE.Vector3(-.13,.13,1).normalize();
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const reflectedUp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const plane = new THREE.Plane();
  const clip = [plane];
  const returnWall = new THREE.Mesh(new THREE.PlaneGeometry(11,6),
    new THREE.MeshStandardMaterial({color:'#a9adbb',roughness:.95,side:THREE.DoubleSide}));
  returnWall.position.set(0,2.9,5.55);
  returnWall.visible=false;
  returnWall.raycast=()=>{};
  scene.add(returnWall);
  const reflectedWindow=new THREE.Group();
  reflectedWindow.position.set(1.05,1.55,5.49);
  reflectedWindow.visible=false;
  reflectedWindow.raycast=()=>{};
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.84,1.66),
    new THREE.MeshBasicMaterial({color:'#e9ead8',side:THREE.DoubleSide}));
  reflectedWindow.add(pane);
  const frameMat=new THREE.MeshBasicMaterial({color:'#98a4ad',side:THREE.DoubleSide});
  function mullion(w,h,x,y) {
    const bar=new THREE.Mesh(new THREE.PlaneGeometry(w,h),frameMat);
    bar.position.set(x,y,-.005);
    reflectedWindow.add(bar);
  }
  for(const x of [-.92,0,.92]) mullion(.045,1.67,x,0);
  for(const y of [-.83,0,.83]) mullion(1.88,.045,0,y);
  scene.add(reflectedWindow);
  const material = new THREE.MeshBasicMaterial({color:0xffffff});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uReflection={value:target.texture};
    shader.uniforms.uReflectionMatrix={value:projection};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec4 vReflection;\nuniform mat4 uReflectionMatrix;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvReflection=uReflectionMatrix*modelMatrix*vec4(position,1.);');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec4 vReflection;\nuniform sampler2D uReflection;')
      .replace('#include <map_fragment>',[
        'vec2 uv=vReflection.xy/vReflection.w*.5+.5;',
        'vec3 reflected=texture2D(uReflection,clamp(uv,vec2(.002),vec2(.998))).rgb;',
        'vec3 silver=vec3(.43,.48,.56);',
        'float gleam=pow(max(0.,1.-abs(uv.x+uv.y*.68-.87)*4.),3.);',
        'diffuseColor.rgb=mix(silver,reflected,.79)+vec3(.12,.14,.19)*gleam;'
      ].join('\n'));
  };
  glass.material=material;
  glass.geometry.computeBoundingBox();
  const center=glass.geometry.boundingBox.getCenter(new THREE.Vector3());
  let last=-Infinity;
  return (camera,time)=>{
    if (time-last<120) return;
    last=time;
    glass.updateWorldMatrix(true,false);
    point.copy(center).applyMatrix4(glass.matrixWorld).addScaledVector(normal,.006);
    plane.setFromNormalAndCoplanarPoint(normal,point);
    reflection.position.copy(camera.position)
      .addScaledVector(normal,-2*plane.distanceToPoint(camera.position));
    camera.getWorldDirection(direction).reflect(normal);
    reflectedUp.set(0,1,0).applyQuaternion(camera.quaternion).reflect(normal);
    reflection.up.copy(reflectedUp);
    reflection.lookAt(look.copy(reflection.position).add(direction));
    reflection.projectionMatrix.copy(camera.projectionMatrix);
    reflection.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflection.updateMatrixWorld();
    projection.multiplyMatrices(reflection.projectionMatrix,reflection.matrixWorldInverse);
    const previous=renderer.getRenderTarget(), planes=renderer.clippingPlanes;
    const shadows=renderer.shadowMap.autoUpdate;
    glass.visible=false;returnWall.visible=true;reflectedWindow.visible=true;
    renderer.clippingPlanes=clip;
    renderer.shadowMap.autoUpdate=false;
    try {
      renderer.setRenderTarget(target);
      renderer.render(scene,reflection);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.clippingPlanes=planes;
      renderer.shadowMap.autoUpdate=shadows;
      returnWall.visible=false;reflectedWindow.visible=false;glass.visible=true;
    }
  };
}

export function curtainFabric(group,side) {
  group.updateWorldMatrix(true,true);
  const direction=side==='left'?1:-1;
  const panels=[],ties=[];
  const world=new THREE.Vector3();
  const local=new THREE.Vector3();
  const bounds=new THREE.Box3();
  group.traverse(mesh=>{
    if (!mesh.isMesh) return;
    if (/^Curtain[_ ]tie/.test(mesh.name)) ties.push(mesh);
    if (!/^Linen[_ ]curtain/.test(mesh.name)) return;
    mesh.geometry=mesh.geometry.clone();
    mesh.geometry.boundingBox=null;
    const position=mesh.geometry.attributes.position;
    const source=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){
      world.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      world.toArray(source,i*3);
      bounds.expandByPoint(world);
    }
    position.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;
    panels.push({mesh,position,source,uv:mesh.geometry.attributes.uv,inverse:mesh.matrixWorld.clone().invert()});
  });
  const outer=side==='left'?bounds.min.x:bounds.max.x;
  const inner=side==='left'?bounds.max.x:bounds.min.x;
  const span=Math.max(.001,Math.abs(inner-outer));
  const travel=Math.max(.001,Math.abs(inner)+.025);
  let previous=NaN, previousTime=NaN, previousPull=NaN;
  function update(time,closure,pull=0,breeze=1) {
    if (previous===closure && previousTime===time && previousPull===pull) return;
    previous=closure;previousTime=time;previousPull=pull;
    for(const tie of ties) tie.visible=closure<.055;
    for (const {mesh,position,source,uv,inverse} of panels) {
      for (let i=0;i<position.count;i++) {
        const x=source[i*3],y=source[i*3+1],z=source[i*3+2];
        const u=THREE.MathUtils.clamp(uv ? uv.getX(i) : Math.abs(x-outer)/span,0,1);
        const drop=THREE.MathUtils.clamp((bounds.max.y-y)/(bounds.max.y-bounds.min.y),0,1);
        const ripple=(Math.sin(time*2.25-drop*5.0+u*8+direction)*.055
          +Math.sin(time*3.35+u*13-drop*3.1)*.024)*breeze;
        const loosen=Math.sin(u*8*Math.PI+drop*.60)*.036*closure;
        const foldedZ=-1.29+(z+1.29)*(1-.58*closure);
        const closedX=outer+direction*(Math.abs(outer)+.025)*u;
        const sidePull=(closedX-x)*closure+direction*pull*.043*drop*u;
        local.set(x+sidePull+drop*drop*ripple*.22*u,
          y+u*drop*Math.abs(pull)*.046,
          foldedZ+loosen+drop*drop*ripple*(1-.26*closure)).applyMatrix4(inverse);
        position.setXYZ(i,local.x,local.y,local.z);
      }
      position.needsUpdate=true;
      mesh.geometry.computeBoundingSphere();
    }
  }
  const previousViewer = time => update(time,0);
  return Object.assign(previousViewer,{update,bounds,outer,inner,travel,direction});
}
export function floatingDust(scene) {
  const count=108;
  const geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
  const spark=new Float32Array(count*3);
  const motes=[];
  let seed=547;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<count;i++){
    const col=i%9, row=Math.floor(i/9)%6, layer=Math.floor(i/54);
    motes.push({
      cx:-3.2+(col+.12+.76*random())*6.4/9,
      cy:.28+(row+.13+.74*random())*4.1/6,
      cz:-1.07+layer*2.45+random()*1.68,
      rx:.12+random()*.34, rz:.12+random()*.42,
      a:random()*Math.PI*2, speed:(i%2===0?1:-1)*(.29+random()*.42)
    });
    spark.set([random()*Math.PI*2,.72+random()*1.3,.39+random()*.61],i*3);
  }
  geometry.setAttribute('position',position);
  geometry.setAttribute('aSpark',new THREE.BufferAttribute(spark,3));
  const clock={value:0};
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:clock},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute vec3 aSpark;
      uniform float uTime;
      varying float vGlow;
      void main() {
        vec4 eye=modelViewMatrix*vec4(position,1.0);
        float depth=max(1.0,-eye.z);
        float pulse=pow(0.5+0.5*sin(uTime*aSpark.y+aSpark.x),6.0);
        vGlow=(0.14+0.80*pulse)*aSpark.z*smoothstep(0.75,2.15,depth);
        gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp((55.0+47.0*aSpark.z)/depth,7.0,27.0);
      }`,
    fragmentShader:`
      varying float vGlow;
      void main() {
        vec2 center=gl_PointCoord-vec2(0.5);
        float r2=dot(center,center);
        float haze=exp(-r2*25.0)*0.30;
        float core=exp(-r2*83.0)*0.78;
        float alpha=(haze+core)*vGlow*(1.0-smoothstep(0.064,0.245,r2));
        gl_FragColor=vec4(vec3(1.0),alpha);
      }`
  });
  const points=new THREE.Points(geometry,material);
  points.name='Three dimensional white motes';
  points.frustumCulled=false;
  points.raycast=()=>{};
  scene.add(points);
  return time=>{
    clock.value=time;
    for(let i=0;i<count;i++){
      const p=motes[i];
      const a=p.a+time*p.speed;
      position.setXYZ(i,p.cx+Math.cos(a)*p.rx,
        p.cy+Math.sin(a*.81+p.a)*.18+Math.sin(time*.22+p.a)*.075,
        p.cz+Math.sin(a)*p.rz);
    }
    position.needsUpdate=true;
  };
}
