/**
 * بازاربان — درباره
 * ---------------------------------------------------------------------------
 * چه هستیم، چه نیستیم، چه اصلی را رعایت می‌کنیم و چطور ساخته شده‌ایم.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS } from '../config.js';
import { esc, toFa, formatJalali } from '../utils.js';
import * as store from '../store.js';
import { breadcrumbs, pageHead, setupReveal, brandBadge } from '../ui.js';
import { modeBanner } from './home.js';

const PRINCIPLES = [
  {
    icon: 'shield',
    title: 'بدون تبلیغ و بدون سفارش',
    text: 'هیچ فروشنده‌ای نمی‌تواند جای خودش را بخرد. ترتیب فهرست‌ها فقط از داده می‌آید، نه از بودجهٔ تبلیغات.',
  },
  {
    icon: 'users',
    title: 'تجربهٔ خریدار، نه روابط عمومی',
    text: 'هر نقد یک تجربهٔ شخصی است. بازاربان ادعای «حقیقت مطلق» ندارد و میانگین نظرها را نشان می‌دهد.',
  },
  {
    icon: 'layers',
    title: 'شعبه مهم‌تر از برند',
    text: 'دو شعبه از یک فروشنده یکسان نیستند. برای همین برای هر شعبه پرونده و امتیاز جدا داریم.',
  },
  {
    icon: 'search',
    title: 'انتخاب به‌جای ساخت',
    text: 'برای جلوگیری از رکوردهای تکراری، مسیر اصلی ثبت تجربه انتخاب از فهرست است؛ ساخت فقط وقتی که لازم باشد.',
  },
  {
    icon: 'lock',
    title: 'حداقل دادهٔ شخصی',
    text: 'برای ثبت تجربه فقط یک ورود لازم است. هیچ شمارهٔ تماس، آدرس یا اطلاعات پرداختی از تو نمی‌خواهیم.',
  },
  {
    icon: 'sparkles',
    title: 'سه سطح، نه سی و دو فیلتر',
    text: 'هرچه انتخاب ساده‌تر باشد، آدم بیشتری نقد می‌نویسد. سه سطح خوب، نه‌خوب، افتضاح کافی است.',
  },
];

export const aboutView = {
  title: 'درباره',
  render() {
    const stats = store.globalStats();
    const state = store.getState();
    return `<div class="page">
      ${modeBanner(state)}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'درباره' }])}
        ${pageHead({
          eyebrow: 'چرا بازاربان',
          title: 'حافظهٔ جمعی خرید',
          sub: 'این‌جا جای سفارش دادن نیست؛ جای یادداشت کردن است. یادداشت این‌که کجا خریدیم و کجا پشیمان شدیم.',
        })}

        <section class="cta-band" style="margin-bottom:var(--sp-12)">
          <div class="cta-band__main">
            <h2 class="cta-band__title">هر خرید، یک درس کوچک است.</h2>
            <p class="cta-band__text">
              بیشتر ما بعد از خرید بد، فقط یک چیز می‌گوییم: «دیگه از این‌جا نمی‌خرم». بعد شش ماه می‌گذرد،
              اسم فروشنده را فراموش می‌کنیم و دوباره همان‌جا خرید می‌کنیم. بازاربان برای همین ساخته شده:
              که این درس‌ها را عمومی و ماندگار کند.
            </p>
          </div>
          <div class="cta-band__actions">
            <a class="btn btn--primary btn--lg" href="#/new" data-link>${icon('plus', 17)} تجربه‌ات را ثبت کن</a>
            <a class="btn btn--outline btn--lg" href="#/guide" data-link>${icon('help', 17)} قواعد</a>
          </div>
        </section>

        <div class="stat-row mb-12" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          ${[
            { label: 'فروشنده', value: stats.vendors, icon: 'store' },
            { label: 'شعبه', value: stats.shops, icon: 'building' },
            { label: 'محصول', value: stats.products, icon: 'package' },
            { label: 'نقد', value: stats.comments, icon: 'message' },
            { label: 'امتیاز', value: stats.ratings, icon: 'star' },
            { label: 'خریدار', value: stats.contributors, icon: 'users' },
          ]
            .map(
              (stat) => `<div class="stat">
                <span class="stat__label">${icon(stat.icon, 12)} ${esc(stat.label)}</span>
                <span class="stat__value" data-count-to="${stat.value}">${toFa(stat.value)}</span>
              </div>`,
            )
            .join('')}
        </div>

        <section class="mb-12">
          <h2 class="section__title" style="margin-bottom:var(--sp-6)">شش اصلی که زیر پا نمی‌گذاریم</h2>
          <div class="grid grid--3">
            ${PRINCIPLES.map(
              (item) => `<article class="card card--pad card--hover">
                <span class="step__icon">${icon(item.icon, 19)}</span>
                <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-2)">${esc(item.title)}</h3>
                <p class="hint" style="line-height:1.9">${esc(item.text)}</p>
              </article>`,
            ).join('')}
          </div>
        </section>

        <div class="grid grid--2" style="align-items:start">
          <section id="data">
            <h2 class="section__title" style="font-size:var(--fs-2xl);margin-bottom:var(--sp-4)">دربارهٔ داده‌ها</h2>
            <div class="prose">
              <p>
                بازاربان یک <b>SPA استاتیک</b> است: HTML، CSS و JavaScript خالص، بدون بیلد، بدون سرور
                اختصاصی. داده‌ها روی پروژهٔ Supabase شما نگهداری می‌شوند و احراز هویت با همان سیستم
                موجود انجام می‌شود.
              </p>
              <p>
                همهٔ جدول‌های بازاربان پیشوند <code>${CONFIG.PREFIX}</code> دارند و هیچ‌کدام از جدول‌های
                موجود شما را تغییر نمی‌دهند. اگر جدول‌ها ساخته نشده باشند، برنامه در حالت نمایشی کار
                می‌کند و داده‌ها فقط در مرورگر می‌مانند.
              </p>
              <p>
                برای حذف داده‌هایت کافی است نقدها و امتیازهای خودت را از داشبورد پاک کنی. حذف حساب هم
                با حذف کاربر در Supabase انجام می‌شود و ردیف‌های وابسته با
                <code>on delete cascade</code> پاک می‌شوند.
              </p>
            </div>
          </section>

          <section>
            <h2 class="section__title" style="font-size:var(--fs-2xl);margin-bottom:var(--sp-4)">پشت صحنه</h2>
            <div class="card card--pad">
              <div class="row" style="gap:var(--sp-4);align-items:center;margin-bottom:var(--sp-5)">
                ${brandBadge('بازاربان', 152, 'lg')}
                <div>
                  <div style="font-weight:700">بازاربان ${esc(CONFIG.VERSION)}</div>
                  <div class="hint">RTL فارسی · بدون وابستگی فرانت‌اند</div>
                </div>
              </div>
              <div class="stack stack--sm">
                ${[
                  ['وضعیت داده', state.mode === 'live' ? 'متصل به Supabase' : 'حالت نمایشی محلی'],
                  ['ذخیره‌سازی', 'Supabase Postgres + RLS'],
                  ['احراز هویت', 'Supabase Auth (ایمیل/رمز و لینک ایمیل)'],
                  ['نمودارها', 'SVG دست‌ساز، بدون کتابخانه'],
                  ['فونت', 'وزیرمتن'],
                ]
                  .map(
                    ([key, value]) => `<div class="kv">
                      <span class="kv__k">${esc(key)}</span>
                      <span class="kv__v">${esc(value)}</span>
                    </div>`,
                  )
                  .join('')}
              </div>
              <div class="divider-text">سه سطح</div>
              <div class="chips-row">${LEVELS.map((level) => `<span class="chip chip--${level.className}">${esc(level.label)}</span>`).join('')}</div>
            </div>
          </section>
        </div>

        <section class="mt-12">
          <h2 class="section__title" style="font-size:var(--fs-2xl);margin-bottom:var(--sp-4)">آخرین حرف</h2>
          <div class="prose">
            <blockquote>
              بازاربان هیچ‌وقت جای تجربهٔ خودت را نمی‌گیرد. اگر امتیازی با تجربهٔ تو نمی‌خواند، همان را
              بنویس؛ تفاوت تجربه‌ها بخشی از ارزش این‌جاست. اما اگر یک الگوی تکرارشونده دیدی — مثلاً
              ده نفر از تأخیر یک شعبه گفته‌اند — به آن اعتماد کن و با چشم باز خرید کن.
            </blockquote>
            <p>
              این پروژه برای یادگرفتن و به‌اشتراک‌گذاشتن ساخته شده است. اگر ایده یا ایرادی داری، از
              همان صفحه «گزارش» استفاده کن؛ هر گزارش خوانده می‌شود.
            </p>
          </div>
        </section>
      </div>
    </div>`;
  },
  mount() {
    setupReveal();
  },
};
