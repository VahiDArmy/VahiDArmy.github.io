/**
 * Global keyboard shortcuts.
 * Registers a listener that dispatches to matching handlers.
 *
 *   registerShortcut({ keys: 'Ctrl+K', handler: () => {...} });
 *
 * Supported modifiers: Ctrl, Shift, Alt, Meta (Cmd).
 * Keys are matched case-insensitively against event.key.
 */

import { bus } from '../utils/events.js';

const shortcuts = [];
let installed = false;

function comboFromEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(String(e.key || '').toLowerCase());
  return parts.join('+');
}

function parseCombo(combo) {
  return String(combo)
    .toLowerCase()
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (p === 'cmd' || p === 'command' || p === 'meta' ? 'ctrl' : p))
    .sort((a, b) => {
      const order = ['ctrl', 'alt', 'shift'];
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .join('+');
}

function install() {
  if (installed) return;
  installed = true;

  document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs/textareas/contenteditable — unless a shortcut
    // explicitly requests `allowInInput`.
    const target = e.target;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const combo = comboFromEvent(e);
    const parsedCombo = parseCombo(combo);

    for (const sc of shortcuts) {
      if (sc.combo !== parsedCombo) continue;
      if (isTyping && !sc.allowInInput) continue;
      try {
        sc.handler(e);
        if (sc.preventDefault !== false) e.preventDefault();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[keyboard]', err);
      }
      bus.emit('keyboard:shortcut', { combo: parsedCombo });
      return;
    }
  });
}

/**
 * @param {Object} opts
 * @param {string} opts.keys — e.g. "Ctrl+K", "/", "Escape"
 * @param {Function} opts.handler
 * @param {boolean} [opts.allowInInput]
 * @param {boolean} [opts.preventDefault]
 * @param {string} [opts.label] — display label for the shortcuts modal
 * @returns {Function} — unregister
 */
export function registerShortcut({ keys, handler, allowInInput = false, preventDefault = true, label = '' } = {}) {
  install();
  const combo = parseCombo(keys);
  const entry = { combo, handler, allowInInput, preventDefault, label, keys };
  shortcuts.push(entry);
  return () => {
    const idx = shortcuts.indexOf(entry);
    if (idx !== -1) shortcuts.splice(idx, 1);
  };
}

export function listShortcuts() {
  return shortcuts.map((s) => ({ keys: s.keys, label: s.label }));
}

/** The canonical shortcuts shown in the settings dialog. */
export const CANONICAL_SHORTCUTS = [
  { keys: 'Ctrl+K', label: 'جستجوی سراسری' },
  { keys: 'Shift+?', label: 'نمایش راهنمای میانبر' },
  { keys: 'Escape', label: 'بستن پنجره/منو' },
  { keys: 'G سپس H', label: 'رفتن به خانه' },
  { keys: 'G سپس P', label: 'رفتن به افراد' },
  { keys: 'G سپس T', label: 'رفتن به نظریه‌ها' },
];