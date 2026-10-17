/* ============================================================
   js/features/lies/lie-card.js
   UPDATED: Accepts typesMap and moodsMap for dynamic labels.
   ============================================================ */

import { el } from '../../utils/dom.js';
import { formatRelative, truncate, toFaDigits } from '../../utils/format.js';
import { chip } from '../../ui/chips.js';
import { attachContextMenu } from '../../ui/context-menu.js';

export function lieCard(lie, opts = {}) {
  const { selected = false, onOpen, onToggleSelect, onContextMenu, getCategory, typesMap = {}, moodsMap = {}, enableDrag = true } = opts;

  const card = el('article', {
    class: ['lie-card', selected ? 'is-selected' : ''].filter(Boolean),
    dataset: { id: lie.id },
    attrs: { tabindex: '0', role: 'button', 'aria-selected': selected ? 'true' : 'false' },
  });

  const top = el('div', { class: 'lie-card__top' });
  const type = typesMap[lie.type] || { label: 'دروغ دیگر', color: 'var(--text-tertiary)', icon: '✳️' };

  const typePill = el('span', { class: 'lie-card__type', style: { '--type-color': type.color } });
  typePill.appendChild(el('span', { class: 'lie-card__type-icon' }, { children: [type.icon] }));
  typePill.appendChild(el('span', {}, { children: [type.label] }));
  top.appendChild(typePill);

  if (lie.isPinned) top.appendChild(el('span', { class: 'lie-card__pin', attrs: { title: 'سنجاق‌شده' } }, { children: ['📌'] }));

  const meta = el('div', { class: 'lie-card__meta' });
  meta.appendChild(el('span', { class: 'lie-card__intensity', attrs: { title: `شدت: ${lie.intensity}/۱۰` }, dataset: { level: String(Math.ceil(lie.intensity / 3.34)) } }, { children: [`⚡ ${toFaDigits(lie.intensity)}`] }));
  meta.appendChild(el('span', { class: 'lie-card__belief', attrs: { title: `باور: ${lie.belief}/۱۰` }, dataset: { level: String(Math.ceil(lie.belief / 3.34)) } }, { children: [`◉ ${toFaDigits(lie.belief)}`] }));
  top.appendChild(meta);
  card.appendChild(top);

  card.appendChild(el('h3', { class: 'lie-card__title' }, { children: [lie.title] }));
  if (lie.body) card.appendChild(el('p', { class: 'lie-card__excerpt' }, { children: [truncate(String(lie.body).replace(/\s+/g, ' ').trim(), 160)] }));

  if (lie.truth) {
    const truthBox = el('div', { class: 'lie-card__truth' });
    truthBox.appendChild(el('span', { class: 'lie-card__truth-icon' }, { children: ['✦'] }));
    truthBox.appendChild(el('span', { class: 'lie-card__truth-text' }, { children: [truncate(lie.truth, 90)] }));
    card.appendChild(truthBox);
  }

  const tags = lie.tags || [];
  if (tags.length) {
    const tagWrap = el('div', { class: 'lie-card__tags' });
    for (const t of tags.slice(0, 4)) tagWrap.appendChild(chip({ label: t.name, color: t.color, size: 'sm' }));
    if (tags.length > 4) tagWrap.appendChild(chip({ label: `+${tags.length - 4}`, size: 'sm' }));
    card.appendChild(tagWrap);
  }

  const foot = el('div', { class: 'lie-card__foot' });
  const cat = lie.categoryId ? getCategory?.(lie.categoryId) : null;
  if (cat) {
    const catChip = el('span', { class: 'lie-card__category' });
    catChip.appendChild(el('span', { class: 'lie-card__category-icon' }, { children: [cat.icon || '📁'] }));
    catChip.appendChild(el('span', {}, { children: [cat.name] }));
    foot.appendChild(catChip);
  } else foot.appendChild(el('span', { class: 'lie-card__category lie-card__category--empty' }, { children: ['—'] }));

  const mood = lie.mood ? moodsMap[lie.mood] : null;
  if (mood) foot.appendChild(el('span', { class: 'lie-card__mood', title: mood.label }, { children: [mood.icon] }));

  foot.appendChild(el('span', { class: 'lie-card__date' }, { children: [formatRelative(lie.updatedAt || lie.createdAt)], attrs: { title: lie.createdAt } }));
  card.appendChild(foot);

  const cb = el('div', { class: 'lie-card__check' });
  cb.appendChild(el('span', { class: 'lie-card__check-box' }, { children: ['✓'] }));
  cb.addEventListener('click', (ev) => { ev.stopPropagation(); onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : ev.ctrlKey || ev.metaKey ? 'toggle' : 'single' }); });
  card.appendChild(cb);

  card.addEventListener('click', (ev) => {
    if (ev.target.closest('.lie-card__check')) return;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { ev.preventDefault(); onToggleSelect?.(lie.id, { mode: ev.shiftKey ? 'range' : 'toggle' }); return; }
    onOpen?.(lie);
  });
  card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen?.(lie); } });
  if (onContextMenu) attachContextMenu(card, (ev) => onContextMenu(ev, lie));
  if (enableDrag) { card.setAttribute('draggable', 'true'); card.dataset.draggable = '1'; }

  return card;
}

export function lieCardSkeleton() {
  const card = el('div', { class: 'lie-card lie-card--skeleton' });
  const top = el('div', { class: 'lie-card__top' });
  top.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '70px', height: '18px' } }));
  top.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '44px', height: '14px' } }));
  card.appendChild(top);
  card.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '80%', height: '20px', marginTop: '12px' } }));
  for (let i = 0; i < 3; i++) card.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: i === 2 ? '60%' : '100%', height: '12px' } }));
  return card;
}