/* ============================================================
   Bookmarks view
   ============================================================ */
import { el, escapeHtml } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { listBookmarks } from '../data.js';
import { theoryCard, emptyState } from '../components.js';

export const renderBookmarks = async (root) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  if (!state.user) {
    page.innerHTML = '';
    page.appendChild(emptyState({
      title: 'وارد شوید',
      desc: 'برای دیدن نشان‌شده‌ها باید وارد حساب خود شوید.',
      actions: [{ label: 'ورود', primary: true, onClick: () => navigate('/auth') }]
    }));
    root.appendChild(page);
    return;
  }

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-bookmark-3-line"></i>کتابخانه من</div>
      <h1 class="page-header__title">نشان‌شده‌ها</h1>
      <p class="page-header__desc">نظریه‌هایی که برای مطالعه بعدی نشان کرده‌اید.</p>
    </div>
  `;
  page.appendChild(header);

  const grid = document.createElement('div');
  grid.style.marginTop = '16px';
  page.appendChild(grid);
  root.appendChild(page);

  try {
    const items = await listBookmarks();
    if (!items.length) {
      grid.appendChild(emptyState({
        title: 'هنوز چیزی نشان نکرده‌اید',
        desc: 'در صفحه هر نظریه، روی دکمه نشان‌کردن بزنید تا اینجا ظاهر شود.',
        actions: [{ label: 'کاوش نظریه‌ها', primary: true, onClick: () => navigate('/theories') }]
      }));
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'theory-grid stagger';
    items.forEach(b => b.theory && wrap.appendChild(theoryCard(b.theory)));
    grid.appendChild(wrap);
  } catch (e) {
    grid.appendChild(emptyState({ title: 'خطا', desc: e.message }));
  }
};
