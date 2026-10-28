/**
 * Madacto App Entry Point
 */

import { supabase, apiService } from './services/api.js';
import { renderLogin } from './pages/login.page.js';
import { renderHome } from './pages/home.page.js';
import { renderUpload } from './pages/upload.page.js';
import { initTheme, toggleTheme, openModal, showToast, escapeHtml } from './utils/ui.js';
import { formatDateShamsi, toGregorian, formatDateISO } from './utils/date.js';
import { MEAL_TYPES } from './config.js';

const root = document.getElementById('app-main');
const header = document.getElementById('app-header');
const footer = document.getElementById('app-footer');

// Icons
const icons = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
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
          <a href="#/upload" class="icon-btn" title="آپلود عکس">${icons.upload}</a>
          <button id="theme-btn" class="icon-btn" title="تغییر تم">${isDark ? icons.sun : icons.moon}</button>
          <span class="header__email" title="${user.email}">${user.email}</span>
          <button id="logout-btn" class="icon-btn" title="خروج">${icons.logout}</button>
        ` : `
          <button id="theme-btn" class="icon-btn" title="تغییر تم">${isDark ? icons.sun : icons.moon}</button>
          <a href="#/login" class="btn btn--primary btn--sm" style="margin-inline-start: 4px;">ورود</a>
          <a href="#/signup" class="btn btn--secondary btn--sm">ثبت‌نام</a>
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
  }
}

// Global function to open the Manual Entry Modal
window.openManualEntryModal = async function(dateShamsi = '', type = 'breakfast', currentName = '', currentDesc = '') {
  let allNames = [];
  try {
    allNames = await apiService.getAllMealNames();
  } catch (e) { console.warn('Could not fetch meal names'); }

  const datalistOptions = allNames.map(name => `<option value="${escapeHtml(name)}">`).join('');
  const mealTypeLabel = MEAL_TYPES.find(m => m.id === type)?.label || type;

  const content = document.createElement('form');
  content.innerHTML = `
    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px; text-align: center; background: var(--bg-subtle); padding: 4px; border-radius: 4px;">
      ${dateShamsi} • ${mealTypeLabel}
    </div>
    <div class="form-group">
      <label>نام غذا</label>
      <input type="text" id="m-name" list="meal-names" value="${escapeHtml(currentName)}" required autocomplete="off" placeholder="جستجو یا تایپ نام...">
      <datalist id="meal-names">${datalistOptions}</datalist>
    </div>
    <div class="form-group">
      <label>توضیحات (اختیاری)</label>
      <input type="text" id="m-desc" value="${escapeHtml(currentDesc)}" placeholder="مثلاً همراه با نوشابه">
    </div>
  `;

  const modal = openModal({
    title: currentName ? 'ویرایش غذا' : 'ثبت غذا',
    content: content,
    actions: [
      {
        label: 'ذخیره',
        primary: true,
        onClick: async () => {
          const name = document.getElementById('m-name').value;
          const desc = document.getElementById('m-desc').value;

          if (!name) return showToast('نام غذا الزامی است', 'error');

          try {
            const parts = dateShamsi.split('/').map(Number);
            if (parts.length !== 3) throw new Error('فرمت تاریخ نامعتبر است');
            const [gy, gm, gd] = toGregorian(parts[0], parts[1], parts[2]);
            const iso = formatDateISO(new Date(gy, gm - 1, gd));

            await apiService.saveMeals([{
              meal_date: iso,
              meal_type: type,
              name: name.trim(),
              description: desc.trim() || null
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
};

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
    const user = session?.user || null;
    renderHeader(user);

    const hash = window.location.hash || '#/';

    // Auth Routes
    if (hash === '#/login' || hash === '#/signup') {
      if (user) {
        window.location.hash = '#/'; // Redirect to home if already logged in
        return;
      }
      renderLogin(root, () => {
        window.location.reload();
      });
      return;
    }

    // Protected Routes
    if (hash === '#/upload') {
      if (!user) {
        showToast('برای آپلود عکس باید وارد شوید.', 'error');
        window.location.hash = '#/login';
        return;
      }
      renderUpload(root);
      return;
    }

    // Public / Home Route
    renderHome(root, user);

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