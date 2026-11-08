// Lightweight confetti burst for satisfying milestones.

const COLORS = [
  '#7dd3a8',
  '#59b7e6',
  '#c79bf0',
  '#e3bb7c',
  '#6ee7d0',
  '#9db8ff',
  '#f19ba6',
];

let canvas = null;
let ctx = null;
let particles = [];
let rafHandle = null;

function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  return canvas;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function burst(options = {}) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ensureCanvas();

  const origin = options.origin || {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.4,
  };
  const count = options.count || 90;
  const spread = options.spread || 6;
  const baseVelocity = options.velocity || 9;
  const gravity = options.gravity || 0.24;

  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * Math.PI * spread / 3;
    const speed = baseVelocity * (0.5 + Math.random() * 0.8);
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed - Math.random() * 3,
      size: 3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      life: 1,
      gravity,
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
    });
  }

  if (!rafHandle) tick();
}

function tick() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let alive = 0;
  for (const p of particles) {
    if (p.life <= 0) continue;
    alive++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.995;
    p.rotation += p.spin;
    p.life -= 0.012;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 40);

  if (alive > 0) {
    rafHandle = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function cleanup() {
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = null;
  particles = [];
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  ctx = null;
}
