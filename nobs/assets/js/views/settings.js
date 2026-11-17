/* ==========================================================================
   settings.js — پروفایل، حساب، داده‌ها، میان‌برها و درباره
   ========================================================================== */

import { getState, subscribe, patchData } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import * as auth from '../lib/auth.js';
import { openModal, confirmDialog, toast, setBusy, openMenu } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { esc, faNum, fmtInt, downloadFile, toCSV, readFileText, copyText } from '../lib/utils.js';
import { CONFIG, TABLES } from '../lib/backend.js';
import { RATING_LIST } from '../lib/domain.js';
import { openReviewForm } from './reviewForm.js';
import { userAvatar, sectionHead, callout } from '../components/parts.js';
import { formatJalali } from '../lib/jalali.js';

const SHORTCUTS = [
  { keys: ['/'], label: 'فوکوس روی جست‌وجوی خانه' },
  { keys: ['Ctrl', 'K'], label: 'پالت دستورات' },
  { keys: ['N'], label: 'ثبت تجربه جدید' },
  { keys: ['G', 'H'], label: 'رفتن به خانه' },
  { keys: ['G', 'P'], label: 'رفتن به محصولات' },
  { keys: ['G', 'S'], label: 'رفتن به فروشگاه‌ها' },
  { keys: ['G', 'V'], label: 'رفتن به پلتفرم‌ها' },
  { keys: ['G', 'I'], label: 'رفتن به تحلیل‌ها' },
  { keys: ['G', 'L'], label: 'رفتن به لیست‌ها' },
  { keys: ['?'], label: 'همین راهنما' },
  { keys: ['Esc'], label: 'بستن پنجره‌ها' },
];

export function mount(container, ctx = {}) {
  container.innerHTML = `<div class="page__inner">
    <header class="page__head">
      <div class="page__head-text">
        <span class="eyebrow">تنظیمات</span>
        <h1 class="page__title">تنظیمات و داده‌ها</h1>
        <p class="page__sub">پروفایل، ابزارهای پشتیبان‌گیری و همه چیزهایی که برای مدیریت دفترچه تجربه لازم داری.</p>
      </div>
      <div class="page__actions">
        <button type="button" class="btn btn--primary" data-new-review>${icon('plus', 16)} ثبت خرید</button>
      </div>
    </header>
    <div data-settings></div>
  </div>`;

  const slot = container.querySelector('[data-settings]');

  function render() {
    const state = getState();
    const profile = state.data.profile || {};
    const counts = repo.dataCounts();

    slot.innerHTML = `
      ${state.mode === 'demo' ? callout({
        tone: 'info',
        title: 'در حالت نمایشی هستید',
        text: 'همه داده‌ها فقط در همین مرورگر ذخیره می‌شوند. برای استفاده واقعی با حساب Supabase خودتان وارد شوید.',
        actions: `<button type="button" class="btn btn--soft btn--sm" data-exit-demo>${icon('logout', 14)} خروج از حالت نمایشی</button>
          <button type="button" class="btn btn--ghost btn--sm" data-reset-demo>${icon('rotate-ccw', 14)} بازنشانی داده نمونه</button>`,
      }) : ''}

      <div class="settings-grid">
        <section class="card">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('user', 16)} پروفایل</div>
              <div class="card__sub">اسمی که در یادداشت‌ها و هدر نمایش داده می‌شود</div>
            </div>
            ${userAvatar(profile, 'lg')}
          </div>
          <div class="card__body">
            <form class="stack" data-profile-form>
              <div class="form-grid">
                <div class="field span-2">
                  <label class="field__label" for="pf-name">نام نمایشی</label>
                  <input class="input" id="pf-name" name="display_name" maxlength="60" value="${esc(profile.display_name || '')}" placeholder="مثلاً علی" />
                </div>
                <div class="field">
                  <label class="field__label" for="pf-city">شهر</label>
                  <input class="input" id="pf-city" name="city" maxlength="60" value="${esc(profile.city || '')}" placeholder="تهران" />
                </div>
                <div class="field">
                  <label class="field__label" for="pf-currency">واحد پول</label>
                  <select class="select" id="pf-currency" name="currency">
                    <option value="IRT" ${profile.currency !== 'IRR' ? 'selected' : ''}>تومان</option>
                    <option value="IRR" ${profile.currency === 'IRR' ? 'selected' : ''}>ریال</option>
                  </select>
                </div>
                <div class="field span-2">
                  <label class="field__label" for="pf-bio">درباره من</label>
                  <input class="input" id="pf-bio" name="bio" maxlength="280" value="${esc(profile.bio || '')}" placeholder="یک جمله کوتاه" />
                </div>
              </div>
              <div class="field">
                <label class="field__label">رنگ آواتار</label>
                <div class="u-row u-gap-3">
                  ${userAvatar(profile, 'lg')}
                  <input class="range" type="range" min="0" max="360" step="2" name="avatar_hue" value="${Number(profile.avatar_hue ?? 158)}" data-hue style="flex:1" />
                </div>
              </div>
              <div class="field">
                <label class="field__label">چگالی نمایش</label>
                <div class="segmented" data-density-seg>
                  <button type="button" class="segmented__btn ${profile.density !== 'compact' ? 'is-active' : ''}" data-density-choice="cozy">راحت</button>
                  <button type="button" class="segmented__btn ${profile.density === 'compact' ? 'is-active' : ''}" data-density-choice="compact">جمع‌وجور</button>
                </div>
              </div>
              <div class="btn-row">
                <button type="button" class="btn btn--primary" data-save-profile>${icon('save', 16)} ذخیره پروفایل</button>
              </div>
            </form>
          </div>
        </section>

        <div class="stack">
          <section class="card">
            <div class="card__head">
              <div>
                <div class="card__title">${icon('shield', 16)} حساب کاربری</div>
                <div class="card__sub">${state.mode === 'demo' ? 'حالت نمایشی' : 'متصل به Supabase'}</div>
              </div>
              <span class="badge ${state.mode === 'demo' ? 'badge--meh' : 'badge--good'}">${state.mode === 'demo' ? 'دمو' : 'متصل'}</span>
            </div>
            <div class="card__body stack stack--sm">
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">ایمیل</div>
                  <div class="setting-line__sub" dir="ltr" style="text-align:end">${esc(state.user?.email || '—')}</div>
                </div>
                ${icon('mail', 16)}
              </div>
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">شناسه کاربر</div>
                  <div class="setting-line__sub u-mono" style="direction:ltr;text-align:end">${esc((state.user?.id || '—').slice(0, 18))}…</div>
                </div>
                ${icon('key', 16)}
              </div>
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">آخرین بارگذاری داده</div>
                  <div class="setting-line__sub">${state.lastLoadedAt ? faNum(new Date(state.lastLoadedAt).toLocaleTimeString('fa-IR')) : '—'}</div>
                </div>
                <button type="button" class="icon-btn icon-btn--bordered" data-reload aria-label="به‌روزرسانی">${icon('refresh', 15)}</button>
              </div>
              <div class="btn-row u-mt-2">
                ${
                  state.mode === 'demo'
                    ? `<button type="button" class="btn btn--soft btn--sm" data-exit-demo>${icon('logout', 15)} ورود واقعی</button>`
                    : `<button type="button" class="btn btn--ghost btn--sm" data-sign-out>${icon('logout', 15)} خروج از حساب</button>
                       <button type="button" class="btn btn--ghost btn--sm" data-change-password>${icon('lock', 15)} تغییر رمز</button>`
                }
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card__head">
              <div>
                <div class="card__title">${icon('database', 16)} داده‌های من</div>
                <div class="card__sub">${faNum(counts.reviews)} تجربه · ${faNum(counts.products)} محصول · ${faNum(counts.shops)} فروشگاه · ${faNum(counts.vendors)} پلتفرم</div>
              </div>
            </div>
            <div class="card__body stack stack--sm">
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">پشتیبان کامل (JSON)</div>
                  <div class="setting-line__sub">همه موجودیت‌ها برای انتقال یا نگهداری</div>
                </div>
                <button type="button" class="btn btn--soft btn--sm" data-export-json>${icon('download', 14)} دانلود</button>
              </div>
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">جدول خریدها (CSV)</div>
                  <div class="setting-line__sub">مناسب اکسل و گوگل‌شیت</div>
                </div>
                <button type="button" class="btn btn--soft btn--sm" data-export-csv>${icon('file-spreadsheet', 14)} دانلود</button>
              </div>
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">بازیابی از فایل</div>
                  <div class="setting-line__sub">فایل JSON پشتیبان را انتخاب کنید</div>
                </div>
                <button type="button" class="btn btn--ghost btn--sm" data-import>${icon('upload', 14)} انتخاب فایل</button>
                <input type="file" accept="application/json" data-import-file hidden />
              </div>
              <div class="setting-line">
                <div class="setting-line__text">
                  <div class="setting-line__title">بارگذاری داده نمونه</div>
                  <div class="setting-line__sub">چند تجربه واقعی‌نما برای آشنایی با اپ</div>
                </div>
                <button type="button" class="btn btn--ghost btn--sm" data-seed>${icon('sparkles', 14)} بارگذاری</button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="settings-grid">
        <section class="card">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('command', 16)} میان‌برهای صفحه‌کلید</div>
              <div class="card__sub">برای کار سریع‌تر</div>
            </div>
          </div>
          <div class="card__body">
            <div class="shortcut-list">
              ${SHORTCUTS.map(
                (item) => `<div class="shortcut-item">
                  <span>${esc(item.label)}</span>
                  <span class="shortcut-keys">${item.keys.map((key) => `<kbd class="kbd">${esc(key)}</kbd>`).join('')}</span>
                </div>`,
              ).join('')}
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('info', 16)} درباره فروشگاه‌یار</div>
              <div class="card__sub">نسخه ۱.۰ · SPA بدون فریم‌ورک</div>
            </div>
          </div>
          <div class="card__body stack stack--sm">
            <div class="about-box">
              <p>فروشگاه‌یار دفترچه تجربه خرید آنلاین است: هر محصول را در ترکیب با فروشگاه و پلتفرم امتیاز می‌دهی و بعداً می‌دانی از کجا بخر و از کجا نخر.</p>
              <p><b>مدل داده:</b> محصول × فروشگاه × پلتفرم یک ترکیب یکتا برای هر کاربر است؛ یک بار امتیاز، همیشه قابل ویرایش.</p>
              <p><b>پیشوند جدول‌ها:</b> <span class="u-mono">smrv_</span> — کاملاً جدا از سایر جدول‌های پروژه.</p>
              <p><b>پروژه Supabase:</b> <span class="u-mono" dir="ltr">${esc(CONFIG.url.replace('https://', ''))}</span></p>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost btn--sm" data-copy-schema>${icon('copy', 14)} کپی اسکیمای SQL</button>
              <a class="btn btn--ghost btn--sm" href="${esc(CONFIG.sqlEditorUrl)}" target="_blank" rel="noopener">${icon('external', 14)} SQL Editor</a>
            </div>
          </div>
        </section>
      </div>

      <section class="card danger-zone">
        <div class="card__head" style="border-color:rgba(255,93,122,.18)">
          <div>
            <div class="card__title" style="color:#ff8fa2">${icon('alert', 16)} منطقه خطر</div>
            <div class="card__sub">این عملیات قابل بازگشت نیست</div>
          </div>
        </div>
        <div class="card__body">
          <div class="setting-line" style="border:0">
            <div class="setting-line__text">
              <div class="setting-line__title">پاک کردن همه داده‌ها</div>
              <div class="setting-line__sub">همه محصولات، فروشگاه‌ها، پلتفرم‌ها، تجربه‌ها، نظرها و لیست‌ها حذف می‌شوند. پروفایل باقی می‌ماند.</div>
            </div>
            <button type="button" class="btn btn--danger btn--sm" data-wipe>${icon('trash', 14)} پاک کن</button>
          </div>
        </div>
      </section>
    `;
  }

  /* ------------------------------- رویدادها ----------------------------- */

  container.addEventListener('input', (event) => {
    if (event.target.matches('[data-hue]')) {
      const avatarNode = container.querySelector('[data-profile-form] .avatar');
      if (avatarNode) {
        avatarNode.style.setProperty('--hue', event.target.value);
        avatarNode.style.color = `hsl(${event.target.value} 75% 74%)`;
      }
    }
  });

  container.addEventListener('click', async (event) => {
    const target = event.target;

    if (target.closest('[data-new-review]')) {
      openReviewForm({ onSaved: () => render() });
      return;
    }

    const densityBtn = target.closest('[data-density-choice]');
    if (densityBtn) {
      container
        .querySelectorAll('[data-density-choice]')
        .forEach((btn) => btn.classList.toggle('is-active', btn === densityBtn));
      document.documentElement.dataset.density = densityBtn.dataset.densityChoice;
      return;
    }

    if (target.closest('[data-save-profile]')) {
      const btn = target.closest('[data-save-profile]');
      const form = container.querySelector('[data-profile-form]');
      const density = container.querySelector('[data-density-choice].is-active')?.dataset.densityChoice || 'cozy';
      setBusy(btn, true);
      try {
        await repo.saveProfile({
          display_name: form.querySelector('[name="display_name"]').value,
          city: form.querySelector('[name="city"]').value,
          bio: form.querySelector('[name="bio"]').value,
          avatar_hue: Number(form.querySelector('[name="avatar_hue"]').value),
          currency: form.querySelector('[name="currency"]').value,
          density,
        });
        document.documentElement.dataset.density = density;
        toast.success('پروفایل ذخیره شد.');
        render();
        ctx.onProfileChange?.();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusy(btn, false);
      }
      return;
    }

    if (target.closest('[data-reload]')) {
      try {
        await repo.reload();
        toast.success('داده‌ها به‌روزرسانی شد.');
        render();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    if (target.closest('[data-export-json]')) {
      const payload = repo.exportAll();
      downloadFile(`forooshgahyar-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
      toast.success('پشتیبان دانلود شد.');
      return;
    }

    if (target.closest('[data-export-csv]')) {
      const state = getState();
      const index = new Map(state.data.products.map((p) => [p.id, p]));
      const shopMap = new Map(state.data.shops.map((s) => [s.id, s]));
      const vendorMap = new Map(state.data.vendors.map((v) => [v.id, v]));
      const rows = state.data.reviews.map((review) => ({
        product: index.get(review.product_id)?.name || '',
        shop: shopMap.get(review.shop_id)?.name || '',
        vendor: vendorMap.get(review.vendor_id)?.name || '',
        rating: RATING_LIST.find((r) => r.key === review.rating)?.label || review.rating,
        price: review.price ?? '',
        quantity: review.quantity,
        total: review.price ? Number(review.price) * Number(review.quantity || 1) : '',
        date: formatJalali(review.purchased_at, 'numeric'),
        tags: (review.tags || []).join(' | '),
        note: review.note || '',
      }));
      downloadFile(
        `forooshgahyar-reviews-${new Date().toISOString().slice(0, 10)}.csv`,
        toCSV(rows, [
          { key: 'product', label: 'محصول' },
          { key: 'shop', label: 'فروشگاه' },
          { key: 'vendor', label: 'پلتفرم' },
          { key: 'rating', label: 'امتیاز' },
          { key: 'price', label: 'قیمت واحد' },
          { key: 'quantity', label: 'تعداد' },
          { key: 'total', label: 'هزینه کل' },
          { key: 'date', label: 'تاریخ' },
          { key: 'tags', label: 'برچسب‌ها' },
          { key: 'note', label: 'یادداشت' },
        ]),
        'text/csv;charset=utf-8',
      );
      toast.success('فایل CSV دانلود شد.');
      return;
    }

    if (target.closest('[data-import]')) {
      container.querySelector('[data-import-file]')?.click();
      return;
    }

    if (target.closest('[data-seed]')) {
      const btn = target.closest('[data-seed]');
      setBusy(btn, true);
      try {
        await repo.importSampleIntoAccount();
        toast.success('داده نمونه اضافه شد.');
        render();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusy(btn, false);
      }
      return;
    }

    if (target.closest('[data-copy-schema]')) {
      try {
        const response = await fetch('supabase/schema.sql');
        const sql = await response.text();
        const ok = await copyText(sql);
        toast[ok ? 'success' : 'error'](ok ? 'اسکیمای SQL کپی شد.' : 'کپی نشد.');
      } catch {
        toast.error('فایل اسکیما در دسترس نیست؛ از پوشه supabase باز کنید.');
      }
      return;
    }

    if (target.closest('[data-exit-demo]')) {
      repo.exitDemo();
      window.location.hash = '#/auth';
      window.location.reload();
      return;
    }

    if (target.closest('[data-reset-demo]')) {
      const ok = await confirmDialog({ title: 'بازنشانی داده نمونه', message: 'داده‌های نمونه به حالت اولیه برگردند؟ تغییرات شما پاک می‌شود.', confirmText: 'بازنشانی' });
      if (!ok) return;
      repo.resetDemo();
      toast.success('داده نمونه بازنشانی شد.');
      render();
      return;
    }

    if (target.closest('[data-sign-out]')) {
      const ok = await confirmDialog({ title: 'خروج از حساب', message: 'از حساب کاربری خارج می‌شوید؟', confirmText: 'خروج', tone: 'primary' });
      if (!ok) return;
      try {
        await auth.signOut();
        window.location.reload();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    if (target.closest('[data-change-password]')) {
      const email = getState().user?.email;
      if (!email) return;
      try {
        await auth.resetPassword(email);
        toast.success('لینک تغییر رمز به ایمیل شما ارسال شد.');
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    if (target.closest('[data-wipe]')) {
      const ok = await confirmDialog({
        title: 'پاک کردن همه داده‌ها',
        message: 'همه تجربه‌ها، محصولات، فروشگاه‌ها، پلتفرم‌ها و لیست‌ها حذف می‌شوند. این کار قابل بازگشت نیست. مطمئن هستید؟',
        confirmText: 'همه را پاک کن',
      });
      if (!ok) return;
      try {
        await repo.wipeAllData();
        toast.success('همه داده‌ها پاک شد.');
        render();
      } catch (error) {
        toast.error(error.message);
      }
    }
  });

  container.addEventListener('change', async (event) => {
    if (event.target.matches('[data-import-file]')) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await readFileText(file);
        const payload = JSON.parse(text);
        const result = await repo.importAll(payload);
        toast.success(`${faNum(result.imported)} تجربه بازیابی شد.`);
        render();
      } catch (error) {
        toast.error(error.message || 'فایل معتبر نیست.');
      } finally {
        event.target.value = '';
      }
    }
  });

  const unsubscribe = subscribe((state, keys) => {
    if (!keys || keys.includes('*') || keys.some((key) => ['profile', 'reviews', 'products', 'shops', 'vendors'].includes(key))) render();
  });

  render();

  return { destroy: () => unsubscribe() };
}

export function openShortcutsModal() {
  openModal({
    title: 'میان‌برهای صفحه‌کلید',
    subtitle: 'با صفحه‌کلید سریع‌تر حرکت کن',
    size: 'sm',
    body: `<div class="shortcut-list">
      ${SHORTCUTS.map(
        (item) => `<div class="shortcut-item"><span>${esc(item.label)}</span><span class="shortcut-keys">${item.keys
          .map((key) => `<kbd class="kbd">${esc(key)}</kbd>`)
          .join('')}</span></div>`,
      ).join('')}
    </div>`,
  });
}

export { SHORTCUTS };
