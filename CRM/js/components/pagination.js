/* ============================================================================
   PAGINATION COMPONENT
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Persian = window.Persian;
  const ENV = window.ENV || {};

  const Pagination = {
    render(container, { page = 1, pageSize = 20, total = 0, onChange = null, pageSizeOptions = null, showPageSize = true } = {}) {
      if (!container) return;
      Dom.empty(container);

      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const sizes = pageSizeOptions || ENV.PAGE_SIZE_OPTIONS || [10, 20, 50, 100];
      const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, total);

      // Info
      const info = Dom.el("div", { class: "pagination__info" });
      info.innerHTML = `نمایش <b>${Persian.toPersianDigits(start)}</b> تا <b>${Persian.toPersianDigits(end)}</b> از <b>${Persian.toPersianDigits(total)}</b> مورد`;
      container.appendChild(info);

      // Controls
      const controls = Dom.el("div", { class: "pagination__controls" });

      const makeBtn = (content, opts = {}) => {
        const btn = Dom.el("button", {
          class: `pagination__btn ${opts.active ? "is-active" : ""} ${opts.arrow ? `pagination__arrow--${opts.arrow}` : ""}`.trim(),
          type: "button",
          disabled: opts.disabled ? "" : null,
          "aria-label": opts.label || "",
        });
        if (content instanceof HTMLElement) btn.appendChild(content);
        else btn.innerHTML = content;
        if (!opts.disabled && opts.onClick) btn.addEventListener("click", opts.onClick);
        return btn;
      };

      // Prev
      controls.appendChild(makeBtn(
        Dom.el("i", { class: "ri-arrow-right-s-line" }),
        {
          arrow: "prev",
          label: "قبلی",
          disabled: page <= 1,
          onClick: () => onChange && onChange(page - 1, pageSize),
        }
      ));

      // Page numbers
      const pages = this.buildRange(page, totalPages);
      pages.forEach((p) => {
        if (p === "...") {
          controls.appendChild(Dom.el("span", { class: "pagination__ellipsis" }, "…"));
        } else {
          controls.appendChild(makeBtn(Persian.toPersianDigits(p), {
            active: p === page,
            onClick: () => onChange && onChange(p, pageSize),
          }));
        }
      });

      // Next
      controls.appendChild(makeBtn(
        Dom.el("i", { class: "ri-arrow-left-s-line" }),
        {
          arrow: "next",
          label: "بعدی",
          disabled: page >= totalPages,
          onClick: () => onChange && onChange(page + 1, pageSize),
        }
      ));

      container.appendChild(controls);

      // Page size
      if (showPageSize) {
        const sizeWrap = Dom.el("div", { class: "pagination__size" });
        sizeWrap.appendChild(Dom.el("span", null, "در صفحه:"));
        const select = Dom.el("select", { "aria-label": "تعداد در صفحه" });
        sizes.forEach((s) => {
          const opt = Dom.el("option", { value: s }, Persian.toPersianDigits(s));
          if (s === pageSize) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          const newSize = Number(select.value);
          if (onChange) onChange(1, newSize);
        });
        sizeWrap.appendChild(select);
        container.appendChild(sizeWrap);
      }
    },

    buildRange(current, total) {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];
      let l;

      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
          range.push(i);
        }
      }

      range.forEach((i) => {
        if (l) {
          if (i - l === 2) rangeWithDots.push(l + 1);
          else if (i - l !== 1) rangeWithDots.push("...");
        }
        rangeWithDots.push(i);
        l = i;
      });

      return rangeWithDots;
    },
  };

  window.Pagination = Pagination;
})(window);