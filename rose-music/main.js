import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { config } from './config.js';
import { makeReferenceRoses } from './rose-reference.js';
import { makeModelRose } from './white-model.js';
import { makeReferenceFlowUniforms } from './reference-flow.js';
import { makeSurfaceCurrent } from './surface-current.js';
import { vertexShader, fragmentShader, veilVertex, veilFragment, modelVertex, modelFragment,
  referenceModelVertex, referenceModelFragment, currentVertex, currentFragment } from './shaders.js';
import { makeStageLight } from './stage-light.js';
import { makeGestureParticles } from './gesture-particles.js';
import { makeHandGestures } from './hand-gestures.js?v=22';
import { makeMusicPlayer } from './music-player.js?mic=30';
import { makeMusicCurrent } from './music-current.js';

const canvas = document.querySelector('#stage');
const status = document.querySelector('#status');
start().catch(error => {
  status.textContent = '无法加载粒子玫瑰。请刷新页面，并检查浏览器是否启用了 WebGL。';
  status.hidden = false;
  console.error(error);
});

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false });
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.setClearColor(config.colors.background);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40);
  const group = new THREE.Group();
  scene.add(group);

  // Same Three.js post-processing chain as particle-manipulator, without its trails.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const { strength, radius, threshold } = config.bloom;
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold));
  composer.addPass(new OutputPass());

  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  const referenceDraft = view === 'flow-study';
  const currentDraft = view === 'surface-current' || view === 'petal';
  const useModel = view === 'model' || referenceDraft || currentDraft;
  const interactive = !useModel && params.get('auto')!=='1' && !params.has('t');
  const uniforms = {
    uDark: { value: config.timing.darkness },
    uStart: { value: config.timing.petalsStart }, uDuration: { value: config.timing.duration },
    uSize: { value: config.pointSize }, uScale: { value: 1 },
    uGatherBounds: { value: new THREE.Vector2(1.4,2.1) },
    uInteractive: { value: Number(interactive) }, uAssembly: { value: 0 },
    uFoldColor: { value: new THREE.Color('#7D201F') },
    uRedColor: { value: new THREE.Color('#C22135') },
    uRimColor: { value: new THREE.Color('#F34564') },
    uHeartColor: { value: new THREE.Color('#D76027') },
    uSilverColor: { value: new THREE.Color(config.colors.silver) },
  };
  const music=makeMusicPlayer();
  const flowUniforms = referenceDraft ? makeReferenceFlowUniforms() : {};
  const { roses: referenceRoses, outline } = useModel
    ? { roses: [makeModelRose()] } : await makeReferenceRoses();
  const stageLight = makeStageLight(scene, outline,interactive);
  const particleField = !useModel ? makeGestureParticles(referenceRoses) : null;
  const musicCurrent = !useModel ? makeMusicCurrent(referenceRoses) : null;
  if (particleField) canvas.dataset.particleCount=String(particleField.particleCount);
  let current;
  const blooms = referenceRoses.map(({ geometry, rim, mask, center, scale, aspect }, index) => {
    const localTime = { value: 0 };
    const bloomUniforms = {
      ...uniforms, ...flowUniforms, uTime: localTime, uCenter: { value: center },
      uMist: { value: 0 }, uDriftLayer: { value: 0 },
      uFront: { value: 0 },
      uIsolated: { value: Number(view === 'petal') },
    };
    if (mask) {
      const maskTexture = new THREE.CanvasTexture(mask);
      maskTexture.colorSpace = THREE.SRGBColorSpace;
      const sheet = new THREE.PlaneGeometry(scale * aspect, scale, 112, 160);
      for (const front of interactive ? [] : [2, 0, 1]) {
        const veil = new THREE.Mesh(sheet, new THREE.ShaderMaterial({
          uniforms: { ...bloomUniforms, uMask: { value: maskTexture },
            uVeilSize: { value: new THREE.Vector2(scale * aspect, scale) },
            uFront: { value: front } },
          vertexShader: veilVertex, fragmentShader: veilFragment,
          side: THREE.DoubleSide, transparent: true, depthWrite: false,
        }));
        veil.renderOrder = front === 1 ? 3 : 1;
        group.add(veil);
      }
      const lip = new THREE.Points(geometry, new THREE.ShaderMaterial({
        uniforms: { ...bloomUniforms, uFront: { value: 1 } },
        vertexShader, fragmentShader, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lip.frustumCulled = false;
      lip.renderOrder = 4;
      group.add(lip);
    }
    const material = new THREE.ShaderMaterial({
      uniforms: bloomUniforms,
      vertexShader: currentDraft ? currentVertex : referenceDraft ? referenceModelVertex : useModel ? modelVertex : vertexShader,
      fragmentShader: currentDraft ? currentFragment : referenceDraft ? referenceModelFragment : useModel ? modelFragment : fragmentShader,
      transparent: !useModel,
      blending: useModel ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: useModel,
    });
    const flower = new THREE.Points(geometry, material);
    flower.frustumCulled = false;
    flower.renderOrder = 2;
    group.add(flower);
    if (currentDraft) {
      current = makeSurfaceCurrent(geometry, view === 'petal');
      const dust = new THREE.Points(current.geometry, new THREE.ShaderMaterial({
        uniforms: { ...bloomUniforms, uDriftLayer: { value: 1 } },
        vertexShader: currentVertex, fragmentShader: currentFragment,
        transparent: true, depthWrite: false,
      }));
      dust.frustumCulled = false;
      dust.renderOrder = 3;
      group.add(dust);
    }
    if (referenceDraft) {
      const mist = new THREE.Points(geometry, new THREE.ShaderMaterial({
        uniforms: { ...bloomUniforms, uMist: { value: 1 } },
        vertexShader: referenceModelVertex, fragmentShader: referenceModelFragment,
        transparent: true, depthWrite: false,
      }));
      mist.frustumCulled = false;
      mist.renderOrder = 3;
      group.add(mist);
    }
    return { localTime, delay: config.blooms[index].delay, rim };
  });
  const rim = blooms.flatMap(bloom => bloom.rim);

  const threads = new THREE.BufferGeometry();
  const ends = new Float32Array(config.counts.threads * 6);
  const colors = new Float32Array(ends.length);
  threads.setAttribute('position', new THREE.BufferAttribute(ends, 3).setUsage(THREE.DynamicDrawUsage));
  threads.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(threads, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: .35,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  lines.frustumCulled = false;
  group.add(lines);
  const threadColor = new THREE.Color(config.colors.silver);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio, config.maxPixelRatio, 1700 / Math.max(w, h));
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.set(0, 0, Math.max(6.32, 3.55 / camera.aspect));
    const halfHeight = camera.position.z*Math.tan(THREE.MathUtils.degToRad(18));
    uniforms.uGatherBounds.value.set(halfHeight*camera.aspect,halfHeight);
    particleField?.resize(halfHeight*camera.aspect,halfHeight);
    if (view === 'petal') camera.position.set(.46, 1.35, 1.95);
    camera.updateProjectionMatrix();
    uniforms.uScale.value = h * ratio / 780;
    stageLight.resize(ratio, camera.aspect,uniforms.uGatherBounds.value);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  const preview = new URLSearchParams(location.search).get('t');
  let fixedTime = preview === null ? null : Math.max(0, Number(preview) || 0);
  let started = performance.now();
  let assembly=0,assemblyTarget=0,lastTime=0;
  let galaxyTime=Math.max(0,Number(params.get('galaxy-age'))||0);
  const gatherButton=document.querySelector('#replay');
  const instruction=document.querySelector('#gesture-status');
  function setAssembled(value) {
    assemblyTarget=Number(value);
    gatherButton.textContent=value?'散回银河':'聚成玫瑰';
    gatherButton.setAttribute('aria-pressed',String(value));
  }
  function replay() {
    if (interactive) {setAssembled(!assemblyTarget);return;}
    fixedTime = null;
    started = performance.now();
    render(0);
  }
  if (!interactive) {
    canvas.addEventListener('click',replay);
    gatherButton.textContent='重播';
    document.querySelector('#gesture').hidden=true;
    instruction.hidden=true;
  } else {
    canvas.addEventListener('pointermove',event=>{
      const rect=canvas.getBoundingClientRect();
      particleField.push((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,performance.now());
    });
    makeHandGestures({
      onPose:pose=>setAssembled(pose==='fist'),
      onMove:(x,y,stamp)=>particleField.push(x,y,stamp),
      onState:enabled=>{canvas.dataset.camera=String(enabled);},
    });
  }
  if (interactive && params.get('bloom')==='1') setAssembled(true);
  gatherButton.addEventListener('click',replay);
  canvas.addEventListener('webglcontextlost', () => {
    status.textContent = 'WebGL 已断开，请刷新页面。';
    status.hidden = false;
  });

  function render(t) {
    const dt=Math.max(0,Math.min(.05,t-lastTime));
    lastTime=t;
    if (interactive) {
      const speed=assemblyTarget ? 1/1.45 : 1/1.45;
      assembly=THREE.MathUtils.clamp(assembly+Math.sign(assemblyTarget-assembly)*dt*speed,0,1);
      uniforms.uAssembly.value=assembly;
      if (assembly===0) {
        galaxyTime+=dt;
        particleField.update(dt,galaxyTime,performance.now());
      }
      canvas.dataset.galaxyAge=galaxyTime.toFixed(2);
      canvas.dataset.mode=assembly>.99?'rose':assembly<.01?'floating':'gathering';
      canvas.dataset.assembly=assembly.toFixed(3);
    }
    current?.update(Math.max(0,t-config.timing.petalsStart-config.timing.duration));
    for (const bloom of blooms) bloom.localTime.value = t - bloom.delay;
    group.rotation.x = .018 * Math.sin(t * .65);
    group.rotation.y = .036 * Math.sin(t * .49);
    group.rotation.z = .011 * Math.sin(t * .73);
    const end = useModel ? config.timing.petalsStart + config.timing.duration : 9.5;
    const musicActive=!useModel&&(interactive ? assembly>.985&&assemblyTarget===1 : t>end);
    music.setVisible(musicActive);
    const audio=music.update();
    canvas.dataset.musicFlow=(musicCurrent?.update(audio,musicActive)??0).toFixed(8);
    const fade = interactive ? uniforms.uAssembly.value : THREE.MathUtils.smoothstep(t, end - .65, end + .2);
    stageLight.render(t, interactive ? fade : THREE.MathUtils.smoothstep(t, end - .38, end + .45),
      interactive ? galaxyTime : t);
    for (let i = 0; i < config.counts.threads; i++) {
      const cluster = Math.floor(i / 4);
      const anchor = rim[(cluster * 97 + 53) % rim.length];
      const phase = cluster * 2.399;
      const side = i % 4;
      const length = .014 + .021 * (cluster % 7) / 6;
      const driftX = .09 * Math.cos(phase + t*.42);
      const driftY = .08 * Math.sin(phase + t*.38);
      const angle = phase + t*.36 + side*Math.PI/2;
      const next = angle + Math.PI/2;
      const offset = i * 6;
      ends.set([
        anchor.x+driftX+Math.cos(angle)*length, anchor.y+driftY+Math.sin(angle)*length, anchor.z,
        anchor.x+driftX+Math.cos(next)*length, anchor.y+driftY+Math.sin(next)*length, anchor.z,
      ], offset);
      const flash = fade * Math.pow(.5 + .5 * Math.sin(t*1.1 + phase), 3) * .72;
      const color = [threadColor.r*flash, threadColor.g*flash, threadColor.b*flash];
      colors.set([...color, ...color], offset);
    }
    threads.attributes.position.needsUpdate = true;
    threads.attributes.color.needsUpdate = true;
    composer.render();
    canvas.dataset.time = t.toFixed(2);
  }

  render(0);
  renderer.setAnimationLoop(now => render(fixedTime ?? (now - started) * .001 * config.timing.speed));
}
