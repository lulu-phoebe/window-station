import * as THREE from 'three';

// The flow lives in the tangent plane of each sampled point of the GLB.
// A soft tether keeps the mobile layer close to its original surface.
export function makeSurfaceCurrent(source, isolated) {
  const base = source.attributes.position;
  const centers = source.attributes.aStart;
  const normals = source.attributes.aNormal;
  const tags = source.attributes.aData;
  const colors = source.attributes.aTint;
  const selection = [];
  for (let i = 0; i < base.count; i++) {
    const petal = tags.getZ(i) === 0;
    if (isolated && (!petal || centers.getY(i) < 1 ||
      base.getX(i) < centers.getX(i)+.10 || base.getY(i) > centers.getY(i)+.25)) continue;
    if (tags.getW(i) > (petal ? .46 : .19)) continue;
    selection.push(i);
  }
  const count = selection.length;
  const home = new Float32Array(count*3);
  const positions = new Float32Array(home.length);
  const velocity = new Float32Array(home.length);
  const attributes = {
    aNormal: [3, normals], aStart: [3, centers], aTint: [3, colors], aData: [4, tags],
  };
  const geometry = new THREE.BufferGeometry();
  for (const [name, [size, original]] of Object.entries(attributes)) {
    const values = new Float32Array(count*size);
    for (let j = 0; j < count; j++) {
      const start = selection[j]*size;
      values.set(original.array.subarray(start,start+size), j*size);
    }
    geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
  }
  for (let j = 0; j < count; j++) {
    const start = selection[j]*3;
    home.set(base.array.subarray(start,start+3),j*3);
  }
  positions.set(home);
  const position = new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);
  const state = geometry.attributes.aData.array;
  const localNormals = geometry.attributes.aNormal.array;
  const localCenters = geometry.attributes.aStart.array;
  const tangentialX = new Float32Array(count), tangentialY = new Float32Array(count);
  const phases = new Float32Array(count);
  const release = new Float32Array(count);
  for (let j = 0; j < count; j++) {
    const i = j*3;
    const x = home[i]-localCenters[i], y = home[i+1]-localCenters[i+1];
    const length = Math.max(.045,Math.hypot(x,y));
    tangentialX[j] = x/length;
    tangentialY[j] = y/length;
    phases[j] = home[i]*4.9+home[i+1]*5.6+home[i+2]*7.2;
    release[j] = state[j*4+3] < .105 ? 1 : 0;
  }
  const step = 1/60;
  let integrated = 0;
  function update(time) {
    if (time < integrated-step || time-integrated > 2) {
      positions.set(home);
      velocity.fill(0);
      integrated = Math.max(0,time-1.8);
      position.needsUpdate = true;
    }
    if (integrated+step > time+1e-6) return;
    while (integrated+step <= time+1e-6) {
      integrated += step;
      for (let j = 0; j < count; j++) {
        const i = j*3;
        const petal = state[j*4+2] === 0;
        const radius = state[j*4];
        const front = Math.sin(phases[j]-integrated*2.9);
        const curl = Math.cos(phases[j]*.63-integrated*2.1);
        const envelope = petal ? .17+.83*radius : .30;
        const force = Math.max(0,front+.24)*envelope*(4.1+3.4*release[j]);
        const nx = localNormals[i], ny = localNormals[i+1], nz = localNormals[i+2];
        const rx = tangentialX[j], ry = tangentialY[j];
        const x = (rx*.77-ry*curl*.72)*force;
        const y = (ry*.77+rx*curl*.72)*force;
        const z = curl*.27*force;
        const normalForce = x*nx+y*ny+z*nz;
        const lift = (petal ? .055+.31*radius*release[j] : .035)*force*Math.max(0,curl);
        const returnForce = 15-5.5*release[j];
        velocity[i] = .916*velocity[i] + step*(x-nx*(normalForce-lift) - (positions[i]-home[i])*returnForce);
        velocity[i+1] = .916*velocity[i+1] + step*(y-ny*(normalForce-lift) - (positions[i+1]-home[i+1])*returnForce);
        velocity[i+2] = .916*velocity[i+2] + step*(z-nz*(normalForce-lift) - (positions[i+2]-home[i+2])*returnForce);
        positions[i] += velocity[i]*step;
        positions[i+1] += velocity[i+1]*step;
        positions[i+2] += velocity[i+2]*step;
      }
    }
    position.needsUpdate = true;
  }
  return { geometry, update };
}
