/* ============================================================================
   LOGIN PAGE CONTROLLER
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const AuthService = window.AuthService;
  const Toast = window.Toast;
  const Validators = window.Validators;

  /* ✅ FIX: robust URL resolution for GitHub Pages subpath */
  function resolveAppUrl() {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
    return base + "index.html";
  }

  const LoginPage = {
    init() {
      this.bindTabs();
      this.bindPasswordToggles();
      this.bindLoginForm();
      this.bindSignupForm();
      this.bindForgotForm();
      this.bindDemoLogin();
      this.bindPasswordStrength();

      // If already logged in, offer quick redirect
      AuthService.init().then((user) => {
        if (user) {
          console.log("[login] already authenticated:", user.email);
        }
      });
    },

    bindTabs() {
      Dom.qa("[data-auth-tab]").forEach((tab) => {
        tab.addEventListener("click", () => {
          const key = tab.dataset.authTab;
          Dom.qa("[data-auth-tab]").forEach((t) =>
            Dom.toggleClass(t, "is-active", t === tab)
          );
          Dom.qa("[data-auth-panel]").forEach((p) =>
            Dom.toggleClass(p, "is-active", p.dataset.authPanel === key)
          );
        });
      });
    },

    bindPasswordToggles() {
      Dom.qa("[data-toggle-password]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = btn.dataset.togglePassword;
          const input = Dom.id(targetId);
          if (!input) return;
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          const icon = btn.querySelector("i");
          if (icon) icon.className = isPassword ? "ri-eye-off-line" : "ri-eye-line";
        });
      });
    },

    setFieldError(name, message) {
      const err = document.querySelector(`[data-error-for="${name}"]`);
      if (err) err.textContent = message || "";
      const input = Dom.id(name) || document.querySelector(`[name="${name}"]`);
      if (input) {
        const wrap = input.closest(".field");
        if (wrap) Dom.toggleClass(wrap, "has-error", !!message);
      }
    },

    clearErrors(form) {
      if (!form) return;
      form.querySelectorAll(".field__error").forEach((e) => (e.textContent = ""));
      form.querySelectorAll(".field").forEach((f) => Dom.removeClass(f, "has-error"));
    },

    setLoading(button, loading) {
      if (!button) return;
      const label = button.querySelector(".btn__label");
      const spinner = button.querySelector(".btn__spinner");
      button.classList.toggle("is-loading", !!loading);
      if (label) label.hidden = !!loading;
      if (spinner) spinner.hidden = !loading;
    },

    bindLoginForm() {
      const form = Dom.id("login-form");
      if (!form) return;

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        this.clearErrors(form);

        const email = Dom.id("login-email").value.trim();
        const password = Dom.id("login-password").value;

        let hasError = false;
        if (!email) {
          this.setFieldError("login-email", "ایمیل را وارد کنید");
          hasError = true;
        } else if (!Validators.email(email)) {
          this.setFieldError("login-email", "ایمیل معتبر نیست");
          hasError = true;
        }
        if (!password) {
          this.setFieldError("login-password", "رمز عبور را وارد کنید");
          hasError = true;
        }
        if (hasError) return;

        const submit = Dom.id("login-submit");
        this.setLoading(submit, true);

        try {
          await AuthService.login({ email, password });
          Toast.success("ورود موفق", "خوش آمدید");
          setTimeout(() => {
            window.location.href = resolveAppUrl();
          }, 450);
        } catch (err) {
          const msg = (err.message || "").toLowerCase();
          if (msg.includes("invalid") || msg.includes("credential")) {
            this.setFieldError("login-password", "ایمیل یا رمز عبور نادرست است");
          } else if (msg.includes("email")) {
            this.setFieldError("login-email", err.message);
          } else {
            Toast.error(err.message || "خطا در ورود");
          }
        } finally {
          this.setLoading(submit, false);
        }
      });
    },

    bindSignupForm() {
      const form = Dom.id("signup-form");
      if (!form) return;

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        this.clearErrors(form);

        const fullName = Dom.id("signup-name").value.trim();
        const email = Dom.id("signup-email").value.trim();
        const password = Dom.id("signup-password").value;
        const confirm = Dom.id("signup-confirm").value;
        const terms = Dom.id("signup-terms").checked;

        let hasError = false;
        if (!fullName) {
          this.setFieldError("signup-name", "نام را وارد کنید");
          hasError = true;
        }
        if (!Validators.email(email)) {
          this.setFieldError("signup-email", "ایمیل معتبر نیست");
          hasError = true;
        }
        if (password.length < 8) {
          this.setFieldError("signup-password", "رمز عبور باید حداقل ۸ کاراکتر باشد");
          hasError = true;
        }
        if (password !== confirm) {
          this.setFieldError("signup-confirm", "رمزهای عبور مطابقت ندارند");
          hasError = true;
        }
        if (!terms) {
          Toast.warning("لطفاً شرایط استفاده را بپذیرید");
          hasError = true;
        }
        if (hasError) return;

        const submit = Dom.id("signup-submit");
        this.setLoading(submit, true);

        try {
          await AuthService.signup({ email, password, full_name: fullName });
          Toast.success("حساب ایجاد شد، خوش آمدید");
          setTimeout(() => {
            window.location.href = resolveAppUrl();
          }, 600);
        } catch (err) {
          const msg = (err.message || "").toLowerCase();
          if (msg.includes("already") || msg.includes("exists")) {
            this.setFieldError("signup-email", "این ایمیل قبلاً ثبت شده است");
          } else {
            Toast.error(err.message || "خطا در ایجاد حساب");
          }
        } finally {
          this.setLoading(submit, false);
        }
      });
    },

    bindForgotForm() {
      const form = Dom.id("forgot-form");
      const forgotLink = Dom.id("forgot-link");

      if (forgotLink) {
        forgotLink.addEventListener("click", (e) => {
          e.preventDefault();
          Dom.qa("[data-auth-panel]").forEach((p) =>
            Dom.toggleClass(p, "is-active", p.dataset.authPanel === "forgot")
          );
        });
      }

      Dom.qa("[data-auth-back]").forEach((b) => {
        b.addEventListener("click", () => {
          Dom.qa("[data-auth-tab]").forEach((t) =>
            Dom.toggleClass(t, "is-active", t.dataset.authTab === "login")
          );
          Dom.qa("[data-auth-panel]").forEach((p) =>
            Dom.toggleClass(p, "is-active", p.dataset.authPanel === "login")
          );
        });
      });

      if (!form) return;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = Dom.id("forgot-email").value.trim();
        if (!Validators.email(email)) {
          Toast.warning("ایمیل معتبر وارد کنید");
          return;
        }
        const submit = form.querySelector('button[type="submit"]');
        this.setLoading(submit, true);
        try {
          await AuthService.sendPasswordReset(email);
          Toast.success("اگر ایمیل در سیستم موجود باشد، لینک بازیابی ارسال می‌شود");
          Dom.qa("[data-auth-panel]").forEach((p) =>
            Dom.toggleClass(p, "is-active", p.dataset.authPanel === "login")
          );
        } catch (err) {
          Toast.error(err.message || "خطا در ارسال ایمیل");
        } finally {
          this.setLoading(submit, false);
        }
      });
    },

    bindDemoLogin() {
      Dom.qa("[data-demo-login]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await AuthService.loginDemo();
            Toast.success("ورود با حالت نمایشی");
            setTimeout(() => {
              window.location.href = resolveAppUrl();
            }, 450);
          } catch (err) {
            Toast.error(err.message || "خطا در ورود نمایشی");
          }
        });
      });
    },

    bindPasswordStrength() {
      const input = Dom.id("signup-password");
      const meter = Dom.id("password-strength");
      const hint = Dom.id("password-hint");
      if (!input || !meter) return;

      input.addEventListener("input", () => {
        const level = Validators.passwordStrength(input.value);
        meter.dataset.level = String(level);
        const labels = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "قوی"];
        if (hint) hint.textContent = input.value ? `قدرت رمز: ${labels[level] || "—"}` : "قدرت رمز عبور";
      });
    },
  };

  Dom.ready(() => LoginPage.init());
  window.LoginPage = LoginPage;
})(window);