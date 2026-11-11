/* ============================================================
   Settings view
   ============================================================ */
import { el, escapeHtml, isEmail, downloadJSON } from '../utils.js';
import { state, subscribe, setTheme, setAccent, setFont, setDensity, setRadius, clearRecentSearches } from '../state.js';
import { navigate } from '../router.js';
import { loadProfile, updateProfile, changePassword, signOut, displayName } from '../auth.js';
import { toastSuccess, toastError, toastInfo, confirm } from '../ui.js';
import { APP } from '../config.js';

const SECTIONS = [
  { id: 'appearance', label: 'ظاهر', icon: 'ri-palette-line' },
  { id: 'profile', label: 'پروفایل', icon: 'ri-user-3-line' },
  { id: 'account', label: 'امنیت', icon: 'ri-shield-keyhole-line' },
  { id: 'data', label: 'داده‌ها', icon: 'ri-database-2-line' },
  { id: 'about', label: 'درباره', icon: 'ri-information-line' }
];

export const renderSettings = async (root, { query = {} } = {}) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-settings-5-line"></i>تنظیمات</div>
      <h1 class="page-header__title">تنظیمات</h1>
      <p class="page-header__desc">ظاهر، پروفایل، امنیت و داده‌های خود را مدیریت کنید.</p>
    </div>
  `;
  page.appendChild(header);

  const layout = document.createElement('div');
  layout.className = 'settings-layout';
  const nav = document.createElement('nav');
  nav.className = 'settings-nav';
  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  layout.append(nav, panel);
  page.appendChild(layout);
  root.appendChild(page);

  let active = query.section || 'appearance';

  const buildNav = () => {
    nav.innerHTML = '';
    SECTIONS.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'settings-nav__item' + (s.id === active ? ' is-active' : '');
      b.innerHTML = `<i class="${s.icon}"></i>${s.label}`;
      b.addEventListener('click', () => { active = s.id; buildNav(); renderPanel(); });
      nav.appendChild(b);
    });
  };

  const renderPanel = () => {
    panel.innerHTML = '';
    switch (active) {
      case 'appearance': panel.appendChild(appearancePanel()); break;
      case 'profile': panel.appendChild(profilePanel()); break;
      case 'account': panel.appendChild(accountPanel()); break;
      case 'data': panel.appendChild(dataPanel()); break;
      case 'about': panel.appendChild(aboutPanel()); break;
    }
  };

  buildNav();
  renderPanel();
};

/* ---------------- Appearance ---------------- */
const appearancePanel = () => {
  const wrap = document.createElement('div');

  /* Theme section */
  const themeSec = document.createElement('div');
  themeSec.className = 'settings-section';
  themeSec.innerHTML = `
    <div class="settings-section__head">
      <div class="settings-section__title">پوسته</div>
      <div class="settings-section__desc">حالت روشن، تاریک یا خودکار را انتخاب کنید.</div>
    </div>
    <div class="settings-section__body" data-body></div>
  `;
  const body = themeSec.querySelector('[data-body]');
  const themeRow = document.createElement('div');
  themeRow.className = 'setting-row';
  themeRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">پوسته</div><div class="setting-row__desc">روشن، تاریک یا بر اساس سیستم</div></div>`;
  const themeSeg = document.createElement('div');
  themeSeg.className = 'segmented';
  [['light', 'روشن'], ['dark', 'تاریک'], ['system', 'سیستم']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__item' + (state.theme === id ? ' is-active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { setTheme(id); themeSeg.querySelectorAll('.segmented__item').forEach(x => x.classList.remove('is-active')); b.classList.add('is-active'); });
    themeSeg.appendChild(b);
  });
  themeRow.appendChild(themeSeg);
  body.appendChild(themeRow);

  /* Accent section */
  const accentRow = document.createElement('div');
  accentRow.className = 'setting-row';
  accentRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">رنگ تأکیدی</div><div class="setting-row__desc">رنگ اصلی رابط کاربری</div></div>`;
  const swatches = document.createElement('div');
  swatches.className = 'swatch-row';
  APP.accents.forEach(a => {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = `swatch ${a.swatch}` + (state.accent === a.id ? ' is-active' : '');
    s.title = a.label;
    s.setAttribute('aria-label', a.label);
    s.addEventListener('click', () => {
      setAccent(a.id);
      swatches.querySelectorAll('.swatch').forEach(x => x.classList.remove('is-active'));
      s.classList.add('is-active');
    });
    swatches.appendChild(s);
  });
  accentRow.appendChild(swatches);
  body.appendChild(accentRow);

  /* Font */
  const fontRow = document.createElement('div');
  fontRow.className = 'setting-row';
  fontRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">اندازه متن</div><div class="setting-row__desc">اندازه پایه متن رابط</div></div>`;
  const fontSeg = document.createElement('div');
  fontSeg.className = 'segmented';
  APP.fonts.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__item' + (state.font === f.id ? ' is-active' : '');
    b.textContent = f.label;
    b.addEventListener('click', () => { setFont(f.id); fontSeg.querySelectorAll('.segmented__item').forEach(x => x.classList.remove('is-active')); b.classList.add('is-active'); });
    fontSeg.appendChild(b);
  });
  fontRow.appendChild(fontSeg);
  body.appendChild(fontRow);

  /* Density */
  const densityRow = document.createElement('div');
  densityRow.className = 'setting-row';
  densityRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">چیدمان</div><div class="setting-row__desc">فشرده یا راحت</div></div>`;
  const densitySeg = document.createElement('div');
  densitySeg.className = 'segmented';
  [['comfortable', 'راحت'], ['compact', 'فشرده']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__item' + (state.density === id ? ' is-active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { setDensity(id); densitySeg.querySelectorAll('.segmented__item').forEach(x => x.classList.remove('is-active')); b.classList.add('is-active'); });
    densitySeg.appendChild(b);
  });
  densityRow.appendChild(densitySeg);
  body.appendChild(densityRow);

  /* Radius */
  const radiusRow = document.createElement('div');
  radiusRow.className = 'setting-row';
  radiusRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">گوشه‌ها</div><div class="setting-row__desc">سبک گردی گوشه‌ها</div></div>`;
  const radiusSeg = document.createElement('div');
  radiusSeg.className = 'segmented';
  APP.radii.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__item' + (state.radius === r.id ? ' is-active' : '');
    b.textContent = r.label;
    b.addEventListener('click', () => { setRadius(r.id); radiusSeg.querySelectorAll('.segmented__item').forEach(x => x.classList.remove('is-active')); b.classList.add('is-active'); });
    radiusSeg.appendChild(b);
  });
  radiusRow.appendChild(radiusSeg);
  body.appendChild(radiusRow);

  wrap.appendChild(themeSec);
  return wrap;
};

/* ---------------- Profile ---------------- */
const profilePanel = () => {
  const wrap = document.createElement('div');
  const sec = document.createElement('div');
  sec.className = 'settings-section';
  sec.innerHTML = `
    <div class="settings-section__head">
      <div class="settings-section__title">اطلاعات پروفایل</div>
      <div class="settings-section__desc">نام نمایشی، معرفی و تصویر شما.</div>
    </div>
    <div class="settings-section__body"></div>
  `;
  const body = sec.querySelector('.settings-section__body');

  if (!state.user) {
    body.innerHTML = `<div style="color:var(--ink-mute);font-size:var(--fs-sm);">برای ویرایش پروفایل باید <a href="#/auth" data-link>وارد شوید</a>.</div>`;
    wrap.appendChild(sec);
    return wrap;
  }

  const p = state.profile || {};
  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';
  form.innerHTML = `
    <div class="field">
      <label class="field__label">نام نمایشی</label>
      <input class="input" name="display_name" value="${escapeHtml(p.display_name || displayName())}" maxlength="60" />
    </div>
    <div class="field">
      <label class="field__label">معرفی کوتاه</label>
      <textarea class="textarea" name="bio" rows="3" maxlength="300">${escapeHtml(p.bio || '')}</textarea>
    </div>
    <div class="field">
      <label class="field__label">آدرس تصویر (URL)</label>
      <input class="input" name="avatar_url" type="url" value="${escapeHtml(p.avatar_url || '')}" placeholder="https://…" />
    </div>
    <div class="setting-row">
      <div class="setting-row__main"><div class="setting-row__title">ایمیل</div><div class="setting-row__desc">${escapeHtml(state.user.email || '')}</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn--primary" type="submit"><i class="ri-save-line"></i>ذخیره</button>
    </div>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await updateProfile({
        display_name: String(fd.get('display_name') || '').trim() || 'همراه',
        bio: String(fd.get('bio') || '').trim(),
        avatar_url: String(fd.get('avatar_url') || '').trim() || null
      });
      toastSuccess('پروفایل ذخیره شد');
    } catch (err) { toastError('خطا', err.message); }
  });
  body.appendChild(form);
  wrap.appendChild(sec);
  return wrap;
};

/* ---------------- Account ---------------- */
const accountPanel = () => {
  const wrap = document.createElement('div');
  const sec = document.createElement('div');
  sec.className = 'settings-section';
  sec.innerHTML = `
    <div class="settings-section__head">
      <div class="settings-section__title">امنیت حساب</div>
      <div class="settings-section__desc">تغییر رمز عبور و خروج از حساب.</div>
    </div>
    <div class="settings-section__body"></div>
  `;
  const body = sec.querySelector('.settings-section__body');

  if (!state.user) {
    body.innerHTML = `<div style="color:var(--ink-mute);font-size:var(--fs-sm);">ابتدا <a href="#/auth" data-link>وارد شوید</a>.</div>`;
    wrap.appendChild(sec);
    return wrap;
  }

  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '12px';
  form.innerHTML = `
    <div class="field"><label class="field__label">رمز عبور جدید</label><input class="input" type="password" name="pw" required minlength="6" /></div>
    <div class="field"><label class="field__label">تکرار رمز عبور</label><input class="input" type="password" name="pw2" required minlength="6" /></div>
    <div style="display:flex;justify-content:flex-end;"><button class="btn btn--primary" type="submit"><i class="ri-lock-password-line"></i>تغییر رمز</button></div>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const pw = String(fd.get('pw'));
    if (pw !== String(fd.get('pw2'))) { toastError('رمزها یکسان نیستند'); return; }
    try { await changePassword(pw); form.reset(); }
    catch (err) { toastError('خطا', err.message); }
  });
  body.appendChild(form);

  const logoutRow = document.createElement('div');
  logoutRow.className = 'setting-row';
  logoutRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">خروج از حساب</div><div class="setting-row__desc">از همه دستگاه‌های این مرورگر خارج شوید.</div></div>`;
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn--danger';
  logoutBtn.innerHTML = '<i class="ri-logout-box-line"></i>خروج';
  logoutBtn.addEventListener('click', async () => {
    const ok = await confirm({ title: 'خروج', message: 'از حساب خارج می‌شوید؟', danger: true, confirmText: 'خروج' });
    if (!ok) return;
    await signOut();
    navigate('/home');
  });
  logoutRow.appendChild(logoutBtn);
  body.appendChild(logoutRow);

  wrap.appendChild(sec);
  return wrap;
};

/* ---------------- Data ---------------- */
const dataPanel = () => {
  const wrap = document.createElement('div');
  const sec = document.createElement('div');
  sec.className = 'settings-section';
  sec.innerHTML = `
    <div class="settings-section__head">
      <div class="settings-section__title">مدیریت داده‌ها</div>
      <div class="settings-section__desc">جستجوهای اخیر، تنظیمات ظاهری.</div>
    </div>
    <div class="settings-section__body"></div>
  `;
  const body = sec.querySelector('.settings-section__body');

  const clearRow = document.createElement('div');
  clearRow.className = 'setting-row';
  clearRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">پاک کردن جستجوهای اخیر</div><div class="setting-row__desc">لیست جستجوهای این دستگاه حذف می‌شود.</div></div>`;
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn';
  clearBtn.textContent = 'پاک کردن';
  clearBtn.addEventListener('click', () => { clearRecentSearches(); toastSuccess('پاک شد'); });
  clearRow.appendChild(clearBtn);
  body.appendChild(clearRow);

  const exportRow = document.createElement('div');
  exportRow.className = 'setting-row';
  exportRow.innerHTML = `<div class="setting-row__main"><div class="setting-row__title">برون‌بری تنظیمات</div><div class="setting-row__desc">دریافت فایل JSON از تنظیمات ظاهری.</div></div>`;
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn';
  exportBtn.textContent = 'دانلود';
  exportBtn.addEventListener('click', () => {
    downloadJSON('theories-settings.json', {
      theme: state.theme, accent: state.accent, font: state.font,
      density: state.density, radius: state.radius
    });
    toastSuccess('دانلود شد');
  });
  exportRow.appendChild(exportBtn);
  body.appendChild(exportRow);

  wrap.appendChild(sec);
  return wrap;
};

/* ---------------- About ---------------- */
const aboutPanel = () => {
  const wrap = document.createElement('div');
  const sec = document.createElement('div');
  sec.className = 'settings-section';
  sec.innerHTML = `
    <div class="settings-section__head">
      <div class="settings-section__title">درباره ${APP.name}</div>
      <div class="settings-section__desc">${APP.tagline} — نسخه ${APP.version}</div>
    </div>
    <div class="settings-section__body">
      <p style="color:var(--ink-soft);line-height:1.9;">
        ${APP.name} استودیویی است برای ثبت، سازمان‌دهی و به‌اشتراک‌گذاری نظریه‌ها.
        هر نظریه می‌تواند اشیاء، تصاویر و پیوندهایی داشته باشد و همه‌چیز با تقویم شمسی ثبت می‌شود.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
        ${APP.shortcuts.map(s => `
          <div style="background:var(--bg-elev-2);border:1px solid var(--line);border-radius:var(--r-md);padding:10px;">
            <div style="display:flex;gap:4px;margin-bottom:6px;">${s.keys.map(k => `<kbd>${escapeHtml(k)}</kbd>`).join('')}</div>
            <div style="font-size:var(--fs-xs);color:var(--ink-mute);">${escapeHtml(s.label)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  wrap.appendChild(sec);
  return wrap;
};
