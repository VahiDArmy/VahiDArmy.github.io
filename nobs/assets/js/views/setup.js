/* ==========================================================================
   setup.js — صفحه راه‌اندازی وقتی جدول‌های smrv_ ساخته نشده‌اند
   ========================================================================== */

import { CONFIG, TABLES } from '../lib/backend.js';
import { icon } from '../lib/icons.js';
import { toast } from '../lib/ui.js';
import { copyText, esc, faNum } from '../lib/utils.js';
import { refreshBootstrap, enterDemo } from '../lib/repo.js';
import * as auth from '../lib/auth.js';

export function mount(container, ctx = {}) {
  container.innerHTML = `
    <div class="setup">
      <div class="setup__card">
        <div class="setup__head">
          <span class="setup__ico">${icon('database', 22)}</span>
          <div class="u-grow">
            <h1 class="page__title" style="font-size:var(--fs-2xl)">یک قدم تا آماده شدن</h1>
            <p class="page__sub">
              جدول‌های این اپ در دیتابیس Supabase شما ساخته نشده‌اند. اسکریپت اختصاصی زیر را یک بار در SQL Editor اجرا کنید.
              هیچ جدول موجودی تغییر نمی‌کند؛ همه جدول‌ها با پیشوند <span class="u-mono">smrv_</span> ساخته می‌شوند.
            </p>
          </div>
        </div>

        <div class="setup__steps">
          <div class="setup__step">
            <span class="setup__step-num">۱</span>
            <div>
              دکمه «کپی اسکریپت» را بزنید یا فایل
              <span class="u-mono">${esc(CONFIG.schemaFile)}</span> را از پروژه باز کنید.
            </div>
          </div>
          <div class="setup__step">
            <span class="setup__step-num">۲</span>
            <div>
              در داشبورد Supabase، بخش
              <a class="link" href="${esc(CONFIG.sqlEditorUrl)}" target="_blank" rel="noopener">SQL Editor</a>
              را باز کنید و اسکریپت را کامل اجرا (Run) کنید.
            </div>
          </div>
          <div class="setup__step">
            <span class="setup__step-num">۳</span>
            <div>به این صفحه برگردید و «بررسی مجدد» را بزنید. اگر همه چیز درست باشد، وارد اپ می‌شوید.</div>
          </div>
        </div>

        <div class="callout callout--info">
          ${icon('info', 17)}
          <div class="u-grow">
            <div class="callout__title">چه چیزی ساخته می‌شود؟</div>
            <div class="callout__text">
              ${faNum(8)} جدول (<span class="u-mono">profiles، vendors، shops، products، reviews، comments، lists، list_items</span>)
              به‌همراه RLS، ایندکس‌ها و ویوهای کمکی. سیاست‌ها طوری تنظیم می‌شوند که هر کاربر فقط داده خودش را ببیند.
            </div>
          </div>
        </div>

        <div class="copy-field u-mono" style="font-size:10px">
          ${esc(CONFIG.url)} · ${esc(String(TABLES.reviews))}
        </div>

        <div class="setup__foot">
          <button type="button" class="btn btn--primary" data-copy>${icon('copy', 16)} کپی اسکریپت</button>
          <button type="button" class="btn btn--soft" data-check>${icon('refresh', 16)} بررسی مجدد</button>
          <a class="btn btn--ghost" href="${esc(CONFIG.sqlEditorUrl)}" target="_blank" rel="noopener">${icon('external', 16)} باز کردن SQL Editor</a>
          <span class="u-grow"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-demo>${icon('sparkles', 15)} حالت نمایشی</button>
          <button type="button" class="btn btn--ghost btn--sm" data-signout>${icon('logout', 15)} خروج</button>
        </div>
      </div>
    </div>
  `;

  container.addEventListener('click', async (event) => {
    const target = event.target;

    if (target.closest('[data-copy]')) {
      try {
        const response = await fetch(CONFIG.schemaFile);
        const sql = await response.text();
        const ok = await copyText(sql);
        toast[ok ? 'success' : 'error'](ok ? 'اسکریپت کامل کپی شد.' : 'کپی انجام نشد.');
      } catch {
        toast.error('فایل اسکیما پیدا نشد. از پوشه supabase باز کنید.');
      }
      return;
    }

    if (target.closest('[data-check]')) {
      const btn = target.closest('[data-check]');
      btn.classList.add('is-loading');
      btn.disabled = true;
      try {
        await refreshBootstrap();
        ctx.onReady?.();
      } catch (error) {
        toast.error(error.message);
      } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
      return;
    }

    if (target.closest('[data-demo]')) {
      enterDemo();
      ctx.onReady?.();
      return;
    }

    if (target.closest('[data-signout]')) {
      try {
        await auth.signOut();
        window.location.reload();
      } catch (error) {
        toast.error(error.message);
      }
    }
  });

  return { destroy() {} };
}
