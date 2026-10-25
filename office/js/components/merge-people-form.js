/**
 * Merge People Modal (Admin Only)
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

export function openMergePeopleForm({ people = [] }) {
  return new Promise((resolve) => {
    const sourceSelect = el('select', { class: 'select' }, [
      el('option', { value: '' }, ['--- انتخاب کنید ---']),
      ...people.map(p => el('option', { value: p.id }, [`${p.full_name} (${p.user_id ? 'کاربر سایت' : 'بدون اکانت'})`]))
    ]);
    
    const targetSelect = el('select', { class: 'select' }, [
      el('option', { value: '' }, ['--- انتخاب کنید ---']),
      ...people.map(p => el('option', { value: p.id }, [`${p.full_name} (${p.user_id ? 'کاربر سایت' : 'بدون اکانت'})`]))
    ]);

    const form = el('form', { class: 'form-grid' }, [
      el('p', { class: 'form-help', style: { color: 'var(--danger-700)', marginBottom: '12px' } }, [
        'هشدار: این عملیات غیرقابل بازگشت است. تمام اطلاعات (نظریه‌ها، بگایی‌ها، جدول‌ها) از فرد مبدا به فرد مقصد منتقل شده و فرد مبدا حذف می‌شود.'
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['فرد مبدا (حذف خواهد شد)']),
        sourceSelect,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['فرد مقصد (باقی می‌ماند)']),
        targetSelect,
      ]),
    ]);

    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--danger',
      on: { click: () => form.requestSubmit() }
    }, ['ادغام و حذف مبدا']);

    const cancelBtn = el('button', {
      type: 'button',
      class: 'btn btn--secondary',
      on: { click: () => { handle.close(); resolve(null); } }
    }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (!sourceSelect.value || !targetSelect.value) {
        toast.warning('لطفاً هم فرد مبدا و هم فرد مقصد را انتخاب کنید.');
        return;
      }

      if (sourceSelect.value === targetSelect.value) {
        toast.warning('فرد مبدا و مقصد نمی‌توانند یکی باشند.');
        return;
      }
      
      handle.close();
      resolve({ sourceId: sourceSelect.value, targetId: targetSelect.value });
    });

    const handle = openModal({
      title: 'ادغام افراد',
      subtitle: 'دو پروفایل را به صورت کامل با هم ادغام کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
    });
  });
}