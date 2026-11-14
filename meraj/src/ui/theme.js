/** Apply appearance settings to the document. */
import { ACCENTS, CONFIG, THEMES } from '../config.js';

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [231, 194, 125];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixWhite(rgb, amount = 0.4) {
  return rgb.map((channel) => Math.round(channel + (255 - channel) * amount));
}

export function applyAppearance(settings = {}) {
  const root = document.documentElement;
  const theme = THEMES.some((item) => item.id === settings.theme) ? settings.theme : CONFIG.defaults.theme;
  const accent = ACCENTS.find((item) => item.id === settings.accent) || ACCENTS[0];
  const rgb = hexToRgb(accent.hex);
  const soft = mixWhite(rgb, 0.35);

  root.dataset.theme = theme;
  root.dataset.density = settings.density === 'compact' ? 'compact' : 'comfortable';
  root.dataset.motion = settings.motion === false ? 'off' : 'on';
  root.dataset.bubbles = settings.bubbles || 'soft';
  root.style.setProperty('--accent', accent.hex);
  root.style.setProperty('--accent-soft', `rgb(${soft.join(' ')})`);
  root.style.setProperty('--accent-rgb', rgb.join(' '));
  root.style.setProperty('--font-scale', String(settings.fontScale || 1));
  root.style.setProperty('--ui-radius', settings.radius || '18px');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const isLight = theme === 'dawn';
    meta.setAttribute('content', isLight ? '#f2eadc' : '#080910');
  }

  const themeMeta = THEMES.find((item) => item.id === theme);
  document.documentElement.dataset.themeName = themeMeta?.name || 'Nocturne';
  applyFavicon(accent.hex, theme === 'dawn' ? '#f2eadc' : '#080910');
}

export function applyFavicon(accent = '#e7c27d', background = '#080910') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="${background}"/>
    <path d="M32 10 L49 44 H15 Z" fill="none" stroke="${accent}" stroke-width="2"/>
    <path d="M32 19 L41 37 H23 Z" fill="${accent}" fill-opacity=".22" stroke="${accent}" stroke-width="1.4"/>
    <circle cx="32" cy="44" r="2.4" fill="${accent}"/>
  </svg>`;
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = href;
}

export function themeName(id) {
  return THEMES.find((theme) => theme.id === id)?.name || 'Nocturne';
}

export function accentName(id) {
  return ACCENTS.find((accent) => accent.id === id)?.name || 'Gold';
}
