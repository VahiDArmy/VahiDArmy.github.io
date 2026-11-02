/* ==========================================================================
   tafsir.js — رندر تفسیر المیزان با صفحه‌بندی بر اساس تیترها
   ========================================================================== */

import { TAFSIR_RAW_500, TAFSIR_RAW_501 } from './data/tafsir.js';
import { $, el, clear, faDigits, storage, CONFIG } from './utils.js';
import { store } from './store.js';

// تبدیل خام به ساختار صفحه‌بندی شده
function parseTafsir(raw) {
  const sections = [];
  // جدا کردن بر اساس ### (سطح ۳ تیترها)
  const parts = raw.split('### ').filter(Boolean);
  
  parts.forEach((part, index) => {
    const lines = part.split('\n');
    const title = lines[0].trim();
    // حذف ## یا # از تیتر اصلی اگر وجود دارد
    const cleanTitle = title.replace(/^[#\s]+/, '');
    const body = lines.slice(1).join('\n').trim();

    sections.push({
      id: `tafsir-section-${index}`,
      title: cleanTitle,
      body: body,
    });
  });

  return sections;
}

const TAFSIR_SECTIONS = [
  ...parseTafsir(TAFSIR_RAW_500),
  ...parseTafsir(TAFSIR_RAW_501),
];

let activePage = 0;

function formatTafsirBody(text) {
  // تبدیل مارک‌داون ساده به HTML برای نمایش بهتر
  const paragraphs = text.split('\n\n').map(p => {
    const clean = p.trim().replace(/\n/g, ' ');
    return clean ? `<p>${clean}</p>` : '';
  }).join('');

  return paragraphs;
}

function renderPagination() {
  const nav = el('div', { class: 'tafsir-pagination' });
  
  TAFSIR_SECTIONS.forEach((sec, idx) => {
    const btn = el('button', {
      class: `tafsir-page-btn ${idx === activePage ? 'is-active' : ''}`,
      type: 'button',
      title: sec.title,
      text: `بخش ${faDigits(idx + 1)}`,
      onclick: () => {
        activePage = idx;
        updateTafsirView();
        // اسکرول به بالای بخش
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    nav.appendChild(btn);
  });

  return nav;
}

function renderTOC() {
  const toc = el('div', { class: 'tafsir-toc' });
  toc.appendChild(el('h3', { text: 'فهرست موضوعات' }));
  
  const ul = el('ul');
  TAFSIR_SECTIONS.forEach((sec, idx) => {
    const li = el('li');
    const a = el('a', {
      href: `#tafsir-section-${idx}`,
      text: sec.title,
      onclick: (e) => {
        e.preventDefault();
        activePage = idx;
        updateTafsirView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  toc.appendChild(ul);
  return toc;
}

function renderSection(sec, idx) {
  const block = el('div', { class: 'tafsir-block', id: sec.id });
  
  block.appendChild(el('h3', { class: 'tafsir-block__title', text: sec.title }));
  
  const body = el('div', { class: 'tafsir-text' });
  body.innerHTML = formatTafsirBody(sec.body);
  block.appendChild(body);

  return block;
}

function renderNavButtons() {
  const nav = el('div', { class: 'tafsir-nav-bottom' });

  const prevBtn = el('button', {
    class: 'tafsir-nav-btn',
    type: 'button',
    disabled: activePage === 0,
    onclick: () => {
      if (activePage > 0) {
        activePage--;
        updateTafsirView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, ['بخش قبلی', el('span', { text: ' →' })]);

  const nextBtn = el('button', {
    class: 'tafsir-nav-btn',
    type: 'button',
    disabled: activePage === TAFSIR_SECTIONS.length - 1,
    onclick: () => {
      if (activePage < TAFSIR_SECTIONS.length - 1) {
        activePage++;
        updateTafsirView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, ['بخش بعدی ', el('span', { text: '← ' })]);

  nav.appendChild(nextBtn); // در RTL دکمه بعدی سمت چپ است
  nav.appendChild(prevBtn);

  return nav;
}

function updateTafsirView() {
  const content = $('#tafsirContent');
  if (!content) return;

  clear(content);

  const wrapper = el('div', { class: 'tafsir-wrapper' });

  // هدر
  wrapper.appendChild(
    el('div', { class: 'tafsir-hero' }, [
      el('h2', { text: 'تفسیر المیزان' }),
      el('p', { text: 'سوره واقعه (۵۶)' }),
    ])
  );

  // فهرست
  wrapper.appendChild(renderTOC());

  // صفحه‌بندی
  wrapper.appendChild(renderPagination());

  // محتوای بخش فعال
  const activeSec = TAFSIR_SECTIONS[activePage];
  if (activeSec) {
    wrapper.appendChild(renderSection(activeSec, activePage));
  }

  // ناوبری پایین
  wrapper.appendChild(renderNavButtons());

  content.appendChild(wrapper);
}

export function initTafsir() {
  const content = $('#tafsirContent');
  if (!content) return;

  // بارگذاری صفحه ذخیره‌شده
  const savedPage = storage.get(CONFIG.storageKeys.tafsirPage, 0);
  if (typeof savedPage === 'number' && savedPage >= 0 && savedPage < TAFSIR_SECTIONS.length) {
    activePage = savedPage;
  }

  updateTafsirView();
  
  content.removeAttribute('hidden');
  $('#tafsirLoader').setAttribute('hidden', '');

  // ذخیره صفحه در هنگام تغییر
  window.addEventListener('q56:route-changed', (e) => {
    if (e.detail.route === 'tafsir') {
      storage.set(CONFIG.storageKeys.tafsirPage, activePage);
    }
  });
}