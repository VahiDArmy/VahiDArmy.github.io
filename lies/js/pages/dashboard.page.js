/* ============================================================
   js/pages/dashboard.page.js
   APPROACH: Fully stripped down. No Intl, no complex CSS, 
   just plain text and standard Date methods to ensure 
   it NEVER shows 'undefined'.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { sessionStore } from '../core/store.js';
import * as statsService from '../services/stats.service.js';
import { toFaDigits } from '../utils/format.js';

export async function renderDashboard(container) {
  clear(container);

  const user = sessionStore.get('user');
  const profile = sessionStore.get('profile');
  const name = profile?.display_name || user?.email?.split('@')[0] || 'کاربر';

  let stats = { active: 0, reflections: 0 };
  try {
    stats = await statsService.overview();
  } catch (err) {
    console.warn('Could not load stats', err);
  }

  // 🛡️ SIMPLE HARDCODED DATE (No Intl, No Undefined)
  const now = new Date();
  const months = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
  const dateStr = `${toFaDigits(now.getDate())} ${months[now.getMonth()]} ${toFaDigits(now.getFullYear())}`;

  const page = el('div', { class: 'page page--dashboard', style: { padding: '24px', maxWidth: '800px', margin: '0 auto' } });

  const hero = el('div', { 
    class: 'card', 
    style: { 
      background: 'linear-gradient(135deg, rgba(124,92,255,0.1), transparent)',
      border: '1px solid var(--border)',
      padding: '32px 24px',
      borderRadius: '16px',
      marginBottom: '24px'
    } 
  });

  hero.appendChild(el('h2', { style: { color: 'var(--accent-200)', fontSize: '20px', marginBottom: '8px' } }, {
    children: [`صبح بخیر، ${name} 👋`]
  }));
  
  hero.appendChild(el('h1', { style: { fontSize: '32px', fontWeight: '900', marginBottom: '16px' } }, {
    children: ['آینهٔ درون']
  }));
  
  hero.appendChild(el('p', { style: { color: 'var(--text-secondary)', lineHeight: '1.8' } }, {
    children: ['این فضای خصوصی شماست. هیچ‌کس جز خودتان به اینجا دسترسی ندارد. امروز چه دروغی را می‌خواهی با آن روبه‌رو شوی؟']
  }));

  hero.appendChild(el('div', { style: { marginTop: '24px', display: 'inline-block', padding: '6px 16px', background: 'var(--bg-surface-2)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-tertiary)' } }, {
    children: [`🗓 ${dateStr}`]
  }));

  page.appendChild(hero);

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } });
  
  const mkStat = (label, val) => el('div', {
    style: { background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }
  }, { children: [
    el('div', { style: { fontSize: '28px', fontWeight: '800', color: 'var(--accent)' } }, { children: [toFaDigits(val)] }),
    el('div', { style: { fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' } }, { children: [label] })
  ]});

  grid.appendChild(mkStat('دروغ‌های فعال', stats.active || 0));
  grid.appendChild(mkStat('بازتاب‌ها', stats.reflections || 0));

  page.appendChild(grid);

  const btn = el('button', { class: 'btn btn--primary btn--block btn--lg', style: { marginTop: '32px' } }, { children: ['＋ ثبت دروغ جدید'] });
  btn.addEventListener('click', () => { location.hash = '#/lies?new=1'; });
  page.appendChild(btn);

  container.appendChild(page);
}

export default { renderDashboard };