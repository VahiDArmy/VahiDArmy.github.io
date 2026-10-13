/**
 * Lightweight popover / dropdown anchored to a trigger element.
 *
 *   const dd = dropdown({
 *     trigger: buttonEl,
 *     content: [ { label: "ویرایش", icon: "edit", onClick } ],
 *     align: "end",   // "start" | "end" — direction-aware (RTL/LTR)
 *   });
 *   dd.close();
 *
 * Positioning
 * -----------
 * In RTL:
 *   align: "start" → panel's RIGHT edge aligns with the trigger's RIGHT edge
 *                    (panel extends leftward, toward the page content)
 *   align: "end"   → panel's LEFT edge aligns with the trigger's LEFT edge
 *                    (panel extends rightward, into the viewport)
 * In LTR, the two are mirrored.
 *
 * In every case the final `left` is clamped so the panel never overflows
 * the viewport, and the panel flips vertically if it would cross the
 * bottom edge.
 *
 * Closes on outside click, Escape, scroll, resize, or when another
 * dropdown opens. Only one open at a time.
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";

let currentOpen = null;

function isRTL() {
  return (
    (document.documentElement.getAttribute("dir") || "").toLowerCase() === "rtl"
  );
}

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
    // Measure the panel AFTER it is in the DOM (see open()).
    const pr = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // ---- Horizontal --------------------------------------------------
    // Decide which side of the trigger the panel is anchored to.
    const rtl = isRTL();
    const alignToEnd = align === "end";
    // In RTL the trigger's "end" is on its LEFT side; in LTR it's on its RIGHT.
    const anchorRightEdge =
      (rtl && !alignToEnd) || (!rtl && alignToEnd);

    let left;
    if (anchorRightEdge) {
      // Panel's right edge sits on the trigger's right edge
      left = r.right - pr.width;
    } else {
      // Panel's left edge sits on the trigger's left edge
      left = r.left;
    }

    // Clamp within the viewport so nothing spills off-screen
    if (left + pr.width > vw - margin) left = vw - margin - pr.width;
    if (left < margin) left = margin;

    panel.style.position = "fixed";
    panel.style.left = `${left}px`;
    panel.style.right = "auto";
    panel.style.top = `${r.bottom + offset}px`;

    // ---- Vertical flip -----------------------------------------------
    if (r.bottom + pr.height + margin > vh) {
      const flipped = r.top - pr.height - offset;
      if (flipped >= margin) panel.style.top = `${flipped}px`;
    }
  }

  function open() {
    if (panel) return;
    if (currentOpen && currentOpen !== handle) currentOpen.close();

    panel = buildPanel();
    document.body.appendChild(panel);

    // Force layout so the panel is measurable, then position it.
    panel.getBoundingClientRect();
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

  const handle = {
    open,
    close,
    toggle,
    get isOpen() { return !!panel; },
  };

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