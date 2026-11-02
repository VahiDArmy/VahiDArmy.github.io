/* ==========================================================================
   tafsir.js — رندر تفسیر المیزان با صفحه‌بندی بر اساس تیترها و فهرست پاپ‌آپ
   ========================================================================== */

import { TAFSIR_RAW_500, TAFSIR_RAW_501 } from './data/tafsir.js';
import { $, el, clear, faDigits, storage } from './utils.js';
import { CONFIG } from './config.js';

// تبدیل خام به ساختار صفحه‌بندی شده
function parseTafsir(raw) {
  const sections = [];
  const parts = raw.split('### ').filter(Boolean);
  
  parts.forEach((part, index) => {
    const lines = part.split('\n');
    const title = lines[0].trim();
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    nav.appendChild(btn);
  });

  return nav;
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

  nav.appendChild(nextBtn);
  nav.appendChild(prevBtn);

  return nav;
}

// --- منطق مودال فهرست ---
function openTocModal() {
  const overlay = el('div', { class: 'modal-overlay is-open', id: 'tocModal' });
  
  const modal = el('div', { class: 'modal-content', style: { maxWidth: '500px' } });
  
  const header = el('div', { class: 'modal-header' }, [
    el('h3', {}, [
      el('svg', { viewBox: '0 0 24 24', html: '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' }),
      'فهرست موضوعات'
    ]),
    el('button', {
      class: 'modal-close',
      type: 'button',
      onclick: () => closeTocModal(overlay),
    }, [
      el('svg', { viewBox: '0 0 24 24', width: '20', height: '20', html: '<path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' })
    ])
  ]);

  const body = el('div', { class: 'modal-body' });
  const ul = el('ul', { class: 'tafsir-toc-list' });
  
  TAFSIR_SECTIONS.forEach((sec, idx) => {
    const li = el('li');
    const a = el('a', {
      href: '#',
      text: sec.title,
      onclick: (e) => {
        e.preventDefault();
        activePage = idx;
        updateTafsirView();
        closeTocModal(overlay);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  
  body.appendChild(ul);
  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  
  document.getElementById('modalRoot').appendChild(overlay);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTocModal(overlay);
  });
}

function closeTocModal(overlay) {
  overlay.classList.remove('is-open');
  setTimeout(() => overlay.remove(), 300);
}

function updateTafsirView() {
  const content = $('#tafsirContent');
  if (!content) return;

  clear(content);

  const wrapper = el('div', { class: 'tafsir-wrapper' });

  // هدر تفسیر (با دکمه فهرست)
  const hero = el('div', { class: 'tafsir-hero' }, [
    el('div', { class: 'flex justify-between items-center w-full px-4' }, [
      el('div', { class: 'text-right' }, [
        el('h2', { text: 'تفسیر المیزان' }),
        el('p', { text: 'سوره واقعه (۵۶)' })
      ]),
      el('button', {
        class: 'btn btn--ghost',
        type: 'button',
        onclick: openTocModal,
        style: { fontSize: '0.85rem', padding: '0.4rem 0.8rem' }
      }, [
        el('svg', { viewBox: '0 0 24 24', width: '16', height: '16', html: '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' }),
        'فهرست'
      ])
    ])
  ]);
  wrapper.appendChild(hero);

  // صفحه‌بندی (بالای محتوا، فشرده)
  wrapper.appendChild(renderPagination());

  // محتوای بخش فعال (اول)
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

  const savedPage = storage.get(CONFIG.storageKeys.tafsirPage, 0);
  if (typeof savedPage === 'number' && savedPage >= 0 && savedPage < TAFSIR_SECTIONS.length) {
    activePage = savedPage;
  }

  updateTafsirView();
  
  content.removeAttribute('hidden');
  $('#tafsirLoader').setAttribute('hidden', '');

  window.addEventListener('q56:route-changed', (e) => {
    if (e.detail.route === 'tafsir') {
      storage.set(CONFIG.storageKeys.tafsirPage, activePage);
    }
  });
}