/* ============================================================
   App bootstrap + routing (login ↔ home ↔ share ↔ reset)
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
import { mountGroupedView } from './components/grouped-view.js';
import { openPurchaseModal } from './components/purchase-modal.js';
import { openCommandPalette } from './components/command-palette.js';
import { maybeStartOnboarding } from './components/onboarding.js';
import { readShareSlugFromUrl } from './utils/share.js';
import {
  isRecoveryCallback,
  clearRecoveryUrl,
  openSetNewPasswordModal,
} from './components/password-reset.js';

let currentRoute = null;
let headerEl = null;
let mainEl = null;
let keyHandlerInstalled = false;

export async function bootApp() {
  const root = document.getElementById('app');
  if (!root) return;

  const shareSlug = readShareSlugFromUrl();
  if (shareSlug) {
    currentRoute = 'share';
    try {
      const { renderShareView } = await import('./components/share-view.js');
      await renderShareView(root, shareSlug);
    } catch (err) {
      console.error('[share]', err);
      root.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-3)">
        خطا در بارگذاری لینک: ${String(err?.message || err)}
      </div>`;
    }
    return;
  }

  restoreFiltersFromStorage();
  initToast();
  installGlobalKeys();

  let session = null;
  try {
    const res = await sb.auth.getSession();
    session = res?.data?.session ?? null;
  } catch (err) {
    console.error('[auth.getSession]', err);
  }

  const inRecovery = isRecoveryCallback() && !!session;
  if (inRecovery) {
    clearRecoveryUrl();
    await openSetNewPasswordModal();
  }

  await route(root, session);

  sb.auth.onAuthStateChange(async (event, sess) => {
    if (event === 'PASSWORD_RECOVERY') {
      await openSetNewPasswordModal();
      return;
    }
    if (event === 'SIGNED_IN' && sess) await route(root, sess);
    else if (event === 'SIGNED_OUT') await route(root, null);
    else if (event === 'USER_UPDATED' && sess) {
      store.user.set(sess.user);
      store.session.set(sess);
    }
  });
}

function installGlobalKeys() {
  if (keyHandlerInstalled) return;
  keyHandlerInstalled = true;
  document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (e.key === '?' && !typing) {
      e.preventDefault();
      maybeStartOnboarding();
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
    onOpenSettings: () => import('./components/settings-modal.js').then((m) => m.openSettingsModal()),
  });
  mainEl = el('main', { class: 'container page', id: 'app-main' });
  mainEl.appendChild(renderHomeShell());
  root.append(headerEl, mainEl);
  store.ready.set(true);

  maybeStartOnboarding();
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
        class: 'btn btn--primary btn--lg', type: 'button',
        html: `${icon('refresh', 16)}<span>تلاش دوباره</span>`,
        onclick: () => location.reload(),
      }),
    ]),
  ]);
}

function renderHomeShell() {
  const shell = el('div', { id: 'home-shell', style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' } });

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

  const filters = mountFilters();
  const viewToggle = el('div', { class: 'view-toggle', role: 'tablist' });
  const tableWrap = mountPurchasesTable();
  const groupedWrap = mountGroupedView();

  function renderView() {
    const v = store.filters.get().view || 'table';
    viewToggle.innerHTML = '';
    viewToggle.append(
      el('button', {
        type: 'button', role: 'tab',
        class: 'view-toggle__btn' + (v === 'table' ? ' is-active' : ''),
        onclick: () => { store.filters.set({ ...store.filters.get(), view: 'table' }); },
      }, [el('span', { html: icon('list', 14) }), el('span', { text: 'جدول' })]),
      el('button', {
        type: 'button', role: 'tab',
        class: 'view-toggle__btn' + (v === 'grouped' ? ' is-active' : ''),
        onclick: () => { store.filters.set({ ...store.filters.get(), view: 'grouped' }); },
      }, [el('span', { html: icon('calendar', 14) }), el('span', { text: 'گروهی' })]),
    );
    tableWrap.style.display = v === 'table' ? '' : 'none';
    groupedWrap.style.display = v === 'grouped' ? '' : 'none';
  }
  renderView();
  store.filters.subscribe(renderView);

  import('./components/reminders.js').then(({ mountReminders }) => {
    const reminders = mountReminders();
    shell.prepend(reminders);
  }).catch(() => {});

  shell.append(statsStrip, filters, viewToggle, tableWrap, groupedWrap);
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
}
