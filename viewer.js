import * as THREE from './three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { gardenBreeze } from './garden.js?v=7';
import { seasons, seasonalParticles, seasonalBackdrop } from './seasons.js?v=9';
import { roomMirror, curtainFabric, floatingDust } from './room-effects.js?v=31?v=15';

const labels = [
  [/^(Envelope|Ornate envelope)/, 'letter'],
  [/^Instant (print|photograph artwork)/, 'photos'],
  [/^(Instant camera|Print slot|Camera flash)/, 'camera'],
  [/^CRT/, 'computer'],
  [/^Keyboard/, 'keyboard'],
  [/^(Star|Cream star)/, 'star'],
  [/^Cassette/, 'cassette'],
  [/^Mug /, 'drink'],
  [/^Pencil/, 'pencil'],
  [/^(Rose|Ivory ceramic vase)/, 'rose'],
  [/^(Lamp|Butter enamel)/, 'lamp'],
  [/^(Notebook|Oxblood)/, 'notebook'],
  [/^Note /, 'note'],
  [/^Mirror /, 'mirror']
];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
const nameOf = node => (node?.name || "").replaceAll("_"," ");

function modelGroup(scene, name, parts) {
  if (!parts.length) return null;
  const group = new THREE.Group();
  const bounds = new THREE.Box3();
  for (const part of parts) bounds.expandByObject(part);
  bounds.getCenter(group.position);
  group.name = name;
  scene.add(group);
  parts.forEach(part => group.attach(part));
  return {group, origin: group.position.clone(), lift: 0};
}

export async function createViewer(viewport, onInspect, onHover = () => {}) {
  const renderer = new THREE.WebGLRenderer({antialias:true});
  try {
    const [asset,atlas] = await Promise.all([
      new GLTFLoader().loadAsync('./window-desk-dream.glb'),
      new THREE.TextureLoader().loadAsync('./season-garden.webp')
    ]);
    const scene = asset.scene;
    const camera = asset.cameras[0];
    if (!camera) throw new Error('Room camera missing.');
    const target = new THREE.Vector3(0, 1.5, -.17);
    const position = camera.getWorldPosition(new THREE.Vector3());
    camera.removeFromParent();
    const orbit = new THREE.Spherical().setFromVector3(position.sub(target));
    const start = orbit.clone();
    const view = orbit.clone();

    scene.background = new THREE.Color('#8c9b9e');
    scene.add(new THREE.HemisphereLight('#fff4e8','#96a4b7',2.02));
    const fill = new THREE.DirectionalLight('#ece8ff',.65);
    fill.position.set(1,4,6);
    scene.add(fill);
    const sun = new THREE.DirectionalLight('#ffdeb1',2.3);
    sun.position.set(-3.2,5.5,-4.6);
    sun.target.position.set(.65,1.05,.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536,1536);
    sun.shadow.radius=2.4;
    Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:15});
    sun.shadow.bias = -.00028;
    sun.shadow.normalBias = .018;
    scene.add(sun,sun.target);
    const lamp = new THREE.PointLight('#ffe2a2',.95,2.2);
    lamp.position.set(2.01,1.90,-.40);
    scene.add(lamp);
    const windGarden = gardenBreeze(scene);
    const weatherParticles=seasonalParticles(scene);
    const outside=seasonalBackdrop(scene,atlas);
    let season='summer';
    const dust=floatingDust(scene);
    dust(0);
    function setSeason(name) {
      if (!seasons[name]) return;
      season=name;
      sun.color.set(seasons[name].light);
      outside.choose(name);
      windGarden.choose(name);
      weatherParticles.choose(name);
      weatherParticles.update(elapsed);
    }

    const parts = new Map(labels.map(([,id]) => [id,[]]));
    const curtainParts = {left:[],right:[]};
    scene.updateMatrixWorld(true);
    scene.traverse(object => {
      const name = nameOf(object);
      if (object.isMesh) {
        object.castShadow = !/^Garden view|^Floor board|^Side wall|^Wallpaper|^Blue leaf print/.test(name);
        object.receiveShadow = !/^Garden view/.test(name);
      }
      const match = labels.find(([pattern]) => pattern.test(name));
      if (match && !labels.find(([pattern]) => pattern.test(nameOf(object.parent)))) parts.get(match[1]).push(object);
      if (/^(Linen curtain|Blue leaf print)/.test(name)) curtainParts[name.startsWith('Linen curtain -1') || name.startsWith('Blue leaf print -1') ? 'left' : 'right'].push(object);
      if (/^Curtain tie/.test(name)) curtainParts.right.push(object);
    });
    const groups = new Map();
    for (const [id,objects] of parts) {
      const entry = modelGroup(scene,'Lift '+id,objects);
      if (!entry) continue;
      entry.group.userData.item = id;
      groups.set(id,entry);
    }
    const screenMaterials = [];
    groups.get('computer')?.group.traverse(object => {
      const name = nameOf(object);
      if (!object.isMesh || !object.material?.emissive || !/^CRT (glass|status indicator)$/.test(name)) return;
      const material = object.material.clone();
      object.material = material;
      material.emissive.set(name === 'CRT glass' ? '#a1e4d1' : '#d7f493');
      material.emissiveIntensity = 0;
      screenMaterials.push(material);
    });
    let screenGlow = 0;
    const dropCanvas=document.createElement('canvas');
    dropCanvas.width=768;dropCanvas.height=448;
    const dropContext=dropCanvas.getContext('2d');
    const dropTexture=new THREE.CanvasTexture(dropCanvas);
    dropTexture.colorSpace=THREE.SRGBColorSpace;
    const glassDrops=new THREE.Mesh(new THREE.PlaneGeometry(4.8,2.78),new THREE.MeshBasicMaterial({
      map:dropTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
    }));
    glassDrops.position.set(0,2.79,-1.57);
    glassDrops.visible=false;glassDrops.raycast=()=>{};
    scene.add(glassDrops);
    let liveWeather=null;
    function setLiveWeather(value) {
      const rain=value?.rain??0;
      const rainChanged=rain!==(liveWeather?.rain??0);
      liveWeather=value;
      if(!rainChanged)return;
      glassDrops.visible=rain>0;
      if(!rain)return;
      dropContext.clearRect(0,0,768,448);
      const count=Math.min(155,24+Math.round(rain*76));
      for(let i=0;i<count;i++){
        const col=i%4,row=Math.floor(i/4)%3;
        const top=[8,185,328][row],height=[165,130,109][row];
        const x=col*192+13+(i*79.19%163),y=top+(i*51.21%height);
        const w=1.4+i%5*.46;
        dropContext.beginPath();
        dropContext.ellipse(x,y,w,w*(1.43+i%3*.28),.12,0,Math.PI*2);
        const sheen=dropContext.createLinearGradient(x-w,y-w,x+w,y+w*2);
        sheen.addColorStop(0,'rgba(255,255,246,.88)');
        sheen.addColorStop(.45,'rgba(210,237,248,.20)');
        sheen.addColorStop(1,'rgba(34,68,86,.68)');
        dropContext.fillStyle=sheen;dropContext.fill();
      }
      dropTexture.needsUpdate=true;
    }
    let mirrorGlass;
    const mirror=groups.get('mirror');
    const mirrorBoxes={face:new THREE.Box3(),stand:new THREE.Box3(),base:new THREE.Box3()};
    mirror?.group.traverse(object=>{
      if (!object.isMesh) return;
      const name=nameOf(object);
      if (/^Mirror polished glass/.test(name)) mirrorGlass=object;
      const part=/^Mirror (felt|enamel base|base brass)/.test(name) ? 'base'
        : /^Mirror (tapered stem|stem joint)/.test(name) ? 'stand' : 'face';
      mirrorBoxes[part].expandByObject(object);
    });
    const mirrorTargets=Object.values(mirrorBoxes).filter(box=>!box.isEmpty());
    for(const box of mirrorTargets) box.expandByScalar(.044);
    const mirrorRay=new THREE.Ray();
    const reflect = mirrorGlass ? roomMirror(renderer,scene,mirrorGlass) : null;
    const curtains = new Map();
    const curtainPlane = new THREE.Plane(new THREE.Vector3(0,0,1),1.32);
    const curtainPoint = new THREE.Vector3();
    for (const [side,objects] of Object.entries(curtainParts)) {
      const entry = modelGroup(scene,'Draggable curtain '+side,objects);
      if (!entry) continue;
      entry.group.userData.curtain = side;
      entry.group.traverse(child=>{
        if (child.isMesh) child.material.side=THREE.DoubleSide;
      });
      Object.assign(entry,{target:0,closure:0,pull:0,velocity:0,fabric:curtainFabric(entry.group,side)});
      curtains.set(side,entry);
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.19;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','可转动镜头的窗边书桌 3D 场景');
    viewport.replaceChildren(renderer.domElement);

    const mixer = new THREE.AnimationMixer(scene);
    asset.animations.forEach(clip => mixer.clipAction(clip).play());
    const canvas = renderer.domElement;
    const pointer = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    const groundRay = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    let active = false, drag, lastTime, elapsed = 0, hovered, pinned, point, wind = true;
    let width = 0, height = 0;
    setSeason('summer');

    function tag(hit) {
      for (let node=hit?.object; node; node=node.parent) {
        if (node.userData.item || node.userData.curtain) return node.userData;
      }
      return {};
    }
    function curtainAt(hit) {
      if (!ray.ray.intersectPlane(curtainPlane,curtainPoint)) return null;
      if (hit && hit.distance < ray.ray.origin.distanceTo(curtainPoint)-.14) return null;
      for (const [side,entry] of curtains) {
        const {bounds,outer,inner,travel,direction}=entry.fabric;
        const edge=inner+direction*travel*entry.closure;
        if (curtainPoint.y>=bounds.min.y && curtainPoint.y<=bounds.max.y
            && curtainPoint.x>=Math.min(outer,edge)-.045
            && curtainPoint.x<=Math.max(outer,edge)+.045) return side;
      }
      return null;
    }
    function hitTest(coords, oldItem) {
      if (!coords) return {};
      pointer.set(coords.x,coords.y);
      ray.setFromCamera(pointer,camera);
      if (mirror) {
        mirrorRay.copy(ray.ray);
        mirrorRay.origin.y-=mirror.lift;
        if(mirrorTargets.some(box=>mirrorRay.intersectsBox(box))) return {item:'mirror'};
        mirrorRay.origin.y+=mirror.lift;
        if(mirror.lift>.01 && mirrorTargets.some(box=>mirrorRay.intersectsBox(box))) return {item:'mirror'};
      }
      const hit = ray.intersectObject(scene,true)[0];
      const result = tag(hit);
      if (!result.curtain && !result.item) result.curtain=curtainAt(hit);
      if (result.item === oldItem || result.curtain) return result;
      const entry = groups.get(oldItem);
      if (!entry || entry.lift < .012) return result;
      groundRay.set(origin.copy(ray.ray.origin).addScaledVector(THREE.Object3D.DEFAULT_UP,entry.lift),ray.ray.direction);
      const withoutLift = groundRay.intersectObject(entry.group,true)[0];
      return withoutLift && (!hit || withoutLift.distance <= hit.distance + .06) ? {item:oldItem} : result;
    }
    function cursor(result) {
      const id = result.item;
      if (hovered !== id) { hovered = id; onHover(id); }
      canvas.style.cursor = drag?.moved ? 'grabbing' : result.curtain ? 'ew-resize' : id ? 'pointer' : 'grab';
    }
    function frame(time) {
      if (!active) return;
      const dt = lastTime === undefined ? 1/60 : Math.min((time-lastTime)/1000,.05);
      lastTime=time;
      const breeze=liveWeather ? THREE.MathUtils.clamp(.35+liveWeather.wind/18,.35,2.2) : 1;
      if (!reduced.matches && wind) { elapsed+=dt*breeze; mixer.update(dt*breeze); weatherParticles.update(elapsed); dust(elapsed); }
      const smooth = reduced.matches ? 1 : 1-Math.exp(-dt*12);
      const newWidth=viewport.clientWidth,newHeight=viewport.clientHeight;
      if (!newWidth || !newHeight) return;
      if (newWidth!==width || newHeight!==height) {
        width=newWidth;height=newHeight;
        camera.aspect=width/height;
        camera.updateProjectionMatrix();
        renderer.setSize(width,height,false);
      }
      const parallax = !reduced.matches && !drag && point?.mouse;
      view.theta += (orbit.theta + (parallax ? -point.x*.095 : 0)-view.theta)*smooth;
      view.phi += (orbit.phi + (parallax ? -point.y*.055 : 0)-view.phi)*smooth;
      view.radius = start.radius * Math.max(1,1.25/camera.aspect);
      camera.position.setFromSpherical(view).add(target);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      if (!drag) cursor(hitTest(point?.mouse ? point : null,hovered));
      for (const [id,entry] of groups) {
        const height = id==='computer' || id==='lamp' ? .115 : .15;
        const lift = id === pinned ? height+.075 : !pinned && id === hovered ? height : 0;
        entry.lift += (lift-entry.lift)*smooth;
        entry.group.position.y = entry.origin.y+entry.lift;
      }
      const litComputer = hovered === 'computer' && !pinned;
      screenGlow += ((litComputer ? 1 : 0) - screenGlow) * smooth;
      for (const material of screenMaterials) material.emissiveIntensity = screenGlow * .95;
      let coverage=0;
      for (const [side,entry] of curtains) {
        const pulling=drag?.hit.curtain===side && drag.moved;
        entry.closure+=(entry.target-entry.closure)*(pulling ? Math.max(.70,smooth) : smooth);
        if (pulling) {
          entry.pull+=(entry.velocity-entry.pull)*smooth;
        } else {
          entry.velocity+=(-entry.pull*51-entry.velocity*8)*dt;
          entry.pull+=entry.velocity*dt;
          if (Math.abs(entry.pull)+Math.abs(entry.velocity)<.002) entry.pull=entry.velocity=0;
        }
        entry.fabric.update(elapsed,entry.closure,reduced.matches ? 0 : entry.pull,wind&&!reduced.matches ? breeze : 0);
        coverage+=entry.closure;
      }
      const sunlight=liveWeather ? 1-THREE.MathUtils.clamp(liveWeather.cloud/100,0,1)*.72 : 1;
      sun.intensity=seasons[season].strength*(.81-.09*coverage)*sunlight;
      reflect?.(camera,time);
      renderer.render(scene,camera);
    }
    function eventPoint(event) {
      const b=canvas.getBoundingClientRect();
      return {x:(event.clientX-b.left)/b.width*2-1,y:1-(event.clientY-b.top)/b.height*2,mouse:event.pointerType==='mouse'};
    }
    canvas.onpointerdown=event=>{
      if (event.button!==0 || drag) return;
      point=eventPoint(event);
      const hit=hitTest(point,hovered);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,theta:orbit.theta,phi:orbit.phi,moved:false,hit};
      if (hit.curtain) {
        const curtain=curtains.get(hit.curtain);
        drag.closure=curtain.target;
        drag.lastX=event.clientX;
        drag.width=canvas.getBoundingClientRect().width;
        canvas.style.cursor='grabbing';
      }
      canvas.setPointerCapture(event.pointerId);
    };
    canvas.onpointermove=event=>{
      point=eventPoint(event);
      if (!drag || drag.id!==event.pointerId) return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      drag.moved ||= Math.hypot(dx,dy)>5;
      if (!drag.moved) return;
      canvas.style.cursor='grabbing';
      if (drag.hit.curtain) {
        const curtain=curtains.get(drag.hit.curtain);
        const horizontalSpan=2*view.radius*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*camera.aspect;
        const travel=curtain.fabric.travel;
        const delta=dx*horizontalSpan/drag.width/travel*curtain.fabric.direction;
        curtain.target=clamp(drag.closure+delta,0,1);
        curtain.velocity=clamp((event.clientX-drag.lastX)*curtain.fabric.direction*.05,-.65,.65);
        drag.lastX=event.clientX;
        return;
      }
      orbit.theta=clamp(drag.theta-dx*.004,start.theta-.5,start.theta+.5);
      orbit.phi=clamp(drag.phi-dy*.004,start.phi-.28,start.phi+.22);
    };
    canvas.onpointerup=event=>{
      if (!drag || drag.id!==event.pointerId) return;
      if (!drag.moved && !drag.hit.curtain) {
        const item=drag.hit.item;
        pinned=pinned===item ? undefined : item;
        onInspect(pinned);
      }
      drag=undefined;
      if (event.pointerType!=='mouse') point=undefined;
    };
    canvas.onpointerleave=()=>{if (!drag) point=undefined;};
    canvas.onpointercancel=()=>{drag=undefined;point=undefined;};
    return {
      setActive(value) {
        active=value;
        lastTime=undefined;
        if (active) renderer.setAnimationLoop(frame);
        else { renderer.setAnimationLoop(null); point=undefined; cursor({}); }
      },
      setWind(value) { wind=value; },
      setSeason,
      setLiveWeather,
      pick(item) { if (item==='vase') item='rose'; pinned=groups.has(item) ? item : undefined; onInspect(pinned); return Boolean(pinned); }
    };
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}
