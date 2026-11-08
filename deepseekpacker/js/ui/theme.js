// Theme cycling button.

import { State, setSettings } from '../core/state.js';
import { toast } from './toast.js';

const ORDER = ['obsidian', 'graphite', 'aurora', 'paper'];
const LABELS = {
  obsidian: 'Obsidian',
  graphite: 'Graphite',
  aurora: 'Aurora',
  paper: 'Paper',
};

export function initThemeButton() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const idx = ORDER.indexOf(State.settings.theme);
    const next = ORDER[(idx + 1) % ORDER.length];
    setSettings({ theme: next });
    toast('Theme: ' + LABELS[next]);
  });
}
