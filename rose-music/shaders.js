// Point-sprite falloff adapted from particle-manipulator, Naini Vivekanand (MIT).
export const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;
varying float vGather;
varying float vGlint;
varying vec2 vFlightDirection;
void main() {
  vec2 q=gl_PointCoord-.5;
  float d = length(q);
  if (d > .5) discard;
  float core = 1. - smoothstep(0., .5, d);
  float spec = exp(-d * 15.) * .8;
  float halo = exp(-d * 4.) * .11;
  float settled = smoothstep(0.,1.,vGather);
  float pin=exp(-dot(q,q)*140.);
  float glow=exp(-dot(q,q)*32.)*(1.-smoothstep(.30,.5,d));
  float crossRay=(exp(-abs(q.x)*85.-abs(q.y)*8.)
    +exp(-abs(q.y)*85.-abs(q.x)*8.))*vGlint;
  float along=dot(q,vFlightDirection);
  float across=dot(q,vec2(-vFlightDirection.y,vFlightDirection.x));
  float streak=exp(-across*across*490.-along*along*16.)
    * sin(vGather*3.14159265)*.23;
  float flightAlpha=pin*.95+glow*.24+crossRay*.20+streak;
  vec3 flightColor=vColor*(.68+.32*pin)+vec3(1.25,1.35,1.65)*pin;
  float surface=core*.55+spec+halo;
  gl_FragColor=vec4(mix(flightColor,vColor*surface,settled),
    vAlpha*mix(flightAlpha,surface,settled));
}
`;

const petalMotion = `
uniform vec2 uGatherBounds;
uniform float uInteractive, uAssembly;
float gatherRandom(float seed, float salt) {
  return fract(sin(seed*127.1+salt*311.7)*43758.5453);
}
float gatherLaunch(vec3 point, float seed) {
  return .12+gatherRandom(seed,1.)*2.60;
}
float gatherTravel(vec3 point, float seed) {
  return 4.30+gatherRandom(seed,2.)*2.50+length(point.xy)*.17;
}
vec3 surroundGather(vec3 destination, float seed, float progress) {
  float angle = gatherRandom(seed,3.)*6.2831853;
  float distance = .72+gatherRandom(seed,4.)*.98;
  vec2 radial = vec2(cos(angle),sin(angle));
  vec2 tangent = vec2(-radial.y,radial.x);
  float turn = mix(-1.,1.,step(.5,gatherRandom(seed,5.)));
  vec3 source = vec3(radial*uGatherBounds*distance,
    (gatherRandom(seed,6.)-.5)*3.1);
  vec3 first = source + vec3(tangent*turn*(.30+.60*distance),-.20);
  vec3 second = destination + vec3(radial*.23+tangent*turn*.17,.14);
  float p = progress, q = 1.-p;
  return q*q*q*source+3.*q*q*p*first+3.*q*p*p*second+p*p*p*destination;
}
float liftedPetal(vec2 local, float hue) {
  float r = length(local);
  float angle = atan(local.y, local.x+.0001);
  float tip = cos(angle+.72+.22*sin(r*12.));
  return smoothstep(.47,.78,tip)
    * smoothstep(.24,.35,r) * smoothstep(.022,.13,hue);
}
vec3 rollPetal(vec2 local, float time, float mask) {
  vec2 along = vec2(.752,-.660);
  float stem = dot(local,along)-.22;
  float span = max(0.,stem);
  float phase = .5+.5*sin(time*1.82-local.y*7.);
  float curl = mask * (.025+.13*phase) * smoothstep(0.,.27,span);
  vec2 across = vec2(-along.y,along.x);
  return vec3(along*span*(cos(curl)-1.)+across*span*curl*.27,
    sin(curl)*span*.88);
}
float petalErosion(vec2 local, float time) {
  float radius = length(local);
  float angle = atan(local.y, local.x + .0001);
  float band = sin(radius*21. - time*3.2 + 1.1*sin(2.*angle));
  float sector = smoothstep(-.42,.82,sin(3.*angle - time*.59));
  return smoothstep(.21,.57,radius)*smoothstep(-.45,.84,band)*sector;
}
vec2 petalCurrent(vec2 local, float time) {
  float radius = length(local);
  vec2 axis = local/max(radius,.001);
  vec2 tangent = vec2(-axis.y,axis.x);
  float band = petalErosion(local,time);
  return (axis*.049 + tangent*.063)*band;
}
// Carry the inner folds and their covering sheet through the same small eddies.
vec3 heartCurrent(vec2 local, float time) {
  float influence = 1.-smoothstep(.16,.36,length(local));
  float phase = time*1.65-local.y*12.+local.x*5.;
  float curl = time*1.12+local.x*17.+local.y*7.;
  return influence*vec3(
    .026*sin(phase)+.013*cos(curl),
    .032*sin(phase-.85)+.012*sin(curl),
    .023*cos(phase)+.009*sin(curl));
}
vec3 flexPetal(vec2 local, float time) {
  float radius = length(local);
  float edge = smoothstep(.14, .60, radius);
  float angle = atan(local.y, local.x + .0001);
  float lift = sin(time*1.12 + 3.*angle) * .66
    + sin(time*1.68 - 5.*angle) * .34;
  vec2 radial = local / max(radius, .001);
  vec2 tangent = vec2(-radial.y, radial.x);
  return edge * vec3(radial * lift*.013 + tangent * lift*.009, lift*.038)
    + vec3(petalCurrent(local,time),0.) + heartCurrent(local,time);
}
`;

export const referenceModelVertex = `
attribute vec3 aNormal, aStart, aTint;
attribute vec4 aData;
uniform float uTime, uDark, uStart, uDuration, uScale, uMist;
uniform sampler2D uFlow;
uniform vec2 uAtlasSize, uFlowTile;
uniform vec3 uFlowTiming;
varying vec3 vColor;
varying float vAlpha;
vec3 flowFrame(vec2 uv, float frame) {
  vec2 tile = vec2(mod(frame,uFlowTiming.x),floor(frame/uFlowTiming.x));
  vec2 texel = tile*uFlowTile + .5 + uv*(uFlowTile-1.);
  vec3 flow = texture2D(uFlow, texel/uAtlasSize).rgb;
  return vec3((flow.rg*255.-128.)/16., flow.b);
}
vec3 referenceMotion(vec2 xy, float time) {
  vec2 uv = clamp(vec2(xy.x*.30+.50,.49-xy.y*.263),.0,1.);
  float frame = mod(max(time,0.)*uFlowTiming.z,uFlowTiming.y);
  float first = floor(frame);
  vec3 flow = mix(flowFrame(uv,first),flowFrame(uv,mod(first+1.,uFlowTiming.y)),fract(frame));
  flow.y = -flow.y;
  float seam = smoothstep(0.,9.,min(frame,uFlowTiming.y-frame));
  return flow*seam;
}
void main() {
  float radius = aData.x;
  float seed = aData.w;
  bool flower = aData.z < 1.;
  vec3 local = position - aStart;
  float open = smoothstep(uStart + radius*.65, uStart + uDuration*.91 + radius*.36, uTime);
  vec3 p = flower ? mix(aStart+local*.045, position, open) : position;
  float edge = smoothstep(.18,.85,radius);
  vec3 n = normalize(aNormal);
  vec3 motion = referenceMotion(position.xy,uTime);
  vec3 later = referenceMotion(position.xy,uTime + .14);
  vec3 displacedX = referenceMotion(position.xy + vec2(.055,0.), uTime);
  vec3 displacedY = referenceMotion(position.xy + vec2(0.,.055), uTime);
  float movement = smoothstep(.09,.64,motion.z);
  vec3 flow = vec3(motion.xy*.017, dot(motion.xy,n.xy)*.009);
  float phase = fract(seed*71.9+uTime*(.41+seed*.24));
  float trail = sin(3.14159*phase);
  vec3 skin = vec3(later.xy*.043, .026+.047*seed);
  skin -= n*dot(n,skin)*.57;
  if (flower) {
    p += flow * (.43+.57*edge) * open;
    p += skin * phase * edge * open * uMist;
    n = normalize(n - vec3((displacedX.x-motion.x)*.17,
      (displacedY.y-motion.y)*.17,0.)*edge);
  } else {
    p += flow*.41;
  }
  vec3 lightNormal = normalize(normalMatrix*n);
  float light = max(0.,dot(lightNormal,normalize(vec3(-.62,.72,.69))));
  float highlight = pow(light,3.6);
  if (flower) {
    float pigment = smoothstep(.14,.79,aTint.r);
    vec3 red = mix(vec3(.095,.002,.006),vec3(1.75,.014,.045),sqrt(light)*(.34+.66*pigment));
    float inner = (1.-smoothstep(.07,.32,radius)) * smoothstep(.54,.91,light);
    vColor = red + highlight*vec3(1.45,.056,.10) + inner*vec3(1.05,.29,.025);
    float grain = sin(position.x*82.+position.z*39.) * sin(position.y*71.-position.z*55.);
    float perforation = smoothstep(-.10,.82,grain)*edge;
    float sheet = 1. - perforation*(.24+.34*movement);
    vAlpha = smoothstep(.24,.74,open) * sheet * (.37+.53*seed);
    float spark = (1.-smoothstep(.045,.24,radius)) * smoothstep(.92,.99,seed);
    vAlpha += spark * smoothstep(uDark,uStart,uTime) * (1.-open);
    if (uMist > .5) {
      vAlpha = smoothstep(.75,1.,open) * movement * edge * trail
        * smoothstep(.76,.97,seed) * .67;
      vColor = mix(vColor,vec3(1.65,.028,.084),.45);
    }
  } else {
    vColor = mix(vec3(.028,.041,.007),vec3(.26,.42,.075),light);
    vAlpha = smoothstep(uStart+.22,uStart+1.5,uTime) * (.42+.38*seed);
    vAlpha *= 1.-uMist;
  }
  vec4 view = modelViewMatrix * vec4(p,1.);
  gl_Position = projectionMatrix * view;
  gl_PointSize = clamp(mix(2.26+.85*seed, 1.45+.95*seed, uMist)*uScale*6. / -view.z, .80, 5.);
}
`;

export const referenceModelFragment = `
uniform float uMist;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord-.5);
  float coverage = (1.-smoothstep(.26,.48,radius))*vAlpha;
  if (uMist > .5) {
    if (coverage < .012) discard;
    gl_FragColor = vec4(vColor, coverage);
  } else {
    if (coverage < .26) discard;
    gl_FragColor = vec4(vColor * (.89 + .11*coverage), 1.);
  }
}
`;

export const modelVertex = `
attribute vec3 aNormal, aStart, aTint;
attribute vec4 aData;
uniform float uTime, uDark, uStart, uDuration, uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = aData.x, seed = aData.w;
  bool flower = aData.z < 1.;
  vec3 local = position-aStart;
  float open = smoothstep(uStart+radius*.65,uStart+uDuration*.91+radius*.36,uTime);
  vec3 p = flower ? mix(aStart+local*.045,position,open) : position;
  float edge = smoothstep(.18,.85,radius);
  vec3 n = normalize(aNormal);
  float angle = atan(local.y,local.x+.00001);
  float phase = angle*3.-radius*6.-uTime*1.70+aStart.y;
  float flowBand = smoothstep(.14,.88,sin(phase));
  float drift = sin(phase+.65*sin(angle*5.+radius*4.));
  if (flower) {
    vec3 tangent = vec3(-local.y,local.x,0.);
    tangent -= n*dot(n,tangent);
    float lift = sin(uTime*1.42+angle*3.+aStart.y*2.4)*.72
      + sin(uTime*.91-angle*5.)*.28;
    vec2 radial = local.xy/max(length(local.xy),.001);
    p += vec3(radial*(-.018+lift*.042),lift*.105)*smoothstep(.28,.98,radius)*open;
    float mobile = smoothstep(.55,.94,seed);
    p += (tangent*(.034+.12*edge)*drift*mobile+n*flowBand*edge*.018)*open;
    p += local*flowBand*mobile*edge*.045*open;
  }
  float light = max(0.,dot(normalize(normalMatrix*n),normalize(vec3(-.62,.72,.69))));
  if (flower) {
    float pigment = smoothstep(.14,.79,aTint.r);
    vec3 red = mix(vec3(.095,.002,.006),vec3(1.75,.014,.045),sqrt(light)*(.34+.66*pigment));
    float inner = (1.-smoothstep(.07,.32,radius))*smoothstep(.54,.91,light);
    vColor = red + pow(light,3.6)*vec3(1.45,.056,.10) + inner*vec3(1.05,.29,.025);
    vColor *= 1.+edge*sin(uTime*1.42+angle*3.+aStart.y*2.4)*.16;
    vAlpha = smoothstep(.24,.74,open)*(1.-flowBand*edge*.53)*(.42+.49*seed);
    float spark = (1.-smoothstep(.045,.24,radius))*smoothstep(.92,.99,seed);
    vAlpha += spark*smoothstep(uDark,uStart,uTime)*(1.-open);
  } else {
    vColor = mix(vec3(.028,.041,.007),vec3(.26,.42,.075),light);
    vAlpha = smoothstep(uStart+.22,uStart+1.5,uTime)*(.42+.38*seed);
  }
  vec4 view = modelViewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*view;
  gl_PointSize = clamp((2.55+.65*seed)*uScale*6./-view.z,1.10,5.);
}
`;

export const modelFragment = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord-.5);
  float coverage = (1.-smoothstep(.26,.48,radius))*vAlpha;
  if (coverage < .31) discard;
  gl_FragColor = vec4(vColor*(.91+.09*coverage),1.);
}
`;

export const currentVertex = `
attribute vec3 aNormal, aStart, aTint;
attribute vec4 aData;
uniform float uTime, uStart, uDuration, uScale, uDriftLayer, uIsolated;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = aData.x, seed = aData.w;
  bool petal = aData.z < 1.;
  vec3 local = position - aStart;
  float time = max(0., uTime-uStart-uDuration);
  float open = smoothstep(uStart+.53*radius+aStart.y*.13,
    uStart+uDuration*.85+.29*radius+aStart.y*.13,uTime);
  float edge = smoothstep(.23,.98,radius);
  vec3 p = petal ? mix(aStart+local*.04,position,open) : position;
  vec3 normal = normalize(aNormal);
  float phase = dot(position,vec3(4.9,5.6,7.2))-time*2.9;
  float crest = sin(phase);
  float flutter = sin(phase*.67 + time*.70);
  float grip = petal ? edge : .25;
  vec3 sweep = normalize(vec3(.76,-.32,.50) - normal*dot(normal,vec3(.76,-.32,.50)) + .0001);
  float fold = smoothstep(-.32,.93,crest);
  vec2 fall = normalize(local.xy+vec2(.0001));
  p += (normal * (.077*crest+.023*flutter) + sweep*.058*flutter)*grip*open;
  if (petal) {
    p.xy += fall * (.064*fold - .026) * grip * open;
    normal = normalize(normal - vec3(fall*.29*crest,0.)*grip);
  }

  float light = max(0.,dot(normalize(normalMatrix*normal),normalize(vec3(-.58,.54,.67))));
  if (petal) {
    float pigment = smoothstep(.12,.88,aTint.r);
    float rim = pow(light,3.)*(.56+.44*smoothstep(-.35,.85,flutter));
    float ember = (1.-smoothstep(.09,.36,radius))*smoothstep(.56,.91,light);
    vColor = mix(vec3(.032,.002,.005),vec3(1.11,.032,.073),
      sqrt(light)*(.42+.58*pigment));
    vColor += rim*vec3(1.62,.20,.24) + ember*vec3(.66,.19,.024);
    float veil = smoothstep(-.19,.90,crest)*edge;
    float grain = sin(position.x*87.+position.z*45.)*cos(position.y*80.-position.z*63.);
    vAlpha = smoothstep(.26,.83,open)*(.62+.34*seed)
      * (1.-veil*(.23+.64*smoothstep(-.42,.79,grain)));
    if (uDriftLayer > .5) {
      float feather = 1.-smoothstep(.84,1.12,length(local.xy)/.59);
      vAlpha = open * (.10+.54*veil) * (.32+.68*seed) * (.42+.58*feather);
      vColor = mix(vColor,vec3(1.36,.086,.135),.35);
    }
  } else {
    vColor = mix(vec3(.016,.022,.004),vec3(.20,.28,.064),light);
    vAlpha = smoothstep(uStart+.35,uStart+1.6,uTime)*(.46+.42*seed);
    if (uDriftLayer > .5) vAlpha *= .24;
  }
  if (uIsolated > .5 && (!petal || aStart.y < 1. ||
    local.x < .10 || local.y > .25)) vAlpha = 0.;
  vec4 view = modelViewMatrix * vec4(p,1.);
  gl_Position = projectionMatrix*view;
  float diameter = mix(2.30+.49*seed,1.28+.47*seed,uDriftLayer);
  gl_PointSize = clamp(diameter*uScale*6./-view.z,.65,4.2);
}
`;

export const currentFragment = `
uniform float uDriftLayer;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord-.5);
  float coverage = (1.-smoothstep(.19,.50,radius))*vAlpha;
  if (uDriftLayer > .5) {
    if (coverage < .014) discard;
    gl_FragColor = vec4(vColor,coverage);
  } else {
    if (coverage < .19) discard;
    gl_FragColor = vec4(vColor*(.47+.53*coverage),1.);
  }
}
`;

export const veilVertex = `
uniform float uTime;
uniform vec3 uCenter;
uniform sampler2D uMask;
uniform float uFront;
varying vec2 vUv;
varying float vFold;
${petalMotion}
void main() {
  vUv = uv;
  vec2 local = position.xy-uCenter.xy;
  vec3 flex = flexPetal(local, uTime);
  if (uFront > 1.5) {
    flex += vec3(-.008,.013,-.038);
  } else if (uFront > .5) {
    float mask = liftedPetal(local,texture2D(uMask,uv).r);
    flex += rollPetal(local,uTime,mask);
    flex.z += .018;
  }
  vFold = flex.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + flex, 1.);
}
`;

export const veilFragment = `
uniform sampler2D uMask;
uniform float uTime, uStart, uDuration;
uniform vec3 uCenter;
uniform vec2 uVeilSize;
uniform float uFront;
varying vec2 vUv;
varying float vFold;
${petalMotion}
void main() {
  vec4 petal = texture2D(uMask, vUv);
  float pigment = smoothstep(.012, .58, petal.r);
  float movingFold = smoothstep(-.058, .058, vFold);
  vec3 hue = mix(vec3(.19,.012,.024), vec3(.92,.038,.083), pigment);
  hue *= mix(.92, 1.16, movingFold);
  float fade = mix(smoothstep(8.0,9.8,uTime),smoothstep(.90,1.,uAssembly),uInteractive);
  float fiber = sin(vUv.x*204. + 2.*sin(vUv.y*112.)) * sin(vUv.y*241.);
  float opacity = petal.a * fade * pigment * (.58 + .12*movingFold) * (.86 + .14*fiber);
  vec2 local = (vUv-.5)*uVeilSize-uCenter.xy;
  float mask = liftedPetal(local,petal.r);
  float erosion = petalErosion(local, uTime);
  opacity *= 1. - erosion*.76;
  if (uFront > 1.5) {
    float lift = rollPetal(local,uTime,mask).z;
    opacity *= mask*smoothstep(.008,.085,lift)*.61;
    hue *= vec3(.63,.57,.57);
  } else if (uFront > .5) {
    opacity *= mask;
    hue *= 1.12 + .39*smoothstep(.035,.15,vFold);
    opacity *= 1.17;
  } else {
    opacity *= 1.-mask;
  }
  gl_FragColor = vec4(hue, opacity);
}
`;

export const vertexShader = `
${petalMotion}
attribute vec3 aStart;
attribute vec3 aTint;
attribute vec4 aData;
attribute vec3 aFloat;
attribute vec3 aMusicOffset;
attribute vec3 aStemOffset;
attribute vec4 aFlight;
uniform float uTime, uDark, uStart, uDuration, uSize, uScale;
uniform vec3 uFoldColor, uRedColor, uRimColor, uHeartColor;
uniform vec3 uSilverColor;
uniform vec3 uCenter;
uniform float uFront;
varying vec3 vColor;
varying float vAlpha;
varying float vGather;
varying float vGlint;
varying vec2 vFlightDirection;
void main() {
  float u = aData.x, layer = aData.y, type = aData.z, seed = aData.w;
  float launch = gatherLaunch(position,seed);
  float gather = clamp((uTime-launch)/gatherTravel(position,seed),0.,1.);
  if (uInteractive>.5) {
    float stagger=.13*clamp(u,0.,1.)+.045*aFlight.z;
    gather=clamp((uAssembly-stagger)/(1.-stagger),0.,1.);
  }
  vGather = gather;
  vGlint=smoothstep(.88,1.,gatherRandom(aFlight.z,12.))
    *(.68+.32*sin(uTime*.8+aFlight.z*11.))*(1.-smoothstep(.65,.98,gather));
  vFlightDirection=normalize((position.xy-aFloat.xy)*vec2(1.,-1.)+vec2(.0001));
  float unfold = smoothstep(.66,1.,gather);
  float visible = smoothstep(.0,.10,gather);
  vec3 target = position - aStart;
  vec3 pos = position;
  vec3 flow = sin(position.yzx * 11. + position.zxy * 5. + vec3(.7, -.89, .51) * uTime);
  pos += flow * (.001 + .005 * pow(u, 4.)) * unfold;
  float twinkle = .73 + .27 * sin(seed * 124. + uTime * (1.8 + seed * 3.));
  float size = (1.00 + 1.56 * pow(seed, 2.1)) * uSize;
  vColor = aTint * 1.76;
  vAlpha = visible * (.50 + .44 * seed) * (.84 + .16 * twinkle);
  if (type == 1.) {
    float ignition = visible;
    pos = position + flow * .034 * ignition;
    float heartDim = mix(1.,.26,smoothstep(uStart,uStart+uDuration,uTime));
    vec2 heartLocal = position.xy-uCenter.xy;
    pos = position + heartCurrent(heartLocal,uTime)*ignition;
    float filament = sin(heartLocal.x*48.+heartLocal.y*29.-uTime*2.5);
    pos.xy += vec2(.010*cos(filament+uTime),.012*sin(filament))*ignition;
    vColor = aTint * mix(.82, 3.7, pow(seed, 8.)) * (.85 + .23 * twinkle) * heartDim;
    vAlpha = ignition * (.29 + .56 * seed);
    size *= .76 + .77 * pow(seed, 5.);
  } else if (type == 2.) {
    pos = position + flow * .010;
    vAlpha = visible*(.24 + seed * .39);
    size *= .72;
  } else if (type == 3.) {
    vec2 local = position.xy-uCenter.xy;
    float speed = .60 + .29*seed;
    float life = fract(seed*41.7 + uTime*speed);
    float launched = petalErosion(local,uTime-life/speed);
    vec2 outward = local/max(length(local), .001);
    vec2 tangent = vec2(-outward.y,outward.x);
    pos = position + flexPetal(local,uTime)
      + vec3((tangent*(.043+.054*seed)+outward*(.016+.043*seed))*life,
        .041*life);
    vAlpha = smoothstep(.97,1.,gather)
      * sin(life*3.14159) * sqrt(launched) * (.44+.52*seed);
    vColor = uSilverColor*(1.25+1.8*seed) + vec3(.06,.08,.12);
    size *= .67 + .30*seed;
  }
  if (type == 0. || type == 2.) {
    vec2 lampDirection = vec2(-.64, .77);
    float facingLight = dot(target.xy, lampDirection);
    float fold = (aTint.r - .30) * .13;
    float lit = smoothstep(-.035, .095, facingLight + fold);
    if (type == 0.) {
      float detail = clamp(pow(aTint.r / 1.67, .56), 0., 1.);
      float body = smoothstep(.23, .82, detail);
      float outerPetal = smoothstep(.36, .88, u);
      float faceLight = mix(.35, 1., lit) * mix(.68, 1., outerPetal);
      float crest = smoothstep(.58, .96, detail) * faceLight;
      vec3 deepFold = uFoldColor * .66;
      vec3 petalRed = uRedColor * 5.6;
      vec3 brightRed = uRimColor * 5.5;
      vColor = mix(deepFold, petalRed, body) * mix(.43, 1.37, faceLight);
      vColor = mix(vColor, brightRed, crest*.68);
      float innerPetal = (1. - smoothstep(.09, .43, u)) * body;
      vec3 ember = mix(uFoldColor, uHeartColor * 4.9, body);
      vColor = mix(vColor, ember, innerPetal*.67);
      // Compensate for the warm background and additive glow in the final frame.
      vColor *= mix(vec3(1.27, .65, .57), vec3(1.14, 1., .58), innerPetal);
      vec2 local = target.xy;
      float lipHeight = -.105 + .75*local.x*local.x;
      float frontLip = (1. - smoothstep(.025, .085, abs(local.y-lipHeight)))
        * smoothstep(-.28, -.17, local.x) * (1. - smoothstep(.19, .30, local.x));
      float uprightFold = (1. - smoothstep(.014, .068, abs(local.x-.16-local.y*.22)))
        * smoothstep(-.105, -.04, local.y) * (1. - smoothstep(.09, .21, local.y));
      float litPetal = max(frontLip, uprightFold) * smoothstep(.24, .69, detail);
      // Coherent gaps follow the petal surface instead of flickering per particle.
      float coreFlow = 1.-smoothstep(.14,.33,length(position.xy-uCenter.xy));
      vec2 grain = local * vec2(73., 106.)
        - coreFlow*vec2(uTime*1.25,uTime*3.2);
      float mesh = sin(grain.x + 1.4*sin(grain.y*.43))
        * cos(grain.y + sin(grain.x*.57));
      float openings = smoothstep(-.68, .46, mesh);
      vColor *= .78;
      vColor += litPetal * mix(vec3(2.5,.11,.17), vec3(5.1,.58,.61), openings);
      vAlpha *= mix(.72 + .28*openings, .24 + .76*openings, litPetal);
      vColor *= 1.+.32*petalErosion(position.xy-uCenter.xy,uTime);
      size *= mix(.90, 1.24, body) * mix(1., 1.10, lit);
    } else {
      float leafLight = smoothstep(-.15, .14, dot(position.xy, lampDirection));
      float leafDetail = clamp(dot(aTint, vec3(.24, .68, .08)) * 6., 0., 1.);
      vColor = mix(vec3(.024, .023, .010), vec3(.35, .34, .12), leafDetail)
        * mix(.70, 1.55, leafLight);
    }
  }
  if (type == 0.) {
    vec2 local = position.xy-uCenter.xy;
    float mask = liftedPetal(local,aTint.r/1.72);
    vec3 flex = flexPetal(local, uTime);
    if (uFront > .5) flex += rollPetal(local,uTime,mask)+vec3(0.,0.,.018);
    pos += flex * unfold;
    vec2 tangent = vec2(-local.y, local.x);
    float erosion = petalErosion(local, uTime) * smoothstep(uStart+1., uStart+uDuration, uTime);
    vec2 outward = local / max(length(local), .001);
    pos.xy += (outward*(.004+seed*.015)+tangent*.024)*erosion;
    pos.z += (.011+.031*seed)*erosion;
    vAlpha *= mix(1., .18+.46*seed, erosion);
    vColor *= mix(.94, 1.13, smoothstep(-.055, .055, flex.z));
    vColor *= 1.+uFront*.33*smoothstep(.035,.17,flex.z);
    size *= mix(.89, .68, erosion);
  } else if (type == 3.) {
    if (uFront > .5) vAlpha = 0.;
    vec2 local = position.xy-uCenter.xy;
    pos += rollPetal(local,uTime,liftedPetal(local,aTint.r/1.72));
  } else {
    vAlpha *= 1.-uFront;
  }
  if (type != 3.) {
    if (uInteractive>.5) {
      float travel=smoothstep(0.,1.,gather);
      float coil=.65*sin(gather*3.14159265);
      mat2 rotation=mat2(cos(coil),sin(coil),-sin(coil),cos(coil));
      vec3 source=vec3(rotation*aFloat.xy,aFloat.z);
      vec3 tangent=vec3(-source.y,source.x,.2)*(.14+.06*aFlight.z);
      pos=mix(source,pos,travel)+tangent*sin(gather*3.14159265)*(1.-travel);
    } else pos = surroundGather(pos,seed,gather);
    float surfaceLayer=1.-uFront;
    if (type == 0.) {
      float mask = liftedPetal(position.xy-uCenter.xy,aTint.r/1.72);
      surfaceLayer=mix(1.-mask,mask,uFront);
    }
    if (uInteractive>.5) {
      // Every surface grain is already a visible galaxy star. Position,
      // opacity, footprint and pigment change throughout the same journey.
      float outer=1.-smoothstep(1.10,1.21,aFlight.w);
      float coreProtection=mix(.65,1.,smoothstep(.08,.40,aFlight.w));
      float dustAlpha=(.17+.18*seed)*outer*coreProtection;
      float floatingAlpha=mix(dustAlpha,.59+.25*seed,aFlight.x);
      float blend=smoothstep(.02,1.,gather);
      float opacity=mix(floatingAlpha,vAlpha*.82,blend);
      vAlpha=opacity*mix(1.-uFront,surfaceLayer,smoothstep(.20,1.,gather));
      float starCore=1.-smoothstep(.08,.48,aFlight.w);
      vec3 light=mix(vec3(.25,.45,1.55),vec3(.80,.65,1.35),gatherRandom(aFlight.z,8.));
      light=mix(light,vec3(2.10,1.35,.57),starCore*.88);
      vColor=mix(light,vColor,smoothstep(.04,1.,gather));
    } else {
      float arrival=smoothstep(.83,.995,gather);
      vAlpha*=mix(step(.989,gatherRandom(seed,7.))*.92,1.,arrival)
        *mix(1.-uFront,surfaceLayer,smoothstep(.86,1.,gather));
    }
  }
  if(type==0.||type==1.) {
    pos+=aMusicOffset*smoothstep(.94,1.,gather);
  }
  if(type<2.5)pos+=aStemOffset*smoothstep(.94,1.,gather);
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  float grainSize = .62+.78*pow(gatherRandom(seed,9.),2.5);
  float surfaceSize = size*grainSize*1.08;
  float beadSize = mix(5.5+25.*pow(gatherRandom(seed,10.),1.5),aFlight.y,uInteractive);
  if (uInteractive>.5 && aFlight.x<.5) beadSize=3.0+seed*2.5;
  float diameter = mix(beadSize,surfaceSize,smoothstep(0.,1.,gather));
  gl_PointSize = clamp(diameter*uScale*5./-mv.z,.7,36.);
}
`;



