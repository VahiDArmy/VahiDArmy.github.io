/**
 * Madacto App Entry Point
 */

import { supabase } from './services/api.js';
import { renderLogin } from './pages/login.page.js';
import { renderHome } from './pages/home.page.js';
import { renderUpload } from './pages/upload.page.js';

const root = document.getElementById('app-main');
const header = document.getElementById('app-header');
const splash = document.getElementById('boot-splash');

function renderHeader(user) {
  header.innerHTML = `
    <div class="container header">
      <div class="header__brand">
        <span class="header__mark">M</span>
        <span>ماداکتو</span>
      </div>
      ${user ? `<div class="header__user"><span style="font-size:12px;color:var(--text-secondary)">${user.email}</span><button id="logout-btn" class="btn btn--ghost btn--sm">خروج</button></div>` : ''}
    </div>
  `;

  if (user) {
    document.getElementById('logout-btn').onclick = async () => {
      await supabase.auth.signOut();
      window.location.reload();
    };
  }
}

async function router() {
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
}

async function init() {
  await router();
  
  if (splash) {
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 300);
  }
}

window.addEventListener('hashchange', router);
init();