/**
 * Settings page — profile, goals, theme, data, danger zone.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { modal } from "../components/modal.js";
import { store } from "../core/state.js";
import { auth } from "../services/auth.service.js";
import { profile } from "../services/profile.service.js";
import { goals } from "../services/goals.service.js";
import { theme, THEMES } from "../config/theme.js";
import { DEFAULT_GOALS } from "../config/constants.js";
import { formatNumber, escapeHTML, toLatinDigits } from "../utils/format.js";
import { validators, validate } from "../utils/validation.js";
import { navigate } from "../router.js";

export default {
  title: "تنظیمات",
  subtitle: "مدیریت حساب و اهداف",
  icon: "settings",

  async render(container) {
    let activePanel = "profile";
    const user = store.get("user");
    const profileData = store.get("profile") || {};
    const goalData = store.get("goals") || DEFAULT_GOALS;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header__info">
          <div class="page-header__title">تنظیمات</div>
          <div class="page-header__subtitle">مدیریت حساب کاربری، اهداف و نمایش</div>
        </div>
      </div>

      <div class="settings-layout">
        <nav class="settings-nav">
          <div class="settings-nav__item is-active" data-panel="profile" role="button" tabindex="0">${icon("user", { size: 16 })}<span>پروفایل</span></div>
          <div class="settings-nav__item" data-panel="goals" role="button" tabindex="0">${icon("target", { size: 16 })}<span>اهداف</span></div>
          <div class="settings-nav__item" data-panel="appearance" role="button" tabindex="0">${icon("palette", { size: 16 })}<span>نمایش</span></div>
          <div class="settings-nav__item" data-panel="data" role="button" tabindex="0">${icon("download", { size: 16 })}<span>داده‌ها</span></div>
          <div class="settings-nav__item" data-panel="security" role="button" tabindex="0">${icon("lock", { size: 16 })}<span>امنیت</span></div>
          <div class="settings-nav__item" data-panel="danger" role="button" tabindex="0" style="color:var(--color-danger)">${icon("alert", { size: 16 })}<span>منطقه خطر</span></div>
        </nav>

        <div data-panels></div>
      </div>
    `;

    function switchPanel(name) {
      activePanel = name;
      container.querySelectorAll("[data-panel]").forEach((el) =>
        el.classList.toggle("is-active", el.dataset.panel === name && el.matches(".settings-nav__item"))
      );
      renderPanel();
    }

    delegate(container, "click", ".settings-nav__item", (e, btn) => switchPanel(btn.dataset.panel));

    function renderPanel() {
      const wrap = $("[data-panels]", container);
      if (activePanel === "profile") renderProfile(wrap);
      else if (activePanel === "goals") renderGoals(wrap);
      else if (activePanel === "appearance") renderAppearance(wrap);
      else if (activePanel === "data") renderData(wrap);
      else if (activePanel === "security") renderSecurity(wrap);
      else if (activePanel === "danger") renderDanger(wrap);
    }

    /* ---------- Profile --------------------------------------------- */
    function renderProfile(wrap) {
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("user", { size: 18 })}<span>اطلاعات پروفایل</span></div>
                <div class="settings-section__desc">این اطلاعات در داشبورد شما نمایش داده می‌شود</div>
              </div>
            </div>

            <div class="avatar-upload">
              <div class="avatar-upload__preview" data-avatar>
                ${profileData.avatar_url
                  ? `<img src="${escapeHTML(profileData.avatar_url)}" alt="" />`
                  : (profileData.display_name?.[0] || user?.email?.[0] || "؟").toUpperCase()}
              </div>
              <div class="avatar-upload__body">
                <button class="btn btn--secondary btn--sm" data-upload-avatar type="button">${icon("upload", { size: 14 })}<span>تغییر تصویر</span></button>
                <div class="text-2xs text-muted">فرمت‌های مجاز: JPG، PNG — حداکثر ۲ مگابایت</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">نام نمایشی</label>
                <input class="form-input" data-field="display_name" value="${escapeHTML(profileData.display_name || "")}" />
              </div>
              <div class="form-group">
                <label class="form-label">ایمیل</label>
                <input class="form-input" value="${escapeHTML(user?.email || "")}" disabled dir="ltr" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">قد (سانتی‌متر)</label>
                <input class="form-input" type="number" data-field="height_cm" value="${profileData.height_cm || ""}" />
              </div>
              <div class="form-group">
                <label class="form-label">سال تولد</label>
                <input class="form-input" type="number" data-field="birth_year" value="${profileData.birth_year || ""}" />
              </div>
              <div class="form-group">
                <label class="form-label">جنسیت</label>
                <select class="form-select" data-field="gender">
                  <option value="">انتخاب…</option>
                  <option value="male" ${profileData.gender === "male" ? "selected" : ""}>مرد</option>
                  <option value="female" ${profileData.gender === "female" ? "selected" : ""}>زن</option>
                  <option value="other" ${profileData.gender === "other" ? "selected" : ""}>سایر</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">نوع دیابت</label>
              <select class="form-select" data-field="diabetes_type">
                <option value="">انتخاب…</option>
                <option value="type1" ${profileData.diabetes_type === "type1" ? "selected" : ""}>نوع ۱</option>
                <option value="type2" ${profileData.diabetes_type === "type2" ? "selected" : ""}>نوع ۲</option>
                <option value="gestational" ${profileData.diabetes_type === "gestational" ? "selected" : ""}>بارداری</option>
                <option value="prediabetes" ${profileData.diabetes_type === "prediabetes" ? "selected" : ""}>پیش‌دیابت</option>
              </select>
            </div>

            <div class="flex justify-end gap-2">
              <button class="btn btn--primary" data-save="profile" type="button">${icon("save", { size: 16 })}<span>ذخیره تغییرات</span></button>
            </div>
          </div>
        </div>
      `;

      // Avatar upload
      wrap.querySelector("[data-upload-avatar]").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg";
        input.addEventListener("change", async () => {
          const file = input.files[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) return toast.error("حجم فایل بیش از ۲ مگابایت است");
          try {
            await profile.uploadAvatar(file);
            toast.success("تصویر به‌روزرسانی شد");
            renderPanel();
          } catch (err) {
            toast.error("آپلود ناموفق بود");
          }
        });
        input.click();
      });

      // Save
      wrap.querySelector("[data-save='profile']").addEventListener("click", async () => {
        const patch = {};
        ["display_name", "height_cm", "birth_year", "gender", "diabetes_type"].forEach((f) => {
          const el = wrap.querySelector(`[data-field="${f}"]`);
          if (!el) return;
          let v = el.value;
          if (["height_cm", "birth_year"].includes(f)) v = v ? Number(toLatinDigits(v)) : null;
          patch[f] = v || null;
        });
        try {
          await profile.save(patch);
          toast.success("ذخیره شد");
        } catch (err) {
          toast.error("ذخیره ناموفق بود");
        }
      });
    }

    /* ---------- Goals ----------------------------------------------- */
    function renderGoals(wrap) {
      const g = store.get("goals") || DEFAULT_GOALS;
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("target", { size: 18 })}<span>اهداف روزانه</span></div>
                <div class="settings-section__desc">مقادیر هدف روزانه برای کالری و درشت‌مغذی‌ها</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">کالری (kcal)</label>
                <input class="form-input" type="number" data-goal="calories" value="${g.calories}" />
              </div>
              <div class="form-group">
                <label class="form-label">پروتئین (گرم)</label>
                <input class="form-input" type="number" data-goal="protein" value="${g.protein}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">کربوهیدرات (گرم)</label>
                <input class="form-input" type="number" data-goal="carbs" value="${g.carbs}" />
              </div>
              <div class="form-group">
                <label class="form-label">چربی (گرم)</label>
                <input class="form-input" type="number" data-goal="fat" value="${g.fat}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">فیبر (گرم)</label>
                <input class="form-input" type="number" data-goal="fiber" value="${g.fiber}" />
              </div>
              <div class="form-group">
                <label class="form-label">آب (لیوان)</label>
                <input class="form-input" type="number" data-goal="water" value="${g.water}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">قدم روزانه</label>
                <input class="form-input" type="number" data-goal="steps" value="${g.steps}" />
              </div>
              <div class="form-group">
                <label class="form-label">خواب (ساعت)</label>
                <input class="form-input" type="number" step="0.5" data-goal="sleepHours" value="${g.sleepHours}" />
              </div>
            </div>

            <div class="flex justify-between gap-2">
              <button class="btn btn--ghost btn--sm" data-goal-reset type="button">${icon("refresh", { size: 14 })}<span>بازگردانی به پیش‌فرض</span></button>
              <button class="btn btn--primary" data-goal-save type="button">${icon("save", { size: 16 })}<span>ذخیره اهداف</span></button>
            </div>
          </div>
        </div>
      `;

      wrap.querySelector("[data-goal-save]").addEventListener("click", async () => {
        const patch = {};
        wrap.querySelectorAll("[data-goal]").forEach((el) => {
          const key = el.dataset.goal;
          const v = Number(toLatinDigits(el.value)) || 0;
          patch[key] = key === "sleepHours" ? v : Math.round(v);
        });
        try {
          await goals.save(patch);
          toast.success("اهداف ذخیره شد");
        } catch {
          toast.error("ذخیره ناموفق بود");
        }
      });
      wrap.querySelector("[data-goal-reset]").addEventListener("click", async () => {
        const ok = await confirm({
          title: "بازگردانی اهداف",
          message: "همه اهداف به مقادیر پیش‌فرض بازگردانده شوند؟",
          variant: "warning",
          confirmLabel: "بازگردان",
        });
        if (!ok) return;
        try {
          await goals.save(DEFAULT_GOALS);
          toast.success("بازگردانی شد");
          renderPanel();
        } catch { toast.error("خطا"); }
      });
    }

    /* ---------- Appearance ------------------------------------------ */
    function renderAppearance(wrap) {
      const current = theme.current;
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("palette", { size: 18 })}<span>پوسته</span></div>
                <div class="settings-section__desc">پوسته مورد علاقه خود را انتخاب کنید</div>
              </div>
            </div>
            <div class="theme-picker">
              <div class="theme-opt ${current === "dark" ? "is-active" : ""}" data-theme-opt="dark" role="button" tabindex="0">
                <div class="theme-opt__preview theme-opt__preview--dark"></div>
                <div class="theme-opt__label">تیره</div>
              </div>
              <div class="theme-opt ${current === "midnight" ? "is-active" : ""}" data-theme-opt="midnight" role="button" tabindex="0">
                <div class="theme-opt__preview theme-opt__preview--midnight"></div>
                <div class="theme-opt__label">نیمه‌شب</div>
              </div>
              <div class="theme-opt ${current === "slate" ? "is-active" : ""}" data-theme-opt="slate" role="button" tabindex="0">
                <div class="theme-opt__preview theme-opt__preview--slate"></div>
                <div class="theme-opt__label">خاکستری</div>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("globe", { size: 18 })}<span>منطقه و نمایش</span></div>
                <div class="settings-section__desc">تنظیمات محلی‌سازی</div>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__info">
                <div class="setting-row__label">شروع هفته</div>
                <div class="setting-row__hint">مبنای نمایش هفتگی در گزارش‌ها</div>
              </div>
              <div class="setting-row__control">
                <select class="form-select" data-pref="weekStartsOn">
                  <option value="6" ${store.get("prefs").weekStartsOn === 6 ? "selected" : ""}>شنبه</option>
                  <option value="0" ${store.get("prefs").weekStartsOn === 0 ? "selected" : ""}>یکشنبه</option>
                  <option value="1" ${store.get("prefs").weekStartsOn === 1 ? "selected" : ""}>دوشنبه</option>
                </select>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__info">
                <div class="setting-row__label">حالت فشرده</div>
                <div class="setting-row__hint">کاهش فاصله‌ها برای نمایش اطلاعات بیشتر</div>
              </div>
              <div class="setting-row__control">
                <label class="form-switch">
                  <input type="checkbox" data-pref="compactMode" ${store.get("prefs").compactMode ? "checked" : ""} />
                  <span></span>
                </label>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-row__info">
                <div class="setting-row__label">اعلان‌ها</div>
                <div class="setting-row__hint">نمایش اعلان‌ها هنگام رویدادها</div>
              </div>
              <div class="setting-row__control">
                <label class="form-switch">
                  <input type="checkbox" data-pref="notifications" ${store.get("prefs").notifications ? "checked" : ""} />
                  <span></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      `;

      wrap.querySelectorAll("[data-theme-opt]").forEach((el) => {
        el.addEventListener("click", () => {
          const name = el.dataset.themeOpt;
          theme.apply(name);
          wrap.querySelectorAll("[data-theme-opt]").forEach((e) => e.classList.toggle("is-active", e === el));
          toast.success("پوسته تغییر یافت");
        });
      });

      wrap.querySelectorAll("[data-pref]").forEach((el) => {
        el.addEventListener("change", () => {
          const key = el.dataset.pref;
          const value = el.type === "checkbox" ? el.checked : Number(el.value);
          store.setPrefs({ [key]: value });
          toast.success("ذخیره شد");
        });
      });
    }

    /* ---------- Data ------------------------------------------------ */
    function renderData(wrap) {
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("download", { size: 18 })}<span>پشتیبان‌گیری</span></div>
                <div class="settings-section__desc">دریافت اطلاعات خود در قالب JSON</div>
              </div>
            </div>
            <p class="text-sm text-muted">برای پشتیبان‌گیری کامل، از دکمه زیر استفاده کنید. فایل خروجی شامل تمام ثبت‌های غذا، سلامت، خواب و ورزش است.</p>
            <div>
              <button class="btn btn--primary" data-backup type="button">${icon("download", { size: 16 })}<span>دانلود پشتیبان کامل</span></button>
            </div>
          </div>
        </div>
      `;

      wrap.querySelector("[data-backup]").addEventListener("click", async () => {
        try {
          const { foodLog } = await import("../services/food-log.service.js");
          const { insulin, glucose, bp, weight } = await import("../services/health.service.js");
          const { sleep } = await import("../services/sleep.service.js");
          const { activity } = await import("../services/activity.service.js");
          const { todayISO, addDays } = await import("../utils/date.js");

          const end = todayISO();
          const start = addDays(end, -365);

          const [food, ins, glu, b, w, sl, act] = await Promise.all([
            foodLog.listByRange(start, end).catch(() => []),
            insulin.listByRange(start, end).catch(() => []),
            glucose.listByRange(start, end).catch(() => []),
            bp.listByRange(start, end).catch(() => []),
            weight.listByRange(start, end).catch(() => []),
            sleep.listByRange(start, end).catch(() => []),
            activity.listByRange(start, end).catch(() => []),
          ]);

          const dump = { exported_at: new Date().toISOString(), food, insulin: ins, glucose: glu, bp: b, weight: w, sleep: sl, activity: act };
          const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `backup-${todayISO()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("پشتیبان دانلود شد");
        } catch (err) {
          console.error(err);
          toast.error("خطا در پشتیبان‌گیری");
        }
      });
    }

    /* ---------- Security -------------------------------------------- */
    function renderSecurity(wrap) {
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("lock", { size: 18 })}<span>تغییر رمز عبور</span></div>
                <div class="settings-section__desc">رمز عبور قوی با حداقل ۸ کاراکتر، شامل حرف و عدد</div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">رمز عبور فعلی</label>
              <input class="form-input" type="password" data-pwd="current" dir="ltr" />
            </div>
            <div class="form-group">
              <label class="form-label">رمز عبور جدید</label>
              <input class="form-input" type="password" data-pwd="new" dir="ltr" />
            </div>
            <div class="form-group">
              <label class="form-label">تکرار رمز جدید</label>
              <input class="form-input" type="password" data-pwd="confirm" dir="ltr" />
            </div>
            <div class="flex justify-end">
              <button class="btn btn--primary" data-pwd-save type="button">${icon("save", { size: 16 })}<span>تغییر رمز</span></button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("mail", { size: 18 })}<span>تغییر ایمیل</span></div>
                <div class="settings-section__desc">ایمیل جدید پس از تأیید جایگزین می‌شود</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">ایمیل جدید</label>
                <input class="form-input" type="email" data-email="new" dir="ltr" />
              </div>
            </div>
            <div class="flex justify-end">
              <button class="btn btn--primary" data-email-save type="button">${icon("save", { size: 16 })}<span>تغییر ایمیل</span></button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("logOut", { size: 18 })}<span>خروج از حساب</span></div>
                <div class="settings-section__desc">خروج از دستگاه‌های دیگر</div>
              </div>
            </div>
            <button class="btn btn--danger-soft" data-signout-all type="button">${icon("logOut", { size: 16 })}<span>خروج از همه دستگاه‌ها</span></button>
          </div>
        </div>
      `;

      wrap.querySelector("[data-pwd-save]").addEventListener("click", async () => {
        const current = wrap.querySelector('[data-pwd="current"]').value;
        const pwd = wrap.querySelector('[data-pwd="new"]').value;
        const confirmPwd = wrap.querySelector('[data-pwd="confirm"]').value;
        const { valid, errors } = validate({ pwd, confirmPwd }, {
          pwd: [validators.required, validators.password],
          confirmPwd: [validators.match(pwd, "تکرار رمز")],
        });
        if (!valid) return toast.error(Object.values(errors)[0]);
        try {
          // Optional: verify current password by signing in
          const user = store.get("user");
          if (current) {
            await auth.signIn(user.email, current);
          }
          await auth.updatePassword(pwd);
          toast.success("رمز عبور تغییر یافت");
          wrap.querySelectorAll("[data-pwd]").forEach((el) => (el.value = ""));
        } catch (err) {
          toast.error(err.message || "تغییر رمز ناموفق بود");
        }
      });

      wrap.querySelector("[data-email-save]").addEventListener("click", async () => {
        const email = wrap.querySelector('[data-email="new"]').value.trim();
        const v = validators.email(email);
        if (!email || v) return toast.error(v || "ایمیل را وارد کنید");
        try {
          await auth.updateEmail(email);
          toast.success("ایمیل تغییر یافت — لطفاً تأیید کنید");
        } catch (err) {
          toast.error(err.message || "خطا");
        }
      });

      wrap.querySelector("[data-signout-all]").addEventListener("click", async () => {
        const ok = await confirm({
          title: "خروج از همه دستگاه‌ها",
          message: "از تمام دستگاه‌های وارد‌شده خارج می‌شوید. ادامه؟",
          variant: "warning",
          confirmLabel: "خروج",
        });
        if (!ok) return;
        try {
          await auth.signOut({ global: true });
        } catch {
          toast.error("خطا");
        }
      });
    }

    /* ---------- Danger zone ----------------------------------------- */
    function renderDanger(wrap) {
      wrap.innerHTML = `
        <div class="settings-panel is-active">
          <div class="settings-section danger-zone">
            <div class="settings-section__head">
              <div>
                <div class="settings-section__title">${icon("alert", { size: 18 })}<span>حذف حساب کاربری</span></div>
                <div class="settings-section__desc">تمام اطلاعات شما به‌طور دائمی حذف می‌شود. این عمل قابل بازگشت نیست.</div>
              </div>
            </div>
            <button class="btn btn--danger" data-delete-account type="button">${icon("trash", { size: 16 })}<span>حذف دائمی حساب</span></button>
          </div>
        </div>
      `;

      wrap.querySelector("[data-delete-account]").addEventListener("click", async () => {
        const ok = await confirm({
          title: "حذف حساب کاربری",
          message: "این عملیات تمام داده‌های شما را حذف می‌کند. آیا مطمئن هستید؟",
          variant: "danger",
          confirmLabel: "حذف حساب",
        });
        if (!ok) return;

        // Second confirmation with typed text
        const m = modal.open({
          title: "تأیید نهایی",
          iconName: "alert",
          size: "sm",
          content: `
            <p class="text-sm text-muted" style="margin-bottom:12px">برای تأیید، عبارت <strong>حذف حساب</strong> را وارد کنید:</p>
            <input class="form-input" data-confirm-input placeholder="حذف حساب" />
          `,
          footer: [
            { label: "انصراف", variant: "ghost" },
            {
              label: "حذف دائمی",
              variant: "danger",
              onClick: async (e, handle) => {
                const val = handle.el.querySelector("[data-confirm-input]").value.trim();
                if (val !== "حذف حساب") {
                  toast.error("عبارت تأیید نادرست است");
                  return false;
                }
                try {
                  // Requires an Edge Function or RPC on the server.
                  const { supabase } = await import("../config/supabase.js");
                  const { error } = await supabase.rpc("delete_my_account");
                  if (error) throw error;
                  await auth.signOut();
                  toast.success("حساب حذف شد");
                } catch (err) {
                  toast.error("حذف حساب نیازمند تماس با پشتیبانی است");
                }
              },
            },
          ],
        });
      });
    }

    renderPanel();

    return function cleanup() {};
  },
};