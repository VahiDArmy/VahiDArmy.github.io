/* ============================================================
   js/core/shortcuts.js
   Keyboard shortcut registry with sequences and scopes
   ============================================================ */

import { SHORTCUT_SCOPES } from '../config/constants.js';

/**
 * @typedef {Object} Shortcut
 * @property {string} combo      e.g. "ctrl+k", "g d", "n", "?"
 * @property {string} scope      one of SHORTCUT_SCOPES
 * @property {string} label      Persian label for help
 * @property {string} [group]
 * @property {() => void} handler
 * @property {boolean} [allowInInput]
 * @property {boolean} [preventDefault=true]
 */

const SEQUENCE_TIMEOUT = 1400;

class ShortcutManager {
  constructor() {
    /** @type {Shortcut[]} */
    this.shortcuts = [];
    /** @type {string} */
    this.scope = SHORTCUT_SCOPES.GLOBAL;
    /** @type {string} */
    this._pendingSeq = '';
    /** @type {number|null} */
    this._seqTimer = null;
    /** @type {boolean} */
    this.enabled = true;
    /** @type {HTMLElement|null} */
    this._helpEl = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onBlur = this._resetSequence.bind(this);
  }

  /* ── Registration ─────────────────────────────────────── */

  /**
   * @param {Partial<Shortcut> & {combo:string, handler:() => void}} def
   * @returns {() => void} unregister
   */
  register(def) {
    const entry = {
      scope: SHORTCUT_SCOPES.GLOBAL,
      label: '',
      group: 'عمومی',
      allowInInput: false,
      preventDefault: true,
      ...def,
      combo: normalizeCombo(def.combo),
    };
    this.shortcuts.push(entry);
    return () => {
      const idx = this.shortcuts.indexOf(entry);
      if (idx >= 0) this.shortcuts.splice(idx, 1);
    };
  }

  /**
   * Bulk register.
   * @param {Array<Partial<Shortcut> & {combo:string, handler:() => void}>} list
   */
  registerMany(list) {
    return list.map((s) => this.register(s));
  }

  /**
   * Set the active scope.
   * @param {string} scope
   */
  setScope(scope) {
    this.scope = scope;
    this._resetSequence();
  }

  /**
   * Enable/disable globally.
   * @param {boolean} on
   */
  setEnabled(on) {
    this.enabled = !!on;
  }

  /* ── Lifecycle ────────────────────────────────────────── */

  start() {
    document.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('blur', this._onBlur);
  }

  stop() {
    document.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('blur', this._onBlur);
  }

  /* ── Help overlay ─────────────────────────────────────── */

  /**
   * Get all shortcuts grouped for display in help overlay.
   * @returns {Array<{group:string, items:Array<{combo:string, label:string}>}>}
   */
  grouped() {
    const map = new Map();
    for (const s of this.shortcuts) {
      if (!s.label) continue;
      const g = s.group || 'عمومی';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push({ combo: s.combo, label: s.label });
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }

  /* ── Internals ────────────────────────────────────────── */

  /**
   * @param {KeyboardEvent} ev
   */
  _onKeyDown(ev) {
    if (!this.enabled) return;
    if (ev.isComposing || ev.keyCode === 229) return;

    const target = ev.target;
    const isInput = target && (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    );

    const key = keyName(ev);
    if (!key) return;

    // Build current buffer: if it's a modifier combo, check directly
    const direct = buildCombo(ev, key);

    // Try direct match first
    const directMatch = this._findMatch(direct, isInput);
    if (directMatch) {
      if (directMatch.preventDefault) ev.preventDefault();
      this._resetSequence();
      try { directMatch.handler(ev); } catch (e) { console.error('[shortcuts]', e); }
      return;
    }

    // Skip sequence logic for inputs (unless allowInInput)
    if (isInput) return;

    // Sequence handling (e.g., "g d")
    if (/^[a-z]$/i.test(key)) {
      const seq = this._pendingSeq ? `${this._pendingSeq} ${key}` : key;
      // Check if any shortcut starts with this sequence
      const candidates = this.shortcuts.filter(
        (s) => s.scope === this.scope || s.scope === SHORTCUT_SCOPES.GLOBAL
      );
      const hasMatch = candidates.some((s) => s.combo === seq);
      const hasPrefix = candidates.some((s) => s.combo.startsWith(seq + ' '));

      if (hasMatch) {
        const sc = candidates.find((s) => s.combo === seq);
        if (sc) {
          if (sc.preventDefault) ev.preventDefault();
          this._resetSequence();
          try { sc.handler(ev); } catch (e) { console.error('[shortcuts]', e); }
          return;
        }
      }
      if (hasPrefix) {
        this._pendingSeq = seq;
        if (this._seqTimer) clearTimeout(this._seqTimer);
        this._seqTimer = setTimeout(() => this._resetSequence(), SEQUENCE_TIMEOUT);
      } else {
        this._resetSequence();
      }
    }
  }

  /**
   * @param {string} combo
   * @param {boolean} isInput
   * @returns {Shortcut|null}
   */
  _findMatch(combo, isInput) {
    for (const s of this.shortcuts) {
      if (s.combo !== combo) continue;
      if (s.scope !== this.scope && s.scope !== SHORTCUT_SCOPES.GLOBAL) continue;
      if (isInput && !s.allowInInput) continue;
      return s;
    }
    return null;
  }

  _resetSequence() {
    this._pendingSeq = '';
    if (this._seqTimer) { clearTimeout(this._seqTimer); this._seqTimer = null; }
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Convert "Ctrl+K" → "ctrl+k".
 * @param {string} s
 */
function normalizeCombo(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/control/g, 'ctrl')
    .replace(/cmd|meta/g, 'meta')
    .replace(/option/g, 'alt')
    .trim();
}

/**
 * @param {KeyboardEvent} ev
 * @returns {string}
 */
function keyName(ev) {
  const k = ev.key;
  if (!k) return '';
  if (k === ' ') return 'space';
  if (k === 'Escape') return 'esc';
  if (k === 'ArrowUp') return 'up';
  if (k === 'ArrowDown') return 'down';
  if (k === 'ArrowLeft') return 'left';
  if (k === 'ArrowRight') return 'right';
  if (k === 'Enter') return 'enter';
  if (k === 'Tab') return 'tab';
  if (k.length === 1) return k.toLowerCase();
  return k.toLowerCase();
}

/**
 * @param {KeyboardEvent} ev
 * @param {string} key
 * @returns {string}
 */
function buildCombo(ev, key) {
  const parts = [];
  if (ev.ctrlKey) parts.push('ctrl');
  if (ev.altKey) parts.push('alt');
  if (ev.shiftKey && key.length === 1 && !/^[a-z0-9]$/.test(key)) parts.push('shift');
  if (ev.metaKey) parts.push('meta');
  parts.push(key);
  return parts.join('+');
}

export const shortcuts = new ShortcutManager();
export { ShortcutManager };