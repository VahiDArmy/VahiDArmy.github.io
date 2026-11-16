/* ============================================================
   App bootstrap + routing + home wiring
   ============================================================ */
import { sb } from './supabase.js';
import { CONFIG } from './config.js';
import { store, restoreFiltersFromStorage } from './state.js';
import { loadAllData, purchaseStats } from './api.js';
import { el, formatNumber } from './utils.js';
import { mountHeader } from './components/header.js';
import { renderLogin } from './components/login.js';
import { initToast, notify } from './components/toast.js';
import { icon } from './components/icons.js';
import { mountFilters } from './components/filters.js';
import { mountPurchasesTable } from './components/purchases-table.js';
import { openPurchaseModal } from './components/purchase-modal.js';

let currentRoute = null;
let headerEl = null;
let mainEl = null;

export async function bootApp() {
  const root = document.getElementById('app');
  if (!root) return;

  restoreFiltersFromStorage();
  initToast();

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

async function route(root, session) {
  if (!session?.user) {
    if (currentRoute === 'login') return;
    currentRoute = 'login';
    headerEl = null; mainEl = null;
    store.ready.set(false);
    renderLogin(root);
    return;
  }
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
    onSearch: () => {},
    onAdd: handleAddPurchase,
    onOpenSettings: () => notify.info('تنظیمات در پیام‌های بعدی'),
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

/* ---------- home shell ---------- */

function renderHomeShell() {
  const shell = el('div', { id: 'home-shell', style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' } });

  // Stats strip
  const statsStrip = el('div', { class: 'stats-strip' });
  const updateStats = () => {
    const s = purchaseStats(store.purchases.get());
    statsStrip.innerHTML = '';
    statsStrip.append(
      statCard('کل خریدها', s.total, ''),
      statCard('خرید خوب', s.good, 'var(--good-2)'),
      statCard('نچندان خوب', s.bad, 'var(--bad-2)'),
      statCard('افتضاح', s.shit, 'var(--shit-2)'),
      statCard('فروشگاه‌ها', s.shops, ''),
      statCard('محصولات', s.products, ''),
    );
  };
  updateStats();
  store.purchases.subscribe(updateStats);

  // Filters
  const filters = mountFilters();

  // Table
  const table = mountPurchasesTable();

  shell.append(statsStrip, filters, table);
  return shell;
}

function statCard(label, value, color) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-card__label', text: label }),
    el('div', {
      class: 'stat-card__value',
      style: color ? { color } : {},
      text: formatNumber(value),
    }),
  ]);
}

async function handleAddPurchase() {
  await openPurchaseModal({ mode: 'create' });
  // table updates automatically via store.purchases subscription
}
