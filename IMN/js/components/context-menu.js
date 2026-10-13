/**
 * Context menu (right-click) system.
 *
 *   contextMenu.show(event, [
 *     { label: "ویرایش", icon: "edit", onClick: () => edit() },
 *     { label: "کپی",   icon: "copy", shortcut: "Ctrl+C", onClick: copy },
 *     { divider: true },
 *     { label: "حذف", icon: "trash", variant: "danger", onClick: del },
 *   ]);
 *
 * Features: keyboard nav (arrows, Enter, Esc), viewport clamping, nested
 * submenus, dividers, disabled items, danger variant, auto-close on
 * outside click / scroll / resize / Escape.
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";

const ROOT_ID = "context-menu-root";
let current = null;

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = createElement("div", { id: ROOT_ID, class: "context-menu-root" });
    document.body.appendChild(root);
  }
  return root;
}

function hide() {
  if (!current) return;
  current.root.innerHTML = "";
  current = null;
  document.removeEventListener("keydown", onGlobalKey, true);
  document.removeEventListener("mousedown", onGlobalDown, true);
  window.removeEventListener("resize", hide);
  window.removeEventListener("scroll", hide, true);
}

function onGlobalKey(e) {
  if (!current) return;
  if (e.key === "Escape") {
    e.stopPropagation();
    hide();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    current.focusNext(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    current.focusNext(-1);
  } else if (e.key === "Enter") {
    const focused = current.root.querySelector(".context-menu__item.is-focused");
    if (focused) {
      e.preventDefault();
      focused.click();
    }
  }
}

function onGlobalDown(e) {
  if (!current) return;
  if (!current.root.contains(e.target)) hide();
}

export function show(event, items) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const root = ensureRoot();
  root.innerHTML = "";

  const menu = buildMenu(items, { root });
  root.appendChild(menu);

  // Position near pointer, clamped to viewport
  const { clientX: x, clientY: y } = event;
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  let left = x;
  let top = y;
  if (left + rect.width + margin > vw) left = vw - rect.width - margin;
  if (top + rect.height + margin > vh) top = vh - rect.height - margin;
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  // RTL — anchor from right edge of viewport conceptually
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  current = {
    root,
    menu,
    focusNext: (dir) => {
      const focusables = [...menu.querySelectorAll(".context-menu__item:not(.is-disabled)")];
      if (!focusables.length) return;
      const idx = focusables.findIndex((el) => el.classList.contains("is-focused"));
      let next = idx + dir;
      if (next < 0) next = focusables.length - 1;
      if (next >= focusables.length) next = 0;
      focusables.forEach((el) => el.classList.remove("is-focused"));
      focusables[next].classList.add("is-focused");
      focusables[next].focus({ preventScroll: true });
    },
  };

  // Focus first item for keyboard
  requestAnimationFrame(() => current?.focusNext(1));

  document.addEventListener("keydown", onGlobalKey, true);
  document.addEventListener("mousedown", onGlobalDown, true);
  window.addEventListener("resize", hide);
  window.addEventListener("scroll", hide, true);
}

function buildMenu(items, ctx) {
  const menu = createElement("div", { class: "context-menu", role: "menu" });

  items.forEach((item) => {
    if (item.divider) {
      menu.appendChild(createElement("div", { class: "context-menu__divider", role: "separator" }));
      return;
    }
    const el = createElement("div", {
      class: `context-menu__item${item.disabled ? " is-disabled" : ""}${item.variant === "danger" ? " is-danger" : ""}${item.submenu ? " has-submenu" : ""}`,
      role: "menuitem",
      tabindex: item.disabled ? "-1" : "0",
    });
    el.innerHTML = `
      <span class="context-menu__icon">${icon(item.icon || "circle", { size: 16 })}</span>
      <span class="context-menu__label"></span>
      ${item.shortcut ? `<span class="context-menu__shortcut">${escapeHtml(item.shortcut)}</span>` : ""}
      ${item.submenu ? '<span class="context-menu__submenu-arrow">◀</span>' : ""}
    `;
    el.querySelector(".context-menu__label").textContent = item.label || "";

    if (item.submenu && Array.isArray(item.submenu)) {
      el.appendChild(buildMenu(item.submenu, ctx));
    }

    if (!item.disabled) {
      el.addEventListener("click", (e) => {
        if (item.submenu) return; // don't close on parent click
        e.stopPropagation();
        hide();
        try { item.onClick?.(e); } catch (err) { console.error(err); }
      });
      el.addEventListener("mouseenter", () => {
        menu.querySelectorAll(".context-menu__item.is-focused").forEach((n) =>
          n.classList.remove("is-focused")
        );
        el.classList.add("is-focused");
      });
    }
    menu.appendChild(el);
  });

  return menu;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[c]));
}

export const contextMenu = { show, hide };