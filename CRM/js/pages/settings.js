/* ============================================================================
   SETTINGS PAGE — with working tabs
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Formatters = window.Formatters;
  const Persian = window.Persian;
  const Toast = window.Toast;
  const Storage = window.Storage;
  const AuthService = window.AuthService;
  const ThemeSwitcher = window.ThemeSwitcher;

  const TABS = ["profile", "general", "notifications", "team", "integrations"];

  const SettingsPage = {
    async mount() {
      const panels = Dom.id("settings-panels");
      if (!panels) return;

      Dom.empty(panels);
      panels.classList.add("tab-panels");

      TABS.forEach((key, i) => {
        const panel = Dom.el("div", {
          class: "tab-panel",
          dataset: { panel: key },
          role: "tabpanel",
          id: `settings-panel-${key}`,
        });
        if (i > 0) panel.hidden = true;

        const content = this[`render${this.cap(key)}`]?.call(this);
        if (content) panel.appendChild(content);

        panels.appendChild(panel);
      });

      // Ensure tab group is initialized against the freshly rendered panels
      const group = document.querySelector('[data-tabs="settings"]');
      if (group) {
        setTimeout(() => window.Tabs?.initGroup?.(group), 0);
      }
    },

    cap(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /* ==========================================================
       HELPERS
       ========================================================== */
    section(title, subtitle, body) {
      const card = Dom.el("div", { class: "settings-card" });
      const head = Dom.el("div", { class: "settings-card__head" });
      const txt = Dom.el("div");
      txt.appendChild(Dom.el("h3", { class: "settings-card__title" }, title));
      if (subtitle) txt.appendChild(Dom.el("p", { class: "settings-card__subtitle" }, subtitle));
      head.appendChild(txt);
      card.appendChild(head);
      card.appendChild(body);
      return card;
    },

    row(title, desc, control) {
      const row = Dom.el("div", { class: "setting-row" });
      const body = Dom.el("div", { class: "setting-row__body" });
      body.appendChild(Dom.el("div", { class: "setting-row__title" }, title));
      if (desc) body.appendChild(Dom.el("div", { class: "setting-row__desc" }, desc));
      row.appendChild(body);
      if (control) {
        const c = Dom.el("div", { class: "setting-row__control" });
        c.appendChild(control);
        row.appendChild(c);
      }
      return row;
    },

    switchControl(checked, onChange) {
      const label = Dom.el("label", { class: "switch" });
      const input = Dom.el("input", { type: "checkbox" });
      input.checked = !!checked;
      const slider = Dom.el("span", { class: "switch__slider" });
      label.appendChild(input);
      label.appendChild(slider);
      input.addEventListener("change", () => onChange(input.checked));
      return label;
    },

    /* ==========================================================
       TAB: PROFILE
       ========================================================== */
    renderProfile() {
      const wrap = Dom.el("div", { class: "settings-section" });
      const user = AuthService.getUser() || {};
      const name = user.full_name || user.email?.split("@")[0] || "کاربر";

      // --- Avatar block ---
      const avatarBlock = Dom.el("div", { class: "profile-avatar-block" });
      const avatarWrap = Dom.el("div", { class: "profile-avatar-block__avatar" });
      const avatar = Dom.el("div", { class: "avatar" }, name[0]?.toUpperCase() || "؟");
      avatarWrap.appendChild(avatar);
      const editBtn = Dom.el("button", { class: "profile-avatar-block__edit", type: "button", title: "تغییر تصویر" }, [
        Dom.el("i", { class: "ri-camera-line" }),
      ]);
      editBtn.addEventListener("click", () => Toast.info("آپلود تصویر در نسخه بعدی فعال میشود"));
      avatarWrap.appendChild(editBtn);
      avatarBlock.appendChild(avatarWrap);

      const info = Dom.el("div", { class: "profile-avatar-block__info" });
      info.appendChild(Dom.el("div", { class: "profile-avatar-block__name" }, name));
      info.appendChild(Dom.el("div", { class: "profile-avatar-block__email" }, user.email || "—"));
      avatarBlock.appendChild(info);

      const avatarBody = Dom.el("div");
      avatarBody.appendChild(avatarBlock);
      wrap.appendChild(this.section("پروفایل کاربری", "اطلاعات حساب شما", avatarBody));

      // --- Edit form ---
      const form = Dom.el("form", { class: "form-grid" });
      const fields = [
        { name: "full_name", label: "نام و نام خانوادگی", value: name },
        { name: "phone", label: "شماره موبایل", value: user.phone || "", dir: "ltr" },
        { name: "email", label: "ایمیل", value: user.email || "", full: true, dir: "ltr", disabled: true },
      ];
      const inputs = {};
      fields.forEach((f) => {
        const field = Dom.el("div", { class: `field ${f.full ? "field--full" : ""}`.trim() });
        field.appendChild(Dom.el("label", { class: "field__label" }, f.label));
        const input = Dom.el("input", {
          class: "input",
          type: "text",
          value: f.value,
          disabled: f.disabled ? "" : null,
        });
        if (f.dir) input.style.direction = f.dir;
        inputs[f.name] = input;
        field.appendChild(input);
        form.appendChild(field);
      });

      const actions = Dom.el("div", { class: "form-actions", style: "grid-column:1/-1" });
      const saveBtn = Dom.el("button", { class: "btn btn--primary", type: "submit" }, [
        Dom.el("i", { class: "ri-save-3-line" }),
        Dom.el("span", null, "ذخیره تغییرات"),
      ]);
      actions.appendChild(saveBtn);
      form.appendChild(actions);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        saveBtn.classList.add("is-loading");
        try {
          await AuthService.updateProfile({
            full_name: inputs.full_name.value.trim(),
            phone: inputs.phone.value.trim(),
          });
          Toast.success("پروفایل بروزرسانی شد");
          window.Topbar?.renderUserInfo?.();
        } catch (err) {
          Toast.error(err.message || "خطا در ذخیره");
        } finally {
          saveBtn.classList.remove("is-loading");
        }
      });

      wrap.appendChild(this.section("اطلاعات شخصی", "ویرایش نام و اطلاعات تماس", form));

      // --- Change password ---
      const pwForm = Dom.el("form", { class: "form-grid" });
      const pwFields = [
        { name: "new_password", label: "رمز عبور جدید" },
        { name: "confirm_password", label: "تکرار رمز عبور جدید" },
      ];
      const pwInputs = {};
      pwFields.forEach((f) => {
        const field = Dom.el("div", { class: "field" });
        field.appendChild(Dom.el("label", { class: "field__label" }, f.label));
        const input = Dom.el("input", { class: "input", type: "password", dir: "ltr" });
        pwInputs[f.name] = input;
        field.appendChild(input);
        pwForm.appendChild(field);
      });

      const pwActions = Dom.el("div", { class: "form-actions", style: "grid-column:1/-1" });
      const pwBtn = Dom.el("button", { class: "btn btn--secondary", type: "submit" }, [
        Dom.el("i", { class: "ri-lock-password-line" }),
        Dom.el("span", null, "تغییر رمز عبور"),
      ]);
      pwActions.appendChild(pwBtn);
      pwForm.appendChild(pwActions);

      pwForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const np = pwInputs.new_password.value;
        const cp = pwInputs.confirm_password.value;
        if (np.length < 8) {
          Toast.warning("رمز باید حداقل ۸ کاراکتر باشد");
          return;
        }
        if (np !== cp) {
          Toast.warning("رمزها مطابقت ندارند");
          return;
        }
        pwBtn.classList.add("is-loading");
        try {
          await AuthService.changePassword(np);
          Toast.success("رمز عبور تغییر کرد");
          pwForm.reset();
        } catch (err) {
          Toast.error(err.message || "خطا در تغییر رمز");
        } finally {
          pwBtn.classList.remove("is-loading");
        }
      });

      wrap.appendChild(this.section("امنیت", "تغییر رمز عبور حساب کاربری", pwForm));

      return wrap;
    },

    /* ==========================================================
       TAB: GENERAL
       ========================================================== */
    renderGeneral() {
      const wrap = Dom.el("div", { class: "settings-section" });

      // --- Appearance ---
      const appearanceBody = Dom.el("div");

      const themeRow = Dom.el("div", { class: "setting-row" });
      const themeBody = Dom.el("div", { class: "setting-row__body" });
      themeBody.appendChild(Dom.el("div", { class: "setting-row__title" }, "تم ظاهری"));
      themeBody.appendChild(Dom.el("div", { class: "setting-row__desc" }, "حالت تیره یا روشن"));
      themeRow.appendChild(themeBody);

      const themeSw = Dom.el("div", { class: "segmented", style: "margin-inline-start:auto" });
      [
        { v: "dark", l: "تیره", icon: "ri-moon-line" },
        { v: "light", l: "روشن", icon: "ri-sun-line" },
      ].forEach((opt) => {
        const btn = Dom.el("button", { class: `segmented__btn ${(Storage.getTheme() === opt.v) ? "is-active" : ""}`, type: "button" });
        btn.appendChild(Dom.el("i", { class: opt.icon }));
        btn.appendChild(Dom.el("span", null, opt.l));
        btn.addEventListener("click", () => {
          ThemeSwitcher.apply(opt.v);
          Dom.qa(".segmented__btn", themeSw).forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
        });
        themeSw.appendChild(btn);
      });
      const themeCtl = Dom.el("div", { class: "setting-row__control" });
      themeCtl.appendChild(themeSw);
      themeRow.appendChild(themeCtl);
      appearanceBody.appendChild(themeRow);

      // Density
      const density = Storage.get("density", "comfortable");
      const densityRow = Dom.el("div", { class: "setting-row" });
      const densityBody = Dom.el("div", { class: "setting-row__body" });
      densityBody.appendChild(Dom.el("div", { class: "setting-row__title" }, "چگالی نمایش"));
      densityBody.appendChild(Dom.el("div", { class: "setting-row__desc" }, "فاصله ردیفها و اندازه اجزا"));
      densityRow.appendChild(densityBody);

      const densitySw = Dom.el("div", { class: "segmented" });
      [
        { v: "comfortable", l: "راحت" },
        { v: "compact", l: "متراکم" },
      ].forEach((opt) => {
        const btn = Dom.el("button", { class: `segmented__btn ${density === opt.v ? "is-active" : ""}`, type: "button" }, opt.l);
        btn.addEventListener("click", () => {
          ThemeSwitcher.setDensity(opt.v);
          Dom.qa(".segmented__btn", densitySw).forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
        });
        densitySw.appendChild(btn);
      });
      const densityCtl = Dom.el("div", { class: "setting-row__control" });
      densityCtl.appendChild(densitySw);
      densityRow.appendChild(densityCtl);
      appearanceBody.appendChild(densityRow);

      // High contrast
      const contrast = Storage.get("contrast", "normal") === "high";
      appearanceBody.appendChild(this.row(
        "کنتراست بالا",
        "برای خوانایی بهتر در محیطهای پرنور",
        this.switchControl(contrast, (v) => {
          ThemeSwitcher.setContrast(v);
          Toast.success(v ? "کنتراست بالا فعال شد" : "کنتراست عادی فعال شد");
        })
      ));

      wrap.appendChild(this.section("نمایش", "ظاهر و چیدمان سامانه", appearanceBody));

      // --- Preferences ---
      const prefBody = Dom.el("div");

      // Page size
      const pageSize = Storage.get("page-size", 20);
      const psSelect = Dom.el("select", { class: "input", style: "min-width:120px" });
      [10, 20, 50, 100].forEach((n) => {
        const opt = Dom.el("option", { value: n }, Persian.toPersianDigits(n));
        if (n === pageSize) opt.selected = true;
        psSelect.appendChild(opt);
      });
      psSelect.addEventListener("change", () => {
        Storage.set("page-size", Number(psSelect.value));
        Toast.success("ذخیره شد");
      });
      prefBody.appendChild(this.row(
        "تعداد آیتم در هر صفحه",
        "تعداد پیشفرض ردیفهای جدول",
        psSelect
      ));

      // Currency
      const currencyRow = Dom.el("div", { class: "setting-row" });
      const cb = Dom.el("div", { class: "setting-row__body" });
      cb.appendChild(Dom.el("div", { class: "setting-row__title" }, "واحد پول"));
      cb.appendChild(Dom.el("div", { class: "setting-row__desc" }, "واحد نمایش مبالغ"));
      currencyRow.appendChild(cb);
      const currencyVal = Dom.el("span", { class: "badge badge--primary" }, "تومان (IRR)");
      const cty = Dom.el("div", { class: "setting-row__control" });
      cty.appendChild(currencyVal);
      currencyRow.appendChild(cty);
      prefBody.appendChild(currencyRow);

      wrap.appendChild(this.section("تنظیمات عمومی", "پیکربندی پیشفرضهای سامانه", prefBody));

      return wrap;
    },

    /* ==========================================================
       TAB: NOTIFICATIONS
       ========================================================== */
    renderNotifications() {
      const wrap = Dom.el("div", { class: "settings-section" });
      const body = Dom.el("div");

      const prefs = Storage.get("notification-prefs", {
        low_stock: true,
        new_order: true,
        order_shipped: true,
        customer_signup: false,
        daily_summary: true,
        weekly_report: false,
        email_alerts: false,
        push_alerts: false,
      });

      const items = [
        { key: "low_stock", title: "هشدار کمبود موجودی", desc: "وقتی موجودی محصولی به حد بحرانی رسید اطلاع بده" },
        { key: "new_order", title: "سفارش جدید", desc: "برای هر سفارش ورودی اطلاعرسانی کن" },
        { key: "order_shipped", title: "ارسال سفارش", desc: "وقتی وضعیت سفارش به «ارسالشده» تغییر کرد" },
        { key: "customer_signup", title: "ثبتنام مشتری جدید", desc: "برای هر مشتری تازه ثبتشده" },
        { key: "daily_summary", title: "خلاصه روزانه", desc: "هر روز صبح یک خلاصه از فعالیتها" },
        { key: "weekly_report", title: "گزارش هفتگی", desc: "هر هفته گزارش عملکرد" },
      ];

      items.forEach((it) => {
        body.appendChild(this.row(
          it.title,
          it.desc,
          this.switchControl(prefs[it.key], (v) => {
            prefs[it.key] = v;
            Storage.set("notification-prefs", prefs);
            Toast.success("ذخیره شد");
          })
        ));
      });

      wrap.appendChild(this.section("اعلانهای سامانه", "انتخاب کنید چه رخدادهایی به شما اطلاع داده شوند", body));

      // Delivery
      const deliveryBody = Dom.el("div");
      deliveryBody.appendChild(this.row(
        "اعلانهای ایمیل",
        "ارسال اعلانها به ایمیل ثبتشده",
        this.switchControl(prefs.email_alerts, (v) => {
          prefs.email_alerts = v;
          Storage.set("notification-prefs", prefs);
        })
      ));
      deliveryBody.appendChild(this.row(
        "اعلانهای Push",
        "اعلان مرورگر (نیاز به مجوز)",
        this.switchControl(prefs.push_alerts, async (v) => {
          if (v && "Notification" in window) {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
              Toast.warning("مجوز اعلان داده نشد");
              return;
            }
          }
          prefs.push_alerts = v;
          Storage.set("notification-prefs", prefs);
        })
      ));

      wrap.appendChild(this.section("روش ارسال", "کانالهای دریافت اعلان", deliveryBody));

      return wrap;
    },

    /* ==========================================================
       TAB: TEAM
       ========================================================== */
    renderTeam() {
      const wrap = Dom.el("div", { class: "settings-section" });

      const members = [
        { name: "وحید احمدی", email: "vahid8910@gmail.com", role: "admin", status: "online" },
        { name: "مریم کریمی", email: "maryam@crm.local", role: "manager", status: "online" },
        { name: "علی رضایی", email: "ali@crm.local", role: "operator", status: "busy" },
        { name: "زهرا احمدی", email: "zahra@crm.local", role: "viewer", status: "offline" },
      ];

      const list = Dom.el("div", { class: "team-list" });
      members.forEach((m) => {
        const row = Dom.el("div", { class: "team-member" });
        const avatar = Dom.el("div", {
          class: `avatar avatar--status ${m.status === "offline" ? "avatar--offline" : m.status === "busy" ? "avatar--busy" : ""}`,
        }, Formatters.initials(m.name));
        row.appendChild(avatar);

        const body = Dom.el("div", { class: "team-member__body" });
        const name = Dom.el("div", { class: "team-member__name" }, m.name);
        if (m.role === "admin") {
          name.appendChild(Dom.el("span", { class: "badge badge--primary badge--sm" }, "شما"));
        }
        body.appendChild(name);
        body.appendChild(Dom.el("div", { class: "team-member__email" }, m.email));
        row.appendChild(body);

        const roleBadge = Dom.el("span", { class: `badge badge--${m.role === "admin" ? "danger" : m.role === "manager" ? "warning" : "neutral"}` },
          Formatters.roleLabel(m.role));
        const roleWrap = Dom.el("div", { class: "team-member__role" });
        roleWrap.appendChild(roleBadge);
        row.appendChild(roleWrap);

        const actions = Dom.el("div", { class: "team-member__actions" });
        if (m.role !== "admin") {
          const editBtn = Dom.el("button", { class: "icon-btn", type: "button", title: "ویرایش" }, [
            Dom.el("i", { class: "ri-edit-2-line" }),
          ]);
          editBtn.addEventListener("click", () => Toast.info("ویرایش اعضا در نسخه بعدی"));
          actions.appendChild(editBtn);

          const delBtn = Dom.el("button", { class: "icon-btn", type: "button", title: "حذف" }, [
            Dom.el("i", { class: "ri-user-unfollow-line" }),
          ]);
          delBtn.addEventListener("click", () => Toast.warning("قابلیت حذف اعضا در نسخه بعدی"));
          actions.appendChild(delBtn);
        }
        row.appendChild(actions);

        list.appendChild(row);
      });

      const head = Dom.el("div", { class: "settings-card__head" });
      const txt = Dom.el("div");
      txt.appendChild(Dom.el("h3", { class: "settings-card__title" }, "اعضای تیم"));
      txt.appendChild(Dom.el("p", { class: "settings-card__subtitle" }, `${Persian.toPersianDigits(members.length)} عضو در این سازمان`));
      head.appendChild(txt);

      const inviteBtn = Dom.el("button", { class: "btn btn--primary btn--sm", type: "button" }, [
        Dom.el("i", { class: "ri-user-add-line" }),
        Dom.el("span", null, "دعوت عضو"),
      ]);
      inviteBtn.addEventListener("click", () => Toast.info("ارسال دعوتنامه در نسخه بعدی"));
      head.appendChild(inviteBtn);

      const card = Dom.el("div", { class: "settings-card" });
      card.appendChild(head);
      card.appendChild(list);
      wrap.appendChild(card);

      return wrap;
    },

    /* ==========================================================
       TAB: INTEGRATIONS
       ========================================================== */
    renderIntegrations() {
      const wrap = Dom.el("div", { class: "settings-section" });

      const isConnected = window.Supabase?.isReady?.();
      const url = window.ENV?.SUPABASE_URL || "—";
      const projectId = url.replace(/^https:\/\//, "").split(".")[0];

      const grid = Dom.el("div", { class: "integrations-grid" });

      const items = [
        {
          icon: "ri-database-2-line",
          color: isConnected ? "success" : "danger",
          title: "Supabase",
          desc: isConnected
            ? `متصل به پروژه ${projectId}`
            : "تنظیم نشده — از حالت نمایشی استفاده میشود",
          status: isConnected ? "connected" : "disconnected",
        },
        {
          icon: "ri-whatsapp-line",
          color: "warning",
          title: "واتساپ تجاری",
          desc: "ارسال اعلان سفارش به مشتریان",
          status: "coming",
        },
        {
          icon: "ri-mail-send-line",
          color: "info",
          title: "SMTP ایمیل",
          desc: "ارسال فاکتور و اعلان ایمیل",
          status: "coming",
        },
        {
          icon: "ri-bank-card-line",
          color: "violet",
          title: "درگاه پرداخت",
          desc: "اتصال به زرینپال / آیدیپی",
          status: "coming",
        },
        {
          icon: "ri-printer-line",
          color: "brand",
          title: "چاپگر فیش",
          desc: "چاپ خودکار فاکتور فروش",
          status: "coming",
        },
        {
          icon: "ri-bar-chart-box-line",
          color: "success",
          title: "Google Analytics",
          desc: "ردیابی بازدید و رفتار کاربران",
          status: "coming",
        },
      ];

      items.forEach((it) => {
        const card = Dom.el("div", { class: "integration-card" });
        card.appendChild(Dom.el("div", {
          class: `integration-card__logo text-${it.color === "brand" ? "brand" : it.color}`,
          style: "background:var(--bg-surface-3)",
        }, [Dom.el("i", { class: it.icon })]));

        const body = Dom.el("div", { class: "integration-card__body" });
        body.appendChild(Dom.el("div", { class: "integration-card__title" }, it.title));
        body.appendChild(Dom.el("div", { class: "integration-card__desc" }, it.desc));

        let badgeText = "متصل";
        let badgeCls = "success";
        if (it.status === "disconnected") { badgeText = "قطع"; badgeCls = "danger"; }
        else if (it.status === "coming") { badgeText = "بهزودی"; badgeCls = "neutral"; }

        body.appendChild(Dom.el("span", { class: `badge badge--${badgeCls}` }, badgeText));

        card.appendChild(body);
        grid.appendChild(card);
      });

      wrap.appendChild(this.section("یکپارچهسازیها", "سرویسهای خارجی متصل به سامانه", grid));

      return wrap;
    },
  };

  window.SettingsPage = SettingsPage;
})(window);