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
        <button id="theme-btn" class="btn btn--ghost btn--sm" aria-label="تغییر تم">${isDark ? '☀️' : '🌙'}</button>
        ${user ? `<span class="header__email" title="${user.email}">${user.email}</span><button id="logout-btn" class="btn btn--ghost btn--sm">خروج</button>` : ''}
      </div>
    </div>
  `;

  document.getElementById('theme-btn').onclick = () => {
    toggleTheme();
    renderHeader(user); // Re-render to swap icon
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
  // 16. Scroll Reset on Route Change
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
    // 5. Fix Splash Hang: Always remove splash in finally block
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.classList.add('is-hidden');
      setTimeout(() => splash.remove(), 300);
    }
  }
}

window.addEventListener('hashchange', router);
init();