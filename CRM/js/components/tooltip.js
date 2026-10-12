/* ============================================================================
   TOOLTIP
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  let activeTooltip = null;
  let timer = null;

  const root = () => Dom.id("tooltip-root");

  function build(text, placement) {
    const tip = Dom.el("div", {
      class: "tooltip",
      role: "tooltip",
      dataset: { placement },
    });
    tip.appendChild(document.createTextNode(text));
    tip.appendChild(Dom.el("span", { class: "tooltip__arrow" }));
    return tip;
  }

  const Tooltip = {
    show(anchor, text, opts = {}) {
      if (!anchor || !text) return;
      const {
        placement = "top",
        delay = 0,
        offset = 8,
      } = opts;

      this.hide();

      const run = () => {
        const container = root();
        const tip = build(text, placement);
        container.appendChild(tip);
        Dom.positionFor(tip, anchor, placement, offset);
        activeTooltip = { el: tip, anchor };
        tip.style.opacity = "0";
        requestAnimationFrame(() => {
          tip.style.transition = "opacity 140ms ease";
          tip.style.opacity = "1";
        });
      };

      if (delay > 0) {
        timer = setTimeout(run, delay);
      } else {
        run();
      }
    },

    hide() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (activeTooltip && activeTooltip.el) {
        const el = activeTooltip.el;
        el.style.transition = "opacity 100ms ease";
        el.style.opacity = "0";
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 110);
      }
      activeTooltip = null;
    },

    attach(anchor, text, opts = {}) {
      if (!anchor) return () => {};
      const show = () => Tooltip.show(anchor, text, opts);
      const hide = () => Tooltip.hide();

      anchor.addEventListener("mouseenter", show);
      anchor.addEventListener("mouseleave", hide);
      anchor.addEventListener("focus", show);
      anchor.addEventListener("blur", hide);
      anchor.addEventListener("click", hide);

      return () => {
        anchor.removeEventListener("mouseenter", show);
        anchor.removeEventListener("mouseleave", hide);
        anchor.removeEventListener("focus", show);
        anchor.removeEventListener("blur", hide);
        anchor.removeEventListener("click", hide);
      };
    },

    /* ---------- Auto-bind all elements with [title] into tooltip ---------- */
    autoBind(scope = document) {
      Dom.qa("[title], [data-tooltip]", scope).forEach((el) => {
        const text = el.getAttribute("data-tooltip") || el.getAttribute("title");
        if (!text) return;
        el.removeAttribute("title");
        el.setAttribute("data-tooltip-bound", "1");
        this.attach(el, text, { placement: el.dataset.tooltipPlacement || "top", delay: 260 });
      });
    },
  };

  window.Tooltip = Tooltip;
})(window);