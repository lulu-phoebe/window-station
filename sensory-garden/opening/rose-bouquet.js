import * as T from './three.module.js';

// Reference bouquet only. It owns no camera, light, water or chair objects.
export function buildRoseBouquet(flowers,petalG,petalMats){
 flowers.clear();let seed=8251;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const stemMat=new T.MeshStandardMaterial({color:'#4a5030',roughness:.73});
 const twigMat=new T.MeshStandardMaterial({color:'#5c4229',roughness:.76});
 const leafMat=new T.MeshPhysicalMaterial({color:'#395d19',roughness:.31,clearcoat:.65,clearcoatRoughness:.22,side:T.DoubleSide});
 const leafGroups=[],bloomBounds=[],stemPaths=[];
 const veinMat=new T.MeshStandardMaterial({color:'#69813a',roughness:.5});
 function tube(points,r,material=stemMat,parent=flowers){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const o=new T.Mesh(new T.TubeGeometry(curve,Math.max(10,points.length*10),r,7,false),material);parent.add(o);o.castShadow=true;if(parent===flowers)stemPaths.push({mesh:o,curve,r,material});return curve;}
 const leafG=new T.BufferGeometry(),verts=[],uv=[],indices=[],rows=36,cols=8;
 for(let j=0;j<=rows;j++){const t=j/rows,w=Math.pow(Math.sin(Math.PI*t),.77)*(.94+.06*Math.cos(t*Math.PI*24));for(let i=0;i<=cols;i++){const u=i/cols*2-1;verts.push(u*w*.30,t,.10*Math.sin(t*Math.PI)-.095*Math.abs(u)*Math.sin(t*Math.PI)+.025*u*u*Math.sin(t*17));uv.push(i/cols,t);}}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;indices.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}
 leafG.setAttribute('position',new T.Float32BufferAttribute(verts,3));leafG.setAttribute('uv',new T.Float32BufferAttribute(uv,2));leafG.setIndex(indices);leafG.computeVertexNormals();
 function leaf(at,angle,length=.36,tilt=0){const group=new T.Object3D();group.position.fromArray(at);group.rotation.set(tilt,.15+rand()*.6,angle);group.scale.setScalar(length);flowers.add(group);leafGroups.push(group);const blade=new T.Mesh(leafG,leafMat);blade.castShadow=true;blade.receiveShadow=true;group.add(blade);
  tube([[0,0,.006],[0,.45,.105],[0,1,.012]],.012,veinMat,group);
  for(let j=0;j<5;j++){const t=.17+j*.13;for(const side of [-1,1]){const e=t+.15,w=Math.pow(Math.sin(Math.PI*e),.77)*.28;tube([[0,t,.10*Math.sin(t*Math.PI)+.008],[side*w*.5,t+.08,.10*Math.sin((t+.08)*Math.PI)-.025],[side*w,e,.10*Math.sin(e*Math.PI)-.065]],.005,veinMat,group);}}
 }
 function branch(points,count=6){const c=tube(points,.014,twigMat);tube(points.map(([x,y,z])=>[x+.006,y,z+.005]),.006,stemMat);
  for(let j=1;j<count;j++){const t=j/count,p=c.getPoint(t),side=j%2?1:-1;const end=p.clone().add(new T.Vector3(side*(.12+rand()*.08),.035,.035));tube([p.toArray(),end.toArray()],.005);leaf(end.toArray(),-side*(.65+rand()*.45),.29+rand()*.13,(rand()-.5)*.6);
   // Curved, broad-based prickles are attached after the stem paths are cleared.
  }
 }
 const dewG=new T.SphereGeometry(1,8,6),dewMat=new T.MeshPhysicalMaterial({color:'#e6efff',roughness:.035,metalness:.05,clearcoat:1,transparent:true,opacity:.75,ior:1.333}),glintMat=new T.MeshBasicMaterial({color:'#fff5ee',toneMapped:false});
 const dummy=new T.Object3D();
 // Independent cup petals: broad outer lips, erect inner walls, rolled rim and tight core.
 // Each petal has its own curvature; they are not scaled copies of flat radial fans.
 const roseMaterials=['#d50018','#e3081c','#bf0013','#ec1026','#cc0015'].map(color=>{
  const m=new T.MeshPhysicalMaterial({color,roughness:.65,metalness:0,clearcoat:.04,emissive:color,emissiveIntensity:.12,side:T.DoubleSide});
  m.defines={USE_UV:''};m.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float velvet=.64+.36*smoothstep(.02,.78,vUv.y);
    float micro=.985+.015*sin(vUv.x*180.+sin(vUv.y*35.))*sin(vUv.y*210.);
    diffuseColor.rgb*=velvet*micro;`);
  };return m;
 });
 function petalShape(layer,index,count,bud){
  const nx=30,ny=30,positions=[],uv=[],ix=[];
  const R=Math.pow(.86,layer),height=.26+.28*(1.-Math.pow(.73,layer))+.035*Math.sin(index*2.3+layer);
  const phase=index*2.13+layer*1.7;
  const span=Math.PI/count*(1.42+.10*Math.sin(phase));
  for(let j=0;j<=ny;j++){const t=j/ny;
   for(let i=0;i<=nx;i++){const u=i/nx*2-1;
    const angular=u*span*Math.pow(t,.46)+.10*t*t*Math.sin(phase);
    const cup=1.-Math.pow(1.-t,1.55);
    const gather=Math.max(0.,Math.min(1.,(t-.62)/.38));
    const inward=gather*gather*(3.-2.*gather);
    const curl=Math.max(0.,(t-.80)/.20);
    let rad=R*(.05+.95*cup)*(1.-.24*inward)*(1.-.23*u*u*t)+R*.028*Math.sin(curl*Math.PI*.65);
    // Alternate tapered tips, broad arcs and slightly notched asymmetric lips.
    const mode=(index+layer)%3,off=.18*Math.sin(phase);
    const tip=mode===0?Math.pow(Math.max(0.,1.-Math.abs(u-off)),2.8):mode===1?.55*Math.cos((u-off)*Math.PI*.8):.45*Math.cos(u*4.+phase);
    rad+=R*.055*tip*Math.pow(t,9.);
    let z=-.38*(1.-t)+height*Math.pow(t,.70)-.07*u*u*t+R*.035*tip*Math.pow(t,8.);
    // The lip folds outward and softly undulates instead of ending in a rigid ring.
    z-=R*.025*curl*curl;
    z+=R*.025*Math.sin(u*11.+phase)*Math.pow(t,8);
    z+=R*.045*Math.sin(u*2.4+phase)*Math.sin(Math.PI*t);
    rad+=R*.035*Math.sin(u*3.1+phase)*Math.sin(Math.PI*t);
    const taper=bud?.46:1.;positions.push(Math.sin(angular)*rad*taper,Math.cos(angular)*rad*taper,z*(bud?1.22:1.));uv.push(i/nx,t);
   }
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const n=j*(nx+1)+i;ix.push(n,n+1,n+nx+2,n,n+nx+2,n+nx+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
 }
 function rose(at,size,tilt=0,turn=0,bud=false){
  const f=new T.Group();f.position.fromArray(at);f.rotation.set(tilt,turn,rand()*6.28);flowers.add(f);bloomBounds.push({group:f,size});
  const drops=[],layers=bud?7:14;
  const heart=new T.Mesh(new T.SphereGeometry(1,20,14),roseMaterials[2]);heart.scale.set(size*.065,size*.065,size*.11);heart.position.z=size*.53;f.add(heart);
  for(let layer=0;layer<layers;layer++){
   const count=bud?3:layer<2?5:layer<5?6:layer<8?5:layer<11?4:3;
   for(let i=0;i<count;i++){
    const geometry=petalShape(layer,i,count,bud),o=new T.Mesh(geometry,roseMaterials[(i+layer)%5]);
    o.userData.rosePetal=true;o.scale.setScalar(size);
    o.rotation.z=i/count*Math.PI*2+layer*2.399+(rand()-.5)*.09;
    o.rotation.x=(rand()-.5)*.10;o.position.z=0;f.add(o);o.updateMatrix();
    for(let k=0;k<2;k++){
     const index=(19+Math.floor(rand()*10))*31+5+Math.floor(rand()*20);
     const point=new T.Vector3().fromBufferAttribute(geometry.attributes.position,index);
     const normal=new T.Vector3().fromBufferAttribute(geometry.attributes.normal,index);
     point.addScaledVector(normal,.012).applyMatrix4(o.matrix);
     drops.push({point,r:size*(.012+rand()*.018)});
    }
   }
  }
  // Receptacle and swept sepals give the flower a volumetric rear silhouette.
  const calyx=new T.Mesh(new T.SphereGeometry(1,20,14),stemMat);
  calyx.scale.set(size*.25,size*.25,size*.23);calyx.position.z=-size*.36;f.add(calyx);
  for(let i=0;i<5;i++){
   const a=i/5*Math.PI*2,sepal=new T.Mesh(leafG,leafMat);
   sepal.scale.set(size*.35,size*.92,size*.60);sepal.rotation.set(-.38,0,a);sepal.position.z=-size*.34;f.add(sepal);
  }
  const dew=new T.InstancedMesh(dewG,dewMat,drops.length),shine=new T.InstancedMesh(dewG,glintMat,Math.ceil(drops.length/7));f.add(dew,shine);let si=0;
  drops.forEach(({point,r},i)=>{dummy.position.copy(point);dummy.scale.set(r,r,r*.80);dummy.updateMatrix();dew.setMatrixAt(i,dummy.matrix);if(i%7===0){dummy.position.z+=r*.7;dummy.scale.setScalar(r*.12);dummy.updateMatrix();shine.setMatrixAt(si++,dummy.matrix);}});
  return f;
 }
 // Asymmetric garland: upper-left cluster, airy arch, seat-right cluster, pendant tail.
 branch([[-.78,3.82,-.40],[-1.02,3.32,-.29],[-.93,2.70,-.04],[-.86,2.18,.55]],8);
 branch([[-.80,3.80,-.42],[-.10,4.01,-.53],[.55,3.94,-.50],[1.05,3.64,-.44]],7);
 branch([[-.93,2.80,-.05],[-.65,2.51,.12],[-.20,2.30,.57],[.40,2.20,.91],[1.03,2.16,1.02]],7);
 branch([[.75,2.20,1.04],[.48,1.83,1.23],[.53,1.34,1.27],[.32,.82,1.28],[.47,.26,1.22]],9);
 branch([[.75,2.19,1.03],[1.14,2.22,1.03],[1.43,2.14,1.02]],3);
 rose([-.65,3.77,-.25],.35,-.20,-.28);
 rose([-1.03,3.30,-.13],.27,.26,.42);
 rose([-1.14,2.77,.05],.24,.50,-.58);
 rose([-.69,2.74,.10],.255,-.18,.30);
 rose([.30,2.25,1.03],.27,-.34,-.40);
 rose([.91,2.28,1.04],.355,-.12,.20);
 rose([.61,1.54,1.31],.245,.70,-.45);
 rose([.35,.86,1.34],.24,.44,.48);
 rose([.06,3.89,-.39],.145,.40,.3,true);
 rose([1.43,2.17,1.06],.13,.35,-.35,true);
 rose([.63,.45,1.26],.12,.55,.1,true);
 // Resolve visible leaf blades against flower volumes and fixed chair surfaces.
 // Test actual blade vertices after placement; do not merely move the leaf root.
 flowers.updateMatrixWorld(true);
 const inverse=new T.Matrix4(),v=new T.Vector3();
 const leafCollision=group=>{
  group.updateWorldMatrix(true,true);const blade=group.children[0],attr=leafG.attributes.position;
  for(let n=0;n<attr.count;n+=3){v.fromBufferAttribute(attr,n).applyMatrix4(blade.matrixWorld);
   const local=flowers.worldToLocal(v.clone());
   if(local.x> -1.08&&local.x<1.08&&local.z>-.88&&local.z<1.03&&local.y>1.76&&local.y<2.04)return true;
   if(Math.abs(local.x)<1.02&&local.y>2.50&&local.y<3.82&&local.z>-.89&&local.z<-.59)return true;
   for(const b of bloomBounds){inverse.copy(b.group.matrixWorld).invert();const q=v.clone().applyMatrix4(inverse),r=b.size*1.06;
    if(q.x*q.x+q.y*q.y<r*r&&q.z> -b.size*.49&&q.z<b.size*.80)return true;
   }
  }return false;
 };
 for(const group of leafGroups){const origin=group.position.clone(),rotation=group.rotation.z;let clear=!leafCollision(group);
  for(const offset of [.35,-.35,.70,-.70,1.05,-1.05]){if(clear)break;group.rotation.z=rotation+offset;clear=!leafCollision(group);}
  for(const shift of [.12,.24,.36]){if(clear)break;group.rotation.z=rotation;const nearest=bloomBounds.reduce((a,b)=>origin.distanceToSquared(b.group.position)<origin.distanceToSquared(a.group.position)?b:a);
   const away=origin.clone().sub(nearest.group.position);away.z=0;if(away.lengthSq()<.001)away.set(1,0,0);away.normalize();group.position.copy(origin).addScaledVector(away,shift);clear=!leafCollision(group);
  }
  group.visible=clear;
  if(clear&&origin.distanceToSquared(group.position)>.0001){const middle=origin.clone().lerp(group.position,.5);middle.y+=.025;tube([origin.toArray(),middle.toArray(),group.position.toArray()],.0045,stemMat);}
 }

 // Connect each differently oriented flower at its receptacle, not through its face.
 flowers.updateMatrixWorld(true);
 const parentInverse=flowers.matrixWorld.clone().invert(),pathPoint=new T.Vector3();
 const principal=stemPaths.filter(s=>s.r>=.012);
 for(const bloom of bloomBounds){
  const neck=new T.Vector3(0,0,-bloom.size*.56).applyMatrix4(bloom.group.matrixWorld).applyMatrix4(parentInverse);
  let nearest=null,distance=Infinity;
  for(const path of principal)for(let j=0;j<=80;j++){const point=path.curve.getPoint(j/80),d=point.distanceToSquared(neck);if(d<distance){distance=d;nearest=point;}}
  if(nearest&&distance>.0004){const middle=nearest.clone().lerp(neck,.5);middle.z-=.035;tube([nearest.toArray(),middle.toArray(),neck.toArray()],.009,stemMat);}
 }
 const routed=[];
 for(const path of stemPaths){
  const points=[];
  for(let j=0;j<=120;j++){
   const p=path.curve.getPoint(j/120);
   // A stem may enter a calyx from the rear, but must not cross the petal cup.
   for(let iteration=0;iteration<3;iteration++)for(const bloom of bloomBounds){
    const q=p.clone().applyMatrix4(flowers.matrixWorld).applyMatrix4(bloom.group.matrixWorld.clone().invert());
    const r=bloom.size*1.07,xy=Math.hypot(q.x,q.y);
    if(xy<r*1.5&&q.z> -bloom.size*.61-path.r&&q.z<bloom.size*.82){
     const u=T.MathUtils.clamp((r*1.5-xy)/(r*.5),0,1),blend=u*u*(3-2*u);
     q.z=T.MathUtils.lerp(q.z,-bloom.size*.63-path.r-.012,blend);
     p.copy(q.applyMatrix4(bloom.group.matrixWorld).applyMatrix4(parentInverse));
    }
   }
   // Keep stem cylinders outside the seat and backrest, with a clearance margin.
   if(p.x> -1.11&&p.x<1.11&&p.y>1.73&&p.y<2.03&&p.z>-.94&&p.z<1.08)p.z=1.10;
   if(Math.abs(p.x)<1.02&&p.y>2.5&&p.y<3.84&&p.z>-.92&&p.z<-.56)p.z=-.53;
   for(const group of leafGroups){if(!group.visible)continue;
    const q=p.clone().applyMatrix4(flowers.matrixWorld).applyMatrix4(group.matrixWorld.clone().invert());
    const half=.32*Math.pow(Math.max(0.,Math.sin(q.y*Math.PI)),.77);
    if(q.y>.06&&q.y<.97&&Math.abs(q.x)<half&&q.z>-.07&&q.z<.14){q.z=-.09;p.copy(q.applyMatrix4(group.matrixWorld).applyMatrix4(parentInverse));}
   }
   points.push(p);
  }
  // Linear interpolation avoids a smoothed spline swinging back through a cleared surface.
  const curve=new T.Curve();curve.getPoint=(t,target=new T.Vector3())=>{const at=T.MathUtils.clamp(t,0,1)*120,index=Math.min(119,Math.floor(at));return target.copy(points[index]).lerp(points[index+1],at-index);};
  path.mesh.geometry.dispose();path.mesh.geometry=new T.TubeGeometry(curve,240,path.r,7,false);
  if(path.r>=.012)routed.push(curve);
 }
 // Tapered hook-shaped rose prickles, seated in the rerouted woody stem.
 const thornMat=new T.MeshStandardMaterial({color:'#70502f',roughness:.58});
 function hookThorn(){const positions=[],indices=[],rings=10,sides=7;
  for(let j=0;j<=rings;j++){const t=j/rings,r=.022*Math.pow(1-t,1.25)+.00015;
   for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;positions.push(Math.cos(a)*r,.095*t,.040*t*t+Math.sin(a)*r);}}
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const thornG=hookThorn(),up=new T.Vector3(0,1,0);
 for(const curve of routed)for(let i=1;i<12;i++){
  const t=i/12,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
  const radial=new T.Vector3(i%2?1:-1,.05,.50).addScaledVector(tangent,-new T.Vector3(i%2?1:-1,.05,.50).dot(tangent)).normalize();
  const thorn=new T.Mesh(thornG,thornMat);thorn.position.copy(p).addScaledVector(radial,.010);thorn.quaternion.setFromUnitVectors(up,radial);thorn.scale.setScalar(.75+.25*Math.sin(i*2.1));flowers.add(thorn);
 }
 flowers.userData.bouquetClearance='stem-routes/calyx-rear/seat/back/leaves';
 flowers.updateMatrixWorld(true);

}
