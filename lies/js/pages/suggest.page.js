/* ============================================================
   js/pages/suggest.page.js
   COMPLETE FILE - NO TRUNCATION.
   FIXED: Made the page a fixed, scrollable overlay so it works
          regardless of the body's overflow:hidden setting.
          Used `margin: auto` for perfect vertical centering
          without cutting off content on small screens.
   ============================================================ */

import { el } from '../utils/dom.js';
import * as suggestionsService from '../services/suggestions.service.js';
import { toast } from '../ui/toast.js';
import { setButtonLoading } from '../ui/loader.js';

export function renderSuggestPage(container, token) {
  container.innerHTML = '';
  
  // 🛡️ FIX: Fixed, full-screen, scrollable container
  const page = el('div', { style: {
    position: 'fixed',
    inset: '0',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: 'var(--bg-base)',
    direction: 'rtl',
    fontFamily: 'Vazirmatn, sans-serif',
    display: 'flex',
    padding: '24px'
  }});

  // 🛡️ FIX: margin: auto centers it perfectly, but allows scrolling if it's taller than the screen
  const card = el('div', { style: {
    margin: 'auto',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative'
  }});

  card.appendChild(el('div', { style: { fontSize: '48px', textAlign: 'center', marginBottom: '-10px' } }, { children: ['🎭'] }));
  card.appendChild(el('h1', { style: { fontSize: '24px', fontWeight: '900', textAlign: 'center', color: 'var(--text-primary)' } }, {
    children: ['یک پیشنهاد ناشناس']
  }));
  
  card.appendChild(el('p', { style: { fontSize: '15px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.8' } }, {
    children: ['به نظر تو، من چه دروغی را درباره خودم به خودم می‌گویم؟ نوشته‌ی تو مستقیماً به صاحب این لینک ارسال می‌شود.']
  }));

  const form = el('form', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });

  // Name Field
  const nameField = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  nameField.appendChild(el('label', { style: { fontSize: '13px', color: 'var(--text-tertiary)' } }, { children: ['اسم شما (اختیاری)'] }));
  const nameInput = el('input', { class: 'input', attrs: { type: 'text', placeholder: 'مثلاً: یک دوست', maxlength: '50' } });
  nameField.appendChild(nameInput);
  form.appendChild(nameField);

  // Text Field
  const textField = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  textField.appendChild(el('label', { style: { fontSize: '13px', color: 'var(--text-tertiary)' } }, { children: ['متن پیشنهاد *'] }));
  const textInput = el('textarea', { class: 'textarea', attrs: { placeholder: 'مثلاً: به نظر من تو همیشه از قضاوت شدن می‌ترسی و وانمود می‌کنی مهم نیست...', rows: '4', maxlength: '1000', required: 'true' } });
  textField.appendChild(textInput);
  form.appendChild(textField);

  const submitBtn = el('button', { class: 'btn btn--primary btn--block btn--lg', attrs: { type: 'submit' } }, { children: ['ارسال پیشنهاد'] });
  form.appendChild(submitBtn);
  card.appendChild(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = textInput.value.trim();
    const name = nameInput.value.trim();

    if (text.length < 2) {
      toast.warning('متن پیشنهاد خیلی کوتاه است.');
      return;
    }

    setButtonLoading(submitBtn, true, 'در حال ارسال…');
    try {
      await suggestionsService.submitAnon(token, text, name);
      
      // Clear form and show success
      form.innerHTML = ''; 
      
      card.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', background: 'var(--success-soft)', borderRadius: '12px', color: 'var(--success)', fontWeight: 'bold' } }, {
        children: ['✅ پیشنهاد شما با موفقیت ارسال شد. متشکرم!']
      }));
      
    } catch (err) {
      toast.error(err.message || 'خطا در ارسال');
      setButtonLoading(submitBtn, false);
    }
  });

  page.appendChild(card);
  container.appendChild(page);
}