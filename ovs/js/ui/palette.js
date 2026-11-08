// AURORA OS — Command Palette

import { h, $, $$ } from '../core/dom.js';
import { bus } from '../core/bus.js';

const _commands = new Map();
let _selected = 0;
let _results = [];
let _el = null;
let _input = null;
let _list = null;

function fuzzyScore(query, target) {
  if (!query) return 1;
  query = query.toLowerCase();
  target = target.toLowerCase();
  if (target === query) return 1000;
  if (target.startsWith(query)) return 800;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      score += 10 + consecutive * 5;
      if (ti === 0) score += 20;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }
  return qi === query.length ? score : -1;
}

export function registerCommand(cmd) {
  _commands.set(cmd.id, cmd);
}

export function registerCommands(list) {
  for (const c of list) _commands.set(c.id, c);
}

function allCommands() {
  return [..._commands.values()];
}

function filter(query) {
  const cmds = allCommands();
  if (!query.trim()) return cmds.slice(0, 30);
  const scored = cmds.map((c) => {
    const labelScore = fuzzyScore(query, c.label || '');
    const kwScore = c.keywords ? Math.max(...c.keywords.map((k) => fuzzyScore(query, k))) : -1;
    const score = Math.max(labelScore, kwScore);
    return { cmd: c, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 30).map((x) => x.cmd);
}

function render() {
  if (!_list) return;
  _list.innerHTML = '';
  if (!_results.length) {
    _list.append(h('div', { class: 'palette__empty', style: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }, text: 'No results' }));
    return;
  }
  _results.forEach((cmd, i) => {
    const item = h('div', {
      class: 'palette__result' + (i === _selected ? ' is-selected' : ''),
      role: 'option',
      'aria-selected': i === _selected ? 'true' : 'false',
      onClick: () => execute(cmd),
    });
    item.append(h('div', { class: 'palette__result-glyph', text: cmd.icon || '◆' }));
    item.append(h('div', { class: 'palette__result-label', text: cmd.label }));
    if (cmd.hint) item.append(h('div', { class: 'palette__result-hint', text: cmd.hint }));
    _list.append(item);
  });
  const sel = _list.querySelector('.is-selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function execute(cmd) {
  close();
  setTimeout(() => {
    try { cmd.run(); }
    catch (e) { console.error('[palette]', e); }
  }, 10);
}

export function openPalette(initialQuery = '') {
  if (!_el) return;
  _el.hidden = false;
  _input.value = initialQuery;
  _selected = 0;
  _results = filter(initialQuery);
  render();
  requestAnimationFrame(() => _input.focus());
  bus.emit('palette:open');
}

export function closePalette() {
  if (!_el) return;
  _el.hidden = true;
  bus.emit('palette:close');
}

export function initPalette() {
  _el = $('#palette');
  _input = $('#palette-input');
  _list = $('#palette-results');
  if (!_el) return;

  _el.querySelector('[data-close]')?.addEventListener('click', closePalette);

  _input.addEventListener('input', () => {
    _selected = 0;
    _results = filter(_input.value);
    render();
  });

  _input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selected = Math.min(_results.length - 1, _selected + 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selected = Math.max(0, _selected - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (_results[_selected]) execute(_results[_selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_el.hidden) closePalette();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (_el.hidden) openPalette();
      else closePalette();
    }
  });
}
