import { state } from '../state.js';
import { navigate } from '../router.js';
import { CATEGORIES, getCategory } from '../config.js';
import {
  esc, faDigits, fmtCompactMoney, fmtDurationShort, fmtDuration,
  formatPersianDate, formatClock, todayISO, addDaysISO,
} from '../utils.js';
import { emptyState, openModal } from '../ui.js';
import { openEntryDetail } from '../components/entry_modal.js';

export function render(container) {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  const f = state.filters || (state.filters = {});
  f.search = f.search || '';
  f.category = f.category || 'all';
  f.sort = f.sort || 'newest';
  f.favorite = !!f.favorite;
  f.period = f.period || 'all';

  const filtered = applyFilters(entries, f);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">دفتر شادی</div>
        <div class="page-subtitle">${faDigits(entries.length)} شادی ثبت‌شده · ${faDigits(filtered.length)} نمایش</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" data-goto="add">➕ شادی جدید</button>
      </div>
    </div>

    <div class="journal-toolbar">
      <div class="journal-search">
        <input type="search" class="input" id="journal-search-input" placeholder="جستجو در شادی‌ها..." value="${esc(f.search)}" maxlength="80">
      </div>
      <div class="segmented" id="sort-seg">
        <button type="button" data-sort="newest" class="${f.sort === 'newest' ? 'active' : ''}">جدیدترین</button>
        <button type="button" data-sort="oldest" class="${f.sort === 'oldest' ? 'active' : ''}">قدیمی‌ترین</button>
        <button type="button" data-sort="money" class="${f.sort === 'money' ? 'active' : ''}">گران‌ترین</button>
        <button type="button" data-sort="joy" class="${f.sort === 'joy' ? 'active' : ''}">شادترین</button>
      </div>
    </div>

    <div class="journal-filters">
      <button type="button" class="chip ${f.category === 'all' && !f.favorite ? 'active' : ''}" data-cat="all">همه</button>
      <button type="button" class="chip ${f.favorite ? 'active' : ''}" data-fav="1">⭐ موردعلاقه</button>
      ${CATEGORIES.filter((c) => c.id !== 'other' || entries.some((e) => e.category === 'other')).map((c) => `<button type="button" class="chip ${f.category === c.id ? 'active' : ''}" data-cat="${esc(c.id)}">${esc(c.emoji)} ${esc(c.label)}</button>`).join('')}
    </div>

    <div class="segmented" style="margin-bottom:1.25rem" id="period-seg">
      <button type="button" data-period="all" class="${f.period === 'all' ? 'active' : ''}">همه</button>
      <button type="button" data-period="week" class="${f.period === 'week' ? 'active' : ''}">این هفته</button>
      <button type="button" data-period="month" class="${f.period === 'month' ? 'active' : ''}">این ماه</button>
      <button type="button" data-period="year" class="${f.period === 'year' ? 'active' : ''}">امسال</button>
    </div>

    <div class="journal-list stagger" id="journal-list">
      ${filtered.length ? filtered.map((e) => itemHTML(e)).join('') : emptyState({ emoji: '🔍', title: 'چیزی پیدا نشد', desc: 'فیلترها را تغییر بده یا شادی جدیدی ثبت کن.', actionLabel: 'شادی جدید', actionView: 'add' })}
    </div>
  `;

  attachHandlers(container, f);
}

function applyFilters(entries, f) {
  let list = entries.slice();
  const search = (f.search || '').trim().toLowerCase();
  if (search) {
    list = list.filter((e) =>
      (e.title || '').toLowerCase().includes(search)
      || (e.description || '').toLowerCase().includes(search)
      || (Array.isArray(e.tags) && e.tags.some((t) => String(t).toLowerCase().includes(search)))
    );
  }
  if (f.category && f.category !== 'all') list = list.filter((e) => e.category === f.category);
  if (f.favorite) list = list.filter((e) => e.is_favorite);

  if (f.period && f.period !== 'all') {
    const today = todayISO();
    const cutoff = f.period === 'week'
      ? addDaysISO(today, -7)
      : f.period === 'month'
        ? addDaysISO(today, -30)
        : addDaysISO(today, -365);
    list = list.filter((e) => e.entry_date >= cutoff);
  }

  switch (f.sort) {
    case 'oldest':
      list.sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''));
      break;
    case 'money':
      list.sort((a, b) => Number(b.money_spent) - Number(a.money_spent));
      break;
    case 'joy':
      list.sort((a, b) => Number(b.joy_score) - Number(a.joy_score));
      break;
    case 'newest':
    default:
      list.sort((a, b) => {
        const cmp = (b.entry_date || '').localeCompare(a.entry_date || '');
        if (cmp !== 0) return cmp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }
  return list;
}

function itemHTML(entry) {
  const cat = getCategory(entry.category);
  const meta = [];
  meta.push(`<span class="meta-pill">${esc(cat.emoji)} ${esc(cat.label)}</span>`);
  meta.push(`<span class="meta-pill">${esc(formatPersianDate(entry.entry_date, { month: 'long', day: 'numeric' }))}</span>`);
  if (entry.money_spent > 0) meta.push(`<span class="meta-pill">💰 ${esc(fmtCompactMoney(entry.money_spent))}</span>`);
  if (entry.time_spent_minutes > 0) meta.push(`<span class="meta-pill">⏱ ${esc(fmtDurationShort(entry.time_spent_minutes))}</span>`);
  if (entry.is_favorite) meta.push(`<span class="meta-pill">⭐</span>`);

  const tags = Array.isArray(entry.tags) ? entry.tags.slice(0, 4) : [];
  const tagHtml = tags.length
    ? `<div class="tag-cloud" style="margin-top:.4rem">${tags.map((t) => `<span class="tag-item">#${esc(t)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="journal-item" data-entry-id="${esc(entry.id)}" style="--item-color:${esc(cat.color)}">
      <div class="journal-item-icon">${esc(entry.emoji || cat.emoji)}</div>
      <div class="journal-item-body">
        <div class="journal-item-title">${esc(entry.title)}</div>
        ${entry.description ? `<div class="journal-item-desc">${esc(entry.description)}</div>` : ''}
        <div class="journal-item-meta">${meta.join('')}</div>
        ${tagHtml}
      </div>
      <div class="journal-item-actions">
        <div class="badge badge-violet">${faDigits(entry.joy_score || 0)}/${faDigits(10)}</div>
      </div>
    </div>
  `;
}

function attachHandlers(container, f) {
  const searchInput = container.querySelector('#journal-search-input');
  let searchTimer = null;
  searchInput?.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => {
      f.search = value;
      refresh(container, f);
    }, 180);
  });

  container.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      f.category = btn.dataset.cat;
      f.favorite = false;
      refresh(container, f);
    });
  });
  container.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      f.favorite = !f.favorite;
      if (f.favorite) f.category = 'all';
      refresh(container, f);
    });
  });
  container.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      f.sort = btn.dataset.sort;
      refresh(container, f);
    });
  });
  container.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      f.period = btn.dataset.period;
      refresh(container, f);
    });
  });

  container.querySelectorAll('[data-entry-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = (state.entries || []).find((e) => e.id === el.dataset.entryId);
      if (entry) openEntryDetail(entry);
    });
  });

  container.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function refresh(container, f) {
  const entries = state.entries || [];
  const filtered = applyFilters(entries, f);
  const list = container.querySelector('#journal-list');
  if (!list) return;
  list.innerHTML = filtered.length
    ? filtered.map((e) => itemHTML(e)).join('')
    : emptyState({ emoji: '🔍', title: 'چیزی پیدا نشد', desc: 'فیلترها را تغییر بده یا شادی جدیدی ثبت کن.', actionLabel: 'شادی جدید', actionView: 'add' });

  list.querySelectorAll('[data-entry-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = (state.entries || []).find((e) => e.id === el.dataset.entryId);
      if (entry) openEntryDetail(entry);
    });
  });
  list.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  container.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.classList.toggle('active', f.category === btn.dataset.cat);
  });
  container.querySelectorAll('[data-fav]').forEach((btn) => {
    btn.classList.toggle('active', f.favorite);
  });
  container.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.classList.toggle('active', f.sort === btn.dataset.sort);
  });
  container.querySelectorAll('[data-period]').forEach((btn) => {
    btn.classList.toggle('active', f.period === btn.dataset.period);
  });
}
