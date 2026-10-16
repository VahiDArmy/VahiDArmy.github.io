/* ============================================================
   js/core/command-palette.js
   Ctrl+K command palette: nav + actions + search lies (fuzzy)
   ============================================================ */

import { el, byId, clear, focusables, trapFocus } from '../utils/dom.js';
import { bus } from './event-bus.js';
import { EVENTS, ROUTES } from '../config/constants.js';
import { NAV_ITEMS, THEMES, ACCENTS, FONT_SIZES, APP } from '../config/app.config.js';
import { escapeHtml, truncate } from '../utils/sanitize.js';
import { toast } from '../ui/toast.js';
import { confirmDanger } from '../ui/confirm.js';
import * as liesService from '../services/lies.service.js';
import * as exportService from '../services/export.service.js';
import { applyTheme, cycleTheme, getTheme } from '../ui/theme.js';
import { toFaDigits, formatRelative } from '../utils/format.js';
import { debounce } from '../utils/debounce.js';

/** @type {HTMLElement|null} */
let palette = null;
/** @type {HTMLElement|null} */
let inputEl = null;
/** @type {HTMLElement|null} */
let resultsEl = null;
let highlighted = 0;
let releaseFocus = null;
let initialized = false;
let searchToken = 0;
/** @type {Array<{id:string, type:string, label:string, hint?:string, icon?:string, run:Function, keywords?:string}>} */
let staticCommands = [];
let recentIds = [];
let lieResults = [];

const RECENT_KEY = 'cp:recent';

/* ── Public ──────────────────────────────────────────────── */

export function initCommandPalette() {
  if (initialized) return;
  initialized = true;

  buildStaticCommands();
  loadRecent();

  bus.on(EVENTS.COMMAND_PALETTE_OPEN, open);
  bus.on('ui:command-palette-open', open);
  bus.on(EVENTS.ROUTE_CHANGED, close);
}

export function open() {
  if (palette) return;
  buildPalette();
  renderResults('');
  document.body.classList.add('has-overlay');
  requestAnimationFrame(() => palette.classList.add('is-visible'));
  releaseFocus = trapFocus(palette);
  inputEl?.focus();
}

export function close() {
  if (!palette) return;
  const p = palette;
  palette = null;
  inputEl = null;
  resultsEl = null;
  releaseFocus?.();
  releaseFocus = null;
  document.body.classList.remove('has-overlay');
  p.classList.remove('is-visible');
  setTimeout(() => p.remove(), 200);
}

export function toggle() {
  if (palette) close();
  else open();
}

/* ── Static commands ─────────────────────────────────────── */

function buildStaticCommands() {
  const cmds = [];

  // Navigation
  for (const item of NAV_ITEMS) {
    cmds.push({
      id: `nav:${item.id}`,
      type: 'nav',
      label: `رفتن به ${item.label}`,
      hint: item.shortcut || '',
      icon: item.icon,
      keywords: `${item.id} ${item.label}`,
      run: () => { location.hash = `#/${item.id}`; },
    });
  }

  // Actions
  cmds.push({
    id: 'action:new-lie',
    type: 'action',
    label: 'ثبت دروغ جدید',
    hint: 'N',
    icon: '＋',
    keywords: 'ثبت جدید ایجاد ساخت دروغ',
    run: () => { location.hash = '#/lies?new=1'; },
  });
  cmds.push({
    id: 'action:analytics',
    type: 'action',
    label: 'مشاهدهٔ تحلیل و آمار',
    icon: '📊',
    keywords: 'تحلیل آمار نمودار',
    run: () => { location.hash = `#/${ROUTES.ANALYTICS}`; },
  });
  cmds.push({
    id: 'action:toggle-theme',
    type: 'action',
    label: 'تغییر تم',
    icon: '🌗',
    keywords: 'تم theme دارک لایت',
    run: () => {
      cycleTheme();
      const t = getTheme();
      toast.info(`تم: ${t.theme}`);
    },
  });
  for (const a of ACCENTS) {
    cmds.push({
      id: `action:accent:${a.id}`,
      type: 'action',
      label: `اکسنت ${a.label}`,
      icon: '🎨',
      keywords: `رنگ اکسنت ${a.label}`,
      run: () => { applyTheme({ accent: a.id }); toast.info(`اکسنت: ${a.label}`); },
    });
  }
  for (const s of FONT_SIZES) {
    cmds.push({
      id: `action:font:${s}`,
      type: 'action',
      label: `اندازه فونت: ${s}`,
      icon: '🔤',
      keywords: `فونت اندازه ${s}`,
      run: () => { applyTheme({ fontSize: s }); toast.info(`اندازه: ${s}`); },
    });
  }
  cmds.push({
    id: 'action:export-json',
    type: 'action',
    label: 'خروجی JSON',
    icon: '📦',
    keywords: 'خروجی پشتیبان export json',
    run: async () => {
      try { await exportService.exportJSON(); toast.success('فایل دانلود شد.'); }
      catch (err) { toast.error(err.message); }
    },
  });
  cmds.push({
    id: 'action:export-csv',
    type: 'action',
    label: 'خروجی CSV',
    icon: '📄',
    keywords: 'خروجی csv اکسل',
    run: async () => {
      try { await exportService.exportLiesCSV(); toast.success('CSV دانلود شد.'); }
      catch (err) { toast.error(err.message); }
    },
  });
  cmds.push({
    id: 'action:export-md',
    type: 'action',
    label: 'خروجی Markdown',
    icon: '📝',
    keywords: 'خروجی markdown متن',
    run: async () => {
      try { await exportService.exportMarkdown(); toast.success('Markdown دانلود شد.'); }
      catch (err) { toast.error(err.message); }
    },
  });
  cmds.push({
    id: 'action:purge-trash',
    type: 'action',
    label: 'پاک کردن کامل سطل زباله (قدیمی‌تر از ۳۰ روز)',
    icon: '🧹',
    keywords: 'پاک سطل زباله trash',
    run: async () => {
      const ok = await confirmDanger({
        title: 'پاک‌سازی سطل زباله',
        message: 'همهٔ موارد قدیمی‌تر از ۳۰ روز برای همیشه حذف شوند؟',
        phrase: 'پاک',
      });
      if (!ok) return;
      try {
        const n = await liesService.purgeTrash(30);
        toast.success(`${toFaDigits(n || 0)} مورد حذف شد.`);
      } catch (err) { toast.error(err.message); }
    },
  });
  cmds.push({
    id: 'action:settings',
    type: 'action',
    label: 'تنظیمات',
    icon: '⚙️',
    keywords: 'settings تنظیمات',
    run: () => { location.hash = `#/${ROUTES.SETTINGS}`; },
  });
  cmds.push({
    id: 'action:help',
    type: 'action',
    label: 'راهنمای میان‌برها',
    icon: '⌨️',
    keywords: 'کمک راهنما shortcut',
    run: () => { byId('help-btn')?.click(); },
  });

  staticCommands = cmds;
}

/* ── Recent ─────────────────────────────────────────────── */

function loadRecent() {
  try {
    recentIds = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(recentIds)) recentIds = [];
  } catch { recentIds = []; }
}

function pushRecent(id) {
  recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, 6);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds)); } catch { /* noop */ }
}

/* ── Build UI ────────────────────────────────────────────── */

function buildPalette() {
  palette = el('div', {
    class: 'command-palette',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'پالت دستور' },
  });

  const backdrop = el('div', { class: 'command-palette__backdrop' });
  backdrop.addEventListener('click', close);

  const card = el('div', { class: 'command-palette__card' });

  const head = el('div', { class: 'command-palette__head' });
  const searchIco = el('span', { class: 'command-palette__search-ico' }, { children: ['🔍'] });
  inputEl = el('input', {
    class: 'command-palette__input',
    attrs: {
      type: 'text',
      placeholder: 'دنبال چه چیزی می‌گردی؟ (دستور یا دروغ…)',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });
  const kbdHint = el('span', { class: 'command-palette__kbd' });
  kbdHint.innerHTML = '<kbd>ESC</kbd>';
  head.appendChild(searchIco);
  head.appendChild(inputEl);
  head.appendChild(kbdHint);
  card.appendChild(head);

  resultsEl = el('div', { class: 'command-palette__results', attrs: { role: 'listbox' } });
  card.appendChild(resultsEl);

  const foot = el('div', { class: 'command-palette__foot' });
  foot.innerHTML = `
    <span><kbd>↑</kbd><kbd>↓</kbd> پیمایش</span>
    <span><kbd>Enter</kbd> اجرا</span>
    <span><kbd>Esc</kbd> بستن</span>
    <span class="command-palette__brand">${escapeHtml(APP.name)} · ${escapeHtml(APP.version)}</span>
  `;
  card.appendChild(foot);

  palette.appendChild(backdrop);
  palette.appendChild(card);
  document.body.appendChild(palette);

  inputEl.addEventListener('input', debounce((ev) => runSearch(ev.target.value), 140));
  inputEl.addEventListener('keydown', onKeyDown);
  resultsEl.addEventListener('click', (ev) => {
    const item = ev.target.closest('[data-cmd-id]');
    if (item) execute(item.dataset.cmdId);
  });
  resultsEl.addEventListener('mousemove', (ev) => {
    const item = ev.target.closest('[data-cmd-index]');
    if (item) {
      highlighted = Number(item.dataset.cmdIndex);
      updateHighlight();
    }
  });
}

/* ── Search ──────────────────────────────────────────────── */

const runSearch = async (query) => {
  const q = String(query || '').trim();

  // Static commands (filtered by fuzzy)
  let cmds;
  if (!q) {
    // Show recent first then rest
    const recents = recentIds.map((id) => staticCommands.find((c) => c.id === id)).filter(Boolean);
    const rest = staticCommands.filter((c) => !recentIds.includes(c.id));
    cmds = [...recents, ...rest].slice(0, 12);
  } else {
    cmds = fuzzyFilter(staticCommands, q).slice(0, 8);
  }

  // Lies (search server-side)
  let lies = [];
  if (q.length >= 2) {
    const token = ++searchToken;
    try {
      lies = await liesService.search(q, 8);
      if (token !== searchToken) return;
    } catch { lies = []; }
  }
  lieResults = lies;

  renderResults(q, cmds, lies);
};

/* ── Rendering ───────────────────────────────────────────── */

function renderResults(query, cmds, lies) {
  if (!resultsEl) return;
  clear(resultsEl);
  highlighted = 0;

  let index = 0;
  const items = [];

  if (cmds.length) {
    resultsEl.appendChild(sectionLabel(query ? 'دستورها' : 'اخیر و پرکاربرد', '⌘'));
    for (const c of cmds) {
      items.push(buildCommandItem(c, index++, query));
    }
  }

  if (lies.length) {
    resultsEl.appendChild(sectionLabel('دروغ‌ها', '🎭'));
    for (const lie of lies) {
      items.push(buildLieItem(lie, index++, query));
    }
  }

  if (!items.length) {
    const empty = el('div', { class: 'command-palette__empty' });
    if (!query) {
      empty.textContent = 'برای جست‌وجو تایپ کن یا یک دستور را انتخاب کن.';
    } else {
      empty.textContent = `نتیجه‌ای برای «${query}» پیدا نشد.`;
    }
    resultsEl.appendChild(empty);
  } else {
    for (const it of items) resultsEl.appendChild(it);
  }

  updateHighlight();
}

function sectionLabel(label, icon) {
  const el0 = el('div', { class: 'command-palette__section-label' });
  el0.innerHTML = `<span class="cp-section-icon">${icon}</span><span>${escapeHtml(label)}</span>`;
  return el0;
}

function buildCommandItem(cmd, index, query) {
  const btn = el('button', {
    class: 'command-palette__item',
    attrs: { type: 'button', 'data-cmd-id': cmd.id, 'data-cmd-index': String(index) },
  });
  btn.appendChild(el('span', { class: 'command-palette__item-icon' }, { children: [cmd.icon || '•'] }));
  const body = el('div', { class: 'command-palette__item-body' });
  body.appendChild(el('div', { class: 'command-palette__item-label' }, {
    children: [highlightMatch(cmd.label, query)],
  }));
  if (cmd.hint) {
    body.appendChild(el('div', { class: 'command-palette__item-hint' }, { children: [cmd.hint] }));
  }
  btn.appendChild(body);
  const tag = el('span', { class: 'command-palette__item-tag' }, { children: ['دستور'] });
  btn.appendChild(tag);
  return btn;
}

function buildLieItem(lie, index, query) {
  const btn = el('button', {
    class: 'command-palette__item command-palette__item--lie',
    attrs: { type: 'button', 'data-cmd-id': `lie:${lie.id}`, 'data-cmd-index': String(index) },
  });
  btn.appendChild(el('span', { class: 'command-palette__item-icon' }, { children: ['🎭'] }));
  const body = el('div', { class: 'command-palette__item-body' });
  body.appendChild(el('div', { class: 'command-palette__item-label' }, {
    children: [highlightMatch(lie.title, query)],
  }));
  if (lie.body) {
    body.appendChild(el('div', { class: 'command-palette__item-hint' }, {
      children: [escapeHtml(truncate(lie.body.replace(/\s+/g, ' ').trim(), 80))],
    }));
  }
  btn.appendChild(body);
  btn.appendChild(el('span', { class: 'command-palette__item-tag' }, {
    children: [formatRelative(lie.updated_at || lie.created_at)],
  }));
  return btn;
}

function highlightMatch(text, query) {
  const s = String(text || '');
  const q = String(query || '').trim();
  if (!q) return escapeHtml(s);
  const lower = s.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return escapeHtml(s);
  const before = escapeHtml(s.slice(0, idx));
  const match = escapeHtml(s.slice(idx, idx + q.length));
  const after = escapeHtml(s.slice(idx + q.length));
  return `${before}<mark class="cp-mark">${match}</mark>${after}`;
}

/* ── Keyboard ────────────────────────────────────────────── */

function onKeyDown(ev) {
  const items = Array.from(resultsEl?.querySelectorAll('[data-cmd-id]') || []);
  if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
  if (ev.key === 'ArrowDown') { ev.preventDefault(); moveHighlight(1, items); return; }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); moveHighlight(-1, items); return; }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const current = items[highlighted];
    if (current) execute(current.dataset.cmdId);
  }
  if (ev.key === 'Home') { ev.preventDefault(); highlighted = 0; updateHighlight(); }
  if (ev.key === 'End') { ev.preventDefault(); highlighted = items.length - 1; updateHighlight(); }
}

function moveHighlight(delta, items) {
  if (!items.length) return;
  highlighted = (highlighted + delta + items.length) % items.length;
  updateHighlight();
  items[highlighted]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function updateHighlight() {
  if (!resultsEl) return;
  const items = Array.from(resultsEl.querySelectorAll('[data-cmd-id]'));
  items.forEach((it, i) => it.classList.toggle('is-highlighted', i === highlighted));
}

/* ── Execute ─────────────────────────────────────────────── */

async function execute(id) {
  close();

  if (id.startsWith('lie:')) {
    const lieId = id.slice(4);
    pushRecent(id);
    location.hash = `#/lie/${lieId}`;
    return;
  }

  const cmd = staticCommands.find((c) => c.id === id);
  if (!cmd) return;
  pushRecent(id);
  try {
    await cmd.run();
  } catch (err) {
    console.error('[command-palette] command failed', err);
    toast.error(err?.message || 'خطا در اجرا');
  }
}

/* ── Fuzzy filter ────────────────────────────────────────── */

function fuzzyFilter(list, query) {
  const q = query.toLowerCase().trim();
  if (!q) return list;
  const scored = [];
  for (const item of list) {
    const text = `${item.label} ${item.keywords || ''}`.toLowerCase();
    const score = fuzzyScore(q, text);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

function fuzzyScore(query, text) {
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      qi++;
      consecutive++;
      score += 1 + consecutive * 0.6;
      if (i === 0 || text[i - 1] === ' ') score += 1.2;
    } else {
      consecutive = 0;
    }
  }
  if (qi < query.length) return 0;
  return score;
}

export default { initCommandPalette, open, close, toggle };