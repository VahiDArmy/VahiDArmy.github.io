/**
 * Lightweight popover / dropdown anchored to a trigger element.
 *
 *   const dd = dropdown({
 *     trigger: buttonEl,
 *     content: [ { label: "ویرایش", icon: "edit", onClick } ],
 *     align: "end", // start|end (RTL-aware)
 *   });
 *   dd.close();
 *
 * Closes on outside click, Escape, scroll, resize, or when another
 * dropdown opens. Only one open at a time by default.
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";

let currentOpen = null;

export function dropdown(opts = {}) {
  const {
    trigger,
    content,
    align = "end",
    offset = 6,
    closeOnSelect = true,
  } = opts;

  if (!trigger) throw new Error("dropdown: trigger is required");

  let panel = null;

  function buildPanel() {
    const el = createElement("div", { class: `popover popover--${align}`, role: "menu" });
    if (typeof content === "string") {
      el.innerHTML = content;
    } else if (Array.isArray(content)) {
      content.forEach((item) => {
        if (item.divider) {
          el.appendChild(createElement("div", { class: "popover__divider" }));
          return;
        }
        if (item.header) {
          const h = createElement("div", { class: "popover__header" }, item.header);
          el.appendChild(h);
          return;
        }
        const btn = createElement("div", {
          class: `popover__item${item.variant === "danger" ? " is-danger" : ""}${item.active ? " is-active" : ""}`,
          role: "menuitem",
          tabindex: "0",
        });
        btn.innerHTML = `${item.icon ? icon(item.icon, { size: 16 }) : ""}<span></span>${item.shortcut ? `<span class="context-menu__shortcut">${item.shortcut}</span>` : ""}`;
        btn.querySelector("span:not(.context-menu__shortcut)").textContent = item.label || "";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (closeOnSelect) close();
          item.onClick?.(e);
        });
        el.appendChild(btn);
      });
    } else if (content instanceof Node) {
      el.appendChild(content);
    }
    return el;
  }

  function position() {
    if (!panel) return;
    const r = trigger.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.top = `${r.bottom + offset}px`;

    if (align === "end") {
      // RTL: "end" means flush with the right edge of the trigger
      panel.style.right = `${window.innerWidth - r.right}px`;
      panel.style.left = "auto";
    } else {
      panel.style.left = `${r.left}px`;
      panel.style.right = "auto";
    }

    // Flip vertically if not enough space below
    requestAnimationFrame(() => {
      const pr = panel.getBoundingClientRect();
      if (pr.bottom > window.innerHeight - 8) {
        panel.style.top = `${Math.max(8, r.top - pr.height - offset)}px`;
      }
    });
  }

  function open() {
    if (panel) return;
    if (currentOpen && currentOpen !== handle) currentOpen.close();
    panel = buildPanel();
    document.body.appendChild(panel);
    position();
    currentOpen = handle;
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
  }

  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
    if (currentOpen === handle) currentOpen = null;
    document.removeEventListener("mousedown", onDocDown, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onReposition, true);
    window.removeEventListener("resize", onReposition);
  }

  function onDocDown(e) {
    if (panel?.contains(e.target)) return;
    if (trigger.contains(e.target)) return;
    close();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }

  function onReposition() {
    if (panel) position();
  }

  function toggle() {
    panel ? close() : open();
  }

  const handle = { open, close, toggle, get isOpen() { return !!panel; } };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  return handle;
}

export function closeAll() {
  currentOpen?.close();
}