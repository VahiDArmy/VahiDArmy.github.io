/**
 * بازاربان — نقطهٔ ورود
 * ---------------------------------------------------------------------------
 * راه‌اندازی تم و پوسته، بارگذاری داده (Supabase یا نمایشی)، ثبت مسیرها،
 * میان‌بر صفحه‌کلید (پالت دستورات)، منوی کاربر، کشوی موبایل، نوار مقایسه و
 * مدیریت مودال‌های احراز هویت و گزارش.
 */

import { CONFIG, LEVELS, CATEGORIES } from './config.js';
import {
  $,
  $$,
  esc,
  attr,
  toFa,
  fmtInt,
  relTime,
  truncate,
  debounce,
  throttle,
  storage,
  copyText,
  lockScroll,
  formatJalali,
  normalizeFa,
  matchScore,
} from './utils.js';
import { icon } from './icons.js';
import * as store from './store.js';
import {
  registerRoutes,
  setNotFoundView,
  setRouteListener,
  setAuthGuard,
  start,
  navigate,
  parseHash,
} from './router.js';
import {
  toast,
  avatar,
  openModal,
  openMenu,
  openDrawer,
  confirmDialog,
  fillTicker,
  levelMeta,
  setupReveal,
} from './ui.js';
import { homeView } from './views/home.js';
import { vendorsView } from './views/vendors.js';
import { vendorView } from './views/vendor.js';
import { shopsView } from './views/shops.js';
import { shopView } from './views/shop.js';
import { productsView } from './views/products.js';
import { productView } from './views/product.js';
import { reviewsView } from './views/reviews.js';
import { compareView } from './views/compare.js';
import { dashboardView } from './views/dashboard.js';
import { createView } from './views/create.js';
import { authView } from './views/auth.js';
import { searchView } from './views/search.js';
import { guideView } from './views/guide.js';
import { aboutView } from './views/about.js';
import { insightsView } from './views/insights.js';
import { notFoundView } from './views/notfound.js';
import { initShortcuts, openShortcutsHelp } from './shortcuts.js';

/* --------------------------------------------------------------------------
   تم و تراکم
   -------------------------------------------------------------------------- */
const THEME_KEY = CONFIG.LS.theme;
const DENSITY_KEY = CONFIG.LS.density;

function preferredTheme() {
  const saved = storage.get(THEME_KEY, null);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  if (persist) storage.set(THEME_KEY, next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#f6f8f4' : '#06090d');
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  toast(current === 'dark' ? 'تم روشن شد.' : 'تم تاریک شد.', { type: 'info', duration: 1800 });
}

function applyDensity(density, { persist = true } = {}) {
  const next = density === 'compact' ? 'compact' : 'cozy';
  if (next === 'cozy') delete document.documentElement.dataset.density;
  else document.documentElement.dataset.density = next;
  if (persist) storage.set(DENSITY_KEY, next);
}

/* --------------------------------------------------------------------------
   پوسته: سربرگ، فوتر، تیکر
   -------------------------------------------------------------------------- */
function renderAuthSlot() {
  const slot = $('#auth-slot');
  if (!slot) return;
  const user = store.currentUser();
  if (!user) {
    slot.innerHTML = `<a class="btn btn--ghost btn--sm" href="#/login" data-link>ورود</a>`;
    return;
  }
  const profile = store.getState().profile;
  slot.innerHTML = `<button class="user-chip" type="button" data-user-menu aria-haspopup="menu" aria-label="منوی حساب">
    ${avatar({ name: profile?.displayName || user.displayName || user.email, hue: profile?.avatarHue ?? user.avatarHue ?? 152, size: 'sm' })}
    <span class="user-chip__name">${esc(profile?.displayName || user.displayName || user.email || 'کاربر')}</span>
    ${icon('chevron-down', 13)}
  </button>`;
}

function updateNavActive(name) {
  const map = {
    home: 'home',
    vendors: 'vendors',
    vendor: 'vendors',
    shops: 'shops',
    shop: 'shops',
    products: 'products',
    product: 'products',
    reviews: 'reviews',
    compare: 'compare',
    me: 'me',
    new: 'new',
    insights: 'insights',
  };
  const active = map[name] || '';
  $$('[data-nav]').forEach((link) => {
    const key = link.dataset.nav;
    const isActive = key === active;
    link.dataset.active = String(isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderCompareCount() {
  const count = store.getState().compare.length;
  const node = $('#compare-count');
  if (node) {
    node.textContent = toFa(count);
    node.hidden = count === 0;
  }
  document.body.dataset.compareTray = String(count > 0);
}

function renderCompareTray() {
  const existing = $('.compare-tray');
  const entries = store.compareEntities();
  if (!entries.length) {
    existing?.remove();
    return;
  }

  const tray = existing || document.createElement('div');
  tray.className = 'compare-tray';
  tray.setAttribute('role', 'region');
  tray.setAttribute('aria-label', 'نوار مقایسه');
  tray.innerHTML = `
    <span class="badge badge--brand">${icon('columns', 12)} مقایسه</span>
    <div class="compare-tray__items">
      ${entries
        .map(
          ({ type, entity }) => `<span class="compare-tray__chip">
            ${esc(store.entityName(type, entity))}
            <button class="compare-tray__x" type="button" data-action="toggle-compare" data-type="${type}" data-id="${entryId(
              entity,
            )}" aria-label="حذف ${esc(store.entityName(type, entity))}">${icon('close', 11)}</button>
          </span>`,
        )
        .join('')}
    </div>
    <a class="btn btn--primary btn--sm" href="#/compare" data-link>${icon('arrow-left', 14)} مقایسه</a>
    <button class="icon-btn" type="button" data-action="clear-compare" aria-label="پاک‌کردن مقایسه">${icon('trash', 15)}</button>`;
  if (!existing) document.body.append(tray);
}

function entryId(entity) {
  return entity.id;
}

function updateTopline() {
  const meta = $('#topline-meta');
  const state = store.getState();
  if (!meta) return;
  const stats = store.globalStats();
  if (state.mode === 'live') {
    meta.innerHTML = `<span class="dot dot--good"></span> متصل · ${toFa(stats.ratings)} رأی`;
  } else if (state.mode === 'demo') {
    meta.innerHTML = `<span class="dot dot--meh"></span> حالت محلی · ${toFa(stats.ratings)} رأی`;
  } else {
    meta.textContent = 'در حال اتصال…';
  }
}

function updateTicker() {
  const comments = store.recentComments(6);
  const items = comments
    .map((comment) => {
      const entity = store.getEntity(comment.entityType, comment.entityId);
      if (!entity) return null;
      return {
        title: comment.level ? `${levelMeta(comment.level)?.label || 'نقد تازه'}` : 'نقد تازه',
        text: `«${truncate(comment.body, 54)}» — ${store.entityName(comment.entityType, entity)}`,
        href: store.entityHref(comment.entityType, entity),
      };
    })
    .filter(Boolean);
  if (!items.length) {
    items.push({ title: 'بازاربان', text: 'سه سطح ساده: خوب، نه‌خوب، افتضاح.' });
    items.push({ title: 'قانون طلایی', text: 'اول از فهرست انتخاب کن، بعد بساز.' });
  }
  fillTicker(items);
}

const updateShell = debounce(() => {
  renderAuthSlot();
  renderCompareCount();
  renderCompareTray();
  updateTopline();
  updateTicker();
}, 60);

/* --------------------------------------------------------------------------
   منوی کاربر
   -------------------------------------------------------------------------- */
function openUserMenu(anchor) {
  const user = store.currentUser();
  if (!user) return;
  openMenu(anchor, [
    { label: 'داشبورد من', icon: 'home', onClick: () => navigate('/me') },
    { label: 'ثبت تجربه', icon: 'plus', onClick: () => navigate('/new') },
    { label: 'امتیازهای من', icon: 'star', onClick: () => navigate('/me?tab=ratings') },
    { type: 'sep' },
    { label: 'تنظیمات', icon: 'settings', onClick: () => navigate('/me?tab=settings') },
    { label: 'راهنما', icon: 'help', onClick: () => navigate('/guide') },
    { type: 'sep' },
    {
      label: 'خروج از حساب',
      icon: 'logout',
      danger: true,
      onClick: async () => {
        const ok = await confirmDialog({
          title: 'از حساب خارج می‌شوی؟',
          text: 'نقدها و امتیازهای ثبت‌شده باقی می‌مانند.',
          confirmLabel: 'خروج',
          tone: 'danger',
        });
        if (!ok) return;
        await store.signOut();
        store.persistDemoSession();
        toast('خارج شدی.', { type: 'info' });
        navigate('/');
      },
    },
  ]);
}

/* --------------------------------------------------------------------------
   کشوی موبایل
   -------------------------------------------------------------------------- */
function openMobileDrawer() {
  const state = store.getState();
  const user = store.currentUser();
  const stats = store.globalStats();

  openDrawer({
    title: 'بازاربان',
    side: 'end',
    body: `
      <div class="row" style="gap:var(--sp-4);padding-bottom:var(--sp-5);border-bottom:1px solid var(--line);margin-bottom:var(--sp-5)">
        ${
          user
            ? `${avatar({ name: store.getState().profile?.displayName || user.displayName || user.email, hue: store.getState().profile?.avatarHue ?? user.avatarHue, size: 'md' })}
               <div style="flex:1;min-width:0">
                 <div style="font-weight:600;font-size:var(--fs-sm)">${esc(store.getState().profile?.displayName || user.displayName || 'کاربر')}</div>
                 <div class="hint" style="font-size:10px">${esc(user.email || '')}</div>
               </div>`
            : `<div style="flex:1"><div style="font-weight:600;font-size:var(--fs-sm)">مهمان</div><div class="hint" style="font-size:10px">برای ثبت تجربه وارد شو</div></div>
               <a class="btn btn--primary btn--sm" href="#/login" data-link data-close-drawer>ورود</a>`
        }
      </div>

      <nav class="drawer-nav" aria-label="منوی موبایل">
        ${[
          { id: 'home', label: 'خانه', icon: 'home', href: '#/' },
          { id: 'vendors', label: 'فروشنده‌ها', icon: 'store', href: '#/vendors' },
          { id: 'shops', label: 'فروشگاه‌ها', icon: 'building', href: '#/shops' },
          { id: 'products', label: 'محصولات', icon: 'package', href: '#/products' },
          { id: 'reviews', label: 'نقدها', icon: 'message', href: '#/reviews' },
          { id: 'compare', label: 'مقایسه', icon: 'columns', href: '#/compare' },
          { id: 'me', label: 'داشبورد من', icon: 'user', href: '#/me' },
          { id: 'insights', label: 'بینش بازار', icon: 'activity', href: '#/insights' },
          { id: 'new', label: 'ثبت تجربه', icon: 'plus', href: '#/new' },
        ]
          .map(
            (item) => `<a class="drawer-nav__link" href="${item.href}" data-link data-drawer-link>
              <span class="drawer-nav__icon">${icon(item.icon, 16)}</span>
              <span style="flex:1">${esc(item.label)}</span>
              ${item.id === 'compare' && state.compare.length ? `<span class="nav-count">${toFa(state.compare.length)}</span>` : ''}
            </a>`,
          )
          .join('')}
      </nav>

      <div class="divider-text">دسترسی سریع</div>
      <div class="dash-nav" style="position:static;border:0;padding:0;flex-direction:column">
        <a class="dash-nav__item" href="#/guide" data-link data-close-drawer>${icon('help', 15)} راهنمای امتیازدهی</a>
        <a class="dash-nav__item" href="#/about" data-link data-close-drawer>${icon('info', 15)} دربارهٔ بازاربان</a>
        <button class="dash-nav__item" type="button" data-drawer-theme>${icon('moon', 15)} تغییر تم</button>
        <button class="dash-nav__item" type="button" data-drawer-shortcuts>${icon('key', 15)} میان‌برهای صفحه‌کلید</button>
      </div>

      <div class="surface" style="margin-top:var(--sp-6);padding:var(--sp-4);font-size:var(--fs-2xs);color:var(--text-mute);line-height:1.9">
        ${toFa(stats.vendors)} فروشنده · ${toFa(stats.shops)} شعبه · ${toFa(stats.products)} محصول · ${toFa(
          stats.comments,
        )} نقد
        <div style="margin-top:6px">
          ${state.mode === 'live' ? '<span class="dot dot--good"></span> داده از Supabase' : '<span class="dot dot--meh"></span> داده‌های محلی'}
        </div>
      </div>`,
    footer: `<a class="btn btn--primary btn--block" href="#/new" data-link data-close-drawer>${icon('plus', 16)} ثبت تجربه</a>`,
    onMount: (panel, close) => {
      panel.querySelector('[data-drawer-theme]')?.addEventListener('click', () => {
        toggleTheme();
      });
      panel.querySelector('[data-drawer-shortcuts]')?.addEventListener('click', () => {
        close();
        window.setTimeout(() => openShortcutsHelp(), 120);
      });
      panel.querySelectorAll('[data-close-drawer]').forEach((node) => {
        node.addEventListener('click', close);
      });
    },
  });
}

/* --------------------------------------------------------------------------
   پالت دستورات
   -------------------------------------------------------------------------- */
const PALETTE_ACTIONS = [
  { label: 'خانه', sub: 'صفحهٔ اصلی', icon: 'home', href: '#/' },
  { label: 'فروشنده‌ها', sub: 'فهرست و فیلتر', icon: 'store', href: '#/vendors' },
  { label: 'فروشگاه‌ها و شعبه‌ها', sub: 'شعبه به شعبه', icon: 'building', href: '#/shops' },
  { label: 'محصولات', sub: 'قفسه‌ها', icon: 'package', href: '#/products' },
  { label: 'جریان نقدها', sub: 'همهٔ نقدها', icon: 'message', href: '#/reviews' },
  { label: 'میز مقایسه', sub: 'کنار هم', icon: 'columns', href: '#/compare' },
  { label: 'ثبت تجربه', sub: 'ویزارد سه‌مرحله‌ای', icon: 'plus', href: '#/new' },
  { label: 'داشبورد من', sub: 'امتیازها و لیست‌ها', icon: 'user', href: '#/me' },
  { label: 'بینش بازار', sub: 'تحلیل جمعی امتیازها', icon: 'activity', href: '#/insights' },
  { label: 'راهنما', sub: 'قواعد امتیازدهی', icon: 'help', href: '#/guide' },
  { label: 'دربارهٔ بازاربان', sub: 'چرا ساخته شد', icon: 'info', href: '#/about' },
];

let paletteKeyHandler = null;

function openPalette(initial = '') {
  const root = $('#palette-root');
  if (!root) return;

  root.setAttribute('aria-hidden', 'false');
  lockScroll(true);
  root.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="جست‌وجوی سراسری">
      <div class="palette__panel">
        <div class="palette__search">
          ${icon('search', 20)}
          <input class="palette__input" type="text" placeholder="جست‌وجوی فروشنده، شعبه، محصول یا دستور…"
            value="${attr(initial)}" autocomplete="off" spellcheck="false" aria-label="جست‌وجو" />
          <kbd class="kbd">ESC</kbd>
        </div>
        <div class="palette__results" role="listbox"></div>
        <div class="palette__foot">
          <span class="palette__hint">${icon('arrow-up', 12)} ${icon('arrow-down', 12)} جابه‌جایی</span>
          <span class="palette__hint">${icon('arrow-left', 12)} رفتن</span>
          <span class="palette__hint">Enter انتخاب</span>
          <span class="push">${icon('sparkles', 12)} بازاربان</span>
        </div>
      </div>
    </div>`;

  const overlay = root.querySelector('.palette');
  const input = root.querySelector('.palette__input');
  const results = root.querySelector('.palette__results');
  let activeIndex = 0;
  let entries = [];

  const close = () => {
    if (paletteKeyHandler) document.removeEventListener('keydown', paletteKeyHandler, true);
    root.innerHTML = '';
    root.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal, .drawer, .palette')) {
      lockScroll(false);
      document.body.dataset.scrollLocked = 'false';
    }
  };

  const go = (href) => {
    close();
    if (!href) return;
    if (href.startsWith('theme:')) {
      if (href === 'theme:toggle') toggleTheme();
      return;
    }
    window.location.hash = href;
  };

  const render = (query) => {
    const q = query.trim();
    const actionMatches = (q ? PALETTE_ACTIONS.filter((action) => matchScore(`${action.label} ${action.sub}`, q) > 0) : PALETTE_ACTIONS).slice(0, 6);

    entries = actionMatches.map((action) => ({ kind: 'action', ...action }));

    if (q) {
      const found = store.searchAll(q, { limit: 4 });
      const pushEntity = (type, entity) => {
        entries.push({
          kind: 'entity',
          type,
          entity,
          label: store.entityName(type, entity),
          sub: store.entitySubtitle(type, entity),
          href: store.entityHref(type, entity),
        });
      };
      found.vendors.forEach((row) => pushEntity('vendor', row.entity));
      found.shops.forEach((row) => pushEntity('shop', row.entity));
      found.products.forEach((row) => pushEntity('product', row.entity));
    } else {
      store.leaderboard('vendor', { limit: 4, minTotal: 1 }).forEach(({ entity }) => {
        entries.push({
          kind: 'entity',
          type: 'vendor',
          entity,
          label: store.entityName('vendor', entity),
          sub: 'از بهترین‌های بازار',
          href: store.entityHref('vendor', entity),
        });
      });
    }

    activeIndex = 0;
    if (!entries.length) {
      results.innerHTML = `<div class="combo__empty" style="padding:var(--sp-10)">
        چیزی پیدا نشد. عبارت ساده‌تری امتحان کن یا از صفحهٔ «ثبت تجربه» مورد جدید بساز.
      </div>`;
      return;
    }

    let html = '';
    let lastKind = null;
    entries.forEach((entry, index) => {
      const groupLabel =
        entry.kind === 'action'
          ? 'دستورها'
          : entry.type === 'vendor'
            ? 'فروشنده‌ها'
            : entry.type === 'shop'
              ? 'شعبه‌ها'
              : 'محصولات';
      if (groupLabel !== lastKind) {
        html += `<div class="palette__group-label">${groupLabel}</div>`;
        lastKind = groupLabel;
      }
      const visual =
        entry.kind === 'entity'
          ? `<span class="brand-badge brand-badge--sm" style="--bb-hue:${
              entry.type === 'vendor' ? entry.entity.brandHue : 190
            }">${icon(entry.type === 'vendor' ? 'store' : entry.type === 'shop' ? 'building' : 'package', 15)}</span>`
          : `<span class="palette__icon">${icon(entry.icon, 15)}</span>`;
      html += `<button class="palette__item" type="button" role="option" data-palette-index="${index}" data-active="${
        index === activeIndex
      }">
        ${visual}
        <span class="palette__item-main">
          <span class="palette__item-title">${esc(entry.label)}</span>
          <span class="palette__item-sub">${esc(entry.sub || '')}</span>
        </span>
        ${icon('arrow-left', 14)}
      </button>`;
    });
    results.innerHTML = html;
  };

  const setActive = (next) => {
    if (!entries.length) return;
    activeIndex = (next + entries.length) % entries.length;
    results.querySelectorAll('[data-palette-index]').forEach((node) => {
      node.dataset.active = String(Number(node.dataset.paletteIndex) === activeIndex);
    });
    results.querySelector(`[data-palette-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry) go(entry.href);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-palette-index]');
    if (!button) return;
    const entry = entries[Number(button.dataset.paletteIndex)];
    if (entry) go(entry.href);
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  paletteKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', paletteKeyHandler, true);

  render(initial);
  window.requestAnimationFrame(() => input.focus());
}

/* --------------------------------------------------------------------------
   مودال احراز هویت
   -------------------------------------------------------------------------- */
function openAuthModal({ reason = 'rate' } = {}) {
  const demo = store.getState().mode === 'demo';
  let mode = 'login';
  let submitting = false;

  const modal = openModal({
    title: 'ورود به بازاربان',
    subtitle:
      reason === 'comment'
        ? 'برای ثبت نقد، لازم است وارد شوی تا نقد به نام خودت ثبت شود.'
        : 'برای ثبت امتیاز و ذخیرهٔ آن‌ها در حسابت وارد شو.',
    body: `
      <div data-auth-modal>
        <div class="auth-switch" role="tablist">
          <button class="auth-switch__btn" type="button" data-modal-mode="login" data-active="true">ورود</button>
          <button class="auth-switch__btn" type="button" data-modal-mode="signup" data-active="false">ثبت‌نام</button>
        </div>
        <div data-modal-error></div>
        <form class="auth-form" data-modal-form>
          <div class="field">
            <label class="label" for="modal-email">ایمیل</label>
            <input class="input" id="modal-email" name="email" type="email" dir="ltr" autocomplete="email" required placeholder="you@example.com" />
          </div>
          <div class="field">
            <label class="label" for="modal-password">رمز عبور</label>
            <input class="input" id="modal-password" name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="••••••••" />
          </div>
          <div class="field" data-signup-only hidden>
            <label class="label" for="modal-name">نام نمایشی</label>
            <input class="input" id="modal-name" name="displayName" maxlength="40" placeholder="مثلاً نگار" />
          </div>
          <button class="btn btn--primary btn--block" type="submit">${icon('logout', 16)} ورود</button>
        </form>
        ${
          demo
            ? `<div class="divider-text">حالت محلی</div>
               <button class="btn btn--outline btn--sm btn--block" type="button" data-demo-login>
                 ${icon('zap', 14)} ورود سریع محلی
               </button>
               <p class="hint center" style="margin-top:var(--sp-3)">یک حساب محلی ساخته می‌شود؛ هیچ رمزی ذخیره نمی‌شود.</p>`
            : ''
        }
        <p class="hint center" style="margin-top:var(--sp-4)">
          با ورود، به صفحهٔ حساب منتقل نمی‌شوی؛ همین‌جا می‌مانی و کارت ادامه پیدا می‌کند.
        </p>
      </div>`,
  });

  const panel = modal.el;
  const form = panel.querySelector('[data-modal-form]');
  const errorBox = panel.querySelector('[data-modal-error]');
  const signupOnly = panel.querySelector('[data-signup-only]');
  const submit = form.querySelector('button[type="submit"]');

  panel.querySelectorAll('[data-modal-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.modalMode;
      panel.querySelectorAll('[data-modal-mode]').forEach((node) => {
        node.dataset.active = String(node === button);
      });
      signupOnly.hidden = mode !== 'signup';
      submit.innerHTML = `${icon(mode === 'signup' ? 'user' : 'logout', 16)} ${mode === 'signup' ? 'ساختن حساب' : 'ورود'}`;
      errorBox.innerHTML = '';
    });
  });

  const showError = (message) => {
    errorBox.innerHTML = `<div class="callout callout--bad" style="margin-bottom:var(--sp-3)">
      <span class="callout__icon">${icon('alert-circle', 14)}</span><div>${esc(message)}</div>
    </div>`;
  };

  const success = () => {
    store.persistDemoSession();
    toast('وارد شدی. حالا می‌توانی ثبت کنی.', { type: 'good' });
    document.dispatchEvent(new CustomEvent('bb:auth-success', { detail: { reason } }));
    modal.close();
  };

  panel.querySelector('[data-demo-login]')?.addEventListener('click', async () => {
    if (submitting) return;
    submitting = true;
    try {
      await store.signIn({ email: `guest${Math.floor(Math.random() * 900 + 100)}@bazaarban.local`, password: 'demo1234' });
      success();
    } catch (error) {
      showError(error.message || 'ورود محلی ناموفق بود.');
    } finally {
      submitting = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    if (!email.includes('@')) {
      showError('ایمیل معتبر وارد کن.');
      return;
    }
    if (password.length < 6) {
      showError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    submitting = true;
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = `<span class="btn__spinner"></span> صبر کن…`;
    try {
      if (mode === 'signup') {
        const result = await store.signUp({
          email,
          password,
          displayName: String(data.get('displayName') || '').trim(),
        });
        if (result?.pendingConfirmation) {
          toast('حساب ساخته شد؛ ایمیل تأیید را ببین.', { type: 'meh', duration: 7000 });
          modal.close();
          return;
        }
      } else {
        await store.signIn({ email, password });
      }
      success();
    } catch (error) {
      showError(error.message || 'ورود ناموفق بود.');
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });
}

/* --------------------------------------------------------------------------
   گزارش
   -------------------------------------------------------------------------- */
function openReport({ type = 'vendor', id } = {}) {
  const entity = store.getEntity(type, id);
  const modal = openModal({
    title: 'گزارش مشکل',
    subtitle: entity
      ? `دربارهٔ «${store.entityName(type, entity)}» چه مشکلی دیدی؟`
      : 'چه مشکلی دیدی؟',
    size: 'narrow',
    body: `<form data-report-form>
      <div class="stack stack--sm">
        ${CONFIG.REPORT_REASONS.map(
          (reason, index) => `<label class="check">
            <input type="radio" name="reason" value="${reason.id}" ${index === 0 ? 'checked' : ''} />
            <span class="check__box radio-dot"></span>
            <span class="check__text">${esc(reason.label)}</span>
          </label>`,
        ).join('')}
      </div>
      <div class="field mt-6">
        <label class="label" for="report-details">توضیح بیشتر <span class="label__hint">اختیاری</span></label>
        <textarea class="textarea" id="report-details" name="details" rows="3" maxlength="400"
          placeholder="مثلاً: این صفحه اطلاعات تماس اشتباه دارد."></textarea>
      </div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-cancel-report>انصراف</button>
             <button class="btn btn--danger" type="button" data-send-report>${icon('flag', 15)} ارسال گزارش</button>`,
  });

  modal.el.querySelector('[data-cancel-report]')?.addEventListener('click', modal.close);
  modal.el.querySelector('[data-send-report]')?.addEventListener('click', async () => {
    const form = modal.el.querySelector('[data-report-form]');
    const data = new FormData(form);
    try {
      await store.reportContent({
        type,
        id,
        reason: String(data.get('reason') || 'other'),
        details: String(data.get('details') || ''),
      });
      modal.close();
      toast('گزارش ثبت شد. بررسی می‌شود.', { type: 'good', title: 'ممنون' });
    } catch (error) {
      toast(error.message || 'ثبت گزارش ناموفق بود.', { type: 'bad' });
    }
  });
}

/* --------------------------------------------------------------------------
   اکشن‌های عمومی
   -------------------------------------------------------------------------- */
async function handleRate(type, id, level) {
  if (!store.currentUser()) {
    openAuthModal({ reason: 'rate' });
    return;
  }
  const button = document.querySelector(
    `[data-action="rate-entity"][data-type="${type}"][data-id="${id}"][data-level="${level}"]`,
  );
  if (button) button.setAttribute('aria-busy', 'true');
  try {
    await store.rate(type, id, level);
    const entity = store.getEntity(type, id);
    toast(`امتیاز «${level === 'good' ? 'خوب' : level === 'meh' ? 'نه‌خوب' : 'افتضاح'}» ثبت شد.`, {
      type: level === 'bad' ? 'meh' : 'good',
      title: entity ? store.entityName(type, entity) : 'ثبت شد',
      duration: 2600,
    });
    document.querySelectorAll(
      `[data-action="rate-entity"][data-type="${type}"][data-id="${id}"]`,
    ).forEach((node) => {
      const active = node.dataset.level === level;
      node.dataset.selected = String(active);
      node.setAttribute('aria-pressed', String(active));
    });
    document.dispatchEvent(new CustomEvent('bb:rated', { detail: { type, id, value: level } }));
  } catch (error) {
    if (/وارد شو|auth/i.test(String(error.message))) openAuthModal({ reason: 'rate' });
    else toast(error.message || 'ثبت امتیاز ناموفق بود.', { type: 'bad' });
  } finally {
    if (button) button.removeAttribute('aria-busy');
  }
}

async function handleToggleCompare(type, id) {
  const result = store.toggleCompare(type, id);
  if (result.full) {
    toast(`حداکثر ${toFa(CONFIG.COMPARE_MAX)} مورد را می‌توانی مقایسه کنی.`, { type: 'meh' });
    return;
  }
  const entity = store.getEntity(type, id);
  toast(result.added ? 'به میز مقایسه اضافه شد.' : 'از میز مقایسه حذف شد.', {
    type: 'brand',
    title: entity ? store.entityName(type, entity) : '',
    duration: 2200,
  });
  document
    .querySelectorAll(`[data-action="toggle-compare"][data-type="${type}"][data-id="${id}"]`)
    .forEach((node) => {
      node.setAttribute('aria-pressed', String(result.added));
    });
  renderCompareTray();
  renderCompareCount();
}

async function handleSave(type, id) {
  if (!store.currentUser()) {
    openAuthModal({ reason: 'save' });
    return;
  }
  const entity = store.getEntity(type, id);
  try {
    const added = await store.toggleShoppingList(type, id);
    toast(added ? 'به «خرید بعدی» اضافه شد.' : 'از «خرید بعدی» حذف شد.', {
      type: added ? 'good' : 'info',
      title: entity ? store.entityName(type, entity) : '',
      action: added
        ? { label: 'دیدن لیست', onClick: () => navigate('/me?tab=lists') }
        : null,
    });
    document.querySelectorAll(`[data-action="save-entity"][data-type="${type}"][data-id="${id}"]`).forEach((node) => {
      node.setAttribute('aria-pressed', String(added));
      if (node.classList.contains('btn')) {
        node.classList.toggle('btn--good', added);
        node.classList.toggle('btn--outline', !added);
      }
    });
  } catch (error) {
    toast(error.message || 'ذخیره ناموفق بود.', { type: 'bad' });
  }
}

function bindGlobalEvents() {
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      if (event.target.closest('[data-user-menu]')) {
        openUserMenu(event.target.closest('[data-user-menu]'));
      }
      return;
    }
    const action = target.dataset.action;

    switch (action) {
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'open-palette':
        openPalette();
        break;
      case 'toggle-drawer':
        openMobileDrawer();
        break;
      case 'toggle-compare':
        await handleToggleCompare(target.dataset.type, target.dataset.id);
        break;
      case 'save-entity':
        await handleSave(target.dataset.type, target.dataset.id);
        break;
      case 'quick-rate':
      case 'rate-entity':
        await handleRate(target.dataset.type, target.dataset.id, target.dataset.level);
        break;
      case 'vote-comment': {
        if (!store.currentUser()) {
          openAuthModal({ reason: 'vote' });
          break;
        }
        try {
          const voted = await store.toggleVote(target.dataset.id);
          const count = store.voteCount(target.dataset.id);
          target.dataset.voted = String(voted);
          target.innerHTML = `${icon('thumbs-up', 13)} ${count ? toFa(count) : 'مفید بود'}`;
          toast(voted ? 'ممنون؛ رأی تو ثبت شد.' : 'رأی برداشته شد.', { type: 'info', duration: 1600 });
        } catch (error) {
          toast(error.message || 'ثبت رأی ناموفق بود.', { type: 'bad' });
        }
        break;
      }
      case 'reply-comment': {
        const bodyField = document.querySelector('[data-comment-body], [data-wizard-text]');
        if (!bodyField) {
          toast('فرم نقد در این صفحه نیست. از صفحهٔ همان مورد نقد بنویس.', { type: 'meh' });
          break;
        }
        const name = target.dataset.name || '';
        bodyField.value = `${bodyField.value ? `${bodyField.value} ` : ''}@${name} `;
        bodyField.focus();
        bodyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'report-comment':
        openReport({ type: 'comment', id: target.dataset.id });
        break;
      case 'report-entity':
        openReport({ type: target.dataset.type, id: target.dataset.id });
        break;
      case 'delete-comment': {
        if (!store.currentUser()) break;
        const ok = await confirmDialog({
          title: 'نقد حذف شود؟',
          text: 'این کار برگشت‌پذیر نیست.',
          confirmLabel: 'حذف',
          tone: 'danger',
        });
        if (!ok) break;
        try {
          await store.deleteComment(target.dataset.id);
          document.querySelector(`#comment-${CSS.escape(target.dataset.id)}`)?.remove();
          toast('نقد حذف شد.', { type: 'good' });
        } catch (error) {
          toast(error.message || 'حذف ناموفق بود.', { type: 'bad' });
        }
        break;
      }
      case 'share-entity': {
        const url = window.location.href;
        const ok = await copyText(url);
        toast(ok ? 'لینک صفحه کپی شد.' : 'کپی نشد؛ آدرس را از نوار مرورگر بردار.', {
          type: ok ? 'good' : 'meh',
        });
        break;
      }
      case 'clear-compare':
        store.clearCompare();
        renderCompareTray();
        renderCompareCount();
        toast('میز مقایسه پاک شد.', { type: 'info' });
        break;
      case 'toggle-filter-card': {
        const card = target.closest('[data-filter-card]');
        if (card) {
          const open = card.dataset.open !== 'false';
          card.dataset.open = String(!open);
          target.setAttribute('aria-expanded', String(!open));
        }
        break;
      }
      case 'open-auth':
        openAuthModal({ reason: 'generic' });
        break;
      case 'open-shortcuts':
        openShortcutsHelp();
        break;
      default:
        break;
    }
  });

  document.addEventListener('bb:require-auth', (event) => {
    if (store.getState().mode === 'demo' && !store.currentUser()) {
      openAuthModal({ reason: event.detail?.reason || 'generic' });
    } else {
      openAuthModal({ reason: event.detail?.reason || 'generic' });
    }
  });

  document.addEventListener('bb:report', (event) => {
    openReport({ type: event.detail?.type, id: event.detail?.id });
  });

  document.addEventListener('bb:set-theme', (event) => {
    applyTheme(event.detail?.theme);
  });

  document.addEventListener('bb:set-density', (event) => {
    applyDensity(event.detail?.density);
  });

  document.addEventListener('keydown', (event) => {
    const typing =
      event.target instanceof HTMLElement &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }
    if (event.key === '/' && !typing && !document.querySelector('.palette, .modal')) {
      event.preventDefault();
      openPalette();
    }
    if (event.key === 'Escape') {
      const root = $('#palette-root');
      if (root && root.getAttribute('aria-hidden') === 'false') {
        root.innerHTML = '';
        root.setAttribute('aria-hidden', 'true');
        lockScroll(false);
      }
    }
  });

  // اسکرول: نوار پیشرفت و حالت سربرگ
  const progress = $('#scroll-progress span');
  const header = $('#site-header');
  const onScroll = throttle(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
    if (header) header.dataset.scrolled = String(window.scrollY > 6);
  }, 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* --------------------------------------------------------------------------
   مسیرها
   -------------------------------------------------------------------------- */
const ROUTES = [
  { path: '/', name: 'home', view: homeView },
  { path: '/vendors', name: 'vendors', view: vendorsView },
  { path: '/vendor/:slug', name: 'vendor', view: vendorView },
  { path: '/shops', name: 'shops', view: shopsView },
  { path: '/shop/:id', name: 'shop', view: shopView },
  { path: '/products', name: 'products', view: productsView },
  { path: '/product/:id', name: 'product', view: productView },
  { path: '/reviews', name: 'reviews', view: reviewsView },
  { path: '/compare', name: 'compare', view: compareView },
  { path: '/me', name: 'me', view: dashboardView },
  { path: '/new', name: 'new', view: createView },
  { path: '/login', name: 'login', view: authView },
  { path: '/search', name: 'search', view: searchView },
  { path: '/guide', name: 'guide', view: guideView },
  { path: '/insights', name: 'insights', view: insightsView },
  { path: '/about', name: 'about', view: aboutView },
];

function onRouteChange(ctx) {
  updateNavActive(ctx.name);
  const main = $('#main');
  if (main) main.dataset.route = ctx.name;
  store.markViewed?.('page', null);
  window.requestAnimationFrame(() => setupReveal());
  // روی موبایل، منو را بعد از رفتن ببند
  const drawer = $('#drawer-root');
  if (drawer && drawer.children.length) {
    drawer.innerHTML = '';
    drawer.setAttribute('aria-hidden', 'true');
    lockScroll(false);
  }
}

/* --------------------------------------------------------------------------
   راه‌اندازی
   -------------------------------------------------------------------------- */
function bootSkeletonRemoval() {
  const boot = $('#boot');
  if (boot) boot.remove();
}

async function boot() {
  applyTheme(preferredTheme(), { persist: false });
  applyDensity(storage.get(DENSITY_KEY, 'cozy'), { persist: false });

  const yearNode = $('#footer-year');
  if (yearNode) {
    const j = formatJalali(new Date(), { withYear: true }).split(' ').pop();
    yearNode.textContent = toFa(j || '۱۴۰۵');
  }

  renderAuthSlot();
  bindGlobalEvents();
  initShortcuts();
  setAuthGuard(() => store.isAuthed());

  try {
    await store.initStore();
  } catch (error) {
    console.error('[bb] راه‌اندازی داده ناموفق بود:', error);
    toast('بارگذاری داده‌ها ناموفق بود؛ صفحه را تازه کن.', { type: 'bad' });
  }

  store.subscribe(() => updateShell());
  updateShell();

  registerRoutes(ROUTES);
  setNotFoundView(notFoundView);
  setRouteListener(onRouteChange);
  start();

  bootSkeletonRemoval();

  const state = store.getState();
  if (!storage.get(CONFIG.LS.onboarded, false)) {
    storage.set(CONFIG.LS.onboarded, true);
    window.setTimeout(() => {
      if (!store.currentUser() && state.mode === 'demo') {
        toast('برای ثبت تجربه، یک حساب محلی بساز.', {
          type: 'brand',
          title: 'حالت محلی',
          duration: 6000,
          action: { label: 'ورود سریع', onClick: () => openAuthModal({ reason: 'onboarding' }) },
        });
      }
    }, 1600);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// برای دیباگ در کنسول
window.BazaarBan = { store, openPalette, openAuthModal, navigate, parse: parseHash };
