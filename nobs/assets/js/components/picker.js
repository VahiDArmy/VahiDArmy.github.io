/* ==========================================================================
   picker.js — انتخاب‌گر جست‌وجوشونده برای محصول / فروشگاه / پلتفرم
   با امکان ساخت سریع در همان‌جا
   ========================================================================== */

import { icon } from '../lib/icons.js';
import { esc, normFa, debounce, hashHue } from '../lib/utils.js';
import { avatar } from './parts.js';
import { searchEntities } from '../lib/search.js';

const TYPE_LABEL = { product: 'محصول', shop: 'فروشگاه', vendor: 'پلتفرم' };

export function createPicker(options = {}) {
  const {
    type = 'product',
    items = [],
    value = '',
    placeholder = '',
    allowCreate = false,
    createLabel = '',
    excludeIds = [],
    onChange = null,
    onCreate = null,
    emptyHint = '',
    disabled = false,
    idPrefix = `picker-${type}`,
  } = options;

  let currentItems = [...items];
  let currentValue = value || '';
  let open = false;
  let activeIndex = 0;
  let filtered = [];
  let query = '';
  let creating = false;

  const root = document.createElement('div');
  root.className = 'picker';

  const control = document.createElement('div');
  control.className = 'picker__control';
  control.tabIndex = disabled ? -1 : 0;
  control.setAttribute('role', 'combobox');
  control.setAttribute('aria-expanded', 'false');
  control.setAttribute('aria-haspopup', 'listbox');
  root.appendChild(control);

  const list = document.createElement('div');
  list.className = 'picker__list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'picker__input';
  input.placeholder = placeholder || `جست‌وجوی ${TYPE_LABEL[type]}…`;
  input.setAttribute('aria-autocomplete', 'list');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.id = `${idPrefix}-input`;

  function findItem(id) {
    return currentItems.find((item) => item.id === id) || null;
  }

  function renderControl() {
    const selected = findItem(currentValue);
    control.innerHTML = '';
    control.classList.toggle('is-open', open);

    if (selected && !open) {
      const chip = document.createElement('div');
      chip.className = 'picker__selected';
      chip.innerHTML = `${avatar({ name: selected.name, emoji: selected.emoji || (type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒'), size: 'sm' })}
        <span class="picker__selected-name">${esc(selected.name)}</span>
        <button type="button" class="picker__selected-clear" aria-label="حذف انتخاب">${icon('x', 11)}</button>`;
      chip.querySelector('.picker__selected-clear').addEventListener('click', (event) => {
        event.stopPropagation();
        setValue('');
        input.focus();
      });
      control.appendChild(chip);
    }

    control.appendChild(input);

    const chev = document.createElement('span');
    chev.className = 'picker__chev';
    chev.innerHTML = icon(open ? 'chevron-up' : 'chevron-down', 14);
    control.appendChild(chev);
  }

  function renderList() {
    if (!open) {
      list.hidden = true;
      root.appendChild(list);
      return;
    }

    const q = query.trim();
    const pool = currentItems.filter((item) => !excludeIds.includes(item.id));
    filtered = q ? searchEntities({ items: pool, query: q }) : pool;

    const rows = [];
    if (filtered.length) {
      rows.push(
        ...filtered.slice(0, 40).map((item, index) => {
          const meta = [item.category, item.city, item.brand, item.unit].filter(Boolean).join(' · ');
          return `<button type="button" class="picker__option ${index === activeIndex ? 'is-active' : ''}" role="option"
            aria-selected="${item.id === currentValue}" data-picker-id="${esc(item.id)}">
            ${avatar({ name: item.name, emoji: item.emoji || (type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒'), size: 'sm' })}
            <span class="picker__option-text">
              <span class="picker__option-name u-truncate">${esc(item.name)}</span>
              ${meta ? `<span class="picker__option-meta u-truncate">${esc(meta)}</span>` : ''}
            </span>
            ${item.id === currentValue ? `<span class="picker__option-check">${icon('check', 14)}</span>` : ''}
          </button>`;
        }),
      );
    } else {
      rows.push(`<div class="picker__empty">${esc(emptyHint || `هیچ ${TYPE_LABEL[type]}ی پیدا نشد.`)}</div>`);
    }

    const exact = filtered.some((item) => normFa(item.name) === normFa(q));
    if (allowCreate && q.length >= 2 && !exact) {
      rows.push(`<button type="button" class="picker__create" data-picker-create>
        ${icon('plus', 14)}
        <span>${esc(createLabel || `ایجاد ${TYPE_LABEL[type]} جدید`)}: <b>«${esc(q)}»</b></span>
      </button>`);
    }

    if (!q) {
      rows.push(`<div class="picker__hint-row">${icon('info', 12)} بهترین گزینه را انتخاب کنید تا داده تکراری ساخته نشود.</div>`);
    }

    list.innerHTML = rows.join('');
    list.hidden = false;
    root.appendChild(list);
    positionList();
  }

  function positionList() {
    const rect = control.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    list.classList.toggle('picker__list--up', spaceBelow < 240 && rect.top > 260);
    const height = Math.min(252, Math.max(120, spaceBelow - 20));
    if (!list.classList.contains('picker__list--up')) {
      list.style.maxHeight = `${Math.max(140, Math.min(252, spaceBelow - 16))}px`;
    } else {
      list.style.maxHeight = '252px';
    }
    return height;
  }

  function openList() {
    if (disabled || open) return;
    open = true;
    query = '';
    input.value = '';
    activeIndex = 0;
    control.classList.add('is-open');
    control.setAttribute('aria-expanded', 'true');
    renderControl();
    renderList();
  }

  function closeList() {
    if (!open) return;
    open = false;
    control.classList.remove('is-open');
    control.setAttribute('aria-expanded', 'false');
    list.hidden = true;
    query = '';
    if (document.activeElement === input) input.blur();
    renderControl();
  }

  function setValue(id, { silent = false } = {}) {
    currentValue = id || '';
    query = '';
    input.value = '';
    renderControl();
    if (!silent) onChange?.(currentValue);
  }

  function choose(id) {
    setValue(id);
    closeList();
  }

  async function createFromQuery() {
    if (creating || !onCreate) return;
    const name = (query || input.value || '').trim();
    if (name.length < 2) return;
    creating = true;
    list.innerHTML = `<div class="picker__empty u-row u-gap-2" style="justify-content:center"><span class="searchbox__spinner"></span> در حال ساخت…</div>`;
    try {
      const created = await onCreate(name);
      if (created?.id) {
        currentItems = [...currentItems, created];
        setValue(created.id);
        closeList();
      }
    } catch (error) {
      list.innerHTML = `<div class="picker__empty" style="color:var(--bad)">${esc(error.message || 'ساخت ناموفق بود')}</div>`;
    } finally {
      creating = false;
    }
  }

  /* ------------------------------- رویدادها ------------------------------- */

  control.addEventListener('click', () => {
    if (disabled) return;
    if (open) input.focus();
    else openList();
  });

  control.addEventListener('keydown', (event) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
      if (!open) {
        event.preventDefault();
        openList();
        return;
      }
    }
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(0, filtered.length - 1));
      renderList();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) choose(item.id);
      else if (allowCreate && query.trim().length >= 2) createFromQuery();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      closeList();
    }
  });

  input.addEventListener('input', debounce(() => {
    query = input.value;
    activeIndex = 0;
    if (!open) openList();
    renderList();
  }, 90));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) choose(item.id);
      else if (allowCreate && query.trim().length >= 2) createFromQuery();
    }
  });

  list.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const createBtn = event.target.closest('[data-picker-create]');
    if (createBtn) {
      createFromQuery();
      return;
    }
    const option = event.target.closest('[data-picker-id]');
    if (option) choose(option.dataset.pickerId);
  });

  const onDocDown = (event) => {
    if (!root.contains(event.target) && !list.contains(event.target)) closeList();
  };
  document.addEventListener('mousedown', onDocDown);

  renderControl();

  return {
    el: root,
    getValue: () => currentValue,
    getLabel: () => findItem(currentValue)?.name || '',
    setValue: (id) => setValue(id, { silent: true }),
    refresh: (nextItems) => {
      currentItems = [...(nextItems || [])];
      renderControl();
      if (open) renderList();
    },
    focus: () => {
      control.focus();
      openList();
    },
    destroy: () => {
      document.removeEventListener('mousedown', onDocDown);
      closeList();
      root.remove();
    },
  };
}
