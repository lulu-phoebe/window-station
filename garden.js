import * as THREE from './three.module.js';

function leafGeometry() {
  const outline = [[0,-.47],[-.19,-.25],[-.25,.02],[-.17,.31],[0,.49],[.17,.26],[.24,.03],[.17,-.25]];
  const points = [0,0,.065];
  for (const [x,y] of outline) points.push(x,y,.018*Math.sin(y*5));
  const indices = [];
  for (let index=1;index<=8;index++) indices.push(0,index,index===8?1:index+1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function gardenBreeze(scene) {
  let seed=92;
  function random() {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  }
  const material = new THREE.MeshStandardMaterial({color:'#f7f8e1',roughness:.87,side:THREE.DoubleSide});
  const leaves = new THREE.InstancedMesh(leafGeometry(),material,170);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.frustumCulled=false;
  leaves.castShadow=true;
  scene.add(leaves);
  const state=[];
  const color=new THREE.Color();
  const palette=['#758959','#838e54','#a3a971','#5e754d','#a1a469','#c2ba78'];
  const sprigs=[
    [-2.52,3.52,-1.60,1.03,-.31],
    [-1.81,4.15,-1.59,1.15,-.29],
    [.71,4.20,-1.61,1.4,-.34],
    [2.60,3.76,-1.59,-1.05,-.47],
    [2.42,2.63,-1.60,-.78,.42]
  ];
  const branches=[];
  const bark=new THREE.MeshStandardMaterial({color:'#6b6449',roughness:.91});
  for (const [x,y,z,dx,dy] of sprigs) {
    const origin=new THREE.Vector3(x,y,z);
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(),new THREE.Vector3(dx*.40,dy*.05,0),new THREE.Vector3(dx,dy,-.02));
    const branch=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.009,5,false),bark);
    branch.position.copy(origin);
    branch.castShadow=true;
    scene.add(branch);
    branches.push({branch,origin});
    for (let j=0;j<34;j++) {
      const progress=.16+(j/33)*.85;
      const p=curve.getPoint(Math.min(1,progress));
      const side=j%2===0?1:-1;
      state.push({
        branch:branches.length-1,
        x:p.x+(random()-.5)*.28,
        y:p.y+side*(.025+random()*.17),
        z:p.z+random()*.041,
        size:.075+random()*.105,
        angle:side*(.42+random()*1.30),
        phase:random()*Math.PI*2,
        factor:random()*.8+.5
      });
      leaves.setColorAt(state.length-1,color.set(palette[Math.floor(random()*palette.length)]));
    }
  }
  const dummy=new THREE.Object3D();
  const sway=new Float32Array(branches.length);
  function update(time) {
    for (let i=0;i<branches.length;i++) {
      sway[i]=Math.sin(time*1.08+i*.87)*.065+Math.sin(time*2.17+i*.47)*.021;
      branches[i].branch.rotation.z=sway[i];
    }
    for (let i=0;i<state.length;i++) {
      const leaf=state[i];
      const a=sway[leaf.branch];
      const base=branches[leaf.branch].origin;
      const v=Math.sin(time*2.5*leaf.factor+leaf.phase);
      const c=Math.cos(a),s=Math.sin(a);
      dummy.position.set(base.x+leaf.x*c-leaf.y*s,base.y+leaf.x*s+leaf.y*c+v*.008,base.z+leaf.z);
      dummy.rotation.set(v*.20,.4*v,leaf.angle+a+v*.11);
      dummy.scale.set(leaf.size,leaf.size,leaf.size);
      dummy.updateMatrix();
      leaves.setMatrixAt(i,dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate=true;
  }
  update(0);
  function choose(name) {
    leaves.visible=name!=='winter';
    leaves.castShadow=name!=='winter';
    const colors=name==='autumn' ? ['#9a4b28','#ba793d','#bd9b42','#836742'] : palette;
    for (let i=0;i<state.length;i++) leaves.setColorAt(i,color.set(colors[i%colors.length]));
    leaves.instanceColor.needsUpdate=true;
  }
  return {update,choose};
}
