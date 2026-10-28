/**
 * Madacto App Entry Point
 */

import { supabase } from './services/api.js';
import { renderLogin } from './pages/login.page.js';
import { renderHome } from './pages/home.page.js';
import { renderUpload } from './pages/upload.page.js';
import { initTheme, toggleTheme } from './utils/ui.js';

const root = document.getElementById('app-main');
const header = document.getElementById('app-header');
const footer = document.getElementById('app-footer');

// Icons
const iconSun = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const iconMoon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const iconLogout = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

// Initialize Theme
initTheme();

function renderHeader(user) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  header.innerHTML = `
    <div class="container header">
      <div class="header__brand">
        <span class="header__mark">M</span>
        <span>ماداکتو</span>
      </div>
      <div class="header__user">
        <button id="theme-btn" class="icon-btn" aria-label="تغییر تم">${isDark ? iconSun : iconMoon}</button>
        ${user ? `
          <span class="header__email" title="${user.email}">${user.email}</span>
          <button id="logout-btn" class="icon-btn" aria-label="خروج">${iconLogout}</button>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('theme-btn').onclick = () => {
    toggleTheme();
    renderHeader(user);
  };

  if (user) {
    document.getElementById('logout-btn').onclick = async () => {
      await supabase.auth.signOut();
      window.location.reload();
    };
  }
}

function renderFooter() {
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container">
      <p>ماداکتو — رزرو غذای رستوران اداره &copy; ${year}</p>
      <a href="../office/index.html" class="btn btn--ghost btn--sm">بازگشت به اداره</a>
    </div>
  `;
}

async function router() {
  window.scrollTo(0, 0);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    renderHeader(session?.user);

    if (!session) {
      renderLogin(root, () => {
        window.location.reload();
      });
      return;
    }

    const hash = window.location.hash || '#/';

    if (hash === '#/upload') {
      renderUpload(root);
    } else {
      renderHome(root);
    }
  } catch (err) {
    console.error('Router error:', err);
    root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--danger-500)">خطا در اتصال به سرور. لطفاً اینترنت خود را بررسی کنید.</div>`;
  }
}

async function init() {
  try {
    renderFooter();
    await router();
  } catch (err) {
    console.error(err);
  } finally {
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.classList.add('is-hidden');
      setTimeout(() => splash.remove(), 300);
    }
  }
}

window.addEventListener('hashchange', router);
init();