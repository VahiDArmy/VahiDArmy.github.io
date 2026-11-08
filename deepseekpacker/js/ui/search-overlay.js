// Global search overlay — press '/' to open a fuzzy file finder.

import { el, clear } from '../utils/dom.js';
import { State } from '../core/state.js';
import { basename, dirname, fmtBytes, extLabel, fileKind } from '../utils/format.js';
import { navigate } from './router.js';

let active = null;

export function initSearchOverlay() {
  const input = document.getElementById('global-search');
  if (input) {
    input.addEventListener('focus', () => { /* handled by the topbar */ });
  }

  document.addEventListener('keydown', (e) => {
    if (active) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      openSearchOverlay();
    }
  });
}

export function openSearchOverlay(initial = '') {
  if (active) return;

  const scrim = el('div', {
    class: 'palette-scrim',
    role: 'dialog',
    'aria-label': 'Search files',
  });

  const panel = el('div', {
    class: 'palette',
    style: { maxHeight: 'min(70dvh, 640px)' },
  });

  const head = el('div', { class: 'palette-input-wrap' }, [
    el('span', { class: 'p-ico', html: '⌕' }),
    el('input', {
      class: 'palette-input',
      type: 'search',
      placeholder: 'Find a file by name or path…',
      spellcheck: false,
      autocomplete: 'off',
      value: initial,
    }),
    el('kbd', { text: 'ESC' }),
  ]);
  const input = head.querySelector('input');

  const list = el('div', {
    class: 'palette-list',
    role: 'listbox',
    style: { padding: '4px' },
  });

  const foot = el('div', { class: 'palette-foot' }, [
    el('span', { class: 'pf' }, [el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), el('span', { text: 'navigate' })]),
    el('span', { class: 'pf' }, [el('kbd', { text: '↵' }), el('span', { text: 'open' })]),
    el('span', { class: 'pf' }, [el('kbd', { text: 'ESC' }), el('span', { text: 'dismiss' })]),
  ]);

  panel.appendChild(head);
  panel.appendChild(list);
  panel.appendChild(foot);
  scrim.appendChild(panel);
  document.getElementById('overlay-root').appendChild(scrim);

  let results = [];
  let selected = 0;

  function search(query) {
    const q = String(query || '').trim().toLowerCase();
    const all = Array.from(State.files.values());
    let scored = all.map((file) => ({ file, score: scoreMatch(file.path, q) }));
    if (q) scored = scored.filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
    return scored.slice(0, 30).map((s) => s.file);
  }

  function scoreMatch(path, q) {
    if (!q) return 1;
    const lower = path.toLowerCase();
    const base = basename(lower);
    if (base === q) return 1000;
    if (base.startsWith(q)) return 800;
    if (base.includes(q)) return 600;
    if (lower.includes(q)) return 400;
    // Fuzzy: subsequence
    let i = 0;
    for (const ch of lower) {
      if (ch === q[i]) i++;
      if (i === q.length) return 200;
    }
    return 0;
  }

  function render() {
    clear(list);
    if (!State.files.size) {
      list.appendChild(el('div', {
        class: 'palette-empty',
        text: 'No files packed yet. Paste a message with FILE/END blocks first.',
      }));
      return;
    }
    if (!results.length) {
      list.appendChild(el('div', { class: 'palette-empty', text: 'No matches' }));
      return;
    }
    results.forEach((file, i) => {
      const row = el('button', {
        class: ['palette-item', i === selected ? 'is-active' : ''].filter(Boolean).join(' '),
        type: 'button',
        role: 'option',
        onClick: () => {
          close();
          navigate('editor', { path: file.path });
        },
        onMouseEnter: () => {
          if (selected !== i) {
            selected = i;
            highlight();
          }
        },
      }, [
        el('span', {
          class: 'file-ext',
          dataset: { kind: fileKind(file.path) },
          style: { width: '22px', height: '22px', fontSize: '9px' },
          text: extLabel(file.path),
        }),
        el('span', {
          style: {
            flex: '1 1 auto',
            minWidth: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
          },
        }, [
          el('span', {
            style: { fontSize: 'var(--fs-sm)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            text: basename(file.path),
          }),
          el('span', {
            style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            text: dirname(file.path) || '.',
          }),
        ]),
        el('span', { class: 'p-hint', text: fmtBytes(file.bytes.length) }),
      ]);
      list.appendChild(row);
    });
  }

  function highlight() {
    Array.from(list.children).forEach((child, i) => {
      child.classList.toggle('is-active', i === selected);
    });
    const el_ = list.children[selected];
    if (el_) el_.scrollIntoView({ block: 'nearest' });
  }

  function move(delta) {
    if (!results.length) return;
    selected = (selected + delta + results.length) % results.length;
    highlight();
  }

  function close() {
    document.removeEventListener('keydown', onKey, true);
    if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
    active = null;
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const file = results[selected];
      if (file) {
        close();
        navigate('editor', { path: file.path });
      }
    }
  };

  document.addEventListener('keydown', onKey, true);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });

  input.addEventListener('input', () => {
    results = search(input.value);
    selected = 0;
    render();
  });

  results = search(initial);
  render();
  setTimeout(() => { input.focus(); input.select(); }, 30);

  active = { close };
}

export function closeSearchOverlay() {
  if (active) active.close();
}
