/* ============================================================
   js/features/lies/lie-card.js
   Grid card renderer for a lie
   ============================================================ */

import { el } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { formatRelative, truncate, toFaDigits } from '../../utils/format.js';
import { LIE_TYPES, MOODS } from '../../config/app.config.js';
import { chip } from '../../ui/chips.js';
import { attachContextMenu } from '../../ui/context-menu.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));
const MOODS_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/**
 * @param {any} lie
 * @param {{
 *   selected?: boolean,
 *   onOpen?: (lie:any)=>void,
 *   onToggleSelect?: (id:string, opts:object)=>void,
 *   onContextMenu?: (ev:MouseEvent, lie:any)=>any[],
 *   getCategory?: (id:string)=>any,
 *   enableDrag?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function lieCard(lie, opts = {}) {
  const {
    selected = false,
    onOpen,
    onToggleSelect,
    onContextMenu,
    getCategory,
    enableDrag = true,
  } = opts;

  const card = el('article', {
    class: ['lie-card', selected ? 'is-selected' : ''].filter(Boolean),
    dataset: { id: lie.id },
    attrs: {
      tabindex: '0',
      role: 'button',
      'aria-selected': selected ? 'true' : 'false',
    },
  });

  // Top: type pill + intensity meter
  const top = el('div', { class: 'lie-card__top' });

  const type = TYPES_BY_ID[lie.type] || TYPES_BY_ID.other;
  const typePill = el('span', { class: 'lie-card__type', style: { '--type-color': type.color } });
  typePill.appendChild(el('span', { class: 'lie-card__type-icon' }, { children: [type.icon] }));
  typePill.appendChild(el('span', {}, { children: [type.label] }));
  top.appendChild(typePill);

  if (lie.isPinned) {
    top.appendChild(el('span', { class: 'lie-card__pin', attrs: { title: 'سنجاق‌شده' } }, { children: ['📌'] }));
  }

  const meta = el('div', { class: 'lie-card__meta' });
  meta.appendChild(el('span', {
    class: 'lie-card__intensity',
    attrs: { title: `شدت: ${lie.intensity}/۱۰` },
    dataset: { level: String(Math.ceil(lie.intensity / 3.34)) },
  }, { children: [`⚡ ${toFaDigits(lie.intensity)}`] }));
  meta.appendChild(el('span', {
    class: 'lie-card__belief',
    attrs: { title: `باور: ${lie.belief}/۱۰` },
    dataset: { level: String(Math.ceil(lie.belief / 3.34)) },
  }, { children: [`◉ ${toFaDigits(lie.belief)}`] }));
  top.appendChild(meta);

  card.appendChild(top);

  // Title
  const title = el('h3', { class: 'lie-card__title' }, { children: [lie.title] });
  card.appendChild(title);

  // Body excerpt
  if (lie.body) {
    const excerpt = truncate(String(lie.body).replace(/\s+/g, ' ').trim(), 160);
    card.appendChild(el('p', { class: 'lie-card__excerpt' }, { children: [excerpt] }));
  }

  // Truth highlight
  if (lie.truth) {
    const truthBox = el('div', { class: 'lie-card__truth' });
    truthBox.appendChild(el('span', { class: 'lie-card__truth-icon' }, { children: ['✦'] }));
    truthBox.appendChild(el('span', { class: 'lie-card__truth-text' }, { children: [truncate(lie.truth, 90)] }));
    card.appendChild(truthBox);
  }

  // Tags
  const tags = lie.tags || [];
  if (tags.length) {
    const tagWrap = el('div', { class: 'lie-card__tags' });
    for (const t of tags.slice(0, 4)) {
      tagWrap.appendChild(chip({ label: t.name, color: t.color, size: 'sm' }));
    }
    if (tags.length > 4) {
      tagWrap.appendChild(chip({ label: `+${tags.length - 4}`, size: 'sm' }));
    }
    card.appendChild(tagWrap);
  }

  // Footer: category + date
  const foot = el('div', { class: 'lie-card__foot' });

  const cat = lie.categoryId ? getCategory?.(lie.categoryId) : null;
  if (cat) {
    const catChip = el('span', { class: 'lie-card__category' });
    catChip.appendChild(el('span', { class: 'lie-card__category-icon' }, { children: [cat.icon || '📁'] }));
    catChip.appendChild(el('span', {}, { children: [cat.name] }));
    foot.appendChild(catChip);
  } else {
    foot.appendChild(el('span', { class: 'lie-card__category lie-card__category--empty' }, { children: ['—'] }));
  }

  const mood = lie.mood ? MOODS_BY_ID[lie.mood] : null;
  if (mood) {
    foot.appendChild(el('span', { class: 'lie-card__mood', title: mood.label }, { children: [mood.icon] }));
  }

  foot.appendChild(el('span', { class: 'lie-card__date' }, {
    children: [formatRelative(lie.updatedAt || lie.createdAt)],
    attrs: { title: lie.createdAt },
  }));

  card.appendChild(foot);

  // Selection checkbox (appears on hover / when active)
  const cb = el('div', { class: 'lie-card__check' });
  cb.appendChild(el('span', { class: 'lie-card__check-box' }, { children: ['✓'] }));
  cb.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : ev.ctrlKey || ev.metaKey ? 'toggle' : 'single' });
  });
  card.appendChild(cb);

  // Interactions
  card.addEventListener('click', (ev) => {
    if (ev.target.closest('.lie-card__check')) return;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      ev.preventDefault();
      onToggleSelect?.(lie.id, {
        mode: ev.shiftKey ? 'range' : 'toggle',
      });
      return;
    }
    onOpen?.(lie);
  });

  card.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onOpen?.(lie);
    }
  });

  // Context menu
  if (onContextMenu) {
    attachContextMenu(card, (ev) => onContextMenu(ev, lie));
  }

  // Drag handle
  if (enableDrag) {
    card.setAttribute('draggable', 'true');
    card.dataset.draggable = '1';
  }

  return card;
}

/**
 * Skeleton card for loading state.
 * @returns {HTMLElement}
 */
export function lieCardSkeleton() {
  const card = el('div', { class: 'lie-card lie-card--skeleton' });
  const top = el('div', { class: 'lie-card__top' });
  top.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '70px', height: '18px' } }));
  top.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '44px', height: '14px' } }));
  card.appendChild(top);
  card.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '80%', height: '20px', marginTop: '12px' } }));
  for (let i = 0; i < 3; i++) {
    card.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: i === 2 ? '60%' : '100%', height: '12px' } }));
  }
  const foot = el('div', { class: 'lie-card__foot' });
  foot.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '60px', height: '12px' } }));
  foot.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '40px', height: '12px' } }));
  card.appendChild(foot);
  return card;
}

export { TYPES_BY_ID, MOODS_BY_ID };