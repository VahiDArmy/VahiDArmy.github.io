/* ==========================================================================
   history.js — مودال تاریخچه‌ی قرائت (تاریخ شمسی)
   ========================================================================== */

import { supabase } from './supabase.js';
import { CONFIG } from './config.js';
import { el, $, clear, faDigits } from './utils.js';
import { formatShamsiDateTime, relativeShamsiFull } from './jalali.js';
import { store } from './store.js';

let activeModal = null;

export async function openHistoryModal(userId, displayName = 'کاربر') {
  if (activeModal) closeModal();

  // ایجاد DOM مودال
  const overlay = el('div', { class: 'modal-overlay', id: 'historyModal' });
  
  const modal = el('div', { class: 'modal-content' });
  
  // هدر
  const header = el('div', { class: 'modal-header' }, [
    el('h3', {}, [
      el('svg', { viewBox: '0 0 24 24', html: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' }),
      `تاریخچه قرائت ${displayName}`
    ]),
    el('button', {
      class: 'modal-close',
      type: 'button',
      'aria-label': 'بستن',
      onclick: closeModal,
    }, [
      el('svg', { viewBox: '0 0 24 24', width: '20', height: '20', html: '<path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' })
    ])
  ]);

  // بدنه
  const body = el('div', { class: 'modal-body' });
  body.innerHTML = '<div class="text-center text-muted p-4">در حال بارگذاری...</div>';

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  
  document.getElementById('modalRoot').appendChild(overlay);
  activeModal = overlay;

  // افکت باز شدن
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
  });

  // کلیک بیرون از مودال
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // بستن با کلید Escape
  const handleKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  window.addEventListener('keydown', handleKey);
  overlay._cleanup = () => window.removeEventListener('keydown', handleKey);

  // بارگذاری داده‌ها
  await loadHistoryData(userId, body);
}

function closeModal() {
  if (!activeModal) return;
  
  activeModal.classList.remove('is-open');
  const cleanup = activeModal._cleanup;
  
  setTimeout(() => {
    activeModal.remove();
    activeModal = null;
    if (cleanup) cleanup();
  }, 300);
}

async function loadHistoryData(userId, container) {
  try {
    const { data, error } = await supabase
      .from(CONFIG.tables.reads)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    clear(container);

    if (!data || data.length === 0) {
      container.appendChild(
        el('div', { class: 'history-empty' }, [
          el('svg', { viewBox: '0 0 24 24', html: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="1.5"/>' }),
          el('p', { text: 'هنوز هیچ قرائتی ثبت نشده است.' })
        ])
      );
      return;
    }

    // نمایش خلاصه
    const summary = el('div', { class: 'flex justify-between items-center mb-4 p-2 bg-muted rounded-lg' }, [
      el('span', { class: 'text-sm text-muted', text: 'تعداد کل:' }),
      el('span', { class: 'font-bold text-primary', text: faDigits(data.length) + ' بار' })
    ]);
    container.appendChild(summary);

    // لیست تایم‌لاین
    const timeline = el('div', { class: 'history-timeline' });

    data.forEach((event, index) => {
      const dateStr = formatShamsiDateTime(event.created_at, { withWeekday: true });
      const relativeStr = relativeShamsiFull(event.created_at);

      const item = el('div', { class: `history-item ${index === 0 ? 'history-item--active' : ''}` });
      
      item.appendChild(el('div', { class: 'history-date', text: dateStr }));
      
      const timeDiv = el('div', { class: 'history-time' }, [
        el('span', { text: relativeStr }),
      ]);

      if (index === 0) {
        timeDiv.appendChild(el('span', { class: 'history-badge', text: 'آخرین قرائت' }));
      }

      item.appendChild(timeDiv);
      timeline.appendChild(item);
    });

    container.appendChild(timeline);

  } catch (err) {
    console.error('[history] load failed', err);
    clear(container);
    container.appendChild(el('div', { class: 'history-empty text-red-500', text: 'خطا در بارگذاری تاریخچه.' }));
  }
}

// گوش دادن به رویداد ثبت قرائت جدید (برای رفرش)
window.addEventListener('q56:read-registered', () => {
  if (activeModal) {
    // اگر مودال باز است، ببندیم و دوباره باز کنیم
    closeModal();
  }
});