/**
 * Bulk Edit Columns Modal
 * Allows selecting multiple columns and applying new properties to all of them.
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { createColumnProperties } from './column-properties.js';

export function openBulkEditColumns({ columns = [] } = {}) {
  return new Promise((resolve) => {
    if (!columns.length) {
      toast.warning('هیچ ستونی برای ویرایش وجود ندارد.');
      return resolve(null);
    }

    const selectedIds = new Set();
    const listWrap = el('div', { class: 'form-grid', style: { gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' } });
    
    const selectAllCb = el('input', { type: 'checkbox' });
    const propForm = createColumnProperties();

    function renderList() {
      listWrap.innerHTML = '';
      columns.forEach(col => {
        const cb = el('input', {
          type: 'checkbox',
          checked: selectedIds.has(col.id),
          on: {
            change: (e) => {
              if (e.target.checked) selectedIds.add(col.id);
              else selectedIds.delete(col.id);
              syncSelectAll();
            }
          }
        });
        
        listWrap.appendChild(el('label', { class: 'checkbox', style: { padding: '4px 0' } }, [
          cb, el('span', { class: 'checkbox__box' }),
          el('span', {}, [`${col.name} `, el('span', { style: { color: 'var(--text-tertiary)', fontSize: '11px' } }, [`(${col.type})`])])
        ]));
      });
    }

    function syncSelectAll() {
      selectAllCb.checked = selectedIds.size === columns.length && columns.length > 0;
    }

    selectAllCb.addEventListener('change', (e) => {
      if (e.target.checked) columns.forEach(c => selectedIds.add(c.id));
      else selectedIds.clear();
      renderList();
    });

    renderList();

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'checkbox', style: { fontWeight: 'bold' } }, [
          selectAllCb, el('span', { class: 'checkbox__box' }),
          el('span', {}, ['انتخاب همه ستون‌ها'])
        ])
      ]),
      el('div', { 
        style: { 
          border: '1px solid var(--border-default)', 
          borderRadius: 'var(--radius-md)', 
          padding: '12px' 
        } 
      }, [listWrap]),
      el('div', { style: { borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '8px' } }, [
        el('p', { class: 'form-help', style: { color: 'var(--warning-700)', marginBottom: '12px' } }, ['توجه: تغییر نوع داده ممکن است با داده‌های موجود در ردیف‌ها سازگار نباشد.']),
        propForm.node
      ])
    ]);

    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: {
        click: () => form.requestSubmit()
      }
    }, ['اعمال تغییرات']);

    const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => { handle.close(); resolve(null); } } }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (selectedIds.size === 0) {
        toast.warning('حداقل یک ستون را انتخاب کنید.');
        return;
      }
      
      submitBtn.classList.add('is-loading');
      handle.close();
      resolve({ ids: Array.from(selectedIds), props: propForm.getValue() });
    });

    const handle = openModal({
      title: 'ویرایش گروهی ستون‌ها',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'lg',
      onClose: () => resolve(null)
    });
  });
}

export default openBulkEditColumns;