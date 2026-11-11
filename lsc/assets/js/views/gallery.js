/* ============================================================
   Gallery view
   ============================================================ */
import { el, escapeHtml, debounce } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { listImages } from '../data.js';
import { galleryItem, pagination, emptyState } from '../components.js';
import { openLightbox } from '../ui.js';
import { APP } from '../config.js';

export const renderGallery = async (root, { query = {} } = {}) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-gallery-line"></i>گالری</div>
      <h1 class="page-header__title">گالری تصاویر</h1>
      <p class="page-header__desc">تمام تصاویر بارگذاری‌شده در نظریه‌ها را یکجا ببینید.</p>
    </div>
  `;
  page.appendChild(header);

  const results = document.createElement('div');
  results.style.marginTop = '16px';
  page.appendChild(results);
  root.appendChild(page);

  let currentPage = Number(query.page || 1);

  const load = async () => {
    results.innerHTML = '';
    try {
      const { items, count } = await listImages({ page: currentPage, perPage: APP.pagination.galleryPerPage });
      if (!items.length) {
        results.appendChild(emptyState({
          title: 'گالری خالی است',
          desc: 'هنوز تصویری در هیچ نظریه‌ای بارگذاری نشده.',
          actions: [{ label: 'نظریه‌ها', primary: true, onClick: () => navigate('/theories') }]
        }));
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'gallery-grid stagger';
      items.forEach(img => grid.appendChild(galleryItem(img, {
        onClick: () => openLightbox(img.image_url, img.caption || img.theory?.title || '')
      })));
      results.appendChild(grid);
      if (count > APP.pagination.galleryPerPage) {
        results.appendChild(pagination({
          page: currentPage, perPage: APP.pagination.galleryPerPage, total: count,
          onPage: (p) => { currentPage = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        }));
      }
    } catch (e) {
      results.innerHTML = '';
      results.appendChild(emptyState({ title: 'خطا', desc: e.message }));
    }
  };
  await load();
};
