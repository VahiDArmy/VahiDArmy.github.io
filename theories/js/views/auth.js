import { signIn, signUp, sendPasswordReset, getAuthErrorMessage } from "../api.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { QUOTES } from "../config.js";
import { escapeHtml, validateEmail, passwordScore } from "../utils.js";
import { toast, setButtonLoading } from "../ui.js";

function quoteBlock() {
  const quote = QUOTES[0];
  return `
    <div class="auth-quote">
      <div class="auth-quote__mark">”</div>
      <p class="auth-quote__text">${escapeHtml(quote.text)}</p>
      <div class="auth-quote__author">
        <span class="notice-dot"></span>
        <span>${escapeHtml(quote.author)}</span>
      </div>
    </div>
  `;
}

function visual() {
  return `
    <aside class="auth-visual">
      <div class="auth-visual__content">
        <a class="brand" href="#/">
          <span class="brand__mark"><span class="brand__star"></span></span>
          <span class="brand__text">
            <span class="brand__title">نظریه</span>
            <span class="brand__tag">THEORY STUDIO</span>
          </span>
        </a>
        <h2 class="hero__title" style="font-size:clamp(2rem,4vw,3.4rem);margin-top:3rem">
          <span class="line">ایده‌ات را</span>
          <span class="line accent">به جهان</span>
          <span class="line">پیوند بزن.</span>
        </h2>
        <p class="hero__lead" style="margin-top:1.25rem">نظریه فقط متن نیست؛ اشیا، تصاویر و خطوطی است که فکر را شکل می‌دهند.</p>
        <div class="auth-visual__features">
          <div class="auth-feature">
            <span class="auth-feature__icon">${icon("pen-tool", 17)}</span>
            <div><div class="auth-feature__title">ویرایشگر غنی</div><div class="auth-feature__text">بنویس، نقل‌قول کن، تصویر بگذار و ساختار بساز.</div></div>
          </div>
          <div class="auth-feature">
            <span class="auth-feature__icon">${icon("shapes", 17)}</span>
            <div><div class="auth-feature__title">اشیای نظریه</div><div class="auth-feature__text">هر نظریه می‌تواند اشیا و تصاویر خودش را داشته باشد.</div></div>
          </div>
          <div class="auth-feature">
            <span class="auth-feature__icon">${icon("spline", 17)}</span>
            <div><div class="auth-feature__title">خط تصویری</div><div class="auth-feature__text">خطوط فکر را رسم کن؛ چیزی که در متن نمی‌گنجد.</div></div>
          </div>
        </div>
      </div>
      <div class="auth-visual__quote">${quoteBlock()}</div>
    </aside>
  `;
}

function field({ label, name, type = "text", placeholder = "", iconName = "", autocomplete = "", required = true, hint = "", value = "" }) {
  return `
    <div class="field" data-field="${name}">
      <label class="field__label" for="auth-${name}">${escapeHtml(label)}</label>
      <div class="input-group">
        ${iconName ? `<span class="input-group__icon">${icon(iconName, 17)}</span>` : ""}
        <input class="input" id="auth-${name}" name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${required ? "required" : ""} value="${escapeHtml(value)}">
        ${type === "password" ? `<button class="icon-btn icon-btn--sm input-group__action" type="button" data-toggle-password="${name}" aria-label="نمایش رمز">${icon("eye", 15)}</button>` : ""}
      </div>
      ${hint ? `<span class="field__hint">${escapeHtml(hint)}</span>` : ""}
      <span class="field__error"></span>
    </div>
  `;
}

function loginForm(next) {
  return `
    <form class="auth-form" data-auth-form="login" novalidate>
      ${field({ label: "ایمیل", name: "email", type: "email", placeholder: "name@example.com", iconName: "mail", autocomplete: "email" })}
      ${field({ label: "رمز عبور", name: "password", type: "password", placeholder: "••••••••", iconName: "lock", autocomplete: "current-password" })}
      <div class="auth-form__row">
        <label class="checkbox"><input type="checkbox" checked> مرا به خاطر بسپار</label>
        <a class="auth-form__link" href="#/login?mode=forgot">فراموشی رمز؟</a>
      </div>
      <div class="alert alert--danger" data-auth-error hidden>${icon("alert", 16)}<span></span></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">ورود به نظریه</button>
      <input type="hidden" name="next" value="${escapeHtml(next || "/dashboard")}">
    </form>
    <p class="auth-switch">حساب ندارید؟ <a href="#/login?mode=register">ساخت حساب تازه</a></p>
  `;
}

function registerForm() {
  return `
    <form class="auth-form" data-auth-form="register" novalidate>
      <div class="grid-2">
        ${field({ label: "نام نمایشی", name: "fullName", placeholder: "نام و نام خانوادگی", iconName: "user", autocomplete: "name" })}
        ${field({ label: "نام کاربری", name: "username", placeholder: "username", iconName: "at", autocomplete: "username", hint: "حروف انگلیسی، عدد و زیرخط" })}
      </div>
      ${field({ label: "ایمیل", name: "email", type: "email", placeholder: "name@example.com", iconName: "mail", autocomplete: "email" })}
      ${field({ label: "رمز عبور", name: "password", type: "password", placeholder: "حداقل ۶ کاراکتر", iconName: "lock", autocomplete: "new-password" })}
      <div class="password-strength" data-password-strength>
        <div class="password-strength__bars">
          <span class="password-strength__bar"></span><span class="password-strength__bar"></span><span class="password-strength__bar"></span><span class="password-strength__bar"></span>
        </div>
        <span class="password-strength__label">قدرت رمز عبور</span>
      </div>
      ${field({ label: "تکرار رمز عبور", name: "confirmPassword", type: "password", placeholder: "رمز را دوباره وارد کنید", iconName: "key", autocomplete: "new-password" })}
      <label class="checkbox"><input type="checkbox" name="terms" required> با قواعد و حریم خصوصی نظریه موافقم.</label>
      <div class="alert alert--danger" data-auth-error hidden>${icon("alert", 16)}<span></span></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">ساخت حساب</button>
    </form>
    <p class="auth-switch">حساب دارید؟ <a href="#/login">وارد شوید</a></p>
  `;
}

function forgotForm() {
  return `
    <form class="auth-form" data-auth-form="forgot" novalidate>
      <div class="alert alert--warning">${icon("info", 16)}<span>پیوند بازیابی رمز به ایمیل شما فرستاده می‌شود.</span></div>
      ${field({ label: "ایمیل", name: "email", type: "email", placeholder: "name@example.com", iconName: "mail", autocomplete: "email" })}
      <div class="alert alert--danger" data-auth-error hidden>${icon("alert", 16)}<span></span></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">ارسال پیوند بازیابی</button>
    </form>
    <p class="auth-switch"><a href="#/login">بازگشت به ورود</a></p>
  `;
}

export function renderAuth(ctx) {
  const mode = ctx.query.mode || "login";
  const next = ctx.query.next || "/dashboard";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const title = isRegister ? "ساخت حساب تازه" : isForgot ? "بازیابی رمز عبور" : "خوش برگشتی";
  const sub = isRegister
    ? "به جمع نویسندگانی بپیوند که ایده‌هایشان را جدی می‌گیرند."
    : isForgot
      ? "ایمیل حسابت را وارد کن تا پیوند بازیابی بفرستیم."
      : "برای ادامهٔ نوشتن و مدیریت نظریه‌ها وارد شو.";

  return {
    layout: "auth",
    title: isRegister ? "ثبت‌نام" : isForgot ? "بازیابی رمز" : "ورود",
    html: `
      <div class="auth-layout">
        ${visual()}
        <main class="auth-panel">
          <div class="auth-card">
            <div class="auth-card__head">
              <a class="brand" href="#/" style="margin-bottom:1.5rem">
                <span class="brand__mark"><span class="brand__star"></span></span>
                <span class="brand__text"><span class="brand__title">نظریه</span><span class="brand__tag">THEORY STUDIO</span></span>
              </a>
              <h1 class="auth-card__title">${title}</h1>
              <p class="auth-card__sub">${sub}</p>
            </div>
            ${isRegister ? registerForm() : isForgot ? forgotForm() : loginForm(next)}
          </div>
        </main>
      </div>
    `,
    mount(root) {
      root.querySelectorAll("[data-toggle-password]").forEach((button) => {
        button.addEventListener("click", () => {
          const input = root.querySelector(`[name="${button.dataset.togglePassword}"]`);
          if (!input) return;
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          button.innerHTML = icon(show ? "eye" : "lock", 15);
        });
      });

      const passwordInput = root.querySelector('input[name="password"]');
      const strength = root.querySelector("[data-password-strength]");
      if (passwordInput && strength) {
        passwordInput.addEventListener("input", () => {
          const score = passwordScore(passwordInput.value);
          const bars = strength.querySelectorAll(".password-strength__bar");
          bars.forEach((bar, index) => {
            bar.className = "password-strength__bar";
            if (index < score) bar.classList.add(score >= 3 ? "is-strong" : score >= 2 ? "is-medium" : "is-weak");
          });
          const label = strength.querySelector(".password-strength__label");
          if (label) label.textContent = score >= 3 ? "رمز قوی" : score >= 2 ? "رمز متوسط" : score > 0 ? "رمز ضعیف" : "قدرت رمز عبور";
        });
      }

      const form = root.querySelector("[data-auth-form]");
      if (!form) return;
      const errorBox = form.querySelector("[data-auth-error]");

      const showError = (message) => {
        if (!errorBox) return;
        errorBox.hidden = false;
        errorBox.querySelector("span").textContent = message;
      };
      const clearError = () => {
        if (errorBox) errorBox.hidden = true;
      };

      form.querySelectorAll("input").forEach((input) => input.addEventListener("input", clearError));

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearError();
        const data = Object.fromEntries(new FormData(form).entries());
        const submit = form.querySelector('button[type="submit"]');

        if (form.dataset.authForm === "login") {
          if (!validateEmail(data.email)) return showError("ایمیل معتبر وارد کنید.");
          if (!data.password) return showError("رمز عبور را وارد کنید.");
          try {
            setButtonLoading(submit, true);
            await signIn(data.email.trim(), data.password);
            toast({ type: "success", title: "خوش آمدی", message: "با موفقیت وارد شدی." });
            const safeNext = data.next?.startsWith("/") ? data.next : "/dashboard";
            navigate(safeNext, { replace: true });
          } catch (error) {
            showError(getAuthErrorMessage(error));
          } finally {
            setButtonLoading(submit, false);
          }
          return;
        }

        if (form.dataset.authForm === "register") {
          if (!data.fullName.trim()) return showError("نام نمایشی را وارد کنید.");
          if (!/^[a-zA-Z0-9_]{3,24}$/.test(data.username)) return showError("نام کاربری باید ۳ تا ۲۴ کاراکتر و شامل حروف انگلیسی، عدد یا زیرخط باشد.");
          if (!validateEmail(data.email)) return showError("ایمیل معتبر وارد کنید.");
          if (data.password.length < 6) return showError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
          if (data.password !== data.confirmPassword) return showError("تکرار رمز عبور مطابقت ندارد.");
          if (!data.terms) return showError("پذیرش قواعد الزامی است.");
          try {
            setButtonLoading(submit, true);
            const result = await signUp({
              email: data.email.trim(),
              password: data.password,
              fullName: data.fullName.trim(),
              username: data.username.trim(),
            });
            if (result.session) {
              toast({ type: "success", title: "حسابت ساخته شد", message: "به نظریه خوش آمدی." });
              navigate("/dashboard", { replace: true });
            } else {
              toast({ type: "success", title: "حساب ساخته شد", message: "برای فعال‌سازی، ایمیل خود را تأیید کنید.", duration: 6500 });
              navigate("/login?registered=1", { replace: true });
            }
          } catch (error) {
            showError(getAuthErrorMessage(error));
          } finally {
            setButtonLoading(submit, false);
          }
          return;
        }

        if (form.dataset.authForm === "forgot") {
          if (!validateEmail(data.email)) return showError("ایمیل معتبر وارد کنید.");
          try {
            setButtonLoading(submit, true);
            await sendPasswordReset(data.email.trim());
            toast({ type: "success", title: "پیوند فرستاده شد", message: "صندوق ایمیل خود را بررسی کنید.", duration: 6000 });
            navigate("/login", { replace: true });
          } catch (error) {
            showError(getAuthErrorMessage(error));
          } finally {
            setButtonLoading(submit, false);
          }
        }
      });

      if (ctx.query.registered === "1") {
        toast({ type: "info", title: "ایمیل خود را تأیید کنید", message: "پس از تأیید، می‌توانید وارد شوید.", duration: 6000 });
      }
    },
  };
}
