/**
 * Claim Avatar Modal
 * Allows a user to search for their existing unlinked profile and link it.
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { peopleService } from '../services/people.service.js';
import { toast } from '../ui/toast.js';
import { initials } from '../utils/format.js';

export function openClaimAvatarModal() {
  return new Promise((resolve) => {
    const searchInput = el('input', {
      type: 'search',
      class: 'input',
      placeholder: 'نام خود را جستجو کنید...',
      autocomplete: 'off',
    });

    const resultsList = el('div', { class: 'recent-list', style: { marginTop: '12px', maxHeight: '300px', overflowY: 'auto' } });
    
    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['جستجوی نام']),
        searchInput,
      ]),
      resultsList
    ]);

    const handleSearch = async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      
      resultsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary)">در حال جستجو...</div>';
      
      try {
        const results = await peopleService.getUnlinked(q);
        resultsList.innerHTML = '';
        
        if (!results.length) {
          resultsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary)">فردی با این نام یافت نشد.</div>';
          return;
        }

        results.forEach(person => {
          const item = el('div', { class: 'recent-item', style: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between' } }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
              el('span', { class: 'avatar avatar--sm' }, [
                person.avatar_url ? el('img', { src: person.avatar_url }) : initials(person.full_name)
              ]),
              el('div', { class: 'recent-item__main' }, [
                el('div', { class: 'recent-item__title' }, [person.full_name]),
                el('div', { class: 'recent-item__meta' }, [person.job_title || 'بدون سمت']),
              ])
            ]),
            el('button', {
              type: 'button',
              class: 'btn btn--primary btn--sm',
              on: {
                click: async () => {
                  try {
                    await peopleService.linkAccount(person.id);
                    toast.success('پروفایل شما با موفقیت متصل شد.');
                    handle.close();
                    resolve(true);
                    window.location.reload(); // Reload to refresh data
                  } catch (err) {
                    toast.error(err?.message || 'خطا در اتصال پروفایل');
                  }
                }
              }
            }, ['این من هستم'])
          ]);
          resultsList.appendChild(item);
        });
      } catch (err) {
        resultsList.innerHTML = '';
        toast.error('خطا در جستجو');
      }
    };

    // Search on Enter key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    });

    // Also search on typing (debounced)
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleSearch, 500);
    });

    const handle = openModal({
      title: 'آواتار از قبل وجود دارد',
      subtitle: 'اگر شما قبلاً توسط ادمین در لیست اداره ثبت شده‌اید، نام خود را جستجو کرده و آن را به حساب کاربری خود متصل کنید.',
      body: form,
      footer: null,
      size: 'md',
      initialFocus: searchInput,
      onClose: () => resolve(false),
    });
  });
}