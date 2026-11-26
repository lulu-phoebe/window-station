import * as THREE from 'three';
import { config } from './config.js';

export function makeStageLight(scene, outline,galaxyEnabled=false) {
  const time = { value: 0 };
  const galaxyTime = { value: 0 };
  const form = { value: galaxyEnabled?0:1 };
  const pixelRatio = { value: 1 };
  const aspect = { value: 1 };
  const fieldBounds = { value: new THREE.Vector2(1.4,2.1) };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { time,galaxyTime, aspect,form },
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 screen;
      void main() {
        screen = uv;
        gl_Position = vec4(position.xy, .999, 1.);
      }
    `,
    fragmentShader: `
      uniform float time,galaxyTime, aspect, form;
      varying vec2 screen;
      void main() {
        vec2 p = (screen - .5) * vec2(aspect, 1.);
        float down = 1.04 - screen.y;
        float axis = p.x + .39 - .54 * down;
        float shaft = exp(-pow(axis / (.045 + .28 * down), 2.));
        float strands = .78 + .14*sin(axis*48.) + .08*sin(axis*91.);
        float pool = exp(-dot(p*vec2(2.45, 1.9), p*vec2(2.45, 1.9)));
        float falloff = exp(-abs(p.x)*1.8) * smoothstep(0., .29, screen.y);
        float fade = smoothstep(0., 1.5, time);
        vec3 light = vec3(.040, .025, .018) * shaft * strands * falloff
          + vec3(.010, .007, .007) * pool;
        float galaxyHalo=exp(-dot(p*vec2(1.3,.8),p*vec2(1.3,.8))*5.);
        vec3 galaxy=vec3(.0004,.0006,.0022)+vec3(.002,.003,.009)*galaxyHalo;
        vec2 galaxyPoint=p*2.;
        float major=min(.84,aspect*1.95);
        vec2 disk=vec2(dot(galaxyPoint,vec2(.453596,.891207)),
          dot(galaxyPoint,vec2(-.891207,.453596)));
        disk/=vec2(major,major*.52);
        float radius=length(disk);
        float angle=atan(disk.y,disk.x+.00001);
        float pattern=galaxyTime*.025+.040*sin(galaxyTime*.22+radius*2.8);
        float arms=pow(.5+.5*cos(2.*(angle-radius*4.4-pattern)),6.);
        float reach=exp(-radius*radius*1.8)*(1.-smoothstep(.95,1.35,radius));
        float mist=.80+.20*sin(disk.x*28.+sin(disk.y*19.))*sin(disk.y*32.);
        float nucleus=exp(-dot(disk*vec2(1.,1.15),disk*vec2(1.,1.15))*32.);
        vec3 nebula=vec3(.008,.014,.047)*reach*(.15+.85*arms)*mist
          +vec3(.28,.17,.075)*nucleus;
        galaxy+=nebula*pow(1.-form,2.);
        gl_FragColor=vec4(mix(galaxy,vec3(.001)+light*fade,form),1.);
      }
    `,
  }));
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  scene.add(backdrop);

  let shadow;
  if (outline) {
  const mask = document.createElement('canvas');
  const padding = 28;
  mask.width = outline.width + 2*padding;
  mask.height = outline.height + 2*padding;
  const ctx = mask.getContext('2d');
  ctx.filter = 'blur(9px)';
  ctx.drawImage(outline, padding, padding);
  shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.65*mask.width/outline.height, 3.65*mask.height/outline.height),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(mask), color: 0x000000,
      transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  shadow.position.set(.23, -.13, -.40);
  shadow.rotation.z = .045;
  shadow.renderOrder = -5;
  scene.add(shadow);
  }

  const positions = [];
  const seeds = [];
  for (let i = 0; i < config.counts.dust; i++) {
    positions.push(0, 0, 0);
    seeds.push(i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const snowMaterial = new THREE.ShaderMaterial({
    uniforms: { time, pixelRatio, form,fieldBounds, frontPass:{value:0},
      silver: { value: new THREE.Color(config.colors.silver).multiplyScalar(2.0) } },
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float time, pixelRatio, form,frontPass;
      uniform vec2 fieldBounds;
      varying float glow, snowMix, flakeDepth,flakeAngle;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        float seed = aSeed;
        float depth = hash(seed + .9);
        float cycle = fract(hash(seed + .2) + time*(.013 + .021*depth));
        vec3 p = vec3((hash(seed)-.5)*6.1, (cycle-.5)*4.7, mix(-1.8, 1.35, depth));
        p.x += .17*sin(seed + time*.45) + .073*time;
        p.x = mod(p.x + 3.1, 6.2) - 3.1;
        snowMix=smoothstep(.40,1.,form);
        flakeDepth=depth;
        flakeAngle=hash(seed+2.3)*6.2831853+time*(.12+.28*hash(seed+3.1));
        float falling=fract(hash(seed+.2)+time*(.028+.043*depth));
        float width=fieldBounds.x*2.5;
        float drift=time*(.010+.020*depth)
          +(.045+.12*depth)*sin(time*(.32+.14*depth)+seed)
          +.06*sin(time*.18);
        vec3 snow=vec3((hash(seed)-.5)*width+drift,
          (.5-falling)*fieldBounds.y*2.55,
          mix(-1.9,1.45,pow(depth,1.5)));
        snow.x=mod(snow.x+width*.5,width)-width*.5;
        p=mix(p,snow,snowMix);
        vec4 view = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * view;
        float starSize=3.3+8.4*pow(depth,2.5);
        float snowSize=3.4+8.0*pow(depth,5.5);
        gl_PointSize = mix(starSize,snowSize,snowMix)*pixelRatio*6./-view.z;
        float starGlow=smoothstep(0., .9, time)*sin(cycle*3.14159)
          * (.45 + .55*pow(.5+.5*sin(seed*8. + time*(1.+depth)), 2.))
          *.22;
        float snowfall=(.22+.36*depth)*smoothstep(0.,.04,falling)
          *(1.-smoothstep(.95,1.,falling))*(.93+.07*sin(flakeAngle));
        glow=mix(starGlow,snowfall,snowMix);
        float foreground=step(.90,depth);
        glow*=frontPass>.5 ? snowMix*foreground : 1.-snowMix*foreground;
      }
    `,
    fragmentShader: `
      varying float glow,snowMix,flakeDepth,flakeAngle;
      uniform vec3 silver;
      void main() {
        vec2 q=gl_PointCoord-.5;
        float c=cos(flakeAngle),s=sin(flakeAngle);
        vec2 flake=mat2(c,-s,s,c)*q;
        float r = length(q);
        float core = exp(-r*r*110.);
        float halo = exp(-r*r*20.) * (1.-smoothstep(.26,.5,r));
        float snowRadius=length(flake*vec2(1.,1.12+.16*sin(flakeAngle)));
        float crisp=exp(-snowRadius*snowRadius*29.);
        float soft=exp(-snowRadius*snowRadius*11.)*.72;
        float coverage=mix(crisp,soft,smoothstep(.93,1.,flakeDepth))
          *(1.-smoothstep(.34,.5,snowRadius));
        float opacity=glow*mix(.76*core+.20*halo,coverage,snowMix);
        if(opacity<.002)discard;
        vec3 snowColor=mix(vec3(.88,1.02,1.20),vec3(1.25),flakeDepth);
        gl_FragColor=vec4(mix(silver,snowColor,snowMix),opacity);
      }
    `,
  });
  const motes = new THREE.Points(geometry,snowMaterial);
  motes.frustumCulled = false;
  motes.renderOrder=0;
  scene.add(motes);
  const nearMaterial=snowMaterial.clone();
  nearMaterial.uniforms={...snowMaterial.uniforms,frontPass:{value:1}};
  const nearSnow=new THREE.Points(geometry,nearMaterial);
  nearSnow.frustumCulled=false;
  nearSnow.renderOrder=6;
  scene.add(nearSnow);

  return {
    resize(ratio, screenAspect,bounds) {
      pixelRatio.value = ratio;
      aspect.value = screenAspect;
      if(bounds)fieldBounds.value.copy(bounds);
    },
    render(t, shadowOpacity,orbitTime=t) {
      time.value = t;
      galaxyTime.value=orbitTime;
      if (galaxyEnabled) form.value=shadowOpacity;
      if (shadow) shadow.material.opacity = .76 * shadowOpacity;
    },
  };
}
