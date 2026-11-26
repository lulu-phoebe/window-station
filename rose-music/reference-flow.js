import * as THREE from 'three';
import { flowAtlas } from './reference-flow-data.js';

export function makeReferenceFlowUniforms() {
  const { width, height, columns, tileWidth, tileHeight, frames, fps, pixels } = flowAtlas;
  const bytes = Uint8Array.from(atob(pixels), char => char.charCodeAt(0));
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return {
    uFlow: { value: texture },
    uAtlasSize: { value: new THREE.Vector2(width, height) },
    uFlowTile: { value: new THREE.Vector2(tileWidth, tileHeight) },
    uFlowTiming: { value: new THREE.Vector3(columns, frames, fps) },
  };
}
