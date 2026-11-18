import { el, clear } from './dom.js';
import { state } from '../state.js';

const PANELS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'models', label: 'Models', icon: '⚙' },
  { id: 'projects', label: 'Projects', icon: '📦' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

let activePanel = 'chat';
let panelRootEl = null;
let tabbarEl = null;
let panelRenderers = {};
let shellCtx = null;

export function mountShell(root, { user, ctx, renderers }) {
  shellCtx = ctx;
  panelRenderers = renderers;
  clear(root);

  const shell = el('div', { class: 'shell' });
  const top = el('div', { class: 'shell-top' });
  top.appendChild(el('div', { class: 'brand' }, 'DevSpace'));
  const chip = el('div', { class: 'project-chip', onclick: () => setActivePanel('projects') });
  chip.appendChild(el('span', {}, state.currentProject?.name || 'No project'));
  top.appendChild(chip);
  top.appendChild(el('div', { class: 'spacer' }));
  top.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm',
    title: 'New project',
    onclick: () => setActivePanel('projects'),
  }, '+'));
  shell.appendChild(top);

  const body = el('div', { class: 'shell-body' });
  panelRootEl = el('div', { class: 'shell-main' });
  body.appendChild(panelRootEl);
  shell.appendChild(body);

  tabbarEl = el('div', { class: 'tabbar' });
  for (const p of PANELS) {
    const t = el('button', {
      class: 'tab',
      dataset: { panel: p.id },
      onclick: () => setActivePanel(p.id),
    },
      el('span', { class: 'tab-icon' }, p.icon),
      el('span', {}, p.label)
    );
    tabbarEl.appendChild(t);
  }
  shell.appendChild(tabbarEl);
  root.appendChild(shell);

  setActivePanel('chat');
}

export function setActivePanel(id) {
  if (!PANELS.find((p) => p.id === id)) return;
  activePanel = id;
  for (const tab of tabbarEl.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.panel === id);
  }
  renderActive();
}

export function renderActive() {
  if (!panelRootEl || !panelRenderers[activePanel]) return;
  clear(panelRootEl);
  const renderer = panelRenderers[activePanel];
  Promise.resolve(renderer(panelRootEl, shellCtx)).catch((err) => {
    panelRootEl.appendChild(el('div', { class: 'empty' }, `Panel error: ${err.message}`));
  });
}

export function getActivePanel() { return activePanel; }
