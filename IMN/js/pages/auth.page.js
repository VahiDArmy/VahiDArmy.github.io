/**
 * Auth page — sign in, sign up, password reset.
 * Rendered inside #auth-screen (not the router container).
 */

import { $, createElement, show, hide } from "../utils/dom.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { auth } from "../services/auth.service.js";
import { validators, validate } from "../utils/validation.js";

export function mountAuth() {
  const root = document.getElementById("auth-screen");
  if (!root) return;
  root.hidden = false;
  root.innerHTML = "";

  const card = createElement("div", { class: "auth-card anim-fade-in-up" });
  card.innerHTML = `
    <div class="auth-brand">
      <div class="auth-brand__logo">${icon("heartPulse", { size: 34 })}</div>
      <div class="auth-brand__title">ردیاب فعالیت روزانه</div>
      <div class="auth-brand__sub">ثبت غذا، سلامت، خواب و ورزش در یک‌جا</div>
    </div>

    <div class="auth-tabs" role="tablist">
      <button class="auth-tabs__btn is-active" data-auth-tab="signin" type="button">ورود</button>
      <button class="auth-tabs__btn" data-auth-tab="signup" type="button">ثبت‌نام</button>
    </div>

    <div class="auth-message" data-auth-message></div>

    <!-- SIGN IN -->
    <form class="auth-form is-active" data-auth-form="signin" novalidate>
      <div class="form-group">
        <label class="form-label" for="si-email">ایمیل</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("mail", { size: 18 })}</span>
          <input id="si-email" name="email" class="form-input has-icon-start" type="email" autocomplete="email" dir="ltr" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="si-pass">رمز عبور</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("lock", { size: 18 })}</span>
          <input id="si-pass" name="password" class="form-input has-icon-start has-icon-end" type="password" autocomplete="current-password" dir="ltr" required />
          <span class="input-group__action" data-toggle-password="${"si-pass"}" role="button" tabindex="0">${icon("eye", { size: 16 })}</span>
        </div>
      </div>
      <div class="auth-alt">
        <label class="form-check">
          <input type="checkbox" name="remember" checked />
          <span>مرا به خاطر بسپار</span>
        </label>
        <a data-auth-tab="reset" role="button" tabindex="0">فراموشی رمز عبور؟</a>
      </div>
      <button class="btn btn--primary btn--block" type="submit">ورود به حساب</button>
    </form>

    <!-- SIGN UP -->
    <form class="auth-form" data-auth-form="signup" novalidate>
      <div class="form-group">
        <label class="form-label" for="su-email">ایمیل</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("mail", { size: 18 })}</span>
          <input id="su-email" name="email" class="form-input has-icon-start" type="email" autocomplete="email" dir="ltr" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="su-pass">رمز عبور</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("lock", { size: 18 })}</span>
          <input id="su-pass" name="password" class="form-input has-icon-start has-icon-end" type="password" autocomplete="new-password" dir="ltr" required />
          <span class="input-group__action" data-toggle-password="su-pass" role="button" tabindex="0">${icon("eye", { size: 16 })}</span>
        </div>
        <div class="pwd-strength" data-pwd-strength>
          <div class="pwd-strength__bar"></div>
          <div class="pwd-strength__bar"></div>
          <div class="pwd-strength__bar"></div>
          <div class="pwd-strength__bar"></div>
        </div>
        <div class="pwd-strength__label" data-pwd-label>حداقل ۸ کاراکتر شامل حرف و عدد</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="su-pass2">تکرار رمز عبور</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("lock", { size: 18 })}</span>
          <input id="su-pass2" name="password2" class="form-input has-icon-start" type="password" autocomplete="new-password" dir="ltr" required />
        </div>
      </div>
      <button class="btn btn--primary btn--block" type="submit">ایجاد حساب کاربری</button>
      <p class="text-xs text-muted text-center" style="margin-top:8px;line-height:1.7">
        با ثبت‌نام، شرایط استفاده و سیاست حفظ حریم خصوصی را می‌پذیرید.
      </p>
    </form>

    <!-- RESET -->
    <form class="auth-form" data-auth-form="reset" novalidate>
      <p class="text-sm text-muted" style="margin-bottom:16px;line-height:1.8">
        ایمیل خود را وارد کنید؛ لینک بازنشانی رمز عبور برای شما ارسال می‌شود.
      </p>
      <div class="form-group">
        <label class="form-label" for="rs-email">ایمیل</label>
        <div class="input-group">
          <span class="input-group__icon input-group__icon--start">${icon("mail", { size: 18 })}</span>
          <input id="rs-email" name="email" class="form-input has-icon-start" type="email" autocomplete="email" dir="ltr" required />
        </div>
      </div>
      <button class="btn btn--primary btn--block" type="submit">ارسال لینک بازیابی</button>
      <div class="auth-footer">
        <a data-auth-tab="signin" role="button" tabindex="0">بازگشت به ورود</a>
      </div>
    </form>
  `;

  root.appendChild(card);

  wireTabs(card);
  wirePasswordToggles(card);
  wirePasswordStrength(card);
  wireForms(card);
}

export function unmountAuth() {
  const root = document.getElementById("auth-screen");
  if (!root) return;
  root.hidden = true;
  root.innerHTML = "";
}

/* ---------- UI wiring -------------------------------------------------- */
function wireTabs(card) {
  card.querySelectorAll("[data-auth-tab]").forEach((el) => {
    el.addEventListener("click", () => switchTab(card, el.dataset.authTab));
  });
}

function switchTab(card, tab) {
  card.querySelectorAll("[data-auth-tab]").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.authTab === tab && b.matches(".auth-tabs__btn"))
  );
  card.querySelectorAll("[data-auth-form]").forEach((f) =>
    f.classList.toggle("is-active", f.dataset.authForm === tab)
  );
  clearMessage(card);
  setTimeout(() => {
    const first = card.querySelector(`[data-auth-form="${tab}"].is-active input`);
    first?.focus();
  }, 60);
}

function wirePasswordToggles(card) {
  card.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const id = btn.dataset.togglePassword;
    const input = document.getElementById(id);
    if (!input) return;
    btn.addEventListener("click", () => {
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.innerHTML = icon(isPass ? "eyeOff" : "eye", { size: 16 });
    });
  });
}

function wirePasswordStrength(card) {
  const input = card.querySelector("#su-pass");
  const bars = card.querySelectorAll("[data-pwd-strength] .pwd-strength__bar");
  const label = card.querySelector("[data-pwd-label]");
  if (!input) return;

  const update = () => {
    const v = input.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Za-z]/.test(v) && /\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
    if (v.length >= 10 && /[^A-Za-z0-9]/.test(v)) score++;

    const cls = score <= 1 ? "is-weak" : score <= 2 ? "is-medium" : "is-strong";
    bars.forEach((b, i) => {
      b.className = "pwd-strength__bar" + (i < score ? " " + cls : "");
    });
    label.textContent =
      score <= 1 ? "رمز ضعیف" :
      score <= 2 ? "رمز متوسط" :
      "رمز قوی";
  };

  input.addEventListener("input", update);
}

function wireForms(card) {
  const msgEl = card.querySelector("[data-auth-message]");

  function showMessage(text, type = "error") {
    msgEl.textContent = text;
    msgEl.className = `auth-message is-${type}`;
  }
  function clearMessage() {
    msgEl.className = "auth-message";
    msgEl.textContent = "";
  }
  card._clearMessage = clearMessage;

  /* Sign in */
  card.querySelector('[data-auth-form="signin"]').addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const btn = form.querySelector('button[type="submit"]');

    const { valid, errors } = validate({ email, password }, {
      email: [validators.required, validators.email],
      password: [validators.required],
    });
    if (!valid) {
      showMessage(errors.email || errors.password);
      return;
    }

    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      await auth.signIn(email, password);
      toast.success("خوش آمدید!");
      // app.js listens on auth:changed and will transition
    } catch (err) {
      showMessage(err.message || "ورود ناموفق بود");
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  });

  /* Sign up */
  card.querySelector('[data-auth-form="signup"]').addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const password2 = form.password2.value;
    const btn = form.querySelector('button[type="submit"]');

    const { valid, errors } = validate(
      { email, password, password2 },
      {
        email: [validators.required, validators.email],
        password: [validators.required, validators.password],
        password2: [validators.required, validators.match(password, "تکرار رمز عبور")],
      }
    );
    if (!valid) {
      showMessage(Object.values(errors)[0]);
      return;
    }

    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const { needsConfirmation } = await auth.signUp(email, password);
      if (needsConfirmation) {
        showMessage("ایمیل تأیید برای شما ارسال شد. لطفاً صندوق ورودی خود را بررسی کنید.", "success");
        form.reset();
      } else {
        toast.success("حساب کاربری ساخته شد");
      }
    } catch (err) {
      showMessage(err.message || "ثبت‌نام ناموفق بود");
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  });

  /* Reset */
  card.querySelector('[data-auth-form="reset"]').addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();
    const form = e.target;
    const email = form.email.value.trim();
    const btn = form.querySelector('button[type="submit"]');

    const v = validators.email(email);
    if (!email || v) {
      showMessage(v || "ایمیل را وارد کنید");
      return;
    }

    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      await auth.resetPassword(email);
      showMessage("اگر این ایمیل در سیستم موجود باشد، لینک بازیابی ارسال شده است.", "success");
    } catch (err) {
      showMessage(err.message || "ارسال لینک ناموفق بود");
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  });
}