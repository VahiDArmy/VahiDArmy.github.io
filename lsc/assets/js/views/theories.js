/* ============================================================
   Theories list view
   ============================================================ */
import { el, escapeHtml, debounce, formatNumber, buildQuery, parseQuery } from '../utils.js';
import { state, subscribe } from '../state.js';
import { navigate } from '../router.js';
import { listTheories } from '../data.js';
import { theoryCard, pagination, emptyState, skeletonCards } from '../components.js';
import { APP } from '../config.js';

export const renderTheories = async (root, { query = {} } = {}) => {
  const initialCategory = query.category || 'all';
  const initialSort = query.sort || 'created_desc';
  const initialView = query.view || 'grid';
  const initialMine = query.mine === '1';
  const initialQ = query.q || '';

  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-lightbulb-flash-line"></i>کتابخانه</div>
      <h1 class="page-header__title">نظریه‌ها</h1>
      <p class="page-header__desc">کاوش، جستجو و سازمان‌دهی نظریه‌ها با دسته‌بندی، برچسب و تقویم شمسی.</p>
    </div>
    <div class="page-header__actions">
      <button class="btn btn--primary" data-act="new"><i class="ri-add-line"></i>نظریه جدید</button>
    </div>
  `;
  page.appendChild(header);

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;';
  const filters = document.createElement('div');
  filters.className = 'search-filters';
  const cats = [{ id: 'all', label: 'همه' }, ...APP.categories];
  cats.forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (cat.id === initialCategory ? ' is-active' : '');
    b.dataset.cat = cat.id;
    b.innerHTML = `${cat.icon ? `<i class="${cat.icon}"></i>` : ''}${cat.label}`;
    filters.appendChild(b);
  });
  toolbar.appendChild(filters);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  const searchInput = document.createElement('input');
  searchInput.className = 'input';
  searchInput.placeholder = 'جستجو…';
  searchInput.value = initialQ;
  searchInput.style.width = '220px';
  searchInput.style.height = '36px';
  actions.appendChild(searchInput);

  const sortSel = document.createElement('select');
  sortSel.className = 'select';
  sortSel.style.height = '36px';
  sortSel.style.width = 'auto';
  sortSel.innerHTML = `
    <option value="created_desc">جدیدترین</option>
    <option value="created_asc">قدیمی‌ترین</option>
    <option value="updated_desc">آخرین ویرایش</option>
    <option value="title_asc">عنوان (الف)</option>
    <option value="title_desc">عنوان (یا)</option>
    <option value="view_desc">پربازدیدترین</option>
  `;
  sortSel.value = initialSort;
  actions.appendChild(sortSel);

  if (state.user) {
    const mineBtn = document.createElement('button');
    mineBtn.type = 'button';
    mineBtn.className = 'chip' + (initialMine ? ' is-active' : '');
    mineBtn.dataset.mine = '';
    mineBtn.innerHTML = '<i class="ri-user-line"></i>نظریه‌های من';
    actions.appendChild(mineBtn);
  }
  toolbar.appendChild(actions);
  page.appendChild(toolbar);

  const resultWrap = document.createElement('div');
  resultWrap.style.marginTop = '8px';
  resultWrap.appendChild(skeletonCards(6));
  page.appendChild(resultWrap);
  root.appendChild(page);

  let currentPage = Number(query.page || 1);
  let currentCategory = initialCategory;
  let currentSort = initialSort;
  let currentMine = initialMine;
  let currentQ = initialQ;

  const syncHash = () => {
    const q = buildQuery({
      category: currentCategory !== 'all' ? currentCategory : '',
      sort: currentSort !== 'created_desc' ? currentSort : '',
      mine: currentMine ? '1' : '',
      q: currentQ || '',
      page: currentPage > 1 ? currentPage : ''
    });
    history.replaceState(null, '', `#/theories${q}`);
  };

  const load = async () => {
    resultWrap.innerHTML = '';
    resultWrap.appendChild(skeletonCards(6));
    syncHash();
    try {
      const { items, count } = await listTheories({
        page: currentPage, category: currentCategory, q: currentQ, mine: currentMine, sort: currentSort
      });
      resultWrap.innerHTML = '';
      if (!items.length) {
        resultWrap.appendChild(emptyState({
          title: 'نتیجه‌ای یافت نشد',
          desc: currentQ || currentCategory !== 'all' || currentMine ? 'فیلترها را تغییر دهید یا جستجوی دیگری امتحان کنید.' : 'اولین نظریه خود را بسازید.',
          actions: [{ label: 'نظریه جدید', primary: true, icon: 'ri-add-line', onClick: () => navigate('/theories/new') }]
        }));
        return;
      }
      const meta = document.createElement('div');
      meta.style.cssText = 'display:flex;justify-content:space-between;align-items:center;color:var(--ink-mute);font-size:var(--fs-sm);';
      meta.innerHTML = `<span>${formatNumber(count)} نظریه</span><span>صفحه ${formatNumber(currentPage)}</span>`;
      resultWrap.appendChild(meta);
      const grid = document.createElement('div');
      grid.className = 'theory-grid stagger';
      items.forEach(t => grid.appendChild(theoryCard(t)));
      resultWrap.appendChild(grid);
      if (count > APP.pagination.theoriesPerPage) {
        resultWrap.appendChild(pagination({
          page: currentPage, perPage: APP.pagination.theoriesPerPage, total: count,
          onPage: (p) => { currentPage = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        }));
      }
    } catch (e) {
      console.error(e);
      resultWrap.innerHTML = '';
      resultWrap.appendChild(emptyState({ title: 'خطا در بارگذاری', desc: 'لطفاً اتصال خود را بررسی کنید یا وارد شوید.' }));
    }
  };

  page.querySelector('[data-act="new"]').addEventListener('click', () => navigate('/theories/new'));

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cat]');
    if (!b) return;
    filters.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    currentCategory = b.dataset.cat;
    currentPage = 1;
    load();
  });

  actions.addEventListener('click', (e) => {
    const mine = e.target.closest('button[data-mine]');
    if (mine) {
      currentMine = !currentMine;
      mine.classList.toggle('is-active', currentMine);
      currentPage = 1;
      load();
    }
  });

  searchInput.addEventListener('input', debounce(() => {
    currentQ = searchInput.value.trim();
    currentPage = 1;
    load();
  }, 320));

  sortSel.addEventListener('change', () => {
    currentSort = sortSel.value;
    currentPage = 1;
    load();
  });

  await load();
};
