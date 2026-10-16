/* ============================================================
   js/ui/chips.js
   Tag/chip renderer + selector (multi & single)
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { uuid } from '../utils/id.js';

/**
 * Render a chip.
 * @param {{id?:string, label:string, color?:string, icon?:string, removable?:boolean, onRemove?:()=>void, onClick?:()=>void, active?:boolean, size?:'sm'|'md'}} opts
 * @returns {HTMLElement}
 */
export function chip(opts) {
  const {
    label, color, icon, removable, onRemove, onClick,
    active = false, size = 'md',
  } = opts;

  const node = el('span', {
    class: ['chip', `chip--${size}`, active ? 'is-active' : ''].filter(Boolean),
    style: color ? { '--chip-color': color } : {},
  });

  if (icon) node.appendChild(el('span', { class: 'chip__icon' }, { children: [icon] }));
  if (color) node.appendChild(el('span', { class: 'chip__dot' }));
  node.appendChild(el('span', { class: 'chip__label' }, { children: [label] }));

  if (removable) {
    const rm = el('button', {
      class: 'chip__remove',
      attrs: { type: 'button', 'aria-label': `حذف ${label}` },
      on: { click: (ev) => { ev.stopPropagation(); onRemove?.(); } },
    }, { children: ['✕'] });
    node.appendChild(rm);
  }

  if (onClick) {
    node.classList.add('is-clickable');
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.addEventListener('click', onClick);
    node.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); }
    });
  }

  return node;
}

/**
 * Render a list of chips.
 * @param {Array<Parameters<typeof chip>[0]>} items
 * @param {{limit?:number, overflowLabel?:string}} [opts]
 * @returns {HTMLElement}
 */
export function chipList(items = [], opts = {}) {
  const { limit, overflowLabel } = opts;
  const wrap = el('div', { class: 'chip-list' });
  const shown = limit ? items.slice(0, limit) : items;
  for (const it of shown) wrap.appendChild(chip(it));
  if (limit && items.length > limit) {
    wrap.appendChild(chip({
      label: overflowLabel || `+${items.length - limit}`,
      size: 'sm',
    }));
  }
  return wrap;
}

/**
 * Chip selector: renders an input with suggestions and selected chips.
 * @param {{
 *   items?: Array<{id:string, label:string, color?:string, icon?:string}>,
 *   selectedIds?: string[],
 *   placeholder?: string,
 *   creatable?: boolean,
 *   maxItems?: number,
 *   onChange?: (ids:string[], items:any[]) => void,
 *   onCreate?: (name:string) => Promise<{id:string,label:string,color?:string}> | {id:string,label:string,color?:string},
 *   allowDuplicates?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function chipSelector(opts = {}) {
  const {
    items = [],
    selectedIds = [],
    placeholder = 'افزودن…',
    creatable = false,
    maxItems = Infinity,
    onChange,
    onCreate,
  } = opts;

  const wrap = el('div', { class: 'chip-selector' });
  const selected = new Set(selectedIds);
  const lookup = new Map(items.map((i) => [i.id, i]));

  const selectedWrap = el('div', { class: 'chip-selector__selected' });
  const input = el('input', {
    class: 'chip-selector__input',
    attrs: { type: 'text', placeholder, autocomplete: 'off' },
  });
  const suggestions = el('div', { class: 'chip-selector__suggestions' });

  function refreshSelected() {
    clear(selectedWrap);
    for (const id of selected) {
      const it = lookup.get(id);
      if (!it) continue;
      selectedWrap.appendChild(chip({
        label: it.label,
        color: it.color,
        icon: it.icon,
        removable: true,
        size: 'sm',
        onRemove: () => {
          selected.delete(id);
          refreshSelected();
          refreshSuggestions();
          emitChange();
        },
      }));
    }
    input.placeholder = selected.size ? '' : placeholder;
  }

  function refreshSuggestions() {
    clear(suggestions);
    const q = input.value.trim().toLowerCase();
    const list = items
      .filter((it) => !selected.has(it.id))
      .filter((it) => !q || it.label.toLowerCase().includes(q));

    if (!list.length && !(creatable && q)) {
      suggestions.classList.remove('is-open');
      return;
    }

    for (const it of list.slice(0, 8)) {
      const row = el('button', {
        class: 'chip-selector__option',
        attrs: { type: 'button' },
        on: { mousedown: (ev) => ev.preventDefault() },
      });
      if (it.color) row.appendChild(el('span', { class: 'chip-selector__swatch', style: { background: it.color } }));
      if (it.icon) row.appendChild(el('span', {}, { children: [it.icon] }));
      row.appendChild(el('span', { class: 'chip-selector__option-label' }, { children: [it.label] }));
      row.addEventListener('click', () => pick(it));
      suggestions.appendChild(row);
    }

    if (creatable && q && !items.some((it) => it.label.toLowerCase() === q)) {
      const row = el('button', {
        class: 'chip-selector__option chip-selector__option--create',
        attrs: { type: 'button' },
        on: { mousedown: (ev) => ev.preventDefault() },
      });
      row.appendChild(el('span', { class: 'chip-selector__option-icon' }, { children: ['➕'] }));
      row.appendChild(el('span', {}, { children: [`ساخت «${input.value.trim()}»`] }));
      row.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) return;
        try {
          const created = await onCreate?.(name);
          if (created) {
            const it = { id: created.id || uuid(), label: created.label || name, color: created.color };
            lookup.set(it.id, it);
            items.push(it);
            pick(it);
          }
        } catch (err) {
          console.error('[chip-selector] create failed', err);
        }
      });
      suggestions.appendChild(row);
    }

    suggestions.classList.add('is-open');
  }

  function pick(it) {
    if (selected.size >= maxItems) return;
    selected.add(it.id);
    input.value = '';
    refreshSelected();
    refreshSuggestions();
    emitChange();
    input.focus();
  }

  function emitChange() {
    onChange?.(Array.from(selected), Array.from(selected).map((id) => lookup.get(id)).filter(Boolean));
  }

  input.addEventListener('input', refreshSuggestions);
  input.addEventListener('focus', refreshSuggestions);
  input.addEventListener('blur', () => {
    setTimeout(() => suggestions.classList.remove('is-open'), 120);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace' && !input.value && selected.size) {
      const last = Array.from(selected).pop();
      selected.delete(last);
      refreshSelected();
      refreshSuggestions();
      emitChange();
    } else if (ev.key === 'Enter') {
      const first = suggestions.querySelector('.chip-selector__option');
      if (first) { ev.preventDefault(); first.click(); }
    } else if (ev.key === 'Escape') {
      suggestions.classList.remove('is-open');
    }
  });

  wrap.addEventListener('click', () => input.focus());

  wrap.appendChild(selectedWrap);
  wrap.appendChild(input);
  wrap.appendChild(suggestions);

  refreshSelected();

  // Public API
  wrap._chipSelector = {
    getSelected: () => Array.from(selected),
    setSelected: (ids) => {
      selected.clear();
      for (const id of ids) selected.add(id);
      refreshSelected();
      refreshSuggestions();
    },
    setItems: (newItems) => {
      items.length = 0;
      items.push(...newItems);
      lookup.clear();
      for (const it of newItems) lookup.set(it.id, it);
      refreshSelected();
      refreshSuggestions();
    },
  };

  return wrap;
}

export default { chip, chipList, chipSelector };