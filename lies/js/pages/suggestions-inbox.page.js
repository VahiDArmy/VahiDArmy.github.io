/* ============================================================
   js/pages/suggestions-inbox.page.js
   COMPLETE FILE - NO TRUNCATION.
   Inbox for the user to see and accept/reject suggestions.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as suggestionsService from '../services/suggestions.service.js';
import { toast } from '../ui/toast.js';
import { formatRelative } from '../utils/format.js';
import { emptyState } from '../ui/empty-state.js';
import { openLieEditor } from '../features/lies/lie-editor.js';
import { confirm } from '../ui/confirm.js';

export async function renderSuggestionsInbox(container) {
  clear(container);
  
  const page = el('div', { class: 'page page--suggestions' });
  
  const head = el('header', { class: 'page-head' });
  head.appendChild(el('h1', { class: 'page-title' }, { children: [el('span', { class: 'page-title__icon' }, { children: ['📥'] }), 'پیشنهادهای دیگران'] }));
  page.appendChild(head);

  const listHost = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' } });
  page.appendChild(listHost);
  
  container.appendChild(page);

  const loadData = async () => {
    clear(listHost);
    listHost.appendChild(el('div', { class: 'spinner' }));
    
    try {
      const items = await suggestionsService.getPending();
      clear(listHost);

      if (!items.length) {
        listHost.appendChild(emptyState({
          icon: '📭', title: 'صندوق خالی است', 
          message: 'هنوز کسی پیشنهادی برای شما نفرستاده است. می‌توانید لینک اختصاصی خود را با دوستانتان به اشتراک بگذارید.'
        }));
        return;
      }

      for (const item of items) {
        const card = el('div', { class: 'card', style: { padding: '20px' } });
        
        const header = el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' } });
        header.appendChild(el('strong', { style: { color: 'var(--accent-300)' } }, { children: [item.suggesterName || 'یک دوست ناشناس'] }));
        header.appendChild(el('span', { style: { fontSize: '12px', color: 'var(--text-tertiary)' } }, { children: [formatRelative(item.createdAt)] }));
        card.appendChild(header);
        
        card.appendChild(el('p', { style: { fontSize: '16px', lineHeight: '1.7', color: 'var(--text-primary)' } }, { children: [item.suggestedText] }));
        
        const actions = el('div', { style: { display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' } });
        
        const rejectBtn = el('button', { class: 'btn btn--ghost btn--sm' }, { children: ['رد کردن'] });
        rejectBtn.addEventListener('click', async () => {
          if (await confirm({ title: 'رد پیشنهاد', message: 'این پیشنهاد حذف شود؟' })) {
            await suggestionsService.rejectSuggestion(item.id);
            loadData();
          }
        });
        actions.appendChild(rejectBtn);
        
        const acceptBtn = el('button', { class: 'btn btn--primary btn--sm' }, { children: ['افزودن به دروغ‌ها'] });
        acceptBtn.addEventListener('click', () => {
          // Open Lie Editor with pre-filled title
          openLieEditor({ title: item.suggestedText, body: `پیشنهاد از طرف: ${item.suggesterName || 'ناشناس'}` }, {
            onSaved: async () => {
              await suggestionsService.acceptSuggestion(item.id);
              loadData();
            }
          });
        });
        actions.appendChild(acceptBtn);
        
        card.appendChild(actions);
        listHost.appendChild(card);
      }
    } catch (err) {
      clear(listHost);
      listHost.appendChild(el('div', { class: 'page-error' }, { children: [err.message] }));
    }
  };

  loadData();
}