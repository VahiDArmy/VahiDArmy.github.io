/**
 * Settings page — profile, goals, appearance, data, security, danger.
 *
 * The Profile panel now collects the anthropometric data BMI/BMR need
 * (weight, height, birth year, gender, activity level) and shows a live
 * preview of BMI, BMR, and TDEE as the user types. No save is required
 * to see the numbers change — but Save is required to persist.
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
import { metrics } from "../services/metrics.service.js";
import { theme } from "../config/theme.js";
import { DEFAULT_GOALS } from "../config/constants.js";
import { escapeHTML, toLatinDigits, formatNumber } from "../utils/format.js";
import { validators, validate } from "../utils/validation.js";
import { ACTIVITY_LEVELS, getActivityLevel } from "../utils/health-formulas.js";

const TABS = [
  { id: "profile", label: "پروفایل", icon: "user" },
  { id: "goals", label: "اهداف", icon: "target" },
  { id: "appearance", label: "نمایش", icon: "palette" },
  { id: "data", label: "داده‌ها", icon: "download" },
  { id: "security", label: "امنیت", icon: "lock" },
  { id: "danger", label: "منطقه خطر", icon: "alert" },
];

export default {
  title: "تنظیمات",
  subtitle: "مدیریت حساب",
  icon: "settings",

  async render(container) {
    let activePanel = "profile";
    const user = store.get("user");
    const profileData = store.get("profile") || {};

    container.innerHTML = `
      <div class="report-tabs" data-settings-tabs style="margin-bottom:20px;flex-wrap:wrap">
        ${TABS.map((t) => `
          <button class="report-tab ${t.id === activePanel ? "is-active" : ""}" data-panel="${t.id}" type="button">
            ${icon(t.icon, { size: 13 })} <span>${t.label}</span>
          </button>
        `).join("")}
      </div>
      <div data-panels></div>
    `;

    function switchPanel(name) {
      activePanel = name;
      container.querySelectorAll("[data-settings-tabs] [data-panel]").forEach((el) =>
        el.classList.toggle("is-active", el.dataset.panel === name)
      );
      renderPanel();
    }

    delegate(container, "click", "[data-settings-tabs] [data-panel]", (e, btn) => switchPanel(btn.dataset.panel));

    function renderPanel() {
      const wrap = $("[data-panels]", container);
      if (activePanel === "profile") renderProfile(wrap);
      else if (activePanel === "goals") renderGoals(wrap);
      else if (activePanel === "appearance") renderAppearance(wrap);
      else if (activePanel === "data") renderData(wrap);
      else if (activePanel === "security") renderSecurity(wrap);
      else if (activePanel === "danger") renderDanger(wrap);
    }

    /* =============================================================
       PROFILE — with live BMI/BMR/TDEE preview
       ============================================================= */
    function renderProfile(wrap) {
      wrap.innerHTML = `
        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("user", { size: 18 })}<span>اطلاعات پروفایل</span></div>
              <div class="settings-section__desc">وزن، قد، سال تولد و سطح فعالیت برای محاسبه BMI، BMR و TDEE استفاده می‌شوند</div>
            </div>
          </div>

          <div class="avatar-upload">
            <div class="avatar-upload__preview" data-avatar>
              ${profileData.avatar_url
                ? `<img src="${escapeHTML(profileData.avatar_url)}" alt="" />`
                : escapeHTML((profileData.display_name?.[0] || user?.email?.[0] || "؟").toUpperCase())}
            </div>
            <div class="avatar-upload__body">
              <button class="btn btn--secondary btn--sm" data-upload-avatar type="button">${icon("upload", { size: 14 })}<span>تغییر تصویر</span></button>
              <div class="text-2xs text-muted">JPG / PNG — حداکثر ۲ مگابایت</div>
            </div>
          </div>

          <!-- Identity -->
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

          <!-- Anthropometrics — highlighted because they drive the metrics -->
          <div class="metrics-form">
            <div class="metrics-form__title">${icon("activity", { size: 16 })}<span>اطلاعات بدنی</span></div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">وزن <span class="form-label__hint">(کیلوگرم)</span></label>
                <input class="form-input" type="number" step="0.1" min="20" max="400"
                       data-field="weight_kg" data-metric="weightKg"
                       value="${profileData.weight_kg ?? ""}" placeholder="مثلاً 72.5" />
              </div>
              <div class="form-group">
                <label class="form-label">قد <span class="form-label__hint">(سانتی‌متر)</span></label>
                <input class="form-input" type="number" step="0.5" min="80" max="250"
                       data-field="height_cm" data-metric="heightCm"
                       value="${profileData.height_cm ?? ""}" placeholder="مثلاً 175" />
              </div>
              <div class="form-group">
                <label class="form-label">سال تولد <span class="form-label__hint">(میلادی)</span></label>
                <input class="form-input" type="number" min="1900" max="2100"
                       data-field="birth_year" data-metric="birthYear"
                       value="${profileData.birth_year ?? ""}" placeholder="مثلاً 1990" dir="ltr" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">جنسیت</label>
                <select class="form-select" data-field="gender" data-metric="gender">
                  <option value="">انتخاب…</option>
                  <option value="male" ${profileData.gender === "male" ? "selected" : ""}>مرد</option>
                  <option value="female" ${profileData.gender === "female" ? "selected" : ""}>زن</option>
                  <option value="other" ${profileData.gender === "other" ? "selected" : ""}>سایر</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">سطح فعالیت</label>
                <select class="form-select" data-field="activity_level" data-metric="activity">
                  <option value="">انتخاب…</option>
                  ${ACTIVITY_LEVELS.map((l) => `
                    <option value="${l.id}" ${profileData.activity_level === l.id ? "selected" : ""}>
                      ${l.label} — ${l.desc}
                    </option>
                  `).join("")}
                </select>
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
            </div>

            <div class="settings-metrics-preview" data-metrics-preview></div>
          </div>

          <div class="flex justify-end gap-2">
            <button class="btn btn--primary" data-save="profile" type="button">${icon("save", { size: 16 })}<span>ذخیره</span></button>
          </div>
        </div>
      `;

      // -------- Live preview ----------------------------------------
      const previewEl = wrap.querySelector("[data-metrics-preview]");

      function readForm() {
        const num = (name, decimals = null) => {
          const el = wrap.querySelector(`[data-field="${name}"]`);
          if (!el || el.value === "") return null;
          const v = Number(toLatinDigits(el.value));
          if (!Number.isFinite(v)) return null;
          return decimals == null ? v : Number(v.toFixed(decimals));
        };
        const sel = (name) => {
          const el = wrap.querySelector(`[data-field="${name}"]`);
          return el?.value || null;
        };
        return {
          weightKg: num("weight_kg", 2),
          heightCm: num("height_cm", 2),
          birthYear: num("birth_year"),
          gender: sel("gender"),
          activity: sel("activity_level"),
        };
      }

      function updatePreview() {
        const input = readForm();
        const result = metrics.preview(input);
        previewEl.innerHTML = renderMetricsPreview(result);
      }

      // Attach input/change listeners so the preview updates live.
      wrap.querySelectorAll("[data-metric]").forEach((el) => {
        el.addEventListener("input", updatePreview);
        el.addEventListener("change", updatePreview);
      });

      updatePreview();

      // -------- Avatar upload ---------------------------------------
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
          } catch { toast.error("آپلود ناموفق بود"); }
        });
        input.click();
      });

      // -------- Save ------------------------------------------------
      wrap.querySelector("[data-save='profile']").addEventListener("click", async () => {
        const input = readForm();

        // Range checks — same thresholds as the input `min`/`max` hints.
        const rangeErrors = [];
        if (input.weightKg != null && (input.weightKg < 20 || input.weightKg > 400)) rangeErrors.push("وزن باید بین ۲۰ تا ۴۰۰ کیلوگرم باشد");
        if (input.heightCm != null && (input.heightCm < 80 || input.heightCm > 250)) rangeErrors.push("قد باید بین ۸۰ تا ۲۵۰ سانتی‌متر باشد");
        const thisYear = new Date().getFullYear();
        if (input.birthYear != null && (input.birthYear < 1900 || input.birthYear > thisYear)) rangeErrors.push("سال تولد معتبر نیست");
        if (rangeErrors.length) return toast.error(rangeErrors[0]);

        const patch = {
          display_name: wrap.querySelector('[data-field="display_name"]').value?.trim() || null,
          weight_kg: input.weightKg,
          height_cm: input.heightCm,
          birth_year: input.birthYear,
          gender: input.gender,
          activity_level: input.activity,
          diabetes_type: wrap.querySelector('[data-field="diabetes_type"]').value || null,
        };
        try {
          await profile.save(patch);
          toast.success("ذخیره شد");
        } catch (err) {
          toast.error(err?.message || "ذخیره ناموفق بود");
        }
      });
    }

    /* ---------- Goals ---------------------------------------------- */
    function renderGoals(wrap) {
      const g = store.get("goals") || DEFAULT_GOALS;
      wrap.innerHTML = `
        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("target", { size: 18 })}<span>اهداف روزانه</span></div>
              <div class="settings-section__desc">مقادیر هدف برای کالری و درشت‌مغذی‌ها</div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group"><label class="form-label">کالری (kcal)</label><input class="form-input" type="number" data-goal="calories" value="${g.calories}" /></div>
            <div class="form-group"><label class="form-label">پروتئین (گرم)</label><input class="form-input" type="number" data-goal="protein" value="${g.protein}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">کربوهیدرات (گرم)</label><input class="form-input" type="number" data-goal="carbs" value="${g.carbs}" /></div>
            <div class="form-group"><label class="form-label">چربی (گرم)</label><input class="form-input" type="number" data-goal="fat" value="${g.fat}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">فیبر (گرم)</label><input class="form-input" type="number" data-goal="fiber" value="${g.fiber}" /></div>
            <div class="form-group"><label class="form-label">آب (لیوان)</label><input class="form-input" type="number" data-goal="water" value="${g.water}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">قدم روزانه</label><input class="form-input" type="number" data-goal="steps" value="${g.steps}" /></div>
            <div class="form-group"><label class="form-label">خواب (ساعت)</label><input class="form-input" type="number" step="0.5" data-goal="sleepHours" value="${g.sleepHours}" /></div>
          </div>

          <div class="flex justify-between gap-2">
            <button class="btn btn--ghost btn--sm" data-goal-reset type="button">${icon("refresh", { size: 14 })}<span>بازگردانی به پیش‌فرض</span></button>
            <button class="btn btn--primary" data-goal-save type="button">${icon("save", { size: 16 })}<span>ذخیره اهداف</span></button>
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
        } catch { toast.error("ذخیره ناموفق بود"); }
      });
      wrap.querySelector("[data-goal-reset]").addEventListener("click", async () => {
        const ok = await confirm({ title: "بازگردانی اهداف", message: "به مقادیر پیش‌فرض بازگردانده شوند؟", variant: "warning", confirmLabel: "بازگردان" });
        if (!ok) return;
        try {
          await goals.save(DEFAULT_GOALS);
          toast.success("بازگردانی شد");
          renderPanel();
        } catch { toast.error("خطا"); }
      });
    }

    /* ---------- Appearance ----------------------------------------- */
    function renderAppearance(wrap) {
      const current = theme.current;
      wrap.innerHTML = `
        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("palette", { size: 18 })}<span>پوسته</span></div>
              <div class="settings-section__desc">حالت تیره یا روشن</div>
            </div>
          </div>
          <div class="theme-picker">
            <div class="theme-opt ${current === "dark" ? "is-active" : ""}" data-theme-opt="dark" role="button" tabindex="0">
              <div class="theme-opt__preview theme-opt__preview--dark"></div>
              <div class="theme-opt__label">تیره</div>
            </div>
            <div class="theme-opt ${current === "light" ? "is-active" : ""}" data-theme-opt="light" role="button" tabindex="0">
              <div class="theme-opt__preview" style="background:linear-gradient(135deg, #f5f7fb 0%, #dde1ec 100%)"></div>
              <div class="theme-opt__label">روشن</div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("globe", { size: 18 })}<span>نمایش</span></div>
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
      `;

      wrap.querySelectorAll("[data-theme-opt]").forEach((el) => {
        el.addEventListener("click", () => {
          theme.apply(el.dataset.themeOpt);
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

    /* ---------- Data ----------------------------------------------- */
    function renderData(wrap) {
      wrap.innerHTML = `
        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("download", { size: 18 })}<span>پشتیبان‌گیری</span></div>
              <div class="settings-section__desc">دریافت اطلاعات در قالب JSON</div>
            </div>
          </div>
          <p class="text-sm text-muted">فایل خروجی شامل تمام ثبت‌های غذا، سلامت، خواب و ورزش است.</p>
          <div>
            <button class="btn btn--primary" data-backup type="button">${icon("download", { size: 16 })}<span>دانلود پشتیبان کامل</span></button>
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
            foodLog.listByRange(start, end),
            insulin.listByRange(start, end),
            glucose.listByRange(start, end),
            bp.listByRange(start, end),
            weight.listByRange(start, end),
            sleep.listByRange(start, end),
            activity.listByRange(start, end),
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
        } catch { toast.error("خطا در پشتیبان‌گیری"); }
      });
    }

    /* ---------- Security ------------------------------------------- */
    function renderSecurity(wrap) {
      wrap.innerHTML = `
        <div class="settings-section">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("lock", { size: 18 })}<span>تغییر رمز عبور</span></div>
              <div class="settings-section__desc">حداقل ۸ کاراکتر شامل حرف و عدد</div>
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
      `;

      wrap.querySelector("[data-pwd-save]").addEventListener("click", async () => {
        const current = wrap.querySelector('[data-pwd="current"]').value;
        const pwd = wrap.querySelector('[data-pwd="new"]').value;
        const confirmPwd = wrap.querySelector('[data-pwd="confirm"]').value;
        const { valid, errors } = validate({ pwd, confirmPwd }, {
          pwd: [validators.required, validators.password],
          confirmPwd: [validators.match(() => pwd, "تکرار رمز")],
        });
        if (!valid) return toast.error(Object.values(errors)[0]);
        try {
          const user = store.get("user");
          if (current) await auth.signIn(user.email, current);
          await auth.updatePassword(pwd);
          toast.success("رمز عبور تغییر یافت");
          wrap.querySelectorAll("[data-pwd]").forEach((el) => (el.value = ""));
        } catch (err) { toast.error(err.message || "تغییر رمز ناموفق بود"); }
      });
    }

    /* ---------- Danger --------------------------------------------- */
    function renderDanger(wrap) {
      wrap.innerHTML = `
        <div class="settings-section danger-zone">
          <div class="settings-section__head">
            <div>
              <div class="settings-section__title">${icon("alert", { size: 18 })}<span>حذف حساب کاربری</span></div>
              <div class="settings-section__desc">تمام اطلاعات به‌طور دائمی حذف می‌شود.</div>
            </div>
          </div>
          <button class="btn btn--danger" data-delete-account type="button">${icon("trash", { size: 16 })}<span>حذف دائمی حساب</span></button>
        </div>
      `;

      wrap.querySelector("[data-delete-account]").addEventListener("click", async () => {
        const ok = await confirm({ title: "حذف حساب", message: "این عملیات قابل بازگشت نیست. مطمئن هستید؟", variant: "danger", confirmLabel: "حذف حساب" });
        if (!ok) return;
        modal.open({
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
              label: "حذف دائمی", variant: "danger",
              onClick: async (e, handle) => {
                const val = handle.el.querySelector("[data-confirm-input]").value.trim();
                if (val !== "حذف حساب") { toast.error("عبارت تأیید نادرست است"); return false; }
                try {
                  const { supabase } = await import("../config/supabase.js");
                  const { error } = await supabase.rpc("delete_my_account");
                  if (error) throw error;
                  await auth.signOut();
                  toast.success("حساب حذف شد");
                } catch { toast.error("حذف حساب نیازمند تماس با پشتیبانی است"); }
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

/* =============================================================
   Metrics preview renderer — shared visual language with the Health
   page card so users see the same numbers represented the same way.
   ============================================================= */
function renderMetricsPreview(result) {
  if (!result.ready) {
    const missing = result.missing.join("، ");
    return `
      <div class="metrics-preview metrics-preview--incomplete">
        <div class="metrics-preview__icon">${icon("info", { size: 18 })}</div>
        <div class="metrics-preview__body">
          <div class="metrics-preview__title">برای محاسبه به اطلاعات بیشتری نیاز است</div>
          <div class="metrics-preview__desc">لطفاً ${missing} را وارد کنید</div>
        </div>
      </div>
    `;
  }

  const { bmi, bmr, tdee, healthy } = result;
  const cat = bmi?.category;

  return `
    <div class="metrics-preview">
      <div class="metrics-preview__grid">
        <div class="metrics-preview__item">
          <div class="metrics-preview__label">شاخص توده بدنی (BMI)</div>
          <div class="metrics-preview__value metrics-preview__value--${cat?.tone || "flat"}">
            ${formatNumber(bmi.value, { decimals: 1 })}
          </div>
          ${cat ? `<div class="metrics-preview__badge metrics-preview__badge--${cat.tone}">${cat.label}</div>` : ""}
        </div>

        <div class="metrics-preview__item">
          <div class="metrics-preview__label">سوخت‌وساز پایه (BMR)</div>
          <div class="metrics-preview__value">${formatNumber(bmr)}<small>kcal</small></div>
          <div class="metrics-preview__hint">در حالت استراحت</div>
        </div>

        <div class="metrics-preview__item">
          <div class="metrics-preview__label">کالری روزانه (TDEE)</div>
          <div class="metrics-preview__value">${formatNumber(tdee)}<small>kcal</small></div>
          <div class="metrics-preview__hint">با احتساب فعالیت</div>
        </div>
      </div>

      ${healthy ? `
        <div class="metrics-preview__foot">
          محدوده وزن نرمال برای قد شما: <strong>${formatNumber(healthy.min, { decimals: 1 })}</strong> تا <strong>${formatNumber(healthy.max, { decimals: 1 })}</strong> کیلوگرم
        </div>
      ` : ""}
    </div>
  `;
}