// AURORA OS — Settings

import { h, $, clear } from '../core/dom.js';
import { store } from '../core/store.js';
import { persist } from '../core/persist.js';
import { bus } from '../core/bus.js';
import { toggle, segmented, slider, button } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'settings',
  title: 'Settings',
  icon: '⚙',
  defaultSize: { width: 720, height: 620 },
};

const THEMES = [
  { id: 'dark', label: 'Dark', colors: ['#0b0d12', '#1e2330', '#7c5cff'] },
  { id: 'light', label: 'Light', colors: ['#f5f6fa', '#eef1f7', '#5c48e0'] },
  { id: 'midnight', label: 'Midnight', colors: ['#05060a', '#161d2e', '#4fa9ff'] },
  { id: 'paper', label: 'Paper', colors: ['#f0e9dc', '#ebe2d0', '#b8581b'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0a1620', '#183749', '#2ec5e0'] },
  { id: 'forest', label: 'Forest', colors: ['#0c1410', '#1c2d22', '#4ade80'] },
];

function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  store.set('theme', id);
  persist.set('theme', id);
  bus.emit('theme:change', id);
}

function applyDensity(d) {
  if (d === 'default') delete document.documentElement.dataset.density;
  else document.documentElement.dataset.density = d;
  store.set('density', d);
  persist.set('density', d);
}

function themeCard(theme, active) {
  const card = h('div', { class: 'theme-card' + (theme.id === active ? ' is-active' : '') });
  const preview = h('div', { class: 'theme-card__preview' });
  for (const c of theme.colors) {
    const sw = h('div', { class: 'theme-card__swatch' });
    sw.style.background = c;
    preview.append(sw);
  }
  card.append(preview, h('div', { class: 'theme-card__label', text: theme.label }));
  card.addEventListener('click', () => {
    applyTheme(theme.id);
    document.querySelectorAll('.theme-card').forEach((el) => el.classList.remove('is-active'));
    card.classList.add('is-active');
    toast.success('Theme: ' + theme.label);
  });
  return card;
}

function buildSection(title, desc, children) {
  const sec = h('div', { class: 'settings-section' });
  sec.append(h('div', { class: 'settings-section__title', text: title }));
  if (desc) sec.append(h('div', { class: 'settings-section__desc', text: desc }));
  for (const c of children) sec.append(c);
  return sec;
}

function buildRow(label, hint, control) {
  const row = h('div', { class: 'settings-row' });
  const left = h('div', {});
  left.append(h('div', { class: 'settings-row__label', text: label }));
  if (hint) left.append(h('div', { class: 'settings-row__hint', text: hint }));
  row.append(left, control);
  return row;
}

export function mount(container) {
  clear(container);
  const root = h('div', { class: 'settings-wrap' });

  const themeGrid = h('div', { class: 'theme-grid' });
  for (const t of THEMES) themeGrid.append(themeCard(t, store.get('theme')));
  root.append(buildSection('Appearance', 'Choose your theme and density.', [themeGrid]));

  const densitySeg = segmented([
    { value: 'compact', label: 'Compact' },
    { value: 'default', label: 'Default' },
    { value: 'comfortable', label: 'Comfortable' },
  ], { active: store.get('density') || 'default', onChange: applyDensity });
  root.append(buildSection('Density', 'Adjust spacing and font sizes.', [
    buildRow('Layout density', 'Compact uses less padding and smaller fonts.', densitySeg),
  ]));

  const reduceMotion = toggle('Reduce motion', {
    checked: store.get('settings.reduceMotion'),
    onChange: (e) => {
      const v = e.target.checked;
      store.set('settings.reduceMotion', v);
      document.documentElement.dataset.reduceMotion = v ? 'true' : 'false';
      persist.set('settings.reduceMotion', v);
    },
  });
  const clock24 = toggle('24-hour clock', {
    checked: store.get('settings.clock24'),
    onChange: (e) => {
      const v = e.target.checked;
      store.set('settings.clock24', v);
      persist.set('settings.clock24', v);
      bus.emit('clock:update');
    },
  });
  const showSeconds = toggle('Show seconds', {
    checked: store.get('settings.showSeconds'),
    onChange: (e) => {
      const v = e.target.checked;
      store.set('settings.showSeconds', v);
      persist.set('settings.showSeconds', v);
      bus.emit('clock:update');
    },
  });
  root.append(buildSection('Behavior', 'Tune the interface to your preference.', [
    buildRow('Reduce motion', 'Disable animations across the OS.', reduceMotion),
    buildRow('24-hour clock', 'Use 24-hour time format.', clock24),
    buildRow('Show seconds', 'Display seconds in the menubar clock.', showSeconds),
  ]));

  root.append(buildSection('Data', 'Manage local storage.', [
    buildRow('Reset all settings', 'Clears preferences and reloads.', button('Reset', { variant: 'danger', size: 'sm', onClick: () => {
      if (confirm('Reset all settings and reload?')) {
        persist.clear();
        location.reload();
      }
    } })),
    buildRow('Storage used', null, h('span', { class: 'text-sm text-muted', text: (persist.size() / 1024).toFixed(1) + ' KB' })),
  ]));

  root.append(buildSection('About', null, [
    buildRow('Version', null, h('span', { class: 'text-sm text-muted', text: '1.0.0' })),
    buildRow('Built with', null, h('span', { class: 'text-sm text-muted', text: 'Vanilla HTML · CSS · JS' })),
    buildRow('No dependencies', null, h('span', { class: 'text-sm text-muted', text: 'Zero packages' })),
  ]));

  container.append(root);
}

export default { meta, mount };
