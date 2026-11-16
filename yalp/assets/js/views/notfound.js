/**
 * بازاربان — ۴۰۴
 * ---------------------------------------------------------------------------
 * مسیرهای ناشناخته را با یک پیشنهاد مفید برمی‌گرداند، نه با بن‌بست.
 */

import { icon } from '../icons.js';
import { CONFIG } from '../config.js';
import { esc, toFa } from '../utils.js';
import * as store from '../store.js';
import { entityCard } from '../ui.js';

export const notFoundView = {
  title: 'صفحه پیدا نشد',
  render(ctx) {
    const top = store.leaderboard('vendor', { limit: 3, minTotal: 1 });

    return `<div class="container page">
      <div class="notfound">
        <div class="notfound__code">۴۰۴</div>
        <h1 class="notfound__title">این قفسه خالی است</h1>
        <p class="notfound__text">
          آدرس <span class="mono t-faint" style="font-size:11px">${esc(ctx?.path || '')}</span> به هیچ صفحه‌ای
          نمی‌رسد. شاید جابه‌جا شده یا اشتباه تایپ شده باشد.
        </p>
        <div class="cluster" style="justify-content:center;margin-top:var(--sp-4)">
          <a class="btn btn--primary" href="#/" data-link>${icon('home', 16)} خانه</a>
          <a class="btn btn--outline" href="#/vendors" data-link>${icon('store', 16)} فروشنده‌ها</a>
          <a class="btn btn--ghost" href="#/search" data-link>${icon('search', 16)} جست‌وجو</a>
        </div>
      </div>

      ${
        top.length
          ? `<section class="section section--tight">
              <div class="row row--between mb-6">
                <h2 style="font-size:var(--fs-lg)">${icon('crown', 16)} شاید یکی از این‌ها را می‌خواستی</h2>
                <span class="t-faint" style="font-size:var(--fs-2xs)">${toFa(store.globalStats().vendors)} فروشنده ثبت‌شده</span>
              </div>
              <div class="grid grid--3">${top.map(({ entity }) => entityCard('vendor', entity)).join('')}</div>
            </section>`
          : ''
      }
    </div>`;
  },
};
