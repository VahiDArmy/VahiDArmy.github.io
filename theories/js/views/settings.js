import { updateProfile, updatePassword, uploadImage } from "../api.js";
import { getState, setState, setTheme } from "../store.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { escapeHtml, isImageFile } from "../utils.js";
import { toast, setButtonLoading, confirmDialog } from "../ui.js";
import { avatar } from "../components.js";
import { supabase } from "../supabase.js";

function tabItem(key, label, iconName, current) {
  return `<button class="settings-nav__item ${key === current ? "is-active" : ""}" type="button" data-settings-tab="${key}">${icon(iconName, 15)} ${label}</button>`;
}

export function renderSettings(ctx) {
  const state = getState();
  if (!state.user) {
    navigate("/login?next=/settings", { replace: true });
    return { html: "", skip: true };
  }
  const profile = state.profile || {};
  const activeTab = ctx.query.tab || "account";

  return {
    layout: "app",
    title: "تنظیمات",
    html: `
      <div class="container page page-enter">
        <div class="page-head">
          <div class="page-head__copy">
            <span class="eyebrow">تنظیمات</span>
            <h1 class="page-title">فضای شخصی</h1>
            <p class="page-subtitle">حساب، ظاهر و امنیت خود را مدیریت کن.</p>
          </div>
        </div>

        <div class="settings-layout">
          <nav class="settings-nav">
            ${tabItem("account", "حساب کاربری", "user", activeTab)}
            ${tabItem("appearance", "ظاهر", "palette", activeTab)}
            ${tabItem("security", "امنیت", "shield", activeTab)}
            ${tabItem("danger", "خطر", "alert", activeTab)}
          </nav>

          <section class="settings-panel" data-settings-panel>
            ${activeTab === "account" ? accountPanel(profile) : ""}
            ${activeTab === "appearance" ? appearancePanel(state.theme) : ""}
            ${activeTab === "security" ? securityPanel() : ""}
            ${activeTab === "danger" ? dangerPanel() : ""}
          </section>
        </div>
      </div>
    `,
    mount(root) {
      root.querySelectorAll("[data-settings-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          navigate(`/settings?tab=${button.dataset.settingsTab}`, { replace: true });
        });
      });

      const accountForm = root.querySelector("[data-account-form]");
      accountForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(accountForm).entries());
        const submit = accountForm.querySelector("button[type=submit]");
        try {
          setButtonLoading(submit, true);
          const updated = await updateProfile(state.user.id, data);
          setState({ profile: { ...state.profile, ...updated } });
          toast({ type: "success", title: "ذخیره شد", message: "تغییرات پروفایل به‌روزرسانی شد." });
        } catch (error) {
          toast({ type: "error", title: "ذخیره نشد", message: error.message });
        } finally {
          setButtonLoading(submit, false);
        }
      });

      root.querySelector("[data-avatar-input]")?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file || !isImageFile(file)) return;
        try {
          toast({ type: "info", title: "بارگذاری آواتار…", duration: 2000 });
          const url = await uploadImage(file, state.user.id, "avatars");
          await updateProfile(state.user.id, { ...state.profile, avatar_url: url });
          setState({ profile: { ...state.profile, avatar_url: url } });
          const preview = root.querySelector("[data-avatar-preview]");
          if (preview) preview.innerHTML = avatar({ ...state.profile, avatar_url: url }, "xl");
          toast({ type: "success", title: "آواتار به‌روزرسانی شد" });
        } catch (error) {
          toast({ type: "error", title: "بارگذاری نشد", message: error.message });
        }
      });

      root.querySelectorAll("[data-theme-option]").forEach((button) => {
        button.addEventListener("click", () => {
          setTheme(button.dataset.themeOption);
          root.querySelectorAll("[data-theme-option]").forEach((item) => item.classList.toggle("is-active", item === button));
        });
      });

      const passwordForm = root.querySelector("[data-password-form]");
      passwordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(passwordForm).entries());
        if (data.password.length < 6) return toast({ type: "error", title: "رمز کوتاه است" });
        if (data.password !== data.confirm) return toast({ type: "error", title: "تکرار مطابقت ندارد" });
        const submit = passwordForm.querySelector("button[type=submit]");
        try {
          setButtonLoading(submit, true);
          await updatePassword(data.password);
          passwordForm.reset();
          toast({ type: "success", title: "رمز تغییر کرد" });
        } catch (error) {
          toast({ type: "error", title: "تغییر انجام نشد", message: error.message });
        } finally {
          setButtonLoading(submit, false);
        }
      });

      root.querySelector("[data-signout]")?.addEventListener("click", async () => {
        const ok = await confirmDialog({ title: "خروج از حساب؟", description: "برای ادامه باید دوباره وارد شوی.", confirmText: "خروج", danger: true });
        if (!ok) return;
        try {
          await supabase.auth.signOut();
          setState({ user: null, profile: null, session: null });
          navigate("/");
          toast({ type: "info", title: "خارج شدی" });
        } catch (error) {
          toast({ type: "error", title: "خروج انجام نشد", message: error.message });
        }
      });
    },
  };
}

function accountPanel(profile) {
  return `
    <div class="settings-panel__head">
      <h2 class="settings-panel__title">حساب کاربری</h2>
      <p class="settings-panel__sub">اطلاعات نمایشی خودت را ویرایش کن.</p>
    </div>
    <form class="settings-form" data-account-form>
      <div class="flex items-center gap-4" style="flex-wrap:wrap">
        <div data-avatar-preview>${avatar(profile, "xl")}</div>
        <label class="btn btn--outline btn--sm" style="cursor:pointer">
          ${icon("upload", 14)} تغییر آواتار
          <input type="file" accept="image/*" data-avatar-input style="display:none">
        </label>
      </div>
      <div class="field">
        <label class="field__label">نام نمایشی</label>
        <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}">
      </div>
      <div class="field">
        <label class="field__label">نام کاربری</label>
        <input class="input" name="username" value="${escapeHtml(profile.username || "")}">
        <span class="field__hint">حروف انگلیسی، عدد و زیرخط.</span>
      </div>
      <div class="field">
        <label class="field__label">بیوگرافی</label>
        <textarea class="textarea" name="bio" rows="3">${escapeHtml(profile.bio || "")}</textarea>
      </div>
      <div class="field">
        <label class="field__label">وبسایت</label>
        <input class="input" name="website" value="${escapeHtml(profile.website || "")}" placeholder="https://…">
      </div>
      <div class="flex justify-between" style="flex-wrap:wrap;gap:.5rem">
        <p class="field__hint">${icon("info", 13)} این اطلاعات عمومی است.</p>
        <button class="btn btn--primary" type="submit">${icon("save", 15)} ذخیرهٔ تغییرات</button>
      </div>
    </form>
  `;
}

function appearancePanel(theme) {
  return `
    <div class="settings-panel__head">
      <h2 class="settings-panel__title">ظاهر</h2>
      <p class="settings-panel__sub">حالت نمایش را انتخاب کن.</p>
    </div>
    <div class="theme-options">
      <button class="theme-option ${theme === "dark" ? "is-active" : ""}" type="button" data-theme-option="dark">${icon("moon", 15)} تاریک</button>
      <button class="theme-option ${theme === "light" ? "is-active" : ""}" type="button" data-theme-option="light">${icon("sun", 15)} روشن</button>
      <button class="theme-option ${theme === "system" ? "is-active" : ""}" type="button" data-theme-option="system">${icon("monitor", 15)} همگام با سیستم</button>
    </div>
    <div class="settings-row" style="margin-top:1.5rem">
      <div class="settings-row__copy">
        <div class="settings-row__title">میانبر فرمان‌ها</div>
        <div class="settings-row__desc">برای باز کردن پالت فرمان‌ها کلید ترکیبی زیر را بزن.</div>
      </div>
      <div class="kbd-row"><kbd>⌘</kbd><kbd>K</kbd></div>
    </div>
  `;
}

function securityPanel() {
  return `
    <div class="settings-panel__head">
      <h2 class="settings-panel__title">امنیت</h2>
      <p class="settings-panel__sub">رمز عبور خود را تغییر بده.</p>
    </div>
    <form class="settings-form" data-password-form>
      <div class="field">
        <label class="field__label">رمز جدید</label>
        <input class="input" type="password" name="password" autocomplete="new-password" placeholder="حداقل ۶ کاراکتر">
      </div>
      <div class="field">
        <label class="field__label">تکرار رمز جدید</label>
        <input class="input" type="password" name="confirm" autocomplete="new-password">
      </div>
      <div class="flex justify-between" style="flex-wrap:wrap;gap:.5rem">
        <p class="field__hint">${icon("shield", 13)} رمز را با کسی به اشتراک نگذار.</p>
        <button class="btn btn--primary" type="submit">${icon("key", 15)} تغییر رمز</button>
      </div>
    </form>
  `;
}

function dangerPanel() {
  return `
    <div class="settings-panel__head">
      <h2 class="settings-panel__title">خطر</h2>
      <p class="settings-panel__sub">این بخش حساس است.</p>
    </div>
    <div class="settings-row">
      <div class="settings-row__copy">
        <div class="settings-row__title">خروج از حساب</div>
        <div class="settings-row__desc">با خروج، برای ورود مجدد باید رمز را وارد کنی.</div>
      </div>
      <button class="btn btn--outline btn--sm" type="button" data-signout>${icon("logout", 14)} خروج</button>
    </div>
    <div class="alert alert--warning" style="margin-top:1rem">${icon("alert", 16)}<span>حذف کامل حساب کاربری از طریق سرپرست انجام می‌شود.</span></div>
  `;
}
