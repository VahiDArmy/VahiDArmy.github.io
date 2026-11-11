/* ============================================================
   Search view
   ============================================================ */
import { el, escapeHtml, debounce, highlight, formatNumber } from '../utils.js';
import { state, addRecentSearch, clearRecentSearches, subscribe } from '../state.js';
import { navigate } from '../router.js';
import { globalSearch } from '../data.js';
import { emptyState } from '../components.js';
import { formatJalali } from '../shamsi.js';

export const renderSearch = async (root, { query = {} } = {}) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-search-2-line"></i>کاوش پیشرفته</div>
      <h1 class="page-header__title">جستجو</h1>
      <p class="page-header__desc">در عنوان، خلاصه، محتوا و برچسب‌ها جستجو کنید.</p>
    </div>
  `;
  page.appendChild(header);

  const hero = document.createElement('div');
  hero.className = 'search-hero';
  hero.innerHTML = `
    <div class="search-hero__input-wrap">
      <i class="ri-search-line"></i>
      <input class="search-hero__input" type="search" placeholder="چه چیزی را جستجو می‌کنید؟" value="${escapeHtml(query.q || '')}" />
    </div>
    <div class="search-filters">
      <span style="font-size:var(--fs-sm);color:var(--ink-mute);">جستجوهای اخیر:</span>
      <div data-recent style="display:flex;gap:6px;flex-wrap:wrap;"></div>
    </div>
  `;
  page.appendChild(hero);

  const results = document.createElement('div');
  results.className = 'search-results';
  results.style.marginTop = '20px';
  page.appendChild(results);
  root.appendChild(page);

  const input = hero.querySelector('input');
  const recentHost = hero.querySelector('[data-recent]');

  const renderRecent = () => {
    recentHost.innerHTML = '';
    if (!state.recentSearches.length) {
      recentHost.innerHTML = '<span style="color:var(--ink-faint);font-size:var(--fs-xs);">—</span>';
      return;
    }
    state.recentSearches.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = q;
      b.addEventListener('click', () => { input.value = q; doSearch(q); });
      recentHost.appendChild(b);
    });
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.innerHTML = '<i class="ri-delete-bin-line"></i>پاک کردن';
    c.addEventListener('click', () => { clearRecentSearches(); renderRecent(); });
    recentHost.appendChild(c);
  };
  renderRecent();

  const doSearch = async (q) => {
    q = String(q || '').trim();
    if (!q) { results.innerHTML = ''; return; }
    addRecentSearch(q);
    renderRecent();
    results.innerHTML = '<div class="skeleton skeleton--text"></div><div class="skeleton skeleton--text"></div>';
    try {
      const { theories, objects } = await globalSearch(q, 20);
      results.innerHTML = '';
      if (!theories.length && !objects.length) {
        results.appendChild(emptyState({ title: 'نتیجه‌ای یافت نشد', desc: 'عبارت دیگری امتحان کنید.' }));
        return;
      }
      if (theories.length) {
        const h = document.createElement('h3');
        h.style.cssText = 'font-size:var(--fs-lg);margin:12px 0 8px;';
        h.innerHTML = `<i class="ri-lightbulb-flash-line"></i> نظریه‌ها <span style="color:var(--ink-faint);font-size:var(--fs-sm);">(${formatNumber(theories.length)})</span>`;
        results.appendChild(h);
        theories.forEach(t => results.appendChild(theoryResult(t, q)));
      }
      if (objects.length) {
        const h = document.createElement('h3');
        h.style.cssText = 'font-size:var(--fs-lg);margin:12px 0 8px;';
        h.innerHTML = `<i class="ri-shape-2-line"></i> اشیاء <span style="color:var(--ink-faint);font-size:var(--fs-sm);">(${formatNumber(objects.length)})</span>`;
        results.appendChild(h);
        objects.forEach(o => results.appendChild(objectResult(o, q)));
      }
    } catch (e) {
      results.innerHTML = '';
      results.appendChild(emptyState({ title: 'خطا', desc: e.message }));
    }
  };

  input.addEventListener('input', debounce((e) => doSearch(e.target.value), 350));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(input.value); });

  if (query.q) { input.value = query.q; await doSearch(query.q); }
};

const theoryResult = (t, q) => {
  const a = document.createElement('a');
  a.href = `#/theories/${t.id}`;
  a.dataset.link = '';
  a.className = 'search-result';
  const thumb = t.cover_image ? `<img src="${escapeHtml(t.cover_image)}" alt="" />` : `<div style="display:grid;place-items:center;width:100%;height:100%;color:var(--ink-faint);"><i class="ri-image-line"></i></div>`;
  a.innerHTML = `
    <div class="search-result__thumb">${thumb}</div>
    <div class="search-result__body">
      <div class="search-result__title">${highlight(t.title, q)}</div>
      <div class="search-result__excerpt">${highlight(t.summary || '', q)}</div>
      <div class="search-result__meta"><span><i class="ri-calendar-line"></i>${formatJalali(t.created_at)}</span></div>
    </div>
  `;
  return a;
};

const objectResult = (o, q) => {
  const a = document.createElement('a');
  a.href = `#/objects/${o.id}`;
  a.dataset.link = '';
  a.className = 'search-result';
  const thumb = o.image_url ? `<img src="${escapeHtml(o.image_url)}" alt="" />` : `<div style="display:grid;place-items:center;width:100%;height:100%;color:var(--ink-faint);"><i class="ri-shape-2-line"></i></div>`;
  a.innerHTML = `
    <div class="search-result__thumb">${thumb}</div>
    <div class="search-result__body">
      <div class="search-result__title">${highlight(o.title, q)}</div>
      <div class="search-result__meta">${o.theory ? `<span><i class="ri-lightbulb-line"></i>${escapeHtml(o.theory.title)}</span>` : ''}</div>
    </div>
  `;
  return a;
};
