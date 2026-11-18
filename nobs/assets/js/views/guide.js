/**
 * بازاربان — راهنمای کوتاه
 */

import { icon } from '../icons.js';
import { LEVELS, CONFIG } from '../config.js';
import { esc, toFa } from '../utils.js';
import * as store from '../store.js';
import { breadcrumbs, pageHead, setupReveal } from '../ui.js';
import { modeBanner } from './home.js';

export const guideView = {
  title: 'راهنما',
  render() {
    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'راهنما' }])}
        ${pageHead({
          eyebrow: 'قواعد',
          title: 'راهنمای بازاربان',
          actions: `<a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 15)} ثبت تجربه</a>`,
        })}

        <div class="prose">
          <section id="levels">
            <h2 class="anchor-heading">سه سطح</h2>
            <div class="level-legend" style="margin-block:var(--sp-4)">
              ${LEVELS.map(
                (level) => `<article class="level-card level-card--${level.className}">
                  <span class="level-card__icon">${icon(level.icon, 22)}</span>
                  <h3 class="level-card__title">${esc(level.label)}</h3>
                  <p class="level-card__text">${esc(level.hint)}</p>
                </article>`,
              ).join('')}
            </div>
          </section>

          <section id="score">
            <h2 class="anchor-heading">شاخص رضایت</h2>
            <div class="score-formula">
              <b>score</b> = ( (good − bad) / total ) × 100
            </div>
            <p>بین ۱۰۰− و ۱۰۰+. تعداد رأی را هم ببین.</p>
          </section>

          <section id="pickup">
            <h2 class="anchor-heading">انتخاب، نه ساخت</h2>
            <ul>
              <li>اول در فهرست جست‌وجو کن و همان مورد را انتخاب کن.</li>
              <li>فقط اگر وجود ندارد، مورد جدید بساز.</li>
              <li>فروشگاه و محصول همیشه زیر یک فروشنده‌اند.</li>
            </ul>
          </section>

          <section id="data">
            <h2 class="anchor-heading">داده‌ها</h2>
            <p>
              همهٔ جدول‌ها با پیشوند <code>${CONFIG.PREFIX}</code> در Supabase ساخته می‌شوند و به جدول‌های
              دیگر دست نمی‌زنند. برای اتصال، فایل <code>supabase/smr_schema.sql</code> را در SQL Editor
              اجرا کن و صفحه را تازه کن.
            </p>
            <p class="hint">
              وضعیت: ${store.getState().mode === 'live' ? 'متصل به Supabase' : 'حالت محلی'} ·
              ${toFa(store.getState().vendors.length)} فروشنده
            </p>
          </section>
        </div>
      </div>
    </div>`;
  },
  mount() {
    setupReveal();
  },
};
