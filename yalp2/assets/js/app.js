/* ============================================================
   App bootstrap + minimal shell (this file grows in next messages)
   ============================================================ */
import { sb } from './supabase.js';
import { CONFIG } from './config.js';
import { store, restoreFiltersFromStorage } from './state.js';
import { $, escapeHtml } from './utils.js';

export async function bootApp() {
  const root = document.getElementById('app');
  if (!root) return;

  restoreFiltersFromStorage();

  // 1) initial shell (placeholder)
  root.innerHTML = renderShell();

  // 2) auth
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    store.user.set(session.user);
    store.session.set(session);
    // TODO: load data — next messages
    setStatus('در حال آماده‌سازی داده‌ها…');
  } else {
    setStatus('لطفاً وارد حساب کاربری خود شوید');
    // TODO: login screen — next messages
  }

  // 3) listen to auth changes
  sb.auth.onAuthStateChange((_event, sess) => {
    store.user.set(sess?.user ?? null);
    store.session.set(sess ?? null);
    // TODO: reload data or navigate to login
  });
}

function setStatus(text) {
  const el = document.getElementById('shell-status');
  if (el) el.textContent = text;
}

/* ---------- minimal shell HTML ---------- */

function renderShell() {
  return `
    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" href="/" aria-label="خانه">
          <span class="brand__mark">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M6 10h20l-2.5 15h-15L6 10z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              <path d="M11 10a5 5 0 0 1 10 0" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="brand__text">
            <span class="brand__title">${escapeHtml(CONFIG.appName)}</span>
            <span class="brand__sub">${escapeHtml(CONFIG.appTagline)}</span>
          </span>
        </a>
        <div class="header-actions">
          <span id="shell-status" style="color:var(--text-3);font-size:var(--fs-sm)">
            در حال راه‌اندازی…
          </span>
        </div>
      </div>
    </header>

    <main class="container page">
      <div style="
        border:1px dashed var(--border-2);
        border-radius:var(--r-xl);
        padding:var(--s-8);
        text-align:center;
        color:var(--text-3);
        background:var(--surface-1);
      ">
        <div style="font-size:28px;margin-bottom:var(--s-3)">🛒</div>
        <div style="font-size:var(--fs-lg);font-weight:var(--fw-bold);color:var(--text-1);margin-bottom:var(--s-2)">
          اسکلت اولیه آماده است
        </div>
        <div style="font-size:var(--fs-sm);max-width:520px;margin-inline:auto;line-height:1.7">
          در پیام‌های بعدی لایهٔ جستجوی زنده، فیلترها، جدول خریدها،
          مودال افزودن خرید، و صفحهٔ ورود تکمیل می‌شود.
        </div>
      </div>
    </main>
  `;
}
