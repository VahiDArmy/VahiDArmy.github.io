/* ==========================================================================
   app.js — راه‌اندازی، پوسته اپ، مسیریابی، پالت دستورات و میان‌برها
   ========================================================================== */

import { startRouter, parseRoute, navigate } from './lib/router.js';
import { getState, subscribe, resetState } from './lib/store.js';
import { bootstrap, refreshBootstrap, enterDemo, reload } from './lib/repo.js';
import * as auth from './lib/auth.js';
import { openReviewForm } from './views/reviewForm.js';
import { openEntitySheet } from './components/entitySheet.js';
import { openModal, openMenu, toast, confirmDialog, hasOpenLayer } from './lib/ui.js';
import { icon } from './lib/icons.js';
import { esc, faNum, fuzzyScore, debounce } from './lib/utils.js';
import { userAvatar } from './components/parts.js';
import { buildIndex } from './lib/domain.js';
import { openShortcutsModal } from './views/settings.js';

import * as homeView from './views/home.js';
import * as productsView from './views/products.js';
import * as shopsView from './views/shops.js';
import * as vendorsView from './views/vendors.js';
import * as insightsView from './views/insights.js';
import * as listsView from './views/lists.js';
import * as settingsView from './views/settings.js';
import * as authView from './views/auth.js';
import * as setupView from './views/setup.js';

const appEl = document.getElementById('app');
const bootEl = document.getElementById('boot');
const bootHint = document.getElementById('boot-hint');

const ROUTES = {
  '/': { title: 'خانه', view: homeView, nav: 'home' },
  '/products': { title: 'محصولات', view: productsView, nav: 'products' },
  '/shops': { title: 'فروشگاه‌ها', view: shopsView, nav: 'shops' },
  '/vendors': { title: 'پلتفرم‌ها', view: vendorsView, nav: 'vendors' },
  '/insights': { title: 'تحلیل‌ها', view: insightsView, nav: 'insights' },
  '/lists': { title: 'لیست‌ها', view: listsView, nav: 'lists' },
  '/settings': { title: 'تنظیمات', view: settingsView, nav: 'settings' },
};

const NAV_GROUPS = [
  {
    label: 'دفترچه',
    items: [
      { path: '/', label: 'خانه', icon: 'home', key: 'home', count: 'reviews' },
      { path: '/products', label: 'محصولات', icon: 'package', key: 'products', count: 'products' },
      { path: '/shops', label: 'فروشگاه‌ها', icon: 'store', key: 'shops', count: 'shops' },
      { path: '/vendors', label: 'پلتفرم‌ها', icon: 'globe', key: 'vendors', count: 'vendors' },
    ],
  },
  {
    label: 'بینش',
    items: [
      { path: '/insights', label: 'تحلیل‌ها', icon: 'chart', key: 'insights' },
      { path: '/lists', label: 'لیست‌ها', icon: 'list', key: 'lists', count: 'lists' },
    ],
  },
  {
    label: 'سیستم',
    items: [{ path: '/settings', label: 'تنظیمات', icon: 'settings', key: 'settings' }],
  },
];

const MOBILE_NAV = [
  { path: '/', label: 'خانه', icon: 'home', key: 'home' },
  { path: '/products', label: 'محصولات', icon: 'package', key: 'products' },
  { path: '/insights', label: 'تحلیل', icon: 'chart', key: 'insights' },
  { path: '/settings', label: 'تنظیمات', icon: 'settings', key: 'settings' },
];

let activeView = null;
let shellEl = null;
let shellKind = null; // shell | auth | setup | error
let pendingG = false;
let palette = null;

/* ------------------------------- ابزار -------------------------------- */

function setBootHint(text) {
  if (bootHint) bootHint.textContent = text;
}

function hideBoot() {
  if (!bootEl) return;
  bootEl.classList.add('is-done');
  setTimeout(() => bootEl.remove(), 620);
}

function destroyView() {
  if (activeView?.destroy) {
    try {
      activeView.destroy();
    } catch (error) {
      console.error('[view] destroy failed', error);
    }
  }
  activeView = null;
}

function countOf(key) {
  const data = getState().data;
  if (!key) return null;
  return data[key]?.length ?? null;
}

function updateNavCounts() {
  if (!shellEl) return;
  shellEl.querySelectorAll('[data-count-key]').forEach((node) => {
    const value = countOf(node.dataset.countKey);
    if (value === null || value === undefined) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.textContent = faNum(value);
  });
}

function updateUserChip() {
  if (!shellEl) return;
  const state = getState();
  const nameNode = shellEl.querySelector('[data-user-name]');
  const subNode = shellEl.querySelector('[data-user-sub]');
  const avatarNode = shellEl.querySelector('[data-user-avatar]');
  const profile = state.data.profile || {};

  if (nameNode) nameNode.textContent = profile.display_name || (state.mode === 'demo' ? 'کاربر مهمان' : 'کاربر');
  if (subNode) subNode.textContent = state.mode === 'demo' ? 'حالت نمایشی' : state.user?.email || '—';
  if (avatarNode) avatarNode.outerHTML = userAvatar(profile, 'sm').replace('class="avatar ', 'data-user-avatar class="avatar ');
}

/* ------------------------------- پوسته -------------------------------- */

function shellHTML() {
  return `
    <div class="shell">
      <div class="sidebar-scrim" data-scrim></div>
      <aside class="sidebar" id="sidebar" aria-label="ناوبری اصلی">
        <div class="sidebar__top">
          <a class="brand" href="#/" aria-label="خانه فروشگاه‌یار">
            <span class="brand__mark">${icon('cart', 22)}</span>
            <span class="brand__text">
              <span class="brand__name">فروشگاه‌یار</span>
              <span class="brand__tag">دفترچه تجربه خرید</span>
            </span>
          </a>
        </div>

        <nav class="nav">
          ${NAV_GROUPS.map(
            (group) => `
            <div class="nav__group">${esc(group.label)}</div>
            ${group.items
              .map(
                (item) => `<a class="nav__item" href="#${item.path}" data-nav="${item.key}">
                  ${icon(item.icon, 19)}
                  <span class="nav__label">${esc(item.label)}</span>
                  ${item.count ? `<span class="nav__badge" data-count-key="${item.count}">—</span>` : ''}
                </a>`,
              )
              .join('')}
          `,
          ).join('')}
        </nav>

        <div class="sidebar__spacer"></div>

        <div class="sidebar__cta">
          <h4>ثبت سریع یک خرید</h4>
          <p>محصول، فروشگاه و پلتفرم را بگو؛ سه کلیک تا یک تجربه ماندگار.</p>
          <button type="button" class="btn btn--primary btn--sm" data-quick-add>${icon('plus', 14)} ثبت تجربه</button>
        </div>

        <button type="button" class="user-chip" data-user-menu>
          <span data-user-avatar>${userAvatar(getState().data.profile, 'sm')}</span>
          <span class="user-chip__meta">
            <span class="user-chip__name" data-user-name>کاربر</span>
            <span class="user-chip__sub" data-user-sub>—</span>
          </span>
          <span class="user-chip__chev">${icon('chevron-up', 14)}</span>
        </button>
      </aside>

      <div class="shell__main">
        <header class="topbar">
          <button type="button" class="icon-btn" data-nav-toggle aria-label="باز کردن منو">${icon('menu', 19)}</button>
          <div class="topbar__crumbs">
            <span class="crumb-parent">فروشگاه‌یار</span>
            <span class="sep">/</span>
            <b data-crumb>خانه</b>
          </div>
          <div class="topbar__actions">
            <button type="button" class="search-trigger" data-palette-open>
              ${icon('search', 16)}<span>جست‌وجوی سریع…</span><kbd class="kbd kbd--sm">Ctrl K</kbd>
            </button>
            <button type="button" class="icon-btn icon-btn--bordered" data-quick-add aria-label="ثبت خرید جدید" title="ثبت خرید (N)">${icon('plus', 18)}</button>
            <button type="button" class="icon-btn" data-user-menu aria-label="حساب کاربری">${userAvatar(getState().data.profile, 'sm')}</button>
          </div>
        </header>
        <main class="page" id="main-content" tabindex="-1"></main>
      </div>

      <nav class="mobile-nav" aria-label="ناوبری موبایل">
        ${MOBILE_NAV.slice(0, 2)
          .map(
            (item) => `<a class="mobile-nav__item" href="#${item.path}" data-nav="${item.key}">
              ${icon(item.icon, 20)}<span>${esc(item.label)}</span>
            </a>`,
          )
          .join('')}
        <button type="button" class="mobile-nav__item mobile-nav__item--add" data-quick-add aria-label="ثبت خرید">
          <span class="mobile-nav__add">${icon('plus', 20)}</span>
          <span>ثبت</span>
        </button>
        ${MOBILE_NAV.slice(2)
          .map(
            (item) => `<a class="mobile-nav__item" href="#${item.path}" data-nav="${item.key}">
              ${icon(item.icon, 20)}<span>${esc(item.label)}</span>
            </a>`,
          )
          .join('')}
      </nav>
    </div>
  `;
}

function buildShell() {
  appEl.innerHTML = shellHTML();
  shellEl = appEl.querySelector('.shell');
  shellKind = 'shell';
  updateNavCounts();
  updateUserChip();
}

function renderStandalone(kind, module, ctx) {
  if (shellKind === kind) return;
  destroyView();
  appEl.innerHTML = '';
  shellEl = null;
  shellKind = kind;
  // میزبان تازه در هر بارگذاری تا شنونده‌های قدیمی روی appEl جمع نشوند
  const host = document.createElement('div');
  host.className = 'standalone-host';
  appEl.appendChild(host);
  activeView = module.mount(host, ctx) || null;
}

function renderShell(route) {
  if (shellKind !== 'shell') {
    destroyView();
    appEl.innerHTML = '';
    buildShell();
  }
  const entry = ROUTES[route.path] || null;

  shellEl.querySelectorAll('[data-nav]').forEach((link) => {
    const target = link.getAttribute('href').replace(/^#/, '');
    const active = entry ? target === route.path : false;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const crumb = shellEl.querySelector('[data-crumb]');
  if (crumb) crumb.textContent = entry ? entry.title : 'پیدا نشد';

  document.title = entry ? `${entry.title} · فروشگاه‌یار` : 'صفحه پیدا نشد · فروشگاه‌یار';

  let pageEl = shellEl.querySelector('#main-content');
  if (!pageEl) return;

  // هر ناوبری یک گره تازه می‌گیرد تا شنونده‌های نمای قبلی باقی نمانند
  const freshPage = pageEl.cloneNode(false);
  pageEl.replaceWith(freshPage);
  pageEl = freshPage;

  if (!entry) {
    destroyView();
    pageEl.innerHTML = `<div class="page__inner"><div class="notfound">
      <div class="notfound__code">۴۰۴</div>
      <h1>این صفحه وجود ندارد</h1>
      <p class="page__sub">ممکن است لینک اشتباه باشد یا صفحه جابه‌جا شده باشد.</p>
      <a class="btn btn--primary" href="#/">${icon('home', 16)} بازگشت به خانه</a>
    </div></div>`;
    activeView = null;
    return;
  }

  destroyView();
  pageEl.innerHTML = '';
  activeView = entry.view.mount(pageEl, { query: route.query, path: route.path, onProfileChange: updateUserChip }) || null;
  pageEl.scrollTop = 0;

  closeMobileNav();
  updateNavCounts();
}

function closeMobileNav() {
  const sidebar = shellEl?.querySelector('.sidebar');
  const scrim = shellEl?.querySelector('[data-scrim]');
  sidebar?.classList.remove('is-open');
  scrim?.classList.remove('is-open');
}

/* ------------------------------- مسیرها ------------------------------- */

function render() {
  const state = getState();
  const route = parseRoute();

  if (!state.user) {
    if (route.path !== '/auth') {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/auth`);
    }
    renderStandalone('auth', authView, {
      onAuthed: async ({ demo = false } = {}) => {
        if (!demo) {
          try {
            await refreshBootstrap();
          } catch (error) {
            console.error(error);
          }
        }
        shellKind = null;
        render();
        toast.success(demo ? 'وارد حالت نمایشی شدی.' : 'خوش آمدی!');
      },
    });
    document.title = 'ورود · فروشگاه‌یار';
    return;
  }

  if (!state.tablesReady) {
    if (route.path !== '/setup') {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/setup`);
    }
    renderStandalone('setup', setupView, {
      onReady: async () => {
        try {
          await refreshBootstrap();
        } catch (error) {
          console.error(error);
        }
        shellKind = null;
        render();
      },
    });
    document.title = 'راه‌اندازی · فروشگاه‌یار';
    return;
  }

  if (route.path === '/auth' || route.path === '/setup') {
    navigate('/', { replace: true });
    return;
  }

  renderShell(route);
}

/* ---------------------------- پالت دستورات ---------------------------- */

function collectPaletteItems() {
  const state = getState();
  const pages = Object.entries(ROUTES).map(([path, entry]) => ({
    group: 'صفحه‌ها',
    label: entry.title,
    icon: entry.nav === 'home' ? 'home' : entry.nav === 'insights' ? 'chart' : entry.nav === 'settings' ? 'settings' : entry.nav === 'lists' ? 'list' : entry.nav === 'shops' ? 'store' : entry.nav === 'vendors' ? 'globe' : 'package',
    sub: `#${path}`,
    run: () => navigate(path),
  }));

  const actions = [
    { group: 'اقدام‌ها', label: 'ثبت تجربه خرید جدید', icon: 'plus', hint: 'N', run: () => openReviewForm({ onSaved: () => render() }) },
    { group: 'اقدام‌ها', label: 'رفتن به تنظیمات', icon: 'settings', run: () => navigate('/settings') },
    { group: 'اقدام‌ها', label: 'میان‌برهای صفحه‌کلید', icon: 'command', hint: '?', run: () => openShortcutsModal() },
    {
      group: 'اقدام‌ها',
      label: 'دانلود پشتیبان JSON',
      icon: 'download',
      run: () => import('./lib/utils.js').then(async (utils) => {
        const repo = await import('./lib/repo.js');
        utils.downloadFile(`forooshgahyar-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(repo.exportAll(), null, 2), 'application/json');
        toast.success('پشتیبان دانلود شد.');
      }),
    },
  ];

  const entities = [
    ...state.data.products.map((entity) => ({ type: 'product', entity, group: 'محصولات', icon: entity.emoji || '📦' })),
    ...state.data.shops.map((entity) => ({ type: 'shop', entity, group: 'فروشگاه‌ها', icon: entity.emoji || '🏪' })),
    ...state.data.vendors.map((entity) => ({ type: 'vendor', entity, group: 'پلتفرم‌ها', icon: entity.emoji || '🛒' })),
  ].map((row) => ({
    group: row.group,
    label: row.entity.name,
    sub: row.entity.category || row.entity.city || (row.type === 'vendor' ? 'پلتفرم' : ''),
    emoji: row.icon,
    run: () => openEntitySheet(row.type, row.entity.id),
  }));

  return [...actions, ...pages, ...entities];
}

function openPalette() {
  if (palette) return;
  const wrap = document.createElement('div');
  wrap.className = 'palette-overlay';
  wrap.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="پالت دستورات">
      <div class="palette__field">
        ${icon('search', 18)}
        <input class="palette__input" type="text" placeholder="جست‌وجو در صفحه‌ها، اقدام‌ها و داده‌ها…" autocomplete="off" spellcheck="false" />
        <kbd class="kbd">Esc</kbd>
      </div>
      <div class="palette__list" role="listbox"></div>
      <div class="palette__foot">
        <span><kbd class="kbd kbd--sm">↑</kbd><kbd class="kbd kbd--sm">↓</kbd> حرکت</span>
        <span><kbd class="kbd kbd--sm">↵</kbd> انتخاب</span>
        <span><kbd class="kbd kbd--sm">Esc</kbd> بستن</span>
        <span class="u-grow"></span>
        <span>${faNum(getState().data.reviews.length)} تجربه در حافظه</span>
      </div>
    </div>
  `;

  document.getElementById('palette-root').appendChild(wrap);
  const input = wrap.querySelector('.palette__input');
  const list = wrap.querySelector('.palette__list');
  const all = collectPaletteItems();
  let items = all.slice(0, 30);
  let activeIndex = 0;

  function renderList() {
    const q = input.value.trim();
    let filtered = all;
    if (q) {
      filtered = all
        .map((item) => ({ item, score: fuzzyScore(q, `${item.label} ${item.sub || ''}`) }))
        .filter((row) => row.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, 24)
        .map((row) => row.item);
    } else {
      filtered = all.slice(0, 30);
    }
    items = filtered;
    activeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

    if (!items.length) {
      list.innerHTML = `<div class="u-center u-dim u-xs" style="padding:28px">چیزی پیدا نشد</div>`;
      return;
    }

    let lastGroup = '';
    list.innerHTML = items
      .map((item, index) => {
        const groupHeader = item.group !== lastGroup ? `<div class="palette__group">${esc(item.group)}</div>` : '';
        lastGroup = item.group;
        return `${groupHeader}<button type="button" class="palette__item ${index === activeIndex ? 'is-active' : ''}" data-index="${index}" role="option">
          ${item.emoji ? `<span style="font-size:15px">${esc(item.emoji)}</span>` : icon(item.icon || 'arrow-left', 16)}
          <span class="u-grow u-truncate">
            <span class="u-clamp-1">${esc(item.label)}</span>
            ${item.sub ? `<span class="palette__item-sub u-clamp-1">${esc(item.sub)}</span>` : ''}
          </span>
          ${item.hint ? `<kbd class="kbd kbd--sm">${esc(item.hint)}</kbd>` : '<span class="palette__hint">↵</span>'}
        </button>`;
      })
      .join('');
  }

  function run(index) {
    const item = items[index];
    if (!item) return;
    close();
    setTimeout(() => item.run?.(), 10);
  }

  function close() {
    if (!wrap.isConnected) return;
    wrap.classList.remove('is-open');
    document.removeEventListener('mousedown', onOutside, true);
    setTimeout(() => wrap.remove(), 200);
    palette = null;
  }

  const onOutside = (event) => {
    if (!wrap.querySelector('.palette')?.contains(event.target)) close();
  };

  wrap.addEventListener('click', (event) => {
    if (event.target === wrap) close();
    const item = event.target.closest('[data-index]');
    if (item) run(Number(item.dataset.index));
  });

  input.addEventListener('input', debounce(() => {
    activeIndex = 0;
    renderList();
  }, 70));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      renderList();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(activeIndex);
    }
  });

  document.addEventListener('mousedown', onOutside, true);
  requestAnimationFrame(() => {
    wrap.classList.add('is-open');
    input.focus();
  });

  renderList();
  palette = { close };
}

/* ------------------------------- رویدادها ----------------------------- */

function openUserMenu(anchor) {
  const state = getState();
  const profile = state.data.profile || {};
  openMenu(anchor, [
    { group: profile.display_name || state.user?.email || 'حساب من' },
    { label: 'پروفایل و تنظیمات', icon: 'settings', onClick: () => navigate('/settings') },
    { label: 'ثبت خرید جدید', icon: 'plus', hint: 'N', onClick: () => openReviewForm({ onSaved: () => render() }) },
    { label: 'میان‌برهای صفحه‌کلید', icon: 'command', hint: '?', onClick: () => openShortcutsModal() },
    { label: 'دانلود پشتیبان', icon: 'download', onClick: async () => {
      const repo = await import('./lib/repo.js');
      const utils = await import('./lib/utils.js');
      utils.downloadFile('forooshgahyar-backup.json', JSON.stringify(repo.exportAll(), null, 2), 'application/json');
      toast.success('پشتیبان دانلود شد.');
    } },
    { sep: true },
    state.mode === 'demo'
      ? {
          label: 'خروج از حالت نمایشی',
          icon: 'logout',
          danger: true,
          onClick: () => {
            import('./lib/repo.js').then((repo) => {
              repo.exitDemo();
              window.location.reload();
            });
          },
        }
      : {
          label: 'خروج از حساب',
          icon: 'logout',
          danger: true,
          onClick: async () => {
            const ok = await confirmDialog({ title: 'خروج', message: 'از حساب کاربری خارج می‌شوی؟', confirmText: 'خروج', tone: 'primary' });
            if (!ok) return;
            try {
              await auth.signOut();
              resetState();
              render();
            } catch (error) {
              toast.error(error.message);
            }
          },
        },
  ]);
}

appEl.addEventListener('click', (event) => {
  const target = event.target;

  if (target.closest('[data-nav-toggle]')) {
    const sidebar = shellEl?.querySelector('.sidebar');
    const scrim = shellEl?.querySelector('[data-scrim]');
    sidebar?.classList.toggle('is-open');
    scrim?.classList.toggle('is-open', sidebar?.classList.contains('is-open'));
    return;
  }

  if (target.closest('[data-scrim]')) {
    closeMobileNav();
    return;
  }

  if (target.closest('[data-palette-open]')) {
    openPalette();
    return;
  }

  const quickAdd = target.closest('[data-quick-add]');
  if (quickAdd) {
    closeMobileNav();
    openReviewForm({ onSaved: () => render() });
    return;
  }

  const userMenu = target.closest('[data-user-menu]');
  if (userMenu) {
    closeMobileNav();
    openUserMenu(userMenu);
    return;
  }

  const navItem = target.closest('.nav__item, .mobile-nav__item');
  if (navItem) closeMobileNav();
});

document.addEventListener('keydown', (event) => {
  const typing = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const state = getState();

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (state.user) openPalette();
    return;
  }

  if (typing || hasOpenLayer()) return;

  if (event.key === 'n' || event.key === 'N') {
    if (!state.user || !state.tablesReady) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    openReviewForm({ onSaved: () => render() });
    return;
  }

  if (event.key === '?') {
    event.preventDefault();
    openShortcutsModal();
    return;
  }

  if (event.key === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    pendingG = true;
    setTimeout(() => {
      pendingG = false;
    }, 1400);
    return;
  }

  if (pendingG) {
    const map = { h: '/', p: '/products', s: '/shops', v: '/vendors', i: '/insights', l: '/lists', t: '/settings' };
    const target = map[event.key.toLowerCase()];
    if (target) {
      pendingG = false;
      event.preventDefault();
      navigate(target);
    }
    return;
  }

  if (event.key === '/') {
    event.preventDefault();
    if (parseRoute().path !== '/') {
      navigate('/');
      setTimeout(() => document.querySelector('[data-home-search]')?.focus(), 220);
    } else {
      document.querySelector('[data-home-search]')?.focus();
    }
  }
});

window.addEventListener('hashchange', () => {
  if (!palette) closeMobileNav();
});

const unsubscribeStore = subscribe((state, keys) => {
  if (!shellEl) return;
  if (!keys || keys.includes('*') || keys.some((key) => ['reviews', 'products', 'shops', 'vendors', 'lists', 'profile', 'user'].includes(key))) {
    updateNavCounts();
    updateUserChip();
  }
});

/* ------------------------------- شروع -------------------------------- */

async function start() {
  appEl.innerHTML = '';
  setBootHint('اتصال به Supabase و خواندن داده‌ها…');

  try {
    const result = await bootstrap();
    if (result?.error && !result?.needsSetup) {
      toast.error(result.error.message || 'اتصال برقرار نشد.');
    }
  } catch (error) {
    console.error(error);
    toast.error(error.message || 'خطا در راه‌اندازی.');
  }

  render();
  hideBoot();

  try {
    auth.onAuthChange(async (event, session) => {
      const state = getState();
      if (event === 'SIGNED_OUT' && state.mode !== 'demo') {
        resetState();
        render();
      } else if (event === 'SIGNED_IN' && !state.user) {
        try {
          await refreshBootstrap();
        } catch (error) {
          console.error(error);
        }
        render();
      }
    });
  } catch (error) {
    /* بدون کلاینت، حالت نمایشی همچنان کار می‌کند */
  }

  startRouter(() => {
    render();
  });
}

start();
