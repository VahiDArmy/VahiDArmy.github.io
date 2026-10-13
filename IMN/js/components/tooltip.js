/**
 * Tooltip.
 *
 * Two flavors:
 *  1. Declarative: any element with `data-tooltip="..."` shows a native
 *     CSS tooltip on hover (see css/components/tooltips.css). No JS needed.
 *  2. Programmatic: `tooltip.attach(el, { content, placement, delay })`
 *     produces a floating tooltip that avoids viewport edges and follows
 *     scroll. Useful for icons in tight spots.
 */

import { createElement } from "../utils/dom.js";

const ROOT_ID = "tooltip-root";
let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById(ROOT_ID);
  if (!root) {
    root = createElement("div", { id: ROOT_ID, class: "tooltip-root" });
    document.body.appendChild(root);
  }
  return root;
}

export function attach(target, opts = {}) {
  if (!target) return () => {};
  const {
    content = target.getAttribute("data-tooltip") || "",
    placement = "top",
    delay = 250,
  } = opts;

  let el = null;
  let timer = null;

  function show() {
    if (el) return;
    el = createElement("div", { class: "tooltip", role: "tooltip" });
    el.dataset.placement = placement;
    el.textContent = content;
    ensureRoot().appendChild(el);
    position();
    // Fade-in
    el.style.opacity = "0";
    requestAnimationFrame(() => (el.style.opacity = "1"));
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
  }

  function hide() {
    clearTimeout(timer);
    timer = null;
    if (!el) return;
    const e = el;
    el = null;
    window.removeEventListener("scroll", position, true);
    window.removeEventListener("resize", position);
    e.remove();
  }

  function position() {
    if (!el) return;
    const r = target.getBoundingClientRect();
    const tr = el.getBoundingClientRect();
    const MARGIN = 8;
    let top, left;

    switch (placement) {
      case "bottom":
        top = r.bottom + MARGIN;
        left = r.left + r.width / 2 - tr.width / 2;
        break;
      case "left":
        top = r.top + r.height / 2 - tr.height / 2;
        left = r.left - tr.width - MARGIN;
        break;
      case "right":
        top = r.top + r.height / 2 - tr.height / 2;
        left = r.right + MARGIN;
        break;
      case "top":
      default:
        top = r.top - tr.height - MARGIN;
        left = r.left + r.width / 2 - tr.width / 2;
    }

    // Clamp within viewport
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tr.width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - tr.height - MARGIN));

    // Flip if it would overflow
    if (placement === "top" && top < MARGIN) {
      top = r.bottom + MARGIN;
      el.dataset.placement = "bottom";
    } else if (placement === "bottom" && top + tr.height > window.innerHeight - MARGIN) {
      top = r.top - tr.height - MARGIN;
      el.dataset.placement = "top";
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }

  function onEnter() {
    timer = setTimeout(show, delay);
  }
  function onLeave() {
    clearTimeout(timer);
    hide();
  }

  target.addEventListener("mouseenter", onEnter);
  target.addEventListener("mouseleave", onLeave);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
  target.addEventListener("click", hide);

  return function detach() {
    target.removeEventListener("mouseenter", onEnter);
    target.removeEventListener("mouseleave", onLeave);
    target.removeEventListener("focus", show);
    target.removeEventListener("blur", hide);
    target.removeEventListener("click", hide);
    hide();
  };
}

/** Auto-wire every `[data-tooltip]` under `root`. */
export function initAll(root = document) {
  const nodes = root.querySelectorAll("[data-tooltip]:not([data-tooltip-wired])");
  const cleanups = [];
  nodes.forEach((el) => {
    el.setAttribute("data-tooltip-wired", "1");
    cleanups.push(attach(el, { content: el.getAttribute("data-tooltip") }));
  });
  return () => cleanups.forEach((c) => c());
}

export const tooltip = { attach, initAll };