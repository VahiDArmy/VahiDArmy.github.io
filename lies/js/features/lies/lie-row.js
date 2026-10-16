/* ============================================================
   js/features/lies/lie-row.js
   Compact list row for a lie
   ============================================================ */

import { el } from '../../utils/dom.js';
import { formatRelative, truncate, toFaDigits } from '../../utils/format.js';
import { LIE_TYPES, MOODS } from '../../config/app.config.js';
import { attachContextMenu } from '../../ui/context-menu.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));
const MOODS_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/**
 * @param {any} lie
 * @param {{
 *   selected?: boolean,
 *   variant?: 'list'|'compact',
 *   onOpen?: (lie:any)=>void,
 *   onToggleSelect?: (id:string, opts:object)=>void,
 *   onContextMenu?: (ev:MouseEvent, lie:any)=>any[],
 *   getCategory?: (id:string)=>any,
 * }} opts
 * @returns {HTMLElement}
 */
export function lieRow(lie, opts = {}) {
  const {
    selected = false,
    variant = 'list',
    onOpen,
    onToggleSelect,
    onContextMenu,
    getCategory,
  } = opts;

  const row = el('div', {
    class: ['lie-row', `lie-row--${variant}`, selected ? 'is-selected' : ''].filter(Boolean),
    dataset: { id: lie.id },
    attrs: { tabindex: '0', role: 'button' },
  });

  // Check
  const check = el('div', { class: 'lie-row__check' });
  check.appendChild(el('span', { class: 'lie-card__check-box' }, { children: ['✓'] }));
  check.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : ev.ctrlKey || ev.metaKey ? 'toggle' : 'single' });
  });
  row.appendChild(check);

  // Type indicator
  const type = TYPES_BY_ID[lie.type] || TYPES_BY_ID.other;
  const typeBadge = el('span', {
    class: 'lie-row__type',
    style: { '--type-color': type.color },
    attrs: { title: type.label },
  }, { children: [type.icon] });
  row.appendChild(typeBadge);

  // Main content
  const main = el('div', { class: 'lie-row__main' });

  const titleRow = el('div', { class: 'lie-row__title-line' });
  if (lie.isPinned) titleRow.appendChild(el('span', { class: 'lie-row__pin' }, { children: ['📌'] }));
  titleRow.appendChild(el('span', { class: 'lie-row__title' }, { children: [lie.title] }));
  main.appendChild(titleRow);

  if (variant !== 'compact' && lie.body) {
    const excerpt = truncate(String(lie.body).replace(/\s+/g, ' ').trim(), 120);
    main.appendChild(el('div', { class: 'lie-row__excerpt' }, { children: [excerpt] }));
  }

  // Inline tags (list variant only)
  if (variant === 'list' && lie.tags?.length) {
    const tags = el('div', { class: 'lie-row__tags' });
    for (const t of lie.tags.slice(0, 3)) {
      const chip = el('span', { class: 'lie-row__tag', style: { '--tag-color': t.color } });
      chip.appendChild(el('span', { class: 'lie-row__tag-dot' }));
      chip.appendChild(el('span', {}, { children: [t.name] }));
      tags.appendChild(chip);
    }
    if (lie.tags.length > 3) {
      tags.appendChild(el('span', { class: 'lie-row__tag lie-row__tag--more' }, { children: [`+${lie.tags.length - 3}`] }));
    }
    main.appendChild(tags);
  }
  row.appendChild(main);

  // Right side: category, mood, meters, date
  const right = el('div', { class: 'lie-row__right' });

  const cat = lie.categoryId ? getCategory?.(lie.categoryId) : null;
  if (cat) {
    right.appendChild(el('span', {
      class: 'lie-row__category',
      attrs: { title: cat.name },
    }, {
      children: [el('span', {}, { children: [cat.icon || '📁'] }), el('span', {}, { children: [cat.name] })],
    }));
  }

  const mood = lie.mood ? MOODS_BY_ID[lie.mood] : null;
  if (mood) {
    right.appendChild(el('span', { class: 'lie-row__mood', title: mood.label }, { children: [mood.icon] }));
  }

  // Intensity bars
  const meters = el('div', { class: 'lie-row__meters' });
  meters.appendChild(el('span', {
    class: 'lie-row__meter lie-row__meter--intensity',
    attrs: { title: `شدت: ${lie.intensity}/۱۰` },
  }, { children: [`⚡${toFaDigits(lie.intensity)}`] }));
  meters.appendChild(el('span', {
    class: 'lie-row__meter lie-row__meter--belief',
    attrs: { title: `باور: ${lie.belief}/۱۰` },
  }, { children: [`◉${toFaDigits(lie.belief)}`] }));
  right.appendChild(meters);

  right.appendChild(el('span', { class: 'lie-row__date' }, {
    children: [formatRelative(lie.updatedAt || lie.createdAt)],
    attrs: { title: lie.createdAt },
  }));

  row.appendChild(right);

  // Interactions
  row.addEventListener('click', (ev) => {
    if (ev.target.closest('.lie-row__check')) return;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      ev.preventDefault();
      onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : 'toggle' });
      return;
    }
    onOpen?.(lie);
  });

  row.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onOpen?.(lie);
    }
  });

  if (onContextMenu) {
    attachContextMenu(row, (ev) => onContextMenu(ev, lie));
  }

  row.setAttribute('draggable', 'true');
  row.dataset.draggable = '1';

  return row;
}

/**
 * Timeline variant — vertical line with dots.
 * @param {any} lie
 * @param {object} opts
 * @returns {HTMLElement}
 */
export function lieTimelineItem(lie, opts = {}) {
  const {
    selected = false,
    onOpen,
    onToggleSelect,
    onContextMenu,
    getCategory,
  } = opts;

  const wrap = el('div', {
    class: ['timeline-item', selected ? 'is-selected' : ''].filter(Boolean),
    dataset: { id: lie.id },
  });

  const type = TYPES_BY_ID[lie.type] || TYPES_BY_ID.other;
  const dot = el('div', { class: 'timeline-item__dot', style: { '--type-color': type.color } });
  dot.appendChild(el('span', { class: 'timeline-item__dot-icon' }, { children: [type.icon] }));
  wrap.appendChild(dot);

  const body = el('div', { class: 'timeline-item__body', attrs: { tabindex: '0', role: 'button' } });

  const head = el('div', { class: 'timeline-item__head' });
  head.appendChild(el('span', { class: 'timeline-item__time', title: lie.createdAt }, {
    children: [formatRelative(lie.updatedAt || lie.createdAt)],
  }));
  head.appendChild(el('span', { class: 'timeline-item__type' }, { children: [type.label] }));
  body.appendChild(head);

  body.appendChild(el('h4', { class: 'timeline-item__title' }, { children: [lie.title] }));
  if (lie.body) {
    body.appendChild(el('p', { class: 'timeline-item__excerpt' }, {
      children: [truncate(String(lie.body).replace(/\s+/g, ' ').trim(), 180)],
    }));
  }

  const meta = el('div', { class: 'timeline-item__meta' });
  const cat = lie.categoryId ? getCategory?.(lie.categoryId) : null;
  if (cat) meta.appendChild(el('span', {}, { children: [`${cat.icon || '📁'} ${cat.name}`] }));
  meta.appendChild(el('span', {}, { children: [`⚡${toFaDigits(lie.intensity)}`] }));
  meta.appendChild(el('span', {}, { children: [`◉${toFaDigits(lie.belief)}`] }));
  body.appendChild(meta);

  body.addEventListener('click', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      ev.preventDefault();
      onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : 'toggle' });
      return;
    }
    onOpen?.(lie);
  });

  if (onContextMenu) {
    attachContextMenu(body, (ev) => onContextMenu(ev, lie));
  }

  wrap.appendChild(body);
  return wrap;
}