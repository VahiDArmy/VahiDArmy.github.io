/* ============================================================
   js/features/lies/lies-toolbar.js
   Search, sort dropdown, view switcher, layout controls
   ============================================================ */

import { el, byId } from '../../utils/dom.js';
import { debounce } from '../../utils/debounce.js';
import { toggleDropdown } from '../../ui/dropdown.js';
import { segmented } from '../../ui/segmented.js';
import { badge } from '../../ui/badges.js';
import { SORT_OPTIONS, VIEW_MODES, PAGE_SIZES } from '../../config/app.config.js';
import { activeFilterCount } from './lies-storage.js';
import { toFaDigits } from '../../utils/format.js';

const VIEW_ITEMS = [
  { id: VIEW_MODES.GRID,     icon: '▦', title: 'کارت‌ها' },
  { id: VIEW_MODES.LIST,     icon: '☰', title: 'لیست' },
  { id: VIEW_MODES.COMPACT,  icon: '≡', title: 'فشرده' },
  { id: VIEW_MODES.TIMELINE, icon: '◷', title: 'خط زمانی' },
];

/**
 * @param {{
 *   state: {view:string, sort:string, filters:object, pageSize:number, total:number, selection:Set<string>},
 *   onSearchChange: (q:string)=>void,
 *   onSortChange: (s:string)=>void,
 *   onViewChange: (v:string)=>void,
 *   onPageSizeChange: (n:number)=>void,
 *   onToggleFilters: ()=>void,
 *   onCreateNew: ()=>void,
 *   onSelectAll: ()=>void,
 *   onClearSelection: ()=>void,
 * }} opts
 * @returns {HTMLElement}
 */
export function liesToolbar(opts) {
  const {
    state, onSearchChange, onSortChange, onViewChange,
    onPageSizeChange, onToggleFilters, onCreateNew,
  } = opts;

  const bar = el('div', { class: 'lies-toolbar' });

  /* Search */
  const searchWrap = el('div', { class: 'lies-toolbar__search' });
  const sIco = el('span', { class: 'search-input__ico' }, { children: ['🔍'] });
  const sInput = el('input', {
    class: 'input',
    attrs: {
      type: 'search',
      placeholder: 'جست‌وجو در عنوان، متن، حقیقت…',
      autocomplete: 'off',
    },
  });
  sInput.value = state.filters.query || '';
  const sClear = el('button', {
    class: 'search-input__clear',
    attrs: { type: 'button', 'aria-label': 'پاک کردن' },
    on: { click: () => { sInput.value = ''; onSearchChange(''); sClear.classList.remove('is-visible'); } },
  }, { children: ['✕'] });
  if (sInput.value) sClear.classList.add('is-visible');

  const debounced = debounce((v) => onSearchChange(v), 280);
  sInput.addEventListener('input', (ev) => {
    const has = !!ev.target.value;
    sClear.classList.toggle('is-visible', has);
    debounced(ev.target.value);
  });

  searchWrap.appendChild(sIco);
  searchWrap.appendChild(sInput);
  searchWrap.appendChild(sClear);
  bar.appendChild(searchWrap);

  /* Filter button */
  const filterCount = activeFilterCount();
  const filterBtn = el('button', {
    class: ['btn', 'btn--surface', filterCount ? 'has-badge' : ''].filter(Boolean),
    attrs: { type: 'button' },
  });
  filterBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['⚙'] }));
  filterBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['فیلترها'] }));
  if (filterCount) {
    filterBtn.appendChild(el('span', { class: 'btn__badge' }, { children: [toFaDigits(filterCount)] }));
  }
  filterBtn.addEventListener('click', onToggleFilters);
  bar.appendChild(filterBtn);

  /* Sort */
  const sortBtn = el('button', {
    class: 'btn btn--surface',
    attrs: { type: 'button' },
  });
  const sortLabel = SORT_OPTIONS.find((s) => s.id === state.sort)?.label || 'مرتب‌سازی';
  sortBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['⇅'] }));
  sortBtn.appendChild(el('span', { class: 'btn__label' }, { children: [sortLabel] }));

  sortBtn.addEventListener('click', () => {
    const menu = el('div', { class: 'sort-menu' });
    for (const s of SORT_OPTIONS) {
      const item = el('button', {
        class: ['dropdown__item', s.id === state.sort ? 'is-active' : ''].filter(Boolean),
        attrs: { type: 'button' },
      });
      item.appendChild(el('span', { class: 'dropdown__item-icon' }, { children: [s.id === state.sort ? '✓' : ''] }));
      item.appendChild(el('span', { class: 'dropdown__item-label' }, { children: [s.label] }));
      item.addEventListener('click', () => {
        onSortChange(s.id);
        closeDropdown();
      });
      menu.appendChild(item);
    }
    import('../../ui/dropdown.js').then(({ toggleDropdown }) => {
      toggleDropdown(sortBtn, menu, { placement: 'bottom-end', width: 220 });
    });
  });
  bar.appendChild(sortBtn);

  /* View switcher */
  const viewSwitch = segmented({
    items: VIEW_ITEMS,
    active: state.view,
    onChange: onViewChange,
    size: 'sm',
  });
  bar.appendChild(viewSwitch);

  /* Page size (small dropdown) */
  const sizeBtn = el('button', {
    class: 'btn btn--ghost btn--sm',
    attrs: { type: 'button', title: 'تعداد در هر صفحه' },
  }, { children: [`${toFaDigits(state.pageSize)}/صفحه`] });
  sizeBtn.addEventListener('click', () => {
    const menu = el('div');
    for (const s of PAGE_SIZES) {
      const item = el('button', {
        class: ['dropdown__item', s === state.pageSize ? 'is-active' : ''].filter(Boolean),
        attrs: { type: 'button' },
      });
      item.appendChild(el('span', { class: 'dropdown__item-icon' }, { children: [s === state.pageSize ? '✓' : ''] }));
      item.appendChild(el('span', { class: 'dropdown__item-label' }, { children: [toFaDigits(s)] }));
      item.addEventListener('click', () => { onPageSizeChange(s); closeDropdown(); });
      menu.appendChild(item);
    }
    toggleDropdown(sizeBtn, menu, { placement: 'bottom-end', width: 140 });
  });
  bar.appendChild(sizeBtn);

  /* Spacer */
  bar.appendChild(el('div', { class: 'lies-toolbar__spacer' }));

  /* Count chip */
  const countEl = el('div', { class: 'lies-toolbar__count' });
  countEl.appendChild(badge({
    label: `${toFaDigits(state.total)} مورد`,
    variant: 'muted',
    size: 'sm',
    pill: true,
  }));
  bar.appendChild(countEl);

  /* New button */
  const newBtn = el('button', {
    class: 'btn btn--primary',
    attrs: { type: 'button' },
  });
  newBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['＋'] }));
  newBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['دروغ جدید'] }));
  newBtn.addEventListener('click', onCreateNew);
  bar.appendChild(newBtn);

  return bar;
}

export { VIEW_ITEMS };