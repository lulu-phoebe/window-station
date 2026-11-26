import * as THREE from 'three';
import { modelSamples } from './model-samples.js';

export function makeModelRose() {
  const bytes = Uint8Array.from(atob(modelSamples), char => char.charCodeAt(0));
  const samples = new Int16Array(bytes.buffer);
  const positions = [], origins = [], normals = [], data = [], tint = [], rim = [];
  const heads = [
    [.058, .985, -.067, -.150, .873, .464],
    [-.180, .706, -.055, -.358, .797, .486],
    [.073, .461, .165, -.110, .815, .569],
  ].map(([x,y,z,nx,ny,nz]) => ({
    center: new THREE.Vector3(x*3.15,(y-.55)*3.15,z*3.15),
    rotation: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(nx,ny,nz).normalize(), new THREE.Vector3(0,0,1),
    ),
  }));
  const point = new THREE.Vector3(), normal = new THREE.Vector3();
  const decode = 1.11 / 32767;
  for (let i = 0; i < samples.length; i += 9) {
    const x = samples[i]*decode*3.15;
    const height = -samples[i+2]*decode;
    const y = (height-.55)*3.15;
    const z = samples[i+1]*decode*3.15;
    const red = samples[i+6]*decode;
    const green = samples[i+7]*decode;
    const blue = samples[i+8]*decode;
    const flower = red > green*1.23 && red > blue*1.32;
    const head = heads[height > .85 ? 0 : height > .60 ? 1 : 2];
    const { center } = head;
    point.set(x,y,z);
    normal.set(samples[i+3]*decode,-samples[i+5]*decode,samples[i+4]*decode);
    if (flower) {
      point.sub(center).applyQuaternion(head.rotation).add(center);
      normal.applyQuaternion(head.rotation);
    }
    const radius = Math.min(1, Math.hypot(point.x-center.x,point.y-center.y)/.49);
    const seed = ((Math.imul(i+31, 2654435761) >>> 0) / 4294967296);
    positions.push(point.x,point.y,point.z);
    normals.push(normal.x,normal.y,normal.z);
    origins.push(center.x, center.y, center.z);
    tint.push(red,green,blue);
    data.push(flower ? radius : 1-height, 0, flower ? 0 : 2, seed);
    if (flower && radius > .55 && i % 450 === 0) {
      rim.push(point.clone());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(origins,3));
  geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(tint,3));
  geometry.setAttribute('aData', new THREE.Float32BufferAttribute(data,4));
  return { geometry, rim, center: heads[0].center };
}
