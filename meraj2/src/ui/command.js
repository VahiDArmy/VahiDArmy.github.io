/** ⌘K command palette. Commands are supplied by the app so every action is real. */
import { escapeHtml } from '../utils.js';
import { icon } from './icons.js';

let openInstance = null;

export function isCommandPaletteOpen() {
  return Boolean(openInstance);
}

function matches(command, query) {
  if (!query) return true;
  const haystack = `${command.label} ${command.hint || ''} ${(command.keywords || []).join(' ')}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

export function openCommandPalette(commands = []) {
  if (openInstance) {
    openInstance.close();
  }
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'cmdk-layer';
  root.innerHTML = `
    <div class="cmdk-backdrop" data-cmdk-close></div>
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk__search">
        ${icon('search', { size: 18 })}
        <input class="cmdk__input" type="text" placeholder="Search commands, models, destinations…" autocomplete="off" spellcheck="false" />
        <kbd class="kbd">Esc</kbd>
      </div>
      <div class="cmdk__list" role="listbox"></div>
      <div class="cmdk__foot"><span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> navigate</span><span><kbd class="kbd">↵</kbd> run</span><span class="cmdk__count"></span></div>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('has-modal');

  const input = root.querySelector('.cmdk__input');
  const list = root.querySelector('.cmdk__list');
  const count = root.querySelector('.cmdk__count');
  let filtered = [];
  let activeIndex = 0;

  const close = () => {
    if (!openInstance) return;
    root.classList.add('is-closing');
    document.body.classList.remove('has-modal');
    document.removeEventListener('keydown', onGlobalKey, true);
    openInstance = null;
    window.setTimeout(() => {
      root.remove();
      if (previousFocus && document.body.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    }, 140);
  };

  const execute = (command) => {
    if (!command) return;
    close();
    window.setTimeout(() => command.run?.(), 40);
  };

  const render = () => {
    const query = input.value.trim();
    filtered = commands.filter((command) => matches(command, query));
    if (!filtered.length) {
      list.innerHTML = `<div class="cmdk__empty">${icon('search', { size: 24 })}<p>No command matches <strong>${escapeHtml(query)}</strong>.</p></div>`;
      count.textContent = '0 results';
      return;
    }
    activeIndex = Math.min(activeIndex, filtered.length - 1);
    list.innerHTML = filtered
      .map(
        (command, index) => `
        <button type="button" class="cmdk__item ${index === activeIndex ? 'is-active' : ''}" role="option" aria-selected="${index === activeIndex}" data-command-index="${index}">
          <span class="cmdk__icon">${icon(command.icon || 'spark', { size: 17 })}</span>
          <span class="cmdk__copy"><span class="cmdk__label">${escapeHtml(command.label)}</span>${command.hint ? `<span class="cmdk__hint">${escapeHtml(command.hint)}</span>` : ''}</span>
          ${command.note ? `<span class="cmdk__note">${escapeHtml(command.note)}</span>` : ''}
        </button>`,
      )
      .join('');
    count.textContent = `${filtered.length} command${filtered.length === 1 ? '' : 's'}`;
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };

  const move = (delta) => {
    if (!filtered.length) return;
    activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
    render();
  };

  const onGlobalKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  input.addEventListener('input', () => {
    activeIndex = 0;
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(filtered[activeIndex]);
    }
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-command-index]');
    if (!button) return;
    execute(filtered[Number(button.dataset.commandIndex)]);
  });
  list.addEventListener('mousemove', (event) => {
    const button = event.target.closest('[data-command-index]');
    if (!button) return;
    const index = Number(button.dataset.commandIndex);
    if (index !== activeIndex) {
      activeIndex = index;
      render();
    }
  });
  root.querySelector('[data-cmdk-close]')?.addEventListener('click', close);
  document.addEventListener('keydown', onGlobalKey, true);

  openInstance = { close, root };
  render();
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    input.focus();
  });
  return openInstance;
}
