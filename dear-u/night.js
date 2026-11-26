const background = document.createElement('canvas');
const foreground = document.createElement('canvas');
background.className = 'night-particles';
foreground.className = 'night-particles night-particles-front';
for (const canvas of [background, foreground]) canvas.setAttribute('aria-hidden', 'true');
document.querySelector('.wash').after(background);
document.body.append(foreground);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const layers = [background, foreground].map((canvas, index) => ({
  canvas,
  context: canvas.getContext('2d'),
  stars: Array.from({ length: index ? 24 : 150 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = (index ? .018 : .007) + Math.random() * .025;
    return {
      x: Math.random(), y: Math.random(),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: index ? 1.1 + Math.random() * 2.3 : .35 + Math.random() ** 2 * 1.7,
      phase: Math.random() * Math.PI * 2,
      frequency: .38 + Math.random() * .72,
      warm: Math.random() > .25,
    };
  }),
}));

// Soft sprites keep the glow continuous as brightness changes.
function makeGlow(warm) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const context = sprite.getContext('2d');
  const rgb = warm ? '255,222,168' : '171,209,255';
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,249,235,1)');
  gradient.addColorStop(.16, 'rgba(' + rgb + ',.86)');
  gradient.addColorStop(.42, 'rgba(' + rgb + ',.24)');
  gradient.addColorStop(1, 'rgba(' + rgb + ',0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return sprite;
}
const warmGlow = makeGlow(true);
const coolGlow = makeGlow(false);
const wrap = value => ((value % 1) + 1) % 1;
let width, height;

function draw(seconds) {
  layers.forEach(({ context, stars }, index) => {
    context.clearRect(0, 0, width, height);
    for (const star of stars) {
      const sway = Math.sin(seconds * .37 + star.phase) * .018;
      const x = wrap(star.x + star.vx * seconds + sway) * (width + 32) - 16;
      const y = wrap(star.y + star.vy * seconds + sway * .6) * (height + 32) - 16;
      const wave = .5 + .5 * Math.sin(seconds * star.frequency + star.phase);
      const shimmer = .5 + .5 * Math.sin(seconds * star.frequency * .61 + star.phase * 2);
      const glow = wave * (.65 + .35 * shimmer);
      const size = star.radius * (5.8 + glow * 1.4);
      context.globalAlpha = index ? .16 + glow * .36 : .14 + glow * .66;
      context.drawImage(star.warm ? warmGlow : coolGlow, x - size / 2, y - size / 2, size, size);
    }
  });
}

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  for (const { canvas, context } of layers) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  draw(reducedMotion.matches ? 0 : performance.now() / 1000);
}

function animate(time) {
  if (!reducedMotion.matches) draw(time / 1000);
  requestAnimationFrame(animate);
}

addEventListener('resize', resize);
reducedMotion.addEventListener('change', resize);
resize();
requestAnimationFrame(animate);
