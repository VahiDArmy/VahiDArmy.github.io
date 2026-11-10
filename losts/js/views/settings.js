import { state, resetState } from '../state.js';
import { navigate } from '../router.js';
import { applyTheme, currentTheme, toast, confirmDialog, openModal } from '../ui.js';
import { signOut } from '../auth.js';
import { saveSettings, loadAll, wipeAllData, exportData } from '../db.js';
import { download, esc, faDigits, fmtNum, todayISO, initials } from '../utils.js';

export function render(container) {
  const user = state.user;
  const settings = state.settings || {};
  const entries = state.entries || [];
  const goals = state.goals || [];
  const wishes = state.wishes || [];
  const reflections = state.reflections || [];
  const theme = currentTheme();

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">تنظیمات</div>
        <div class="page-subtitle">ظاهر، حساب و داده‌های تو</div>
      </div>
    </div>

    <div class="settings-section anim-fade-up">
      <div class="settings-section-title">👤 حساب کاربری</div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">نام نمایشی</div>
          <div class="settings-row-desc">${esc(state.displayName || 'کاربر')}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="edit-name-btn">ویرایش</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">ایمیل</div>
          <div class="settings-row-desc">${esc(user?.email || '—')}</div>
        </div>
        <span class="badge badge-emerald">✓ تأییدشده</span>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">تاریخ عضویت</div>
          <div class="settings-row-desc">${esc(user?.created_at ? new Date(user.created_at).toLocaleDateString('fa-IR') : '—')}</div>
        </div>
      </div>
    </div>

    <div class="settings-section anim-fade-up">
      <div class="settings-section-title">🎨 ظاهر</div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">حالت نمایش</div>
          <div class="settings-row-desc">روشن یا تاریک</div>
        </div>
        <div class="segmented" id="theme-seg">
          <button type="button" data-theme-pick="light" class="${theme === 'light' ? 'active' : ''}">☀️ روشن</button>
          <button type="button" data-theme-pick="dark" class="${theme === 'dark' ? 'active' : ''}">🌙 تاریک</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">واحد پول</div>
          <div class="settings-row-desc">برای نمایش هزینه‌ها</div>
        </div>
        <select class="select" id="currency-select" style="width:auto;min-width:140px">
          ${['تومان', 'ریال', 'دلار', 'یورو'].map((c) => `<option value="${esc(c)}" ${settings.currency === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">هدف روزانه</div>
          <div class="settings-row-desc">تعداد شادی‌هایی که می‌خواهی در روز ثبت کنی</div>
        </div>
        <input type="number" class="input" id="daily-goal-input" min="0" max="20" value="${settings.daily_goal ?? 1}" style="width:90px" inputmode="numeric">
      </div>
    </div>

    <div class="settings-section anim-fade-up">
      <div class="settings-section-title">📊 آمار داده‌های من</div>
      <div class="dash-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:0">
        <div class="stat"><div class="stat-head"><div class="stat-label">شادی‌ها</div><div class="stat-icon">✨</div></div><div class="stat-value">${faDigits(entries.length)}</div></div>
        <div class="stat"><div class="stat-head"><div class="stat-label">هدف‌ها</div><div class="stat-icon">🎯</div></div><div class="stat-value">${faDigits(goals.length)}</div></div>
        <div class="stat"><div class="stat-head"><div class="stat-label">آرزوها</div><div class="stat-icon">🎁</div></div><div class="stat-value">${faDigits(wishes.length)}</div></div>
        <div class="stat"><div class="stat-head"><div class="stat-label">تأمل‌ها</div><div class="stat-icon">🌙</div></div><div class="stat-value">${faDigits(reflections.length)}</div></div>
      </div>
    </div>

    <div class="settings-section anim-fade-up">
      <div class="settings-section-title">💾 داده‌ها</div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">دریافت پشتیبان</div>
          <div class="settings-row-desc">همهٔ داده‌هایت را در قالب JSON دانلود کن</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="export-btn">⬇️ دانلود</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">بارگذاری مجدد</div>
          <div class="settings-row-desc">همگام‌سازی با سرور</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="refresh-btn">🔄 به‌روزرسانی</button>
      </div>
      <div class="settings-row settings-danger">
        <div class="settings-row-label">
          <div class="settings-row-title" style="color:var(--red-500)">پاک کردن همهٔ داده‌ها</div>
          <div class="settings-row-desc">تمام شادی‌ها، هدف‌ها، آرزوها و تأمل‌ها حذف می‌شوند</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" id="wipe-btn">🗑 پاک کردن</button>
      </div>
    </div>

    <div class="settings-section anim-fade-up">
      <div class="settings-section-title">ℹ️ دربارهٔ شادی‌یار</div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">نسخه</div>
          <div class="settings-row-desc">${faDigits('1.0.0')}</div>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-label">
          <div class="settings-row-title">درباره</div>
          <div class="settings-row-desc">شادی‌یار، همراه هر روز تو برای ثبت لحظه‌های شاد و سرمایه‌گذاری روی خودت.</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-top:1.5rem;padding-bottom:3rem">
      <button type="button" class="btn btn-outline" id="signout-btn">🚪 خروج از حساب</button>
    </div>
  `;

  bind(container, settings);
}

function bind(container, settings) {
  container.querySelectorAll('[data-theme-pick]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.themePick;
      applyTheme(theme);
      container.querySelectorAll('[data-theme-pick]').forEach((b) => b.classList.toggle('active', b.dataset.themePick === theme));
      try { await saveSettings({ theme }); state.settings = { ...state.settings, theme }; } catch (err) { console.warn(err); }
      toast(theme === 'dark' ? 'حالت شب فعال شد 🌙' : 'حالت روشن فعال شد ☀️', 'info', 1500);
    });
  });

  container.querySelector('#currency-select')?.addEventListener('change', async (event) => {
    const currency = event.target.value;
    try {
      await saveSettings({ currency });
      state.settings = { ...state.settings, currency };
      toast('واحد پول ذخیره شد', 'success');
    } catch (err) {
      toast(err.message || 'خطا', 'error');
    }
  });

  container.querySelector('#daily-goal-input')?.addEventListener('change', async (event) => {
    const daily_goal = Math.max(0, Number(event.target.value) || 0);
    try {
      await saveSettings({ daily_goal });
      state.settings = { ...state.settings, daily_goal };
      toast('هدف روزانه ذخیره شد', 'success');
    } catch (err) {
      toast(err.message || 'خطا', 'error');
    }
  });

  container.querySelector('#edit-name-btn')?.addEventListener('click', () => {
    const body = `
      <div class="field">
        <label for="display-name-input">نام نمایشی</label>
        <input type="text" class="input" id="display-name-input" value="${esc(state.displayName || '')}" maxlength="40">
      </div>
    `;
    const footer = `
      <button type="button" class="btn btn-ghost" data-close>انصراف</button>
      <button type="button" class="btn btn-primary" data-save>ذخیره</button>
    `;
    openModal({
      title: 'ویرایش نام',
      body,
      footer,
      size: 'sm',
      onMount: (m) => {
        m.footer.querySelector('[data-close]').addEventListener('click', () => m.close());
        m.footer.querySelector('[data-save]').addEventListener('click', async () => {
          const value = m.el.querySelector('#display-name-input').value.trim();
          if (!value) { toast('نام را وارد کن', 'warning'); return; }
          try {
            const { supabase } = await import('../supabase.js');
            const { error } = await supabase.auth.updateUser({ data: { display_name: value } });
            if (error) throw error;
            state.displayName = value;
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            if (nameEl) nameEl.textContent = value;
            if (avatarEl) avatarEl.textContent = value.slice(0, 1);
            await saveSettings({ display_name: value }).catch(() => {});
            toast('نام به‌روز شد', 'success');
            m.close();
            render(container);
          } catch (err) {
            toast(err.message || 'خطا', 'error');
          }
        });
      },
    });
  });

  container.querySelector('#export-btn')?.addEventListener('click', () => {
    const data = exportData();
    const filename = `joyyar-backup-${todayISO()}.json`;
    download(filename, JSON.stringify(data, null, 2));
    toast('پشتیبان دانلود شد', 'success');
  });

  container.querySelector('#refresh-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#refresh-btn');
    btn.disabled = true;
    try {
      await loadAll();
      toast('داده‌ها به‌روز شد', 'success');
      render(container);
    } catch (err) {
      toast(err.message || 'خطا', 'error');
      btn.disabled = false;
    }
  });

  container.querySelector('#wipe-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'پاک کردن همهٔ داده‌ها',
      message: 'همهٔ شادی‌ها، هدف‌ها، آرزوها و تأمل‌هایت برای همیشه پاک می‌شوند. مطمئنی؟',
      confirmText: 'همه را پاک کن',
      danger: true,
    });
    if (!ok) return;
    try {
      await wipeAllData();
      state.entries = [];
      state.goals = [];
      state.wishes = [];
      state.reflections = [];
      toast('همهٔ داده‌ها پاک شد', 'success');
      render(container);
    } catch (err) {
      toast(err.message || 'خطا در پاک کردن', 'error');
    }
  });

  container.querySelector('#signout-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'خروج', message: 'از حسابت خارج می‌شوی. مطمئنی؟', confirmText: 'خروج', danger: true });
    if (!ok) return;
    await signOut();
    resetState();
  });
}
