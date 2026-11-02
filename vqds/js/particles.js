/* ==========================================================================
   particles.js — ذرات شناور پس‌زمینه (قلب صورتی / ستاره پسرانه)
   ========================================================================== */

import { CONFIG } from './config.js';
import { device, randomBetween } from './utils.js';

const SVG_HEART = 'M12 21S3.5 15.5 3.5 9.4A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.6C20.5 15.5 12 21 12 21Z';
const SVG_STAR = 'M12 2l2.9 6.9L22 9.6l-5.5 4.9L18.2 22 12 18.3 5.8 22l1.7-7.5L2 9.6l7.1-.7z';

let container = null;

function createParticle(themeId) {
  const isHeart = themeId === 'pink';
  const path = isHeart ? SVG_HEART : SVG_STAR;
  const type = isHeart ? 'heart' : 'star';
  const size = randomBetween(12, 28);
  const left = randomBetween(-2, 100);
  const duration = randomBetween(14, 26);
  const delay = randomBetween(0, 10);
  const opacity = randomBetween(0.25, 0.55);

  const node = document.createElement('div');
  node.className = `particle particle--${type}`;
  node.setAttribute('aria-hidden', 'true');
  node.style.cssText = `
    position: absolute;
    left: ${left}%;
    bottom: -60px;
    width: ${size}px;
    height: ${size}px;
    animation-duration: ${duration}s;
    animation-delay: -${delay}s;
    opacity: ${opacity};
    color: var(--color-heart-soft);
    fill: currentColor;
    pointer-events: none;
    will-change: transform, opacity;
  `;
  node.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="${path}"/></svg>`;
  return node;
}

function getCount() {
  const desired = device.isMobile
    ? CONFIG.ui.particleCountMobile
    : CONFIG.ui.particleCountDesktop;
  return Math.max(4, Math.min(desired, 40));
}

export function initParticles() {
  container = document.getElementById('ambientParticles');
  if (!container) return;

  const theme = document.documentElement.getAttribute('data-theme') || CONFIG.defaultTheme;
  const count = getCount();

  container.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    container.appendChild(createParticle(theme));
  }

  // بازسازی هنگام تغییر تم
  window.addEventListener('q56:theme-changed', (e) => {
    rebuild(e.detail?.theme || theme);
  });
}

function rebuild(themeId) {
  if (!container) return;
  const count = getCount();
  container.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    container.appendChild(createParticle(themeId));
  }
}

export default { initParticles };