/**
 * Madacto App Entry Point
 */

import { supabase, apiService } from './services/api.js';
import { renderLogin } from './pages/login.page.js';
import { renderHome } from './pages/home.page.js';
import { renderUpload } from './pages/upload.page.js';
import { initTheme, toggleTheme, openModal, showToast } from './utils/ui.js';
import { formatDateShamsi, toGregorian, formatDateISO } from './utils/date.js';

const root = document.getElementById('app-main');
const header = document.getElementById('app-header');
const footer = document.getElementById('app-footer');

// Icons
const icons = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`
};

initTheme();

function renderHeader(user) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  header.innerHTML = `
    <div class="container header">
      <div class="header__brand">
        <span class="header__mark">M</span>
        <span>ماداکتو</span>
      </div>
      <div class="header__actions">
        <a href="../office/index.html" class="icon-btn" title="بازگشت به اداره">${icons.back}</a>
        ${user ? `
          <button id="btn-manual" class="icon-btn" title="افزودن دستی" style="color:var(--accent)">${icons.plus}</button>
          <a href="#/upload" class="icon-btn" title="آپلود عکس">${icons.upload}</a>
          <button id="theme-btn" class="icon-btn" title="تغییر تم">${isDark ? icons.sun : icons.moon}</button>
          <span class="header__email" title="${user.email}">${user.email}</span>
          <button id="logout-btn" class="icon-btn" title="خروج">${icons.logout}</button>
        ` : `
          <button id="theme-btn" class="icon-btn">${isDark ? icons.sun : icons.moon}</button>
        `}
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
    document.getElementById('btn-manual').onclick = () => openManualEntryModal();
  }
}

function openManualEntryModal() {
  const content = document.createElement('form');
  content.innerHTML = `
    <div class="form-group">
      <label>تاریخ (شمسی)</label>
      <input type="text" id="m-date" placeholder="مثلاً 1405/08/15" dir="ltr" required>
    </div>
    <div class="form-group">
      <label>وعده غذایی</label>
      <select id="m-type">
        <option value="breakfast">صبحانه</option>
        <option value="lunch1">ناهار ۱</option>
        <option value="lunch2">ناهار ۲</option>
      </select>
    </div>
    <div class="form-group">
      <label>نام غذا</label>
      <input type="text" id="m-name" required>
    </div>
    <div class="form-group">
      <label>توضیحات</label>
      <input type="text" id="m-desc">
    </div>
  `;

  const modal = openModal({
    title: 'افزودن دستی غذا',
    content: content,
    actions: [
      {
        label: 'ذخیره',
        primary: true,
        onClick: async () => {
          const dateStr = document.getElementById('m-date').value;
          const type = document.getElementById('m-type').value;
          const name = document.getElementById('m-name').value;
          const desc = document.getElementById('m-desc').value;

          if (!dateStr || !name) return showToast('تاریخ و نام غذا الزامی است', 'error');

          try {
            const parts = dateStr.split('/').map(Number);
            if (parts.length !== 3) throw new Error('فرمت تاریخ نامعتبر است');
            const [gy, gm, gd] = toGregorian(parts[0], parts[1], parts[2]);
            const iso = formatDateISO(new Date(gy, gm - 1, gd));

            await apiService.saveMeals([{
              meal_date: iso,
              meal_type: type,
              name: name,
              description: desc || null
            }]);
            
            showToast('غذا با موفقیت ذخیره شد', 'success');
            modal.close();
            if (window.location.hash === '' || window.location.hash === '#/') {
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            }
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      },
      { label: 'انصراف', onClick: () => modal.close() }
    ]
  });
}

function renderFooter() {
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container">
      <p>ماداکتو — رزرو غذای رستوران اداره &copy; ${year}</p>
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
    root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--danger-500)">خطا در اتصال به سرور.</div>`;
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