/**
 * Tabs controller.
 *
 *   const tabs = createTabs(containerEl, [
 *     { id: 'people', label: 'افراد', count: 12, render: () => node },
 *     { id: 'theories', label: 'نظریه‌ها', render: () => node },
 *   ], { variant: 'underline', initial: 'people' });
 */

import { el } from '../utils/dom.js';

export function createTabs(container, tabs, options = {}) {
  const { variant = 'underline', initial, onChange } = options;

  const nav = el('div', {
    class: `tabs${variant === 'pills' ? ' tabs--pills' : ''}`,
    role: 'tablist',
  });

  const panel = el('div', { class: 'tab-panel', role: 'tabpanel' });

  const buttons = new Map();
  const rendered = new Map();

  tabs.forEach((tab) => {
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'tab',
        role: 'tab',
        id: `tab-${tab.id}`,
        'aria-controls': `panel-${tab.id}`,
        'aria-selected': 'false',
        on: { click: () => activate(tab.id) },
      },
      [
        tab.icon ? el('span', { class: 'tab__icon' }) : null,
        el('span', {}, [tab.label]),
        tab.count != null ? el('span', { class: 'tab__count' }, [String(tab.count)]) : null,
      ]
    );
    buttons.set(tab.id, btn);
    nav.appendChild(btn);
  });

  let activeId = initial || tabs[0]?.id;

  function activate(id, emit = true) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    activeId = id;

    buttons.forEach((btn, key) => {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    let content = rendered.get(id);
    if (!content) {
      content = typeof tab.render === 'function' ? tab.render() : tab.render;
      rendered.set(id, content);
    }
    panel.innerHTML = '';
    panel.id = `panel-${id}`;
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    if (content instanceof Node) panel.appendChild(content);
    else if (Array.isArray(content)) content.forEach((n) => panel.appendChild(n));
    else if (content != null) panel.appendChild(document.createTextNode(String(content)));

    if (emit) onChange?.(id, tab);
  }

  container.innerHTML = '';
  container.appendChild(nav);
  container.appendChild(panel);

  if (activeId) activate(activeId, false);

  return {
    activate,
    get active() { return activeId; },
    refreshTab(id) {
      rendered.delete(id);
      if (id === activeId) activate(id, false);
    },
    setCount(id, count) {
      const btn = buttons.get(id);
      if (!btn) return;
      let badge = btn.querySelector('.tab__count');
      if (count == null) { badge?.remove(); return; }
      if (!badge) {
        badge = el('span', { class: 'tab__count' });
        btn.appendChild(badge);
      }
      badge.textContent = String(count);
    },
    destroy() { container.innerHTML = ''; },
  };
}

export const tabs = { create: createTabs };
export default tabs;