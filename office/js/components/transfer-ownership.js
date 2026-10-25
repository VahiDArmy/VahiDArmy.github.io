/**
 * Transfer Ownership Modal
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { profilesService } from '../services/profiles.service.js';

export function openTransferOwnership({ table, profiles = [] }) {
  return new Promise((resolve) => {
    const select = el('select', { class: 'select' },
      profiles.map(p => el('option', { value: p.id }, [p.display_name || p.id]))
    );

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['مالک جدید جدول را انتخاب کنید:']),
        select,
      ]),
    ]);

    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: { click: () => form.requestSubmit() }
    }, ['انتقال مالکیت']);

    const cancelBtn = el('button', {
      type: 'button',
      class: 'btn btn--secondary',
      on: { click: () => { handle.close(); resolve(null); } }
    }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handle.close();
      resolve(select.value);
    });

    const handle = openModal({
      title: 'انتقال مالکیت جدول',
      subtitle: `مالکیت جدول «${table.name}» را به کاربر دیگری منتقل می‌کنید.`,
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'sm',
    });
  });
}