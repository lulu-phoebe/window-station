import * as THREE from './three.module.js';

export const seasons = {
  spring:{tile:[0,1], light:'#ffe3ce', strength:1.96, count:37, speed:.31, size:.070, shades:['#eeb5b9','#ffe0db','#f6bec4']},
  summer:{tile:[1,1], light:'#ffe1b5', strength:2.25, count:13, speed:.38, size:.110, shades:['#719346','#9eae59','#526e39']},
  autumn:{tile:[0,0], light:'#ffd9a4', strength:2.03, count:29, speed:.49, size:.113, shades:['#aa4c2b','#d77c31','#ebbe54','#c56332']},
  winter:{tile:[1,0], light:'#e7efff', strength:1.38, count:96, speed:.24, size:.028, shades:['#ffffff','#f3f7ff','#e8eff8']}
};

function shapeOf(outline) {
  return new THREE.ShapeGeometry(new THREE.Shape(outline.map(p=>new THREE.Vector2(...p))));
}
const petal=[[-.06,-.50],[-.27,-.31],[-.35,-.08],[-.30,.23],[-.15,.41],[-.03,.29],[.08,.43],[.23,.35],[.34,.13],[.30,-.17],[.17,-.34]];
const leaf=[[-.05,-.52],[-.20,-.28],[-.29,-.03],[-.22,.22],[0,.51],[.23,.24],[.28,-.02],[.18,-.27]];
const maple=[[0,-.53],[-.04,-.28],[-.37,-.24],[-.29,-.13],[-.53,.06],[-.31,.13],[-.34,.33],[-.13,.21],[0,.53],[.12,.23],[.33,.34],[.27,.13],[.53,.06],[.27,-.11],[.32,-.23],[.06,-.28]];
const ginkgo=[[0,-.50],[-.046,-.26],[-.31,-.13],[-.50,.12],[-.43,.28],[-.30,.36],[-.13,.39],[0,.31],[.10,.39],[.30,.35],[.45,.24],[.50,.08],[.30,-.15],[.06,-.26]];

export function seasonalParticles(scene) {
  const material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.86,depthWrite:false});
  const shapes=new Map([
    ['spring',[shapeOf(petal)]],['summer',[shapeOf(leaf)]],
    ['autumn',[shapeOf(maple),shapeOf(ginkgo)]],['winter',[new THREE.CircleGeometry(.42,7)]]
  ]);
  const sprites=[];
  const pose=new THREE.Object3D();
  const color=new THREE.Color();
  let state=[], setting=seasons.summer, current;
  function choose(name) {
    if (current===name) return;
    current=name; setting=seasons[name];
    for (const sprite of sprites) { scene.remove(sprite); sprite.dispose(); }
    sprites.length=0;
    const geometry=shapes.get(name);
    const count=Math.ceil(setting.count/geometry.length);
    for (const shape of geometry) {
      const mesh=new THREE.InstancedMesh(shape,material,count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false;
      mesh.raycast=()=>{};
      scene.add(mesh);sprites.push(mesh);
    }
    let seed=431;
    const next=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    state=Array.from({length:count*geometry.length},(_,i)=>{
      sprites[i%geometry.length].setColorAt(Math.floor(i/geometry.length),color.set(setting.shades[i%setting.shades.length]));
      return {x:next()*5.25-2.625,y:next()*3.8,z:-1.74-next()*.63, phase:next()*6.28, fall:.55+next()*.95, size:.56+next()*.80};
    });
  }
  function update(t) {
    const winter=current==='winter';
    const drift=winter?.12:current==='summer'?.32:.21;
    for (let i=0;i<state.length;i++) {
      const p=state[i];
      const sway=Math.sin(p.phase+t*(winter?.85:1.34));
      const horizontal=p.x + drift*t*p.fall + sway*(winter?.09:.22);
      const drop=((p.y+t*setting.speed*p.fall+(winter?.016:.055)*sway)%3.8+3.8)%3.8;
      pose.position.set(((horizontal+2.65)%5.3+5.3)%5.3-2.65,4.65-drop,p.z);
      pose.rotation.set(winter?0:t*.95+p.phase,winter?0:Math.sin(t*.87+p.phase)*1.23,p.phase+sway*.7+t*(winter?.1:.47));
      const scale=p.size*setting.size;
      pose.scale.setScalar(scale);
      pose.updateMatrix();
      sprites[i%sprites.length].setMatrixAt(Math.floor(i/sprites.length),pose.matrix);
    }
    for (const sprite of sprites) sprite.instanceMatrix.needsUpdate=true;
  }
  return {choose,update};
}

export function seasonalBackdrop(scene,atlas) {
  atlas.colorSpace=THREE.SRGBColorSpace;
  atlas.anisotropy=4;
  const selection={value:new THREE.Vector2(1,1)};

  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide, color:'#ffffff'});
  material.customProgramCacheKey=()=> 'garden-atlas-static-v1';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uGarden:{value:atlas},uGardenTile:selection});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vGardenWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGardenWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vGardenWorld;\nuniform sampler2D uGarden;\nuniform vec2 uGardenTile;')
      .replace('#include <map_fragment>', [
        'vec2 localGarden=vec2((vGardenWorld.x+3.15)/6.30,(vGardenWorld.y-1.0)/3.75);',
        'vec2 atlasUV=(clamp(localGarden,vec2(.008),vec2(.992))+uGardenTile)*.5;',
        'diffuseColor.rgb*=texture2D(uGarden,atlasUV).rgb;'
      ].join('\n'));
  };
  const background=new THREE.Mesh(new THREE.PlaneGeometry(7.5,4.55),material);
  background.position.set(0,2.92,-2.49);
  background.raycast=()=>{};
  scene.traverse(object=>{
    if (/^Garden[_ ]view/.test(object.name)) {
      object.visible=false;
      object.raycast=()=>{};
    }
  });
  scene.add(background);
  return {choose(name){selection.value.set(...seasons[name].tile);}};
}
