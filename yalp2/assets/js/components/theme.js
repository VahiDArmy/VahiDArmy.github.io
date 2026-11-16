/* ============================================================
   Theme manager — dark (default) / light, persisted
   ============================================================ */
const KEY = 'smyar.theme.v1';
let currentTheme = 'dark';

export function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch {}
  // Default to dark; also respect OS preference on first visit
  let initial = stored;
  if (!initial) {
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches;
    initial = prefersLight ? 'light' : 'dark';
  }
  applyTheme(initial, { persist: false });
}

export function getTheme() { return currentTheme; }

export function applyTheme(theme, { persist = true } = {}) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // Update theme-color meta for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', currentTheme === 'light' ? '#f8f8fb' : '#07070d');
  if (persist) {
    try { localStorage.setItem(KEY, currentTheme); } catch {}
  }
  // Notify listeners
  window.dispatchEvent(new CustomEvent('smyar:theme', { detail: { theme: currentTheme } }));
}

export function toggleTheme() {
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  return currentTheme;
}
