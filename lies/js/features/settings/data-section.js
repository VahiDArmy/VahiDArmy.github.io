/* ============================================================
   js/features/settings/data-section.js
   Export / Import / Storage usage
   ============================================================ */

import { el } from '../../utils/dom.js';
import * as exportService from '../../services/export.service.js';
import { setButtonLoading } from '../../ui/loader.js';
import { toast, toastPromise } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';
import { formatBytes } from '../../utils/format.js';
import { estimateUsage } from '../../utils/storage.js';
import { STORAGE_QUOTA_BYTES } from '../../config/app.config.js';

/**
 * @returns {HTMLElement}
 */
export function dataSection() {
  const section = el('section', { class: 'settings-section' });

  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [
      el('h2', { class: 'settings-section__title' }, {
        children: [el('span', {}, { children: ['💾'] }), 'داده‌ها'],
      }),
      el('p', { class: 'settings-section__subtitle' }, {
        children: ['خروجی کامل از فضای شخصی یا بازیابی از پشتیبان.'],
      }),
    ],
  }));

  const body = el('div', { class: 'settings-section__body' });

  /* Storage usage */
  const used = estimateUsage();
  const pct = Math.min(100, Math.round((used / STORAGE_QUOTA_BYTES) * 100));
  const storageCard = el('div', { class: 'storage-card' });
  storageCard.appendChild(el('div', { class: 'storage-card__head' }, {
    children: [
      el('span', {}, { children: ['📊 استفاده محلی'] }),
      el('span', { class: 'storage-card__value' }, { children: [formatBytes(used, 1) + ' از ' + formatBytes(STORAGE_QUOTA_BYTES, 0)] }),
    ],
  }));
  const bar = el('div', { class: 'storage-card__bar' });
  bar.appendChild(el('div', { class: 'storage-card__fill', style: { width: pct + '%' } }));
  storageCard.appendChild(bar);
  body.appendChild(storageCard);

  /* Export */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['خروجی گرفتن'] }));
  const exportRow = el('div', { class: 'settings-actions' });

  exportRow.appendChild(actionBtn({
    icon: '📦', label: 'JSON (کامل)', desc: 'همه‌چیز در یک فایل',
    onClick: async (btn) => {
      setButtonLoading(btn, true, 'آماده‌سازی…');
      try {
        await exportService.exportJSON();
        toast.success('فایل دانلود شد.');
      } catch (err) { toast.error(err.message); }
      finally { setButtonLoading(btn, false); }
    },
  }));

  exportRow.appendChild(actionBtn({
    icon: '📄', label: 'CSV', desc: 'مناسب اکسل',
    onClick: async (btn) => {
      setButtonLoading(btn, true, 'آماده‌سازی…');
      try { await exportService.exportLiesCSV(); toast.success('CSV دانلود شد.'); }
      catch (err) { toast.error(err.message); }
      finally { setButtonLoading(btn, false); }
    },
  }));

  exportRow.appendChild(actionBtn({
    icon: '📝', label: 'Markdown', desc: 'متن قابل خواندن',
    onClick: async (btn) => {
      setButtonLoading(btn, true, 'آماده‌سازی…');
      try { await exportService.exportMarkdown(); toast.success('Markdown دانلود شد.'); }
      catch (err) { toast.error(err.message); }
      finally { setButtonLoading(btn, false); }
    },
  }));

  body.appendChild(exportRow);

  /* Import */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['بازیابی از فایل'] }));
  const importCard = el('div', { class: 'import-card' });
  importCard.appendChild(el('p', { class: 'import-card__hint' }, {
    children: ['فایل JSON که قبلاً خروجی گرفته‌ای را انتخاب کن. می‌توانی حالت «ادغام» یا «جایگزینی» را انتخاب کنی.'],
  }));

  const importRow = el('div', { class: 'import-card__row' });
  const modeSelect = el('select', { class: 'select' });
  modeSelect.appendChild(el('option', { attrs: { value: 'merge' } }, { children: ['ادغام با داده‌های موجود'] }));
  modeSelect.appendChild(el('option', { attrs: { value: 'replace' } }, { children: ['⚠️ جایگزینی کامل'] }));
  importRow.appendChild(modeSelect);

  const fileInput = el('input', { attrs: { type: 'file', accept: '.json,application/json' }, style: { display: 'none' } });
  importCard.appendChild(fileInput);

  const pickBtn = el('button', {
    class: 'btn btn--primary',
    attrs: { type: 'button' },
  }, { children: ['📁 انتخاب فایل و بازیابی'] });
  pickBtn.addEventListener('click', () => fileInput.click());
  importRow.appendChild(pickBtn);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const mode = modeSelect.value;

    if (mode === 'replace') {
      const ok = await confirm({
        title: 'جایگزینی کامل',
        message: 'همهٔ داده‌های فعلی پاک و داده‌های فایل جایگزین می‌شوند. مطمئنی؟',
        confirmLabel: 'بله، جایگزین کن',
        variant: 'danger',
        requireTyping: 'جایگزین',
      });
      if (!ok) { fileInput.value = ''; return; }
    }

    try {
      const result = await toastPromise(
        exportService.importJSON(file, { mode }),
        {
          loading: 'در حال بازیابی…',
          success: (r) => `${toFa(r.categories)} دسته، ${toFa(r.tags)} برچسب، ${toFa(r.lies)} دروغ بازیابی شد.`,
          error: (e) => e.message || 'خطا در بازیابی',
        }
      );
      fileInput.value = '';
    } catch { /* handled */ }
  });

  importCard.appendChild(importRow);
  body.appendChild(importCard);

  section.appendChild(body);
  return section;
}

function actionBtn({ icon, label, desc, onClick }) {
  const btn = el('button', {
    class: 'settings-action',
    attrs: { type: 'button' },
  });
  btn.appendChild(el('span', { class: 'settings-action__icon' }, { children: [icon] }));
  const txt = el('div', { class: 'settings-action__text' });
  txt.appendChild(el('span', { class: 'settings-action__label' }, { children: [label] }));
  if (desc) txt.appendChild(el('span', { class: 'settings-action__desc' }, { children: [desc] }));
  btn.appendChild(txt);
  btn.addEventListener('click', () => onClick(btn));
  return btn;
}

function toFa(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export default { dataSection };