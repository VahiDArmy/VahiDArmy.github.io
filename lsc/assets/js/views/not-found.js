/* ============================================================
   404 view
   ============================================================ */
import { navigate } from '../router.js';

export const renderNotFound = async (root) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'notfound';
  page.innerHTML = `
    <div class="notfound__code">۴۰۴</div>
    <h1 class="notfound__title">صفحه پیدا نشد</h1>
    <p class="notfound__desc">آنچه به دنبالش بودید در این جهان وجود ندارد. شاید مسیر عوض شده باشد.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
      <button class="btn btn--primary" data-act="home"><i class="ri-home-5-line"></i>خانه</button>
      <button class="btn" data-act="theories"><i class="ri-lightbulb-flash-line"></i>نظریه‌ها</button>
    </div>
  `;
  page.querySelector('[data-act="home"]').addEventListener('click', () => navigate('/home'));
  page.querySelector('[data-act="theories"]').addEventListener('click', () => navigate('/theories'));
  root.appendChild(page);
};
