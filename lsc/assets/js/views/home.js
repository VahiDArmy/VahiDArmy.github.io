/* ============================================================
   Home view
   ============================================================ */
import { $, el, escapeHtml, formatNumber, debounce } from '../utils.js';
import { state, subscribe } from '../state.js';
import { formatJalali, relativeJalali } from '../shamsi.js';
import { listTheories, listEvents, loadCounts, listImages } from '../data.js';
import { theoryCard, theoryFeature, statCard, galleryItem, placeholder } from '../components.js';
import { skeletonCards, emptyState, toastInfo } from '../ui.js';
import { navigate } from '../router.js';
import { APP } from '../config.js';

export const renderHome = async (root) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  /* Hero */
  const hero = document.createElement('section');
  hero.className = 'hero';
  hero.innerHTML = `
    <div class="hero__grid">
      <div class="hero__content">
        <div class="hero__eyebrow">
          <span class="dot dot--accent"></span>
          استودیوی ایده‌ها
        </div>
        <h1 class="hero__title">
          جهان <span class="gradient-text">نظریه‌های</span> خود را بسازید
        </h1>
        <p class="hero__desc">
          هر نظریه، جهانی از اشیاء، تصاویر و پیوندهاست. ایده‌های خود را با تقویم شمسی ثبت کنید،
          اشیاء تصویری را به آنها پیوند دهید و شبکه‌ای از اندیشه‌ها بسازید.
        </p>
        <div class="hero__actions">
          <button class="btn btn--primary btn--lg" data-act="new-theory">
            <i class="ri-add-circle-line"></i> نظریه جدید بسازید
          </button>
          <a class="btn btn--lg" href="#/theories" data-link>
            <i class="ri-compass-3-line"></i> کاوش در نظریه‌ها
          </a>
        </div>
        <div class="hero__stats" data-hero-stats>
          <div>
            <div class="hero__stat-value" data-stat="theories">—</div>
            <div class="hero__stat-label">نظریه</div>
          </div>
          <div>
            <div class="hero__stat-value" data-stat="objects">—</div>
            <div class="hero__stat-label">شیء</div>
          </div>
          <div>
            <div class="hero__stat-value" data-stat="images">—</div>
            <div class="hero__stat-label">تصویر</div>
          </div>
          <div>
            <div class="hero__stat-value" data-stat="events">—</div>
            <div class="hero__stat-label">رخداد</div>
          </div>
        </div>
      </div>
      <div class="hero__visual">
        <div class="hero-orbit">
          <div class="hero-orbit__ring"></div>
          <div class="hero-orbit__ring"></div>
          <div class="hero-orbit__core"><i class="ri-lightbulb-flash-line"></i></div>
          <div class="hero-orbit__satellite"><i class="ri-image-line"></i></div>
          <div class="hero-orbit__satellite"><i class="ri-link"></i></div>
          <div class="hero-orbit__satellite"><i class="ri-book-mark-line"></i></div>
        </div>
      </div>
    </div>
  `;
  page.appendChild(hero);

  /* Quick tiles */
  const quick = document.createElement('div');
  quick.className = 'quick-tiles';
  const tiles = [
    { href: '#/theories', icon: 'ri-lightbulb-flash-line', title: 'نظریه‌ها', desc: 'همه نظریه‌ها، جستجو، فیلتر دسته‌بندی' },
    { href: '#/objects', icon: 'ri-shape-2-line', title: 'اشیاء و تصاویر', desc: 'کاوش در اشیاء تصویری متصل به نظریه‌ها' },
    { href: '#/gallery', icon: 'ri-gallery-line', title: 'گالری', desc: 'نگاهی یکجا به همه تصاویر نظریه‌ها' },
    { href: '#/timeline', icon: 'ri-timeline-view', title: 'خط زمان', desc: 'رخدادها به ترتیب تاریخ شمسی' }
  ];
  tiles.forEach(t => {
    const a = document.createElement('a');
    a.className = 'quick-tile';
    a.href = t.href;
    a.dataset.link = '';
    a.innerHTML = `
      <div class="quick-tile__icon"><i class="${t.icon}"></i></div>
      <div class="quick-tile__title">${t.title}</div>
      <div class="quick-tile__desc">${t.desc}</div>
      <i class="quick-tile__arrow ri-arrow-left-up-line"></i>
    `;
    quick.appendChild(a);
  });
  page.appendChild(quick);

  /* Recent theories */
  const recentWrap = document.createElement('div');
  recentWrap.dataset.recent = '';
  recentWrap.appendChild(skeletonCards(3));
  page.appendChild(recentWrap);

  /* Featured theory */
  const featWrap = document.createElement('div');
  featWrap.dataset.feat = '';
  page.appendChild(featWrap);

  /* Recent gallery */
  const galleryWrap = document.createElement('div');
  galleryWrap.dataset.gallery = '';
  page.appendChild(galleryWrap);

  root.appendChild(page);

  page.querySelector('[data-act="new-theory"]')?.addEventListener('click', () => navigate('/theories/new'));

  /* Load counts */
  loadCounts().then((counts) => {
    if (!counts) return;
    const map = {
      theories: counts.theoriesCount,
      objects: counts.objectsCount,
      images: counts.galleryCount,
      events: counts.timelineCount
    };
    Object.entries(map).forEach(([k, v]) => {
      const n = page.querySelector(`[data-stat="${k}"]`);
      if (n) n.textContent = formatNumber(v);
    });
  }).catch(() => {});

  /* Load recent theories */
  try {
    const { items } = await listTheories({ page: 1, perPage: 6, sort: 'created_desc' });
    const section = document.createElement('section');
    section.className = 'section';
    const head = document.createElement('div');
    head.className = 'section__head';
    head.innerHTML = `
      <h2 class="section__title"><i class="ri-sparkling-line"></i>تازه‌ترین نظریه‌ها</h2>
      <a class="section__link" href="#/theories" data-link>همه نظریه‌ها <i class="ri-arrow-left-line"></i></a>
    `;
    section.appendChild(head);
    if (items.length === 0) {
      section.appendChild(emptyState({
        title: 'هنوز نظریه‌ای ثبت نشده',
        desc: 'اولین نظریه خود را بسازید و جهان ایده‌ها را شکل دهید.',
        actions: [{ label: 'ساخت نظریه', primary: true, icon: 'ri-add-line', onClick: () => navigate('/theories/new') }]
      }));
    } else {
      const grid = document.createElement('div');
      grid.className = 'theory-grid stagger';
      items.slice(0, 6).forEach(t => grid.appendChild(theoryCard(t)));
      section.appendChild(grid);
    }
    recentWrap.replaceWith(section);
  } catch (e) {
    console.error(e);
    recentWrap.replaceWith(emptyState({ title: 'خطا در دریافت نظریه‌ها', desc: 'اتصال خود را بررسی کنید.' }));
  }

  /* Featured */
  try {
    const { items } = await listTheories({ page: 1, perPage: 12, sort: 'created_desc' });
    const featured = items.find(t => t.cover_image) || items[0];
    if (featured) {
      const sec = document.createElement('section');
      sec.className = 'section';
      sec.innerHTML = `<div class="section__head"><h2 class="section__title"><i class="ri-star-smile-line"></i>نظریه برگزیده</h2></div>`;
      sec.appendChild(theoryFeature(featured));
      featWrap.replaceWith(sec);
    } else {
      featWrap.remove();
    }
  } catch { featWrap.remove(); }

  /* Gallery */
  try {
    const { items } = await listImages({ page: 1, perPage: 6 });
    if (items.length) {
      const sec = document.createElement('section');
      sec.className = 'section';
      sec.innerHTML = `<div class="section__head"><h2 class="section__title"><i class="ri-gallery-line"></i>آخرین تصاویر</h2><a class="section__link" href="#/gallery" data-link>گالری کامل <i class="ri-arrow-left-line"></i></a></div>`;
      const grid = document.createElement('div');
      grid.className = 'gallery-grid stagger';
      items.slice(0, 6).forEach(img => grid.appendChild(galleryItem(img, { onClick: () => navigate(`/theories/${img.theory_id}`) })));
      sec.appendChild(grid);
      galleryWrap.replaceWith(sec);
    } else {
      galleryWrap.remove();
    }
  } catch { galleryWrap.remove(); }
};
