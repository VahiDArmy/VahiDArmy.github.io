/* ============================================================
   App bootstrap + routing (login ↔ home)
   ============================================================ */
import { sb } from './supabase.js';
import { CONFIG } from './config.js';
import { store, restoreFiltersFromStorage } from './state.js';
import { loadAllData } from './api.js';
import { el, escapeHtml } from './utils.js';
import { mountHeader } from './components/header.js';
import { renderLogin } from './components/login.js';
import { initToast, notify } from './components/toast.js';
import { icon } from './components/icons.js';

let currentRoute = null; // 'login' | 'home'
let headerEl = null;
let mainEl = null;

export async function bootApp() {
  const root = document.getElementById('app');
  if (!root) return;

  restoreFiltersFromStorage();
  initToast();

  // initial session check
  let session = null;
  try {
    const res = await sb.auth.getSession();
    session = res?.data?.session ?? null;
  } catch (err) {
    console.error('[auth.getSession]', err);
  }

  await route(root, session);

  sb.auth.onAuthStateChange(async (event, sess) => {
    if (event === 'SIGNED_IN' && sess) await route(root, sess);
    else if (event === 'SIGNED_OUT') await route(root, null);
    else if (event === 'USER_UPDATED' && sess) {
      store.user.set(sess.user);
      store.session.set(sess);
    }
  });
}

/* ---------- routing ---------- */

async function route(root, session) {
  if (!session?.user) {
    if (currentRoute === 'login') return;
    currentRoute = 'login';
    headerEl = null;
    mainEl = null;
    renderLogin(root);
    return;
  }

  // already in the app
  if (currentRoute === 'home' && store.user.get()?.id === session.user.id) {
    store.user.set(session.user);
    store.session.set(session);
    return;
  }

  currentRoute = 'home';
  store.user.set(session.user);
  store.session.set(session);

  await enterApp(root);
}

/* ---------- enter app ---------- */

async function enterApp(root) {
  root.innerHTML = '';
  root.appendChild(renderBootLoading());

  try {
    await loadAllData();
  } catch (err) {
    console.error('[loadAllData]', err);
    root.innerHTML = '';
    root.appendChild(renderLoadError(err));
    return;
  }

  root.innerHTML = '';
  headerEl = mountHeader({
    onSearch: handleSearch,
    onAdd: handleAddPurchase,
    onOpenSettings: () => notify.info('تنظیمات در پیام بعدی می‌آید'),
  });
  mainEl = el('main', { class: 'container page', id: 'app-main' });
  mainEl.appendChild(renderHomeShell());
  root.append(headerEl, mainEl);

  store.ready.set(true);
}

function renderBootLoading() {
  return el('div', { class: 'boot-loading' }, [
    el('div', { class: 'boot-loading__ring' }),
    el('div', { class: 'boot-loading__text', text: 'در حال بارگذاری داده‌ها…' }),
  ]);
}

function renderLoadError(err) {
  return el('div', { class: 'error-page' }, [
    el('div', {}, [
      el('div', { class: 'error-page__icon', html: icon('alert', 32) }),
      el('div', { class: 'error-page__title', text: 'بارگذاری ناموفق بود' }),
      el('div', { class: 'error-page__msg', text: String(err?.message || err) }),
      el('button', {
        class: 'btn btn--primary btn--lg',
        type: 'button',
        html: `${icon('refresh', 16)}<span>تلاش دوباره</span>`,
        onclick: () => location.reload(),
      }),
    ]),
  ]);
}

/* ---------- home shell (placeholder until table component lands) ---------- */

function renderHomeShell() {
  const wrap = el('div', { id: 'home-shell', style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' } });

  const platforms = store.platforms.get();
  const shops = store.shops.get();
  const products = store.products.get();
  const purchases = store.purchases.get();

  // stats strip
  const good = purchases.filter((p) => p.rating === 'good').length;
  const bad = purchases.filter((p) => p.rating === 'bad').length;
  const shit = purchases.filter((p) => p.rating === 'shit').length;

  const stats = el('div', { class: 'stats-strip' }, [
    statCard('کل خریدها', purchases.length, ''),
    statCard('خرید خوب', good, 'var(--good-2)'),
    statCard('نچندان خوب', bad, 'var(--bad-2)'),
    statCard('افتضاح', shit, 'var(--shit-2)'),
    statCard('فروشگاه‌ها', shops.length, ''),
    statCard('محصولات', products.length, ''),
    statCard('پلتفرم‌ها', platforms.length, ''),
  ]);

  const empty = el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-state__icon', html: icon('cart', 32) }),
    el('div', { class: 'empty-state__title', text: 'اولین خریدت را ثبت کن' }),
    el('div', { class: 'empty-state__desc',
      text: 'روی «ثبت خرید» بزن، فروشگاه، پلتفرم و محصول را انتخاب کن و امتیاز بده. جدول خریدها با جستجوی زنده در همین صفحه نمایش داده می‌شود.' }),
    el('button', {
      class: 'btn btn--primary btn--lg', type: 'button',
      html: `${icon('plus', 16)}<span>ثبت خرید</span>`,
      onclick: handleAddPurchase,
    }),
  ]);

  wrap.append(stats, empty);
  return wrap;
}

function statCard(label, value, color) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-card__label', text: label }),
    el('div', {
      class: 'stat-card__value',
      style: color ? { color } : {},
      text: String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]),
    }),
  ]);
}

/* ---------- handlers ---------- */

function handleSearch(query) {
  // Placeholder — the real table filtering will land in the next message.
  // We keep this hook so the table picks up store.filters on its own.
  // console.debug('[search]', query);
}

function handleAddPurchase() {
  // Will open the purchase modal in the next message.
  notify.info('مودال ثبت خرید در پیام بعدی اضافه می‌شود');
}
