/**
 * بازاربان — درباره
 */

import { icon } from '../icons.js';
import { CONFIG } from '../config.js';
import { esc, toFa } from '../utils.js';
import * as store from '../store.js';
import { breadcrumbs, pageHead, setupReveal } from '../ui.js';
import { modeBanner } from './home.js';

export const aboutView = {
  title: 'درباره',
  render() {
    const stats = store.globalStats();
    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'درباره' }])}
        ${pageHead({ eyebrow: 'بازاربان', title: 'حافظهٔ جمعی خرید' })}

        <div class="prose">
          <p>
            بازاربان جای سفارش نیست؛ جای یادداشت تجربه است. فروشنده، شعبه و محصول را ببین،
            در سه سطح امتیاز بده و بنویس چه شد.
          </p>
          <p>
            ${toFa(stats.vendors)} فروشنده · ${toFa(stats.shops)} شعبه · ${toFa(stats.products)} محصول ·
            ${toFa(stats.ratings)} امتیاز
          </p>

          <div class="grid grid--3" style="margin-block:var(--sp-6)">
            ${[
              { icon: 'shield', title: 'بدون تبلیغ', text: 'ترتیب فقط از داده می‌آید.' },
              { icon: 'building', title: 'شعبه مهم است', text: 'هر شعبه امتیاز جدا دارد.' },
              { icon: 'lock', title: 'حداقل داده', text: 'فقط یک ورود لازم است.' },
            ]
              .map(
                (item) => `<article class="card card--pad">
                  <span class="step__icon">${icon(item.icon, 17)}</span>
                  <h3 style="font-size:var(--fs-sm);margin-block:var(--sp-2) 4px">${esc(item.title)}</h3>
                  <p class="hint" style="font-size:10px">${esc(item.text)}</p>
                </article>`,
              )
              .join('')}
          </div>

          <h2 id="data">داده‌ها</h2>
          <p>
            داده‌ها روی پروژهٔ Supabase شما و در جدول‌های <code>${CONFIG.PREFIX}</code> نگهداری می‌شوند.
            احراز هویت با همان سیستم موجود انجام می‌شود.
          </p>
        </div>
      </div>
    </div>`;
  },
  mount() {
    setupReveal();
  },
};
