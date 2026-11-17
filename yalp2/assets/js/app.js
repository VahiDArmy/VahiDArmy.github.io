/* ============================================================
   App bootstrap + routing (login ↔ home ↔ share ↔ reset)
   MINIMAL HOMEPAGE: Header + Search + Table ONLY
   ============================================================ */
import { sb } from './supabase.js';
import { CONFIG } from './config.js';
import { store, restoreFiltersFromStorage } from './state.js';
import { loadAllData } from './api.js';
import { el } from './utils.js';
import { mountHeader } from './components/header.js';
import { renderLogin } from './components/login.js';
import { initToast, notify } from './components/toast.js';
import { icon } from './components/icons.js';
import { mountPurchasesTable } from './components/purchases-table.js';
import { openPurchaseModal } from './components/purchase-modal.js';
import { openCommandPalette } from './components/command-palette.js';
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
    store.session.set(sess);
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
  
  // Header (includes Search Bar)
  headerEl = mountHeader({
    onSearch: () => {},
    onAdd: handleAddPurchase,
    onOpenSettings: () => import('./components/settings-modal.js').then((m) => m.openSettingsModal()),
  });
  
  // Main Content (Table ONLY)
  mainEl = el('main', { class: 'container page', id: 'app-main' });
  mainEl.appendChild(mountPurchasesTable());
  
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
        class: 'btn btn--primary btn--lg', type: 'button',
        html: `${icon('refresh', 16)}<span>تلاش دوباره</span>`,
        onclick: () => location.reload(),
      }),
    ]),
  ]);
}

async function handleAddPurchase() {
  await openPurchaseModal({ mode: 'create' });
}
