/* ============================================================
   js/pages/dashboard.page.js
   FIXED: Removed Hero text. Simplified. Loading stats gracefully.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as statsService from '../services/stats.service.js';
import { toFaDigits } from '../utils/format.js';
import { getJalaliParts, getMonthName } from '../utils/jalali.js';

export async function renderDashboard(container) {
  clear(container);

  let stats = { active: 0, reflections: 0 };
  try {
    stats = await statsService.overview();
  } catch (err) {
    console.warn('Could not load stats', err);
  }

  // SHAMSI DATE
  const j = getJalaliParts(new Date());
  const monthName = getMonthName(j.month) || 'مهر';
  const dateStr = `${toFaDigits(j.day)} ${monthName} ${toFaDigits(j.year)}`;

  const page = el('div', { class: 'page page--dashboard', style: { padding: '24px', maxWidth: '800px', margin: '0 auto' } });

  // Header (very simple)
  const header = el('div', { style: { marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
  header.appendChild(el('h1', { style: { fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' } }, { children: ['داشبورد'] }));
  header.appendChild(el('div', { style: { padding: '6px 16px', background: 'var(--bg-surface-2)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-tertiary)' } }, {
    children: [dateStr]
  }));
  page.appendChild(header);

  // Stats Grid
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' } });
  
  const mkStat = (label, val) => el('div', {
    style: { background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }
  }, { children: [
    el('div', { style: { fontSize: '28px', fontWeight: '800', color: 'var(--accent)' } }, { children: [toFaDigits(val)] }),
    el('div', { style: { fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' } }, { children: [label] })
  ]});

  grid.appendChild(mkStat('دروغ‌های فعال', stats.active || 0));
  grid.appendChild(mkStat('بازتاب‌ها', stats.reflections || 0));
  page.appendChild(grid);

  // New Button
  const btn = el('button', { class: 'btn btn--primary btn--block btn--lg' }, { children: ['＋ ثبت دروغ جدید'] });
  btn.addEventListener('click', () => { location.hash = '#/lies?new=1'; });
  page.appendChild(btn);

  container.appendChild(page);
}

export default { renderDashboard };