/* ============================================================
   Picker — a searchable dropdown with optional inline "create new"
   Used for shops, products, platforms inside the purchase modal.
   ============================================================ */
import { el, normalizeFa, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { notify } from './toast.js';

const DEFAULT_FIELDS = [{ key: 'name', label: 'نام', required: true }];

export function createPicker(opts) {
  const {
    storeSignal,
    placeholder = 'انتخاب کنید',
    allowCreate = false,
    createFields = DEFAULT_FIELDS,
    onCreate,
    onChange,
    value = null,
    getLabel = (item) => item?.name || '',
    renderItem,
    renderTrigger,
  } = opts;

  let selectedValue = value;
  let searchQ = '';
  let open = false;
  let showCreateForm = false;
  let createValues = {};

  const el_ = document.createElement('div');
  el_.className = 'picker';

  const trigger = el('button', {
    type: 'button',
    class: 'picker__trigger',
    'aria-haspopup': 'listbox',
  });
  const valueEl = el('span', { class: 'picker__value' });
  const chevron = el('span', { class: 'picker__chevron', html: icon('chevronDown', 14) });
  trigger.append(valueEl, chevron);

  const popover = el('div', { class: 'picker__popover', role: 'listbox' });
  const searchWrap = el('div', { class: 'picker__search' }, [
    el('span', { html: icon('search', 14) }),
    el('input', {
      type: 'text',
      class: 'picker__search-input',
      placeholder: 'جستجو…',
      autocomplete: 'off',
      spellcheck: 'false',
    }),
  ]);
  const searchInput = searchWrap.querySelector('input');
  const list = el('div', { class: 'picker__list' });
  const createBtn = el('button', {
    type: 'button', class: 'picker__create-btn', hidden: 'hidden',
  });
  const createForm = el('form', { class: 'picker__create-form', hidden: 'hidden' });

  popover.append(searchWrap, list, createBtn, createForm);
  el_.append(trigger);

  /* ---------- helpers ---------- */

  function getItems() {
    const all = storeSignal.get() || [];
    if (!searchQ) return all;
    const q = normalizeFa(searchQ);
    return all.filter((item) => normalizeFa(getLabel(item)).includes(q));
  }
  function getSelected() {
    return (storeSignal.get() || []).find((i) => i.id === selectedValue) || null;
  }

  function updateTrigger() {
    const sel = getSelected();
    valueEl.innerHTML = '';
    if (sel) {
      valueEl.classList.remove('is-placeholder');
      if (renderTrigger) {
        valueEl.innerHTML = renderTrigger(sel);
      } else {
        valueEl.textContent = getLabel(sel);
      }
    } else {
      valueEl.classList.add('is-placeholder');
      valueEl.textContent = placeholder;
    }
  }

  function renderList() {
    const items = getItems();
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(el('div', { class: 'picker__empty', text: 'موردی یافت نشد' }));
      return;
    }
    for (const item of items) {
      const btn = el('button', {
        type: 'button',
        class: 'picker__item' + (item.id === selectedValue ? ' is-selected' : ''),
        role: 'option',
      });
      if (renderItem) btn.innerHTML = renderItem(item);
      else btn.textContent = getLabel(item);
      btn.addEventListener('click', () => select(item.id));
      list.appendChild(btn);
    }
  }

  function select(id) {
    selectedValue = id;
    updateTrigger();
    close();
    onChange?.(id);
  }

  function openPopover() {
    open = true;
    el_.classList.add('is-open');
    searchQ = '';
    searchInput.value = '';
    showCreateForm = false;
    createForm.hidden = true;
    createBtn.hidden = true;
    renderList();
    updateCreateVisibility();

    // Position (portal into body to escape overflow hidden)
    const isMobile = window.innerWidth < 600;
    popover.style.display = 'flex';
    if (!isMobile) {
      const r = trigger.getBoundingClientRect();
      popover.style.top = `${r.bottom + 6}px`;
      popover.style.bottom = 'auto';
      popover.style.left = `${r.left}px`;
      popover.style.right = 'auto';
      popover.style.width = `${r.width}px`;
    } else {
      popover.style.top = 'auto';
      popover.style.bottom = '12px';
      popover.style.left = '12px';
      popover.style.right = '12px';
      popover.style.width = 'auto';
    }
    document.body.appendChild(popover);

    setTimeout(() => searchInput.focus(), 30);
    document.addEventListener('mousedown', onDocClick);
  }

  function close() {
    open = false;
    el_.classList.remove('is-open');
    popover.style.display = 'none';
    if (popover.parentNode === document.body) {
      el_.appendChild(popover);
    }
    document.removeEventListener('mousedown', onDocClick);
  }

  function onDocClick(e) {
    if (el_.contains(e.target)) return;
    if (popover.contains(e.target)) return;
    close();
  }

  function updateCreateVisibility() {
    if (!allowCreate) return;
    const items = getItems();
    const hasExact = items.some((i) => normalizeFa(getLabel(i)) === normalizeFa(searchQ));
    if (searchQ && !hasExact) {
      createBtn.hidden = false;
      createBtn.textContent = `+ ساخت «${searchQ}»`;
    } else if (!searchQ && items.length === 0) {
      createBtn.hidden = false;
      createBtn.textContent = '+ ساخت اولین مورد';
    } else {
      createBtn.hidden = true;
    }
  }

  function renderCreateForm() {
    createForm.innerHTML = '';
    for (const f of createFields) {
      const wrap = el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, [
          document.createTextNode(f.label || f.key),
          f.required ? el('span', { class: 'req', text: '*' }) : null,
        ].filter(Boolean)),
      ]);
      const inp = el('input', {
        type: 'text',
        class: 'input',
        placeholder: f.label || f.key,
        value: createValues[f.key] ?? '',
      });
      inp.addEventListener('input', () => { createValues[f.key] = inp.value; });
      if (f.required) inp.required = true;
      wrap.appendChild(inp);
      createForm.appendChild(wrap);
    }
    const actions = el('div', { class: 'picker__create-actions' });
    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm', text: 'انصراف',
      onclick: () => {
        showCreateForm = false;
        createForm.hidden = true;
        updateCreateVisibility();
      },
    });
    const submitBtn = el('button', {
      type: 'submit', class: 'btn btn--primary btn--sm', text: 'ساخت',
    });
    actions.append(cancelBtn, submitBtn);
    createForm.appendChild(actions);
  }

  /* ---------- wiring ---------- */

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? close() : openPopover();
  });

  searchInput.addEventListener('input', () => {
    searchQ = searchInput.value;
    renderList();
    updateCreateVisibility();
  });

  createBtn.addEventListener('click', () => {
    showCreateForm = true;
    createValues = searchQ ? { name: searchQ } : {};
    renderCreateForm();
    createBtn.hidden = true;
    createForm.hidden = false;
    setTimeout(() => createForm.querySelector('input')?.focus(), 30);
  });

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const f of createFields) {
      if (f.required && !(createValues[f.key] || '').trim()) return;
    }
    const submitBtn = createForm.querySelector('[type="submit"]');
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      const newItem = await onCreate(createValues);
      createForm.hidden = true;
      showCreateForm = false;
      createValues = {};
      if (newItem?.id) select(newItem.id);
      else close();
    } catch (err) {
      notify.error(err?.message || 'خطا در ساخت');
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  // Update on store changes
  storeSignal.subscribe(() => {
    updateTrigger();
    if (open) renderList();
  });

  // Close on scroll / resize for correct positioning
  window.addEventListener('scroll', () => { if (open) close(); }, { capture: true, passive: true });
  window.addEventListener('resize', () => { if (open) close(); }, { passive: true });

  // Init
  updateTrigger();

  return {
    el: el_,
    getValue: () => selectedValue,
    setValue: (v) => { selectedValue = v; updateTrigger(); },
    focus: () => trigger.focus(),
    close,
  };
}

/* ---------- default renderers ---------- */

export function renderShopItem(shop) {
  const ch = escapeHtml((shop.name?.[0] || '؟').toUpperCase());
  return `<span class="picker-item-row">
    <span class="picker-item-avatar">${ch}</span>
    <span class="picker-item-name">${escapeHtml(shop.name)}</span>
    ${shop.category ? `<span class="picker-item-meta">${escapeHtml(shop.category)}</span>` : ''}
  </span>`;
}

export function renderProductItem(product) {
  const ch = escapeHtml((product.name?.[0] || '؟').toUpperCase());
  return `<span class="picker-item-row">
    <span class="picker-item-avatar picker-item-avatar--indigo">${ch}</span>
    <span class="picker-item-name">${escapeHtml(product.name)}</span>
    ${product.category ? `<span class="picker-item-meta">${escapeHtml(product.category)}</span>` : ''}
  </span>`;
}

export function renderPlatformItem(p) {
  return `<span class="picker-item-row">
    <span class="picker-item-dot" style="background:${escapeHtml(p.color || '#6366f1')}"></span>
    <span class="picker-item-name">${escapeHtml(p.name)}</span>
  </span>`;
}
