// AURORA OS — Boot Sequence

import { bus } from './core/bus.js';
import { store } from './core/store.js';
import { persist } from './core/persist.js';
import { h, $, $$, clear, fmtTime, fmtDate } from './core/dom.js';
import { wm } from './core/wm.js';
import { router } from './core/router.js';
import { initPalette, registerCommand, openPalette } from './ui/palette.js';
import toast from './ui/toasts.js';
import { contextMenu } from './ui/contextmenu.js';

import * as dashboardApp from './apps/dashboard.js';
import * as kanbanApp from './apps/kanban.js';
import * as datagridApp from './apps/datagrid.js';
import * as analyticsApp from './apps/analytics.js';
import * as calendarApp from './apps/calendar.js';
import * as notesApp from './apps/notes.js';
import * as chatApp from './apps/chat.js';
import * as filesApp from './apps/files.js';
import * as terminalApp from './apps/terminal.js';
import * as musicApp from './apps/music.js';
import * as settingsApp from './apps/settings.js';
import * as codepadApp from './apps/codepad.js';

const APPS = [
  dashboardApp, kanbanApp, datagridApp, analyticsApp, calendarApp,
  notesApp, chatApp, filesApp, terminalApp, musicApp, settingsApp, codepadApp,
];

// --- Inject extra app styles ---
(function injectStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/apps-more.css';
  document.head.append(link);
})();

// --- Boot sequence ---
const BOOT_STEPS = [
  'cold-start',
  'loading kernel',
  'mounting filesystem',
  'starting services',
  'initializing window manager',
  'loading applications',
  'ready',
];

async function bootSequence() {
  const fill = $('#boot-fill');
  const status = $('#boot-status');
  const boot = $('#boot');
  if (!fill || !status || !boot) return;

  for (let i = 0; i < BOOT_STEPS.length; i++) {
    status.textContent = BOOT_STEPS[i];
    fill.style.width = ((i + 1) / BOOT_STEPS.length * 100) + '%';
    await new Promise((r) => setTimeout(r, 140));
  }

  boot.classList.add('is-hiding');
  setTimeout(() => {
    boot.hidden = true;
    $('#desktop').hidden = false;
    bus.emit('boot:complete');
  }, 450);
}

// --- Apply persisted preferences ---
function applyPreferences() {
  const theme = persist.get('theme', 'dark');
  document.documentElement.dataset.theme = theme;
  store.set('theme', theme);

  const density = persist.get('density', 'default');
  if (density !== 'default') document.documentElement.dataset.density = density;
  store.set('density', density);

  const reduceMotion = persist.get('settings.reduceMotion', false);
  document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  store.set('settings.reduceMotion', reduceMotion);

  const clock24 = persist.get('settings.clock24', true);
  store.set('settings.clock24', clock24);
  const showSeconds = persist.get('settings.showSeconds', false);
  store.set('settings.showSeconds', showSeconds);
}

// --- Clock ---
let _clockTimer = null;
function updateClock() {
  const timeEl = $('#clock-time');
  const dateEl = $('#clock-date');
  if (!timeEl || !dateEl) return;
  const now = new Date();
  const showSeconds = store.get('settings.showSeconds');
  const clock24 = store.get('settings.clock24');
  let hours = now.getHours();
  let ampm = '';
  if (!clock24) {
    ampm = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
  }
  const hh = String(hours).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  timeEl.textContent = hh + ':' + mm + (showSeconds ? ':' + ss : '') + ampm;
  dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function startClock() {
  if (_clockTimer) clearInterval(_clockTimer);
  updateClock();
  _clockTimer = setInterval(updateClock, 1000);
  bus.on('clock:update', updateClock);
}

// --- Dock ---
const DOCK_APPS = ['dashboard', 'kanban', 'datagrid', 'analytics', 'calendar', 'notes', 'chat', 'files', 'terminal', 'music', 'codepad', 'settings'];

function renderDock() {
  const dock = $('#dock');
  if (!dock) return;
  clear(dock);
  for (const id of DOCK_APPS) {
    const app = APPS.find((a) => a.meta.id === id);
    if (!app) continue;
    const item = h('button', { class: 'dock__item', type: 'button', title: app.meta.title });
    item.append(h('span', { text: app.meta.icon }));
    item.append(h('span', { class: 'dock__tooltip', text: app.meta.title }));
    item.addEventListener('click', () => openApp(id));
    item.dataset.appId = id;
    dock.append(item);
  }
  bus.on('wm:closed', (winId) => updateDockActive());
  bus.on('wm:opened', () => updateDockActive());
  bus.on('wm:focus', () => updateDockActive());
}

function updateDockActive() {
  const activeWinId = store.get('activeWindow');
  $$('.dock__item').forEach((el) => {
    const appId = el.dataset.appId;
    el.classList.toggle('is-active', activeWinId === 'app-' + appId);
  });
}

// --- Open app ---
function openApp(appId) {
  const app = APPS.find((a) => a.meta.id === appId);
  if (!app) return;
  const winId = 'app-' + appId;
  const existing = wm.windows.get(winId);
  if (existing) {
    wm.focus(winId);
    if (existing.el.classList.contains('is-minimized')) wm.restore(winId);
    return;
  }
  const container = document.createElement('div');
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';
  try {
    app.mount(container);
  } catch (e) {
    console.error('[app]', appId, e);
    container.append(h('div', { text: 'Failed to load app: ' + e.message, style: { padding: '20px', color: 'var(--danger)' } }));
  }
  wm.open({
    id: winId,
    title: app.meta.title,
    icon: app.meta.icon,
    width: app.meta.defaultSize?.width || 720,
    height: app.meta.defaultSize?.height || 480,
    content: container,
  });
}

// --- Menubar ---
function wireMenubar() {
  $('#btn-search')?.addEventListener('click', () => openPalette());
  $('#btn-settings')?.addEventListener('click', () => openApp('settings'));
  $('#btn-notif')?.addEventListener('click', () => toggleNotifications());
  $('#brand-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('#sysmenu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
    if (!menu.hidden) {
      const close = () => { menu.hidden = true; document.removeEventListener('click', close); };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  });
  $$('#sysmenu .sysmenu__item').forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      $('#sysmenu').hidden = true;
      if (action === 'about') toast.info('AURORA OS v1.0.0');
      else if (action === 'settings') openApp('settings');
      else if (action === 'reload') location.reload();
      else if (action === 'lock') toast.info('Lock not implemented');
    });
  });
}

// --- Notifications ---
function toggleNotifications() {
  const panel = $('#notif-center');
  if (!panel) return;
  panel.hidden = !panel.hidden;
}
function clearNotifications() {
  const list = $('#notif-list');
  const empty = $('#notif-empty');
  if (!list || !empty) return;
  clear(list);
  empty.hidden = false;
  const badge = $('#notif-badge');
  if (badge) badge.hidden = true;
  $('#notif-clear')?.addEventListener('click', () => {});
}
function wireNotifications() {
  $('#notif-clear')?.addEventListener('click', clearNotifications);
}

// --- Keyboard shortcuts ---
function wireShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (isMeta && e.key === 'w') {
      e.preventDefault();
      const active = store.get('activeWindow');
      if (active) wm.close(active);
      return;
    }
    if (isMeta && e.key === 'n') {
      e.preventDefault();
      openApp('notes');
      return;
    }
    if (isMeta && e.key === 'j') {
      e.preventDefault();
      openPalette('theme');
      return;
    }
  });
}

// --- Register palette commands ---
function registerAppCommands() {
  for (const app of APPS) {
    registerCommand({
      id: 'app:' + app.meta.id,
      label: 'Open ' + app.meta.title,
      icon: app.meta.icon,
      keywords: ['app', app.meta.id, 'open', 'launch'],
      run: () => openApp(app.meta.id),
    });
  }
  registerCommand({
    id: 'theme:toggle',
    label: 'Toggle theme (dark / light)',
    icon: '◐',
    keywords: ['theme', 'dark', 'light', 'switch'],
    run: () => {
      const cur = store.get('theme');
      const next = cur === 'dark' || cur === 'midnight' || cur === 'ocean' || cur === 'forest' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('theme', next);
      persist.set('theme', next);
      toast.success('Theme: ' + next);
    },
  });
  registerCommand({
    id: 'reload',
    label: 'Reload application',
    icon: '↻',
    keywords: ['reload', 'refresh', 'restart'],
    run: () => location.reload(),
  });
}

// --- Desktop icons ---
const DESKTOP_ICONS = ['dashboard', 'kanban', 'notes', 'terminal'];
function renderDesktopIcons() {
  const container = $('#desktop-icons');
  if (!container) return;
  clear(container);
  for (const id of DESKTOP_ICONS) {
    const app = APPS.find((a) => a.meta.id === id);
    if (!app) continue;
    const icon = h('div', { class: 'desktop-icon' });
    icon.append(h('div', { class: 'desktop-icon__glyph', text: app.meta.icon }));
    icon.append(h('div', { class: 'desktop-icon__label', text: app.meta.title }));
    icon.addEventListener('dblclick', () => openApp(id));
    icon.addEventListener('click', () => {});
    container.append(icon);
  }
}

// --- App open event ---
bus.on('app:open', (appId) => openApp(appId));

// --- Init ---
async function init() {
  applyPreferences();
  startClock();

  const workspace = $('#workspace');
  if (workspace) {
    wm.init(workspace);
  }

  initPalette();
  registerAppCommands();
  renderDock();
  renderDesktopIcons();
  wireMenubar();
  wireNotifications();
  wireShortcuts();

  // Welcome toast
  bus.on('boot:complete', () => {
    setTimeout(() => toast.info('Welcome to AURORA OS · Press ⌘K to search'), 600);
  });

  await bootSequence();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
