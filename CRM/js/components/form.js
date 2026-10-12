/* ============================================================================
   FORM BUILDER COMPONENT
   ----------------------------------------------------------------------------
   Renders forms from a schema and provides validation, draft save, and
   submission helpers.
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Validators = window.Validators;
  const Storage = window.Storage;

  const Form = {
    /* ---------- Schema renderer ---------- */
    render(container, schema, options = {}) {
      if (!container) return null;
      Dom.empty(container);

      const {
        values = {},
        onSubmit = null,
        onChange = null,
        draftId = null,
        submitLabel = "ذخیره",
        cancelLabel = "انصراف",
        onCancel = null,
        columns = 1,
        footer = true,
      } = options;

      const form = Dom.el("form", { class: "form", novalidate: "true", autocomplete: "off" });
      const grid = Dom.el("div", { class: `form-grid ${columns === 3 ? "form-grid--3" : ""} ${columns === 1 ? "d-form-single" : ""}`.trim() });
      if (columns === 1) grid.style.gridTemplateColumns = "1fr";

      const fields = {};

      schema.forEach((field) => {
        if (field.hidden) return;
        const wrap = Dom.el("div", { class: `field ${field.fullWidth ? "field--full" : ""}`.trim() });

        if (field.label) {
          const label = Dom.el("label", {
            class: "field__label",
            for: `fld-${field.name}`,
          }, field.label);
          if (field.required) {
            label.appendChild(Dom.el("span", { class: "required" }, "*"));
          }
          wrap.appendChild(label);
        }

        let control;
        const initial = values[field.name] ?? field.value ?? "";

        switch (field.type) {
          case "textarea": {
            control = Dom.el("div", { class: "field__control" });
            const ta = Dom.el("textarea", {
              id: `fld-${field.name}`,
              name: field.name,
              placeholder: field.placeholder || "",
              rows: field.rows || 3,
              maxlength: field.max || null,
            }, initial);
            control.appendChild(ta);
            fields[field.name] = ta;
            break;
          }
          case "select": {
            control = Dom.el("div", { class: "field__control" });
            const sel = Dom.el("select", {
              id: `fld-${field.name}`,
              name: field.name,
            });
            if (field.placeholder) {
              sel.appendChild(Dom.el("option", { value: "" }, field.placeholder));
            }
            (field.options || []).forEach((opt) => {
              const o = Dom.el("option", {
                value: opt.value,
              }, opt.label);
              if (String(initial) === String(opt.value)) o.selected = true;
              sel.appendChild(o);
            });
            control.appendChild(sel);
            fields[field.name] = sel;
            break;
          }
          case "checkbox": {
            control = Dom.el("label", { class: "checkbox" });
            const cb = Dom.el("input", {
              id: `fld-${field.name}`,
              type: "checkbox",
              name: field.name,
            });
            cb.checked = !!initial;
            const box = Dom.el("span", { class: "checkbox__box" }, [Dom.el("i", { class: "ri-check-line" })]);
            control.appendChild(cb);
            control.appendChild(box);
            control.appendChild(Dom.el("span", null, field.checkboxLabel || field.label || ""));
            fields[field.name] = cb;
            break;
          }
          case "switch": {
            control = Dom.el("label", { class: "switch" });
            const cb = Dom.el("input", {
              id: `fld-${field.name}`,
              type: "checkbox",
              name: field.name,
            });
            cb.checked = !!initial;
            const slider = Dom.el("span", { class: "switch__slider" });
            control.appendChild(cb);
            control.appendChild(slider);
            if (field.switchLabel) control.appendChild(Dom.el("span", null, field.switchLabel));
            fields[field.name] = cb;
            break;
          }
          case "number": {
            control = Dom.el("div", { class: "field__control" });
            const input = Dom.el("input", {
              id: `fld-${field.name}`,
              name: field.name,
              type: "number",
              value: initial,
              min: field.min ?? null,
              max: field.max ?? null,
              step: field.step ?? "any",
              placeholder: field.placeholder || "",
            });
            control.appendChild(input);
            fields[field.name] = input;
            break;
          }
          case "money": {
            control = Dom.el("div", { class: "field__control" });
            const input = Dom.el("input", {
              id: `fld-${field.name}`,
              name: field.name,
              type: "text",
              value: initial,
              placeholder: field.placeholder || "۰",
              inputmode: "numeric",
            });
            input.addEventListener("input", () => {
              const n = window.Persian.toEnglishDigits(input.value).replace(/[^\d]/g, "");
              input.value = n ? Number(n).toLocaleString("fa-IR") : "";
            });
            control.appendChild(input);
            fields[field.name] = input;
            break;
          }
          default: {
            control = Dom.el("div", { class: `field__control ${field.icon ? "field__control--icon" : ""}`.trim() });
            if (field.icon) control.appendChild(Dom.el("i", { class: field.icon }));
            const input = Dom.el("input", {
              id: `fld-${field.name}`,
              name: field.name,
              type: field.type || "text",
              value: initial,
              placeholder: field.placeholder || "",
              autocomplete: field.autocomplete || "off",
            });
            control.appendChild(input);
            fields[field.name] = input;
            break;
          }
        }

        wrap.appendChild(control);
        if (field.hint) {
          wrap.appendChild(Dom.el("p", { class: "field__hint" }, field.hint));
        }
        wrap.appendChild(Dom.el("p", { class: "field__error" }));

        grid.appendChild(wrap);
      });

      form.appendChild(grid);

      // Footer
      if (footer) {
        const footerEl = Dom.el("div", { class: "form-actions" });
        if (onCancel) {
          const cancel = Dom.el("button", { class: "btn btn--ghost", type: "button" }, cancelLabel);
          cancel.addEventListener("click", onCancel);
          footerEl.appendChild(cancel);
        }
        const submit = Dom.el("button", { class: "btn btn--primary", type: "submit" }, [
          Dom.el("i", { class: "ri-save-3-line" }),
          Dom.el("span", null, submitLabel),
        ]);
        footerEl.appendChild(submit);
        form.appendChild(footerEl);
      }

      /* ---------- Get values ---------- */
      const getValues = () => {
        const values = {};
        schema.forEach((field) => {
          const el = fields[field.name];
          if (!el) return;
          if (el.type === "checkbox") values[field.name] = el.checked;
          else if (field.type === "money") values[field.name] = Number(window.Persian.toEnglishDigits(el.value).replace(/[^\d]/g, "")) || 0;
          else if (field.type === "number") values[field.name] = el.value === "" ? null : Number(el.value);
          else values[field.name] = el.value;
        });
        return values;
      };

      /* ---------- Validate ---------- */
      const validate = () => {
        const values = getValues();
        const schemaMap = {};
        schema.forEach((f) => {
          if (f.rules) schemaMap[f.name] = f.rules;
          else if (f.required) schemaMap[f.name] = ["required"];
        });
        const { valid, errors } = Validators.validate(values, schemaMap);

        // Clear all
        Dom.qa(".field", form).forEach((f) => Dom.removeClass(f, "has-error"));
        Dom.qa(".field__error", form).forEach((e) => (e.textContent = ""));

        if (!valid) {
          Object.entries(errors).forEach(([name, msg]) => {
            const el = fields[name];
            if (!el) return;
            const wrap = el.closest(".field");
            if (wrap) {
              Dom.addClass(wrap, "has-error");
              const err = wrap.querySelector(".field__error");
              if (err) err.textContent = msg;
            }
          });
        }
        return { valid, errors, values };
      };

      /* ---------- Submit ---------- */
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { valid, values } = validate();
        if (!valid) {
          window.Toast?.warning("لطفاً خطاهای فرم را برطرف کنید");
          const firstError = form.querySelector(".field.has-error input, .field.has-error select, .field.has-error textarea");
          if (firstError) firstError.focus();
          return;
        }
        const submit = form.querySelector('button[type="submit"]');
        submit?.classList.add("is-loading");
        try {
          if (onSubmit) await onSubmit(values);
          if (draftId) Storage.clearDraft(draftId);
        } catch (err) {
          window.Toast?.error(err.message || "خطا در ارسال فرم");
        } finally {
          submit?.classList.remove("is-loading");
        }
      });

      // Live change
      if (onChange) {
        form.addEventListener("input", Dom.debounce(() => onChange(getValues()), 220));
      }

      // Draft save
      if (draftId) {
        const saveDraft = Dom.debounce(() => {
          Storage.saveDraft(draftId, getValues());
        }, 800);
        form.addEventListener("input", saveDraft);
      }

      container.appendChild(form);

      return {
        form,
        fields,
        getValues,
        validate,
        setValues(vals) {
          Object.entries(vals).forEach(([k, v]) => {
            const el = fields[k];
            if (!el) return;
            if (el.type === "checkbox") el.checked = !!v;
            else el.value = v == null ? "" : v;
          });
        },
      };
    },
  };

  window.Form = Form;
})(window);