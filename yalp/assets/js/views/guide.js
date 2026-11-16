/**
 * بازاربان — راهنما
 * ---------------------------------------------------------------------------
 * قواعد امتیازدهی، معنی سه سطح، قانون «انتخاب به‌جای ساخت»، حریم خصوصی و
 * راه‌اندازی جدول‌های Supabase.
 */

import { icon } from '../icons.js';
import { LEVELS, CONFIG } from '../config.js';
import { esc, toFa } from '../utils.js';
import * as store from '../store.js';
import { breadcrumbs, pageHead, setupReveal, levelChip } from '../ui.js';
import { levelScale } from '../charts.js';
import { modeBanner } from './home.js';

const FAQ = [
  {
    q: 'چرا فقط سه سطح؟ ستاره که دقیق‌تر است.',
    a: 'در عمل، ستاره‌های پنج‌تایی به «همه چهار می‌دهند» تبدیل می‌شوند. سه سطح تصمیم را ساده می‌کند: اگر دوستت پرسید «از این‌جا بخرم؟»، جوابت کدام است؟ خوب، نه‌خوب یا افتضاح. همین کافی است.',
  },
  {
    q: 'اگر تجربه‌ام بین دو سطح بود چه؟',
    a: 'سطح نزدیک‌تر را انتخاب کن و در متن نقد دقیق بنویس چه چیزی خوب بود و چه چیزی نه. جزئیات متن از خود سطح مهم‌تر است.',
  },
  {
    q: 'می‌توانم بعداً امتیازم را عوض کنم؟',
    a: 'بله. هر امتیاز به حساب تو گره خورده است. کافی است دوباره روی سطح جدید بزنی؛ امتیاز قبلی جایگزین می‌شود و رأی تکراری ساخته نمی‌شود.',
  },
  {
    q: 'چرا باید از فهرست انتخاب کنم و خودم نسازم؟',
    a: 'چون اگر هر کس نام دلخواه خودش را بسازد، امتیازها بین چند رکورد پخش می‌شوند. مثال کلاسیک: «اسنپ» و «اسنپ‌فود» که در عمل یک سرویس‌اند. انتخاب از فهرست باعث می‌شود تصویر کلی واقعی‌تر باشد.',
  },
  {
    q: 'آیا بازاربان فروشنده است یا سفارش می‌گیرد؟',
    a: 'نه. بازاربان فقط دفترچهٔ تجربه است. هیچ سفارشی ثبت نمی‌شود، هیچ کمیسیونی گرفته نمی‌شود و هیچ فروشنده‌ای نمی‌تواند امتیاز بخرد.',
  },
  {
    q: 'نقد توهین‌آمیز یا تبلیغاتی را چه کنم؟',
    a: 'از دکمهٔ «گزارش» استفاده کن. نقدهای گزارش‌شده در صف بررسی قرار می‌گیرند و در صورت تخلف پنهان می‌شوند.',
  },
];

export const guideView = {
  title: 'راهنما',
  render() {
    const stats = store.globalStats();
    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'راهنما' }])}
        ${pageHead({
          eyebrow: 'قواعد بازی',
          title: 'راهنمای بازاربان',
          sub: 'چطور امتیاز بدهیم، چرا سه سطح، و چطور از تکرار موجودیت‌ها جلوگیری کنیم.',
          actions: `<a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 15)} ثبت تجربه</a>`,
        })}

        <div class="guide-layout">
          <nav class="guide-nav" aria-label="فهرست راهنما">
            <a class="guide-nav__link" href="#/guide#levels" data-link>سه سطح امتیاز</a>
            <a class="guide-nav__link" href="#/guide#score" data-link>شاخص رضایت</a>
            <a class="guide-nav__link" href="#/guide#pickup" data-link>انتخاب به‌جای ساخت</a>
            <a class="guide-nav__link" href="#/guide#write" data-link>نقد خوب</a>
            <a class="guide-nav__link" href="#/guide#faq" data-link>پرسش‌های رایج</a>
            <a class="guide-nav__link" href="#/guide#data" data-link>راه‌اندازی داده</a>
          </nav>

          <div class="prose">
            <section id="levels">
              <h2 class="anchor-heading">سه سطح امتیاز <a class="anchor-heading__link" href="#/guide#levels" data-link>#</a></h2>
              <p>
                هر موجودیت — فروشنده، فروشگاه و محصول — دقیقاً سه نوع رأی می‌گیرد. این سه سطح، وزن‌های
                متفاوتی در شاخص رضایت دارند و هیچ‌کدام «صفر» نیستند؛ چون سکوت هم یک پیام است.
              </p>
              <div class="level-legend" style="margin-block:var(--sp-6)">
                ${LEVELS.map(
                  (level) => `<article class="level-card level-card--${level.className}">
                    <span class="level-card__icon">${icon(level.icon, 22)}</span>
                    <h3 class="level-card__title">${esc(level.label)}</h3>
                    <p class="level-card__text">${esc(level.hint)}</p>
                    <span class="level-card__weight">${icon('info', 12)} ${esc(level.explanation)}</span>
                  </article>`,
                ).join('')}
              </div>
              <div>${levelScale()}</div>
              <p class="hint">
                هیچ سطحی «وزن دو برابر» ندارد؛ اما در محاسبه، «خوب» با ۵، «نه‌خوب» با ۳ و «افتضاح» با ۱
                امتیاز نمایشی سنجیده می‌شود تا میانگین سه‌سطحی هم داشته باشیم.
              </p>
            </section>

            <section id="score">
              <h2 class="anchor-heading">شاخص رضایت چطور حساب می‌شود؟ <a class="anchor-heading__link" href="#/guide#score" data-link>#</a></h2>
              <p>
                عدد کنار هر فروشنده، «شاخص رضایت» است؛ بین <b>-۱۰۰</b> تا <b>+۱۰۰</b>. فرمول ساده است:
              </p>
              <div class="score-formula">
                <b>score</b> = ( (good − bad) / total ) × 100
              </div>
              <ul>
                <li><b>+۳۰ و بالاتر:</b> عمدتاً خوب — بیشتر خریداران راضی بوده‌اند.</li>
                <li><b>بین -۲۰ و +۳۰:</b> نه‌خوب یا دوقطبی — نظرها یکدست نیست؛ نقدها را بخوان.</li>
                <li><b>-۲۰ و پایین‌تر:</b> عمدتاً افتضاح — بیشتر تجربه‌ها منفی بوده است.</li>
                <li><b>بدون رأی:</b> هیچ قضاوتی نمی‌کنیم؛ نه خوب، نه بد.</li>
              </ul>
              <blockquote>
                تعداد رأی مهم است. یک فروشنده با ۳ رأی و شاخص ۱۰۰، قابل مقایسه با فروشنده‌ای با ۴۰ رأی و شاخص ۷۰
                نیست. همیشه ستون «تعداد رأی» را هم ببین.
              </blockquote>
            </section>

            <section id="pickup">
              <h2 class="anchor-heading">انتخاب به‌جای ساخت <a class="anchor-heading__link" href="#/guide#pickup" data-link>#</a></h2>
              <p>
                بزرگ‌ترین دشمن یک دفترچهٔ نقد، رکوردهای تکراری است. اگر «اسنپ فود»، «اسنپ‌فود» و
                «Snappfood» سه رکورد جدا باشند، هیچ‌کدام تصویر کامل را نشان نمی‌دهند. به همین دلیل
                مسیر اصلی <b>ثبت تجربه</b> این است:
              </p>
              <ul>
                <li>نوع را انتخاب کن: فروشنده، فروشگاه یا محصول.</li>
                <li>در فهرست جست‌وجو کن و <b>همان مورد موجود</b> را انتخاب کن.</li>
                <li>فقط اگر مطمئنی وجود ندارد، «ساخت مورد جدید» را بزن.</li>
              </ul>
              <p>
                فروشگاه و محصول همیشه به یک فروشنده وصل‌اند. شعبهٔ «پونک» بدون برند معنا ندارد و
                محصول «شیر ۱ لیتری» بدون فروشنده قابل مقایسه نیست. به همین دلیل هنگام ساخت شعبه یا
                محصول، اول فروشنده را انتخاب می‌کنی.
              </p>
              <div class="callout callout--good">
                <span class="callout__icon">${icon('lightbulb', 14)}</span>
                <div>
                  <div class="callout__title">تفاوت فروشنده و فروشگاه</div>
                  <b>فروشنده</b> برند یا پلتفرم است (اسنپ‌فود، افق کوروش). <b>فروشگاه</b> شعبهٔ مشخص با آدرس،
                  ساعات کاری و خدمات خودش است. دو شعبه از یک برند می‌توانند تجربهٔ کاملاً متفاوتی بدهند؛
                  به همین دلیل امتیازشان جداست.
                </div>
              </div>
            </section>

            <section id="write">
              <h2 class="anchor-heading">نقد خوب چه شکلی است؟ <a class="anchor-heading__link" href="#/guide#write" data-link>#</a></h2>
              <p>سه چیز را در نقد بنویس تا برای نفر بعدی واقعاً مفید باشد:</p>
              <ul>
                <li><b>چه سفارش دادی:</b> مثلاً «سبد هفتگی شامل لبنیات و میوه».</li>
                <li><b>چه شد:</b> زمان تحویل، وضع بسته‌بندی، تاریخ انقضا، رفتار پشتیبانی.</li>
                <li><b>چه نتیجه‌ای گرفتی:</b> «دفعهٔ بعد از شعبهٔ دیگر سفارش می‌دهم» یا «دوباره می‌خرم».</li>
              </ul>
              <p>
                از توهین، اطلاعات شخصی و ادعاهای بدون جزئیات پرهیز کن. اگر تجربه‌ات مربوط به یک شعبهٔ
                خاص است، نقد را روی همان شعبه بنویس، نه روی کل برند.
              </p>
              <div class="callout callout--bad">
                <span class="callout__icon">${icon('alert-triangle', 14)}</span>
                <div>
                  <div class="callout__title">این‌ها را ننویس</div>
                  شمارهٔ تماس افراد، آدرس خانه، تهمت، یا متن کپی‌شده از جای دیگر. چنین نقدهایی گزارش و پنهان می‌شوند.
                </div>
              </div>
            </section>

            <section id="faq">
              <h2 class="anchor-heading">پرسش‌های رایج <a class="anchor-heading__link" href="#/guide#faq" data-link>#</a></h2>
              <div class="stack stack--sm">
                ${FAQ.map(
                  (item, index) => `<details class="filter-card" ${index === 0 ? 'open' : ''} style="padding:var(--sp-5) var(--sp-6)">
                    <summary style="cursor:pointer;font-weight:600;font-size:var(--fs-sm);color:var(--text-strong)">
                      ${esc(item.q)}
                    </summary>
                    <p style="margin-top:var(--sp-3);font-size:var(--fs-xs);line-height:1.95;color:var(--text-mute)">${esc(
                      item.a,
                    )}</p>
                  </details>`,
                ).join('')}
              </div>
            </section>

            <section id="data">
              <h2 class="anchor-heading">داده‌ها کجا ذخیره می‌شوند؟ <a class="anchor-heading__link" href="#/guide#data" data-link>#</a></h2>
              <p>
                بازاربان از همان پروژهٔ Supabase شما استفاده می‌کند و همهٔ جدول‌هایش پیشوند اختصاصی
                <code>${CONFIG.PREFIX}</code> دارند تا با جدول‌های موجود شما — مثل
                <code>tafsirs</code>، <code>comments</code> یا <code>cinema_titles</code> — تداخلی نداشته باشد.
              </p>
              <ul>
                <li><code>smr_vendors</code> — فروشنده‌ها (برند/پلتفرم)</li>
                <li><code>smr_shops</code> — شعبه‌های هر فروشنده</li>
                <li><code>smr_products</code> — محصولات و اتصال اختیاری به شعبه</li>
                <li><code>smr_comments</code> — نقدها برای هر سه نوع موجودیت</li>
                <li><code>smr_ratings</code> — امتیاز سه‌سطحی، یک رأی برای هر کاربر در هر موجودیت</li>
                <li><code>smr_comment_votes</code>، <code>smr_lists</code>، <code>smr_list_items</code>، <code>smr_reports</code>، <code>smr_activity</code>، <code>smr_profiles</code></li>
              </ul>
              <p>
                برای فعال‌کردن حالت واقعی، فایل <code>supabase/smr_schema.sql</code> را در SQL Editor
                پروژهٔ Supabase خود اجرا کن. تا وقتی جدول‌ها ساخته نشده‌اند، برنامه در «حالت نمایشی»
                با دادهٔ محلی کار می‌کند تا بتوانی رابط را ببینی.
              </p>
              <p class="hint">
                وضعیت فعلی: ${store.getState().mode === 'live' ? '<b class="t-good">متصل به Supabase</b>' : '<b class="t-meh">حالت نمایشی</b>'}
                ${store.getState().modeDetail ? ` — ${esc(store.getState().modeDetail)}` : ''}
              </p>
              <p class="hint">
                امنیت با RLS انجام می‌شود: خواندن عمومی، نوشتن محدود به کاربر واردشده، و حذف فقط برای
                نویسندهٔ همان ردیف. کلید به‌کاررفته در برنامه از نوع publishable است؛ کلید
                <code>service_role</code> هرگز نباید در مرورگر قرار بگیرد.
              </p>
            </section>

            <div class="cta-band" style="margin-top:var(--sp-12)">
              <div class="cta-band__main">
                <h2 class="cta-band__title">حالا که قواعد را می‌دانی، یک تجربه ثبت کن</h2>
                <p class="cta-band__text">
                  بازاربان با ${toFa(stats.ratings)} رأی و ${toFa(stats.comments)} نقد زنده است. تجربهٔ تو
                  قطعهٔ بعدی این تصویر است.
                </p>
              </div>
              <div class="cta-band__actions">
                <a class="btn btn--primary btn--lg" href="#/new" data-link>${icon('plus', 17)} ثبت تجربه</a>
                <a class="btn btn--outline btn--lg" href="#/vendors" data-link>گشتن در بازار</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },
  mount() {
    setupReveal();
  },
};
