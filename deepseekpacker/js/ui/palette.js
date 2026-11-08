// Command palette (Ctrl/Cmd + K).

import { el, clear } from '../utils/dom.js';

let activePalette = null;

export function openPalette(commands) {
  if (activePalette) {
    closePalette();
    return;
  }

  const scrim = el('div', { class: 'palette-scrim', role: 'dialog', 'aria-label': 'Quick actions' });
  const palette = el('div', { class: 'palette' });

  const inputWrap = el('div', { class: 'palette-input-wrap' }, [
    el('span', { class: 'p-ico', html: '⌘' }),
    el('input', {
      class: 'palette-input',
      type: 'text',
      placeholder: 'Type to filter actions…',
      spellcheck: false,
      autocomplete: 'off',
      'aria-label': 'Search actions',
    }),
    el('kbd', { text: 'ESC' }),
  ]);
  const input = inputWrap.querySelector('input');
  const list = el('div', { class: 'palette-list', role: 'listbox' });
  const foot = el('div', { class: 'palette-foot' }, [
    el('span', { class: 'pf' }, [el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), el('span', { text: 'navigate' })]),
    el('span', { class: 'pf' }, [el('kbd', { text: '↵' }), el('span', { text: 'run' })]),
    el('span', { class: 'pf' }, [el('kbd', { text: 'ESC' }), el('span', { text: 'dismiss' })]),
  ]);

  palette.appendChild(inputWrap);
  palette.appendChild(list);
  palette.appendChild(foot);
  scrim.appendChild(palette);
  document.getElementById('overlay-root').appendChild(scrim);
  activePalette = { scrim, input, list, commands, filtered: commands.slice(), index: 0 };

  renderList();

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    activePalette.filtered = q
      ? commands.filter((c) => {
          const text = (c.label + ' ' + (c.hint || '') + ' ' + (c.group || '')).toLowerCase();
          return text.includes(q);
        })
      : commands.slice();
    activePalette.index = 0;
    renderList();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runActive();
    }
  };
  document.addEventListener('keydown', onKey, true);
  activePalette.onKey = onKey;

  scrim.addEventListener('mousedown', (e) => {
    if (e.target === scrim) closePalette();
  });

  setTimeout(() => input.focus(), 20);

  function move(delta) {
    const f = activePalette.filtered;
    if (!f.length) return;
    activePalette.index = (activePalette.index + delta + f.length) % f.length;
    renderList();
    const active = list.querySelector('.palette-item.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function runActive() {
    const f = activePalette.filtered;
    if (!f.length) return;
    const cmd = f[activePalette.index];
    closePalette();
    if (cmd && typeof cmd.run === 'function') {
      setTimeout(() => cmd.run(), 10);
    }
  }

  function renderList() {
    clear(list);
    const items = activePalette.filtered;
    if (!items.length) {
      list.appendChild(el('div', { class: 'palette-empty', text: 'No matching actions' }));
      return;
    }
    let lastGroup = null;
    items.forEach((cmd, i) => {
      if (cmd.group && cmd.group !== lastGroup) {
        lastGroup = cmd.group;
        list.appendChild(el('div', { class: 'palette-group', text: cmd.group }));
      }
      const item = el('button', {
        class: ['palette-item', i === activePalette.index ? 'is-active' : null].filter(Boolean).join(' '),
        type: 'button',
        role: 'option',
        'aria-selected': String(i === activePalette.index),
        onClick: () => {
          closePalette();
          if (typeof cmd.run === 'function') setTimeout(() => cmd.run(), 10);
        },
      }, [
        el('span', { class: 'p-ico', html: cmd.icon || '·' }),
        el('span', { class: 'p-label', text: cmd.label }),
        cmd.hint ? el('span', { class: 'p-hint', text: cmd.hint }) : null,
      ]);
      list.appendChild(item);
    });
  }
}

export function closePalette() {
  if (!activePalette) return;
  const { scrim, onKey } = activePalette;
  if (onKey) document.removeEventListener('keydown', onKey, true);
  if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim);
  activePalette = null;
}

export function isPaletteOpen() {
  return !!activePalette;
}
