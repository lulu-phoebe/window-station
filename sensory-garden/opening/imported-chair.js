import * as T from './three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export async function replaceOpeningModel({scene,root,chair,flowers,petalGeometry,renderer}){
 const status=document.createElement('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 Object.assign(status.style,{position:'fixed',inset:'0',display:'grid',placeContent:'center',background:'#060812',color:'#c6c8e1',font:'300 14px/1.8 sans-serif',letterSpacing:'.12em',zIndex:'30'});
 status.textContent='正在准备玫瑰椅子…';document.body.appendChild(status);
 try{
  const loader=new GLTFLoader();
  const [gltf,redVertices]=await Promise.all([
   loader.loadAsync('./assets/rose-chair.glb',event=>{if(event.total)status.textContent=`正在准备玫瑰椅子 · ${Math.min(99,Math.round(event.loaded/event.total*100))}%`;}),
   fetch('./assets/rose-surface.json').then(r=>{if(!r.ok)throw new Error('Rose surface map unavailable');return r.json();})
  ]);
  const model=gltf.scene;model.name='Imported rose chair';model.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),centre=bounds.getCenter(new T.Vector3());
  if(!Number.isFinite(size.y)||size.y<.01)throw new Error('Invalid model bounds');
  const scale=4.05/size.y;model.scale.setScalar(scale);model.position.set(-centre.x*scale,.035-bounds.min.y*scale,-centre.z*scale);root.add(model);model.updateMatrixWorld(true);
  const meshes=[];model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.side=T.DoubleSide;
   // Isolate red petals in texture colour; preserve wood and green foliage.
   o.material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float roseMask=smoothstep(1.8,3.0,diffuseColor.r/max(.002,diffuseColor.g))*smoothstep(1.4,2.4,diffuseColor.r/max(.002,diffuseColor.b))*smoothstep(.035,.13,diffuseColor.r);
     vec3 vividRose=vec3(min(1.,diffuseColor.r*1.72+.025),diffuseColor.g*.88,diffuseColor.b*.91);
     diffuseColor.rgb=mix(diffuseColor.rgb,vividRose,roseMask);
    `);
    // Lift only the red-petal shadow floor, weighted by texture detail so folds remain dark.
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
     totalEmissiveRadiance+=roseMask*diffuseColor.rgb*.23;
    `);
   };
   o.material.customProgramCacheKey=()=> 'vivid-red-rose-v2';meshes.push(o);}});
  // The GLB is one merged mesh. Bind invisible emission proxies to its exact red-textured vertices.
  // Proxies never replace the visible model or fabricate independent emission positions.
  flowers.clear();flowers.rotation.set(0,0,0);flowers.updateMatrixWorld(true);
  const parentInverse=flowers.matrixWorld.clone().invert();
  for(const mesh of meshes){
   const indices=redVertices.filter(i=>Number.isInteger(i)&&i>=0&&i<mesh.geometry.attributes.position.count);
   if(!indices.length)continue;
   const bloom=new T.Group();bloom.userData.rigidSource=true;flowers.add(bloom);
   const proxy=new T.Mesh(mesh.geometry,new T.MeshBasicMaterial({visible:false}));proxy.matrixAutoUpdate=false;
   proxy.matrix.multiplyMatrices(parentInverse,mesh.matrixWorld);proxy.userData.rosePetal=true;proxy.userData.emitterIndices=indices;proxy.userData.fallGeometry=petalGeometry;bloom.add(proxy);
  }
  if(!flowers.children.length)throw new Error('Model has no mapped rose surfaces');
  chair.visible=false;
  // The merged model is rigid, so its expensive shadow maps can be cached.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  scene.userData.importedChair={vertices:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),height:4.05,redSurfacePoints:redVertices.length};
  // Compile the supplied material before the opening animation begins.
  await renderer.compileAsync(scene,new T.PerspectiveCamera(34,innerWidth/innerHeight,.1,100));
  status.remove();return model;
 }catch(error){
  console.error('Supplied chair model could not be loaded',error);status.textContent='模型暂未载入，请刷新重试。';status.style.background='rgba(6,8,18,.88)';
  throw error;
 }
}
