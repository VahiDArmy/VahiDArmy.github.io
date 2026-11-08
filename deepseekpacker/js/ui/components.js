// AURORA OS — Component Factory

import { h, $, $$, delegate, clear } from '../core/dom.js';

export function button(label, opts = {}) {
  const { variant = 'primary', size = '', icon, onClick, disabled, className = '' } = opts;
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, className].filter(Boolean).join(' ');
  const el = h('button', { class: cls, type: 'button', onClick, disabled });
  if (icon) el.append(h('span', { class: 'btn__icon', text: icon }));
  if (label) el.append(h('span', { text: label }));
  return el;
}

export function iconButton(icon, opts = {}) {
  const { onClick, title, variant = 'ghost', size = 'sm', className = '' } = opts;
  return h('button', {
    class: `btn btn--${variant} btn--icon btn--${size} ${className}`.trim(),
    type: 'button', title, 'aria-label': title, onClick,
  }, icon);
}

export function input(opts = {}) {
  const { value = '', placeholder = '', type = 'text', onChange, onInput, size = '', name, id, className = '' } = opts;
  const el = h('input', {
    class: ['input', size && `input--${size}`, className].filter(Boolean).join(' '),
    type, value, placeholder, name, id, autocomplete: 'off', spellcheck: 'false',
  });
  if (onInput) el.addEventListener('input', onInput);
  if (onChange) el.addEventListener('change', onChange);
  return el;
}

export function textarea(opts = {}) {
  const { value = '', placeholder = '', onChange, onInput, rows = 4, name, id, className = '' } = opts;
  const el = h('textarea', { class: 'textarea ' + className, placeholder, rows, name, id });
  el.value = value;
  if (onInput) el.addEventListener('input', onInput);
  if (onChange) el.addEventListener('change', onChange);
  return el;
}

export function select(options, opts = {}) {
  const { value = '', onChange, className = '', id } = opts;
  const el = h('select', { class: 'select ' + className, id });
  for (const opt of options) {
    const o = h('option', { value: opt.value, text: opt.label });
    if (opt.value === value) o.selected = true;
    el.append(o);
  }
  if (onChange) el.addEventListener('change', onChange);
  return el;
}

export function checkbox(label, opts = {}) {
  const { checked = false, onChange, id } = opts;
  const wrap = h('label', { class: 'check' });
  const inp = h('input', { type: 'checkbox', checked, id });
  if (onChange) inp.addEventListener('change', onChange);
  wrap.append(inp, h('span', { class: 'check__box' }), h('span', { text: label }));
  return wrap;
}

export function radio(label, opts = {}) {
  const { checked = false, onChange, name, value, id } = opts;
  const wrap = h('label', { class: 'check' });
  const inp = h('input', { type: 'radio', checked, name, value, id });
  if (onChange) inp.addEventListener('change', onChange);
  wrap.append(inp, h('span', { class: 'check__box radio__box' }), h('span', { text: label }));
  return wrap;
}

export function toggle(label, opts = {}) {
  const { checked = false, onChange, id } = opts;
  const wrap = h('label', { class: 'switch' });
  const inp = h('input', { type: 'checkbox', checked, id });
  if (onChange) inp.addEventListener('change', onChange);
  wrap.append(inp, h('span', { class: 'switch__track' }));
  if (label) wrap.append(h('span', { text: label }));
  return wrap;
}

export function slider(opts = {}) {
  const { value = 50, min = 0, max = 100, step = 1, onInput, onChange, id } = opts;
  const el = h('input', { class: 'slider', type: 'range', min, max, step, value, id });
  if (onInput) el.addEventListener('input', onInput);
  if (onChange) el.addEventListener('change', onChange);
  return el;
}

export function badge(text, variant = 'muted') {
  return h('span', { class: 'badge-pill badge-pill--' + variant, text });
}

export function card(title, body, opts = {}) {
  const card = h('div', { class: 'card' });
  if (title) {
    const head = h('div', { class: 'card__head' }, [h('div', { class: 'card__title', text: title })]);
    if (opts.actions) head.append(opts.actions);
    card.append(head);
  }
  card.append(h('div', { class: 'card__body' }, [body]));
  if (opts.footer) card.append(h('div', { class: 'card__foot' }, [opts.footer]));
  return card;
}

export function tabs(items, opts = {}) {
  const { active = items[0]?.id, onChange } = opts;
  const wrap = h('div', { class: 'tabs' });
  for (const item of items) {
    const el = h('button', {
      class: 'tab' + (item.id === active ? ' is-active' : ''),
      type: 'button',
      dataset: { tabId: item.id },
    }, [h('span', { text: item.label })]);
    if (item.badge != null) el.append(h('span', { class: 'tab__badge', text: item.badge }));
    el.addEventListener('click', () => {
      $$('.tab', wrap).forEach((t) => t.classList.toggle('is-active', t.dataset.tabId === item.id));
      if (onChange) onChange(item.id);
    });
    wrap.append(el);
  }
  return wrap;
}

export function segmented(items, opts = {}) {
  const { active = items[0]?.value, onChange } = opts;
  const wrap = h('div', { class: 'segmented' });
  for (const item of items) {
    const el = h('button', {
      class: 'segmented__item' + (item.value === active ? ' is-active' : ''),
      type: 'button',
      dataset: { value: item.value },
      text: item.label,
    });
    el.addEventListener('click', () => {
      $$('.segmented__item', wrap).forEach((s) => s.classList.toggle('is-active', s.dataset.value === item.value));
      if (onChange) onChange(item.value);
    });
    wrap.append(el);
  }
  return wrap;
}

export function progress(value, opts = {}) {
  const { variant = '' } = opts;
  const wrap = h('div', { class: 'progress' + (variant ? ' progress--' + variant : '') });
  const fill = h('div', { class: 'progress__fill' });
  fill.style.width = Math.max(0, Math.min(100, value)) + '%';
  wrap.append(fill);
  return wrap;
}

export function avatar(name, opts = {}) {
  const { size = '', src } = opts;
  const cls = ['avatar', size && 'avatar--' + size].filter(Boolean).join(' ');
  const el = h('div', { class: cls, title: name });
  if (src) el.append(h('img', { src, alt: name }));
  else el.textContent = (name || '?').trim().slice(0, 2).toUpperCase();
  return el;
}

export function dropdown(trigger, items) {
  const wrap = h('div', { class: 'dropdown' });
  wrap.append(trigger);
  let menu = null;
  const close = () => {
    if (menu) { menu.remove(); menu = null; document.removeEventListener('click', onDoc, true); }
  };
  const onDoc = (e) => { if (!wrap.contains(e.target)) close(); };
  const open = () => {
    if (menu) return close();
    menu = h('div', { class: 'dropdown__menu' });
    for (const it of items) {
      if (it.sep) { menu.append(h('div', { class: 'dropdown__sep' })); continue; }
      const mi = h('button', {
        class: 'dropdown__item' + (it.danger ? ' is-danger' : ''),
        type: 'button', onClick: () => { close(); it.onClick?.(); },
      }, [it.icon && h('span', { text: it.icon }), h('span', { text: it.label })]);
      menu.append(mi);
    }
    wrap.append(menu);
    setTimeout(() => document.addEventListener('click', onDoc, true), 0);
  };
  trigger.addEventListener('click', open);
  return wrap;
}

export function listItem(content, opts = {}) {
  const { onClick, selected = false, className = '' } = opts;
  const el = h('div', { class: 'list__item' + (selected ? ' is-selected' : '') + (className ? ' ' + className : '') });
  if (content.nodeType) el.append(content);
  else el.textContent = content;
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

export function emptyState(opts = {}) {
  const { icon = '○', title = 'Nothing here', text = '' } = opts;
  return h('div', { class: 'empty' }, [
    h('div', { class: 'empty__icon', text: icon }),
    h('div', { class: 'empty__title', text: title }),
    text && h('div', { class: 'empty__text', text }),
  ]);
}

export function skeletonLine(width = '100%') {
  const el = h('div', { class: 'skeleton skeleton--text' });
  el.style.width = width;
  return el;
}

export function chip(label, opts = {}) {
  const { active = false, onRemove, onClick } = opts;
  const el = h('span', { class: 'chip' + (active ? ' is-active' : '') });
  el.append(h('span', { text: label }));
  if (onClick) el.addEventListener('click', onClick);
  if (onRemove) {
    const x = h('span', { class: 'chip__x', text: '×' });
    x.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); });
    el.append(x);
  }
  return el;
}

export function tooltip(el, text) {
  el.classList.add('tooltip');
  el.dataset.tip = text;
  return el;
}

export function table(columns, rows, opts = {}) {
  const { onRowClick } = opts;
  const t = h('table', { class: 'table' });
  const thead = h('thead', {}, [h('tr', {}, columns.map((c) => h('th', { text: c.label })))]);
  const tbody = h('tbody', {}, rows.map((row) => {
    const tr = h('tr');
    for (const c of columns) {
      const td = h('td');
      const v = typeof c.render === 'function' ? c.render(row) : row[c.key];
      if (v && v.nodeType) td.append(v);
      else td.textContent = v == null ? '' : v;
      tr.append(td);
    }
    if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
    return tr;
  }));
  t.append(thead, tbody);
  return t;
}

export function modal(opts = {}) {
  const { title = '', body, footer, onClose, width } = opts;
  const root = $('#modal-root');
  if (!root) return null;
  clear(root);
  root.hidden = false;
  const overlay = h('div', { class: 'modal-root__overlay' });
  const close = () => { root.hidden = true; clear(root); onClose?.(); };
  overlay.addEventListener('click', close);
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
  if (width) modal.style.width = typeof width === 'number' ? width + 'px' : width;
  const head = h('div', { class: 'modal__head' }, [
    h('div', { class: 'modal__title', text: title }),
    h('button', { class: 'btn btn--ghost btn--icon btn--sm', type: 'button', onClick: close, text: '×' }),
  ]);
  const bodyEl = h('div', { class: 'modal__body' });
  if (body?.nodeType) bodyEl.append(body);
  else if (typeof body === 'string') bodyEl.innerHTML = body;
  modal.append(head, bodyEl);
  if (footer) {
    const foot = h('div', { class: 'modal__foot' });
    if (footer.nodeType) foot.append(footer);
    else foot.append(...(Array.isArray(footer) ? footer : [footer]));
    modal.append(foot);
  }
  root.append(overlay, modal);
  return { close, modal };
}
