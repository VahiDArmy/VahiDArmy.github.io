// Miscellaneous keyboard shortcuts that the shortcuts reference advertises.
// Kept out of commands.js so the core binding file stays focused.

import { navigate } from './router.js';
import { downloadCurrentPack } from './commands.js';
import { toast, toastWarn } from './toast.js';
import { downloadBlob } from './download.js';
import { buildZip } from '../core/build-shim.js';
import { openShortcutsOverlay } from './shortcuts-overlay.js';
import { openSearchOverlay } from './search-overlay.js';

const NAV_SEQ = {
  d: 'dashboard',
  f: 'files',
  e: 'editor',
  l: 'log',
  i: 'stats',
  s: 'settings',
  h: 'help',
  t: 'templates',
  n: 'snapshots',
  c: 'diff',
  g: 'tags',
  w: 'onboarding',
};

let pending = null;
let pendingTimer = null;

export function initMiscShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const mod = e.ctrlKey || e.metaKey;
    const key = (e.key || '').toLowerCase();

    // Ctrl+Shift+S — download under a generated name
    if (mod && e.shiftKey && key === 's' && !inField) {
      e.preventDefault();
      downloadWithNewName();
      return;
    }

    // Ctrl+P — search overlay (browser's print is replaced while focus is not in a field)
    if (mod && key === 'p' && !inField) {
      // handled by search-overlay module, but kept here for fallback
      return;
    }

    // Ctrl+/ — comment current line (editor only)
    if (mod && key === '/' && tag === 'TEXTAREA') {
      e.preventDefault();
      toggleCommentLine(e.target);
      return;
    }

    // 'g' + letter navigation
    if (!mod && !e.altKey && !inField) {
      if (key === 'g') {
        if (pending === 'g') { pending = null; return; }
        pending = 'g';
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = null; }, 1200);
        return;
      }
      if (pending === 'g') {
        pending = null;
        clearTimeout(pendingTimer);
        if (NAV_SEQ[key]) {
          e.preventDefault();
          navigate(NAV_SEQ[key]);
          return;
        }
      }
    }
  });
}

function downloadWithNewName() {
  const bytes = buildZip();
  if (!bytes || !bytes.length) {
    toastWarn('Nothing to download yet');
    return;
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'project-pack-' + stamp + '.zip');
  toast('Downloaded with timestamped name');
}

function toggleCommentLine(area) {
  const value = area.value;
  const start = area.selectionStart;
  const end = area.selectionEnd;

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', start);
  if (lineEnd === -1) lineEnd = value.length;

  const firstLine = value.slice(lineStart, lineEnd);
  const isCommented = /^\s*(\/\/|#)\s?/.test(firstLine);

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const transformed = lines.map((line) => {
    if (isCommented) return line.replace(/^(\s*)(\/\/|#)\s?/, '$1');
    const m = line.match(/^(\s*)(.*)$/);
    const indent = m ? m[1] : '';
    const rest = m ? m[2] : line;
    return indent + '// ' + rest;
  }).join('\n');

  area.value = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
  const delta = transformed.length - block.length;
  area.selectionStart = Math.max(lineStart, start);
  area.selectionEnd = Math.max(lineStart, end + delta);
  area.dispatchEvent(new Event('input'));
}

export function openHelpFromShortcut() {
  openShortcutsOverlay();
}
