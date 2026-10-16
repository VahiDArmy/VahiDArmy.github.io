/* ============================================================
   js/ui/tabs.js
   Tabs with sliding indicator, keyboard nav, ARIA
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { uuid } from '../utils/id.js';

/**
 * @param {{
 *   items: Array<{id:string, label:string, icon?:string, badge?:string|number, disabled?:boolean}>,
 *   active?: string,
 *   onChange?: (id:string)=>void,
 *   variant?: 'underline'|'pill'|'segmented',
 *   full?: boolean,
 *   className?: string,
 * }} opts
 * @returns {HTMLElement}
 */
export function tabs(opts) {
  const {
    items = [], active, onChange,
    variant = 'underline', full = false, className = '',
  } = opts;

  const id = `tabs_${uuid().slice(0, 6)}`;
  let current = active || items[0]?.id;

  const root = el('div', {
    class: ['tabs', `tabs--${variant}`, full ? 'tabs--full' : '', className].filter(Boolean),
    attrs: { role: 'tablist' },
    dataset: { tabsId: id },
  });

  const indicator = el('span', { class: 'tabs__indicator', attrs: { 'aria-hidden': 'true' } });
  const btns = new Map();

  for (const item of items) {
    const btn = el('button', {
      class: ['tabs__btn'],
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-selected': 'false',
        'aria-controls': `${id}-panel-${item.id}`,
        tabindex: '-1',
        'data-tab': item.id,
        disabled: item.disabled ? 'true' : undefined,
      },
    });
    if (item.icon) btn.appendChild(el('span', { class: 'tabs__btn-icon' }, { children: [item.icon] }));
    btn.appendChild(el('span', { class: 'tabs__btn-label' }, { children: [item.label] }));
    if (item.badge !== undefined && item.badge !== null) {
      btn.appendChild(el('span', { class: 'tabs__btn-badge' }, { children: [String(item.badge)] }));
    }
    btn.addEventListener('click', () => { if (!item.disabled) setActive(item.id); });
    root.appendChild(btn);
    btns.set(item.id, btn);
  }

  if (variant !== 'segmented') root.appendChild(indicator);

  function setActive(next, opts2 = {}) {
    if (next === current && !opts2.force) return;
    current = next;
    for (const [tabId, btn] of btns) {
      const on = tabId === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
      btn.setAttribute('tabindex', on ? '0' : '-1');
    }
    moveIndicator();
    if (!opts2.silent) onChange?.(current);
  }

  function moveIndicator() {
    if (variant === 'segmented') return;
    const btn = btns.get(current);
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    root.style.setProperty('--tabs-indicator-x', `${r.left - rr.left}px`);
    root.style.setProperty('--tabs-indicator-w', `${r.width}px`);
  }

  // Keyboard nav
  root.addEventListener('keydown', (ev) => {
    const list = items.filter((it) => !it.disabled).map((it) => it.id);
    const idx = list.indexOf(current);
    let nextIdx = -1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') nextIdx = (idx + 1) % list.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') nextIdx = (idx - 1 + list.length) % list.length;
    else if (ev.key === 'Home') nextIdx = 0;
    else if (ev.key === 'End') nextIdx = list.length - 1;
    if (nextIdx >= 0) {
      ev.preventDefault();
      setActive(list[nextIdx]);
      btns.get(current)?.focus();
    }
  });

  // Init
  requestAnimationFrame(() => {
    setActive(current, { silent: true, force: true });
    moveIndicator();
  });

  const resizeObs = new ResizeObserver(() => moveIndicator());
  resizeObs.observe(root);

  root._tabs = {
    getActive: () => current,
    setActive,
    destroy: () => resizeObs.disconnect(),
  };

  return root;
}

export default { tabs };