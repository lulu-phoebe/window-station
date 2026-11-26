import * as THREE from 'three';
import { roseImage } from './rose-reference-image.js';
import { config } from './config.js';

// Normalized positions of the three flower centers in the supplied image.
export const roseCenters = [[.505, .149], [.242, .446], [.700, .660]];

export async function makeReferenceRoses() {
  const image = new Image();
  image.src = roseImage;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const scale = 3.65;
  const aspect = canvas.width / canvas.height;
  const toScene = (x, y, z) => new THREE.Vector3((x-.5)*scale*aspect, (.5-y)*scale, z);
  const fields = roseCenters.map(() => ({ positions: [], origins: [], colors: [], metadata: [], rim: [] }));
  const petalMasks = roseCenters.map(() => ctx.createImageData(canvas.width, canvas.height));
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y*canvas.width+x)*4;
      const [r, g, b, alpha] = data.subarray(offset, offset+4);
      if (!alpha || r <= g*1.32 || r <= b*1.5) continue;
      const distances = roseCenters.map(([cx, cy]) => Math.hypot(x/canvas.width-cx, (y/canvas.height-cy)/aspect));
      const mask = petalMasks[distances.indexOf(Math.min(...distances))].data;
      mask.set([r,g,b,alpha], offset);
    }
  }
  const tint = new THREE.Color();
  let seed = 953;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function add(field, point, origin, color, radius, layer, type) {
    field.positions.push(point.x, point.y, point.z);
    field.origins.push(origin.x, origin.y, origin.z);
    field.colors.push(color.r, color.g, color.b);
    field.metadata.push(radius, layer, type, random());
  }

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 2) {
      const px = Math.min(canvas.width-1, x + Math.floor(random()*2));
      const py = Math.min(canvas.height-1, y + Math.floor(random()*2));
      const offset = (py*canvas.width + px)*4;
      if (!data[offset+3]) continue;
      const r = data[offset], g = data[offset+1], b = data[offset+2];
      const nx = px/canvas.width, ny = py/canvas.height;
      const distances = roseCenters.map(([cx, cy]) => Math.hypot((nx-cx)*aspect, ny-cy));
      const index = distances.indexOf(Math.min(...distances));
      const radius = Math.min(1, distances[index]/.15);
      const isPetal = r > g*1.32 && r > b*1.5;
      const weave = Math.sin(px*.084 + 1.8*Math.sin(py*.058))
        * Math.sin(py*.112 + 1.6*Math.cos(px*.061));
      if (isPetal && random() < Math.max(0, weave)*.86) continue;
      const depth = isPetal ? .19*(1-radius) + r/255*.065 : -.12;
      const point = toScene(nx, ny, depth + (random()-.5)*.023);
      const origin = toScene(...roseCenters[index], .22);
      origin.x += (random()-.5)*.065;
      origin.y += (random()-.5)*.065;
      tint.setRGB(r/255, g/255, b/255, THREE.SRGBColorSpace);
      const field = fields[index];
      // Keep the reference's shaded folds and add extra coverage in the dark reds.
      tint.multiplyScalar(isPetal ? 1.72 : .93);
      add(field, point, origin, tint, isPetal ? radius : ny, radius*2, isPetal ? 0 : 2);
      if (isPetal && weave < -.30 && r > 100) {
        const grain = point.clone().add(new THREE.Vector3(
          (random()-.5)*.008, (random()-.5)*.008, (random()-.5)*.033,
        ));
        add(field, grain, origin, tint, radius, radius*2, 0);
      }
      if (isPetal && radius > .76 && r > 105 && random() < .11) {
        field.rim.push(point);
        add(field, point, origin, tint, radius, 2, 3);
      }
    }
  }

  const roses = fields.map((field, index) => {
    const center = toScene(...roseCenters[index], .28);
    for (let i = 0; i < 560; i++) {
      const angle = random()*Math.PI*2;
      const distance = Math.sqrt(random())*.082;
      const point = center.clone().add(new THREE.Vector3(
        Math.cos(angle)*distance, Math.sin(angle)*distance, random()*.07,
      ));
      tint.set(random() < .12 ? config.colors.heart : config.colors.ember);
      add(field, point, center, tint, distance/.082, 0, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(field.positions, 3));
    geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(field.origins, 3));
    geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(field.colors, 3));
    geometry.setAttribute('aData', new THREE.Float32BufferAttribute(field.metadata, 4));
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    mask.getContext('2d').putImageData(petalMasks[index], 0, 0);
    return { geometry, rim: field.rim, mask, center: toScene(...roseCenters[index], 0), scale, aspect };
  });
  return { roses, outline: canvas };
}
