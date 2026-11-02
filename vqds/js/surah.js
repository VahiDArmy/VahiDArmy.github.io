/* ==========================================================================
   surah.js — رندر صفحه‌ی سوره، کارت‌های آیات و نوار ابزار پایین
   ========================================================================== */

import { AYAHS, SURAH_META } from './data/surah.js';
import { $, el, faDigits, storage, CONFIG, onDblTap } from './utils.js';
import { incrementReadCount } from './counters.js';
import { toast, successToast } from './toast.js';
import { store } from './store.js';

let activeFilter = 'all'; // all | bookmarked

function getBookmarks() {
  return storage.get(CONFIG.storageKeys.bookmarks, []);
}

function isBookmarked(ayahNumber) {
  return getBookmarks().includes(ayahNumber);
}

function toggleBookmark(ayahNumber, btn) {
  let marks = getBookmarks();
  if (marks.includes(ayahNumber)) {
    marks = marks.filter((n) => n !== ayahNumber);
    btn.classList.remove('is-bookmarked');
    toast('نشانه حذف شد', 'info');
  } else {
    marks.push(ayahNumber);
    btn.classList.add('is-bookmarked');
    toast('آیه نشانه‌گذاری شد', 'success');
  }
  storage.set(CONFIG.storageKeys.bookmarks, marks);
  updateFiltersUI();
}

function copyAyah(ayah) {
  const text = `${ayah.ar}\n\n${ayah.fa}\n(سوره واقعه، آیه ${faDigits(ayah.a)})`;
  navigator.clipboard.writeText(text).then(() => {
    successToast('متن آیه کپی شد');
  }).catch(() => {
    toast('خطا در کپی کردن', 'error');
  });
}

function renderAyahCard(ayah) {
  const marked = isBookmarked(ayah.a);
  
  const card = el('article', {
    class: `ayah-card ${marked ? 'is-bookmarked' : ''}`,
    id: `ayah-${ayah.a}`,
    dataset: { ayah: ayah.a },
  });

  // شماره آیه
  card.appendChild(el('div', { class: 'ayah-card__number', text: faDigits(ayah.a) }));

  // متن عربی
  card.appendChild(el('div', { class: 'ayah-card__arabic text-arabic', text: ayah.ar }));

  // متن فارسی
  card.appendChild(el('div', { class: 'ayah-card__farsi text-farsi', text: ayah.fa }));

  // اکشن‌ها
  const actions = el('div', { class: 'ayah-card__actions' });

  // دکمه کپی
  const copyBtn = el('button', {
    class: 'ayah-card__action-btn',
    type: 'button',
    title: 'کپی آیه',
    'aria-label': 'کپی آیه',
    onclick: () => copyAyah(ayah),
  }, [
    el('svg', { viewBox: '0 0 24 24', html: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.7"/>' })
  ]);

  // دکمه بوکمارک
  const markBtn = el('button', {
    class: `ayah-card__action-btn ayah-card__action-btn--bookmark ${marked ? 'is-bookmarked' : ''}`,
    type: 'button',
    title: marked ? 'حذف نشانه' : 'نشانه‌گذاری',
    'aria-label': marked ? 'حذف نشانه' : 'نشانه‌گذاری',
    onclick: () => toggleBookmark(ayah.a, markBtn),
  }, [
    el('svg', { viewBox: '0 0 24 24', html: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' })
  ]);

  actions.appendChild(copyBtn);
  actions.appendChild(markBtn);
  card.appendChild(actions);

  return card;
}

function renderHeader() {
  return el('header', { class: 'surah-header' }, [
    el('div', { class: 'surah-header__ornament' }, [
      el('svg', { viewBox: '0 0 24 24', html: '<path d="M12 2l2.9 6.9L22 9.6l-5.5 4.9L18.2 22 12 18.3 5.8 22l1.7-7.5L2 9.6l7.1-.7z"/>' })
    ]),
    el('div', { class: 'surah-header__bismillah', text: SURAH_META.bismillah }),
    el('p', { class: 'surah-header__meta' }, [
      `سوره ${SURAH_META.nameFa} · ${faDigits(SURAH_META.ayahCount)} آیه · ${SURAH_META.revelation}`
    ])
  ]);
}

function renderFilters() {
  const filterBar = el('div', { class: 'surah-filters flex justify-center gap-2 mb-6' });
  
  const allBtn = el('button', {
    class: `tafsir-page-btn ${activeFilter === 'all' ? 'is-active' : ''}`,
    type: 'button',
    text: 'همه آیات',
    onclick: () => { activeFilter = 'all'; renderSurahView(); }
  });

  const markedBtn = el('button', {
    class: `tafsir-page-btn ${activeFilter === 'marked' ? 'is-active' : ''}`,
    type: 'button',
    text: 'نشانه‌گذاری‌شده',
    onclick: () => { activeFilter = 'marked'; renderSurahView(); }
  });

  filterBar.appendChild(allBtn);
  filterBar.appendChild(markedBtn);
  return filterBar;
}

function updateFiltersUI() {
  const markedBtn = $('#view-surah .tafsir-page-btn:last-child');
  if (activeFilter === 'marked') {
    renderSurahView(); // اگر در حالت نشانه‌دار هستیم، صفحه را رفرش کن
  }
}

function renderFAB() {
  const fabContainer = el('div', { class: 'surah-fab' });
  
  const topBtn = el('button', {
    class: 'fab-btn',
    type: 'button',
    title: 'بازگشت به بالا',
    'aria-label': 'بازگشت به بالا',
    onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [
    el('svg', { viewBox: '0 0 24 24', width: '24', height: '24', html: '<path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' })
  ]);

  fabContainer.appendChild(topBtn);
  return fabContainer;
}

function renderReadAction() {
  const container = el('div', { class: 'surah-read-action mt-8 mb-8 text-center' });
  
  const btn = el('button', {
    class: 'btn btn--primary ripple',
    type: 'button',
    onclick: async (e) => {
      const b = e.currentTarget;
      b.classList.add('btn--loading');
      await incrementReadCount();
      b.classList.remove('btn--loading');
    }
  }, [
    el('span', { text: 'اتمام قرائت این سوره' }),
    el('span', { text: ' ♥', style: { color: 'var(--color-heart)' } })
  ]);

  container.appendChild(btn);
  return container;
}

export function renderSurahView() {
  const content = $('#surahContent');
  if (!content) return;

  content.replaceChildren();

  // هدر سوره
  content.appendChild(renderHeader());
  
  // فیلترها
  content.appendChild(renderFilters());

  // لیست آیات
  const list = el('div', { class: 'ayah-list' });
  
  let displayAyahs = AYAHS;
  if (activeFilter === 'marked') {
    const marks = getBookmarks();
    displayAyahs = AYAHS.filter(a => marks.includes(a.a));
    if (displayAyahs.length === 0) {
      list.appendChild(
        el('div', { class: 'history-empty' }, [
          el('p', { text: 'هنوز هیچ آیه‌ای را نشانه‌گذاری نکرده‌اید.' })
        ])
      );
    }
  }

  displayAyahs.forEach(ayah => {
    list.appendChild(renderAyahCard(ayah));
  });

  content.appendChild(list);

  // دکمه ثبت قرائت در پایین
  content.appendChild(renderReadAction());
  
  // دکمه شناور
  content.appendChild(renderFAB());

  // اسکرول به آیه در صورت وجود هش
  const hash = window.location.hash;
  if (hash.includes('ayah-')) {
    const ayahId = hash.split('/')[1];
    const target = document.getElementById(ayahId);
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('is-highlighted');
        setTimeout(() => target.classList.remove('is-highlighted'), 2000);
      }, 100);
    }
  }
}

export function initSurah() {
  // رندر اولیه
  renderSurahView();
  $('#surahContent').removeAttribute('hidden');
  $('#surahLoader').setAttribute('hidden', '');

  // لغو ثبت رویدادهای اضافی در صورت رفرش
  window.addEventListener('q56:read-registered', () => {
    // به‌روزرسانی UI مثلا نمایش یک پیام خاص
  });
}