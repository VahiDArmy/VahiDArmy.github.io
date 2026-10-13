/**
 * Sidebar navigation.
 */

import { $, createElement, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { ROUTES, APP_VERSION, STORAGE_KEYS } from "../config/constants.js";
import { navigate, getCurrentRoute } from "../router.js";
import { storage } from "../core/storage.js";
import { auth } from "../services/auth.service.js";
import { toast } from "./toast.js";
import { confirm } from "./confirm.js";
import { dropdown } from "./dropdown.js";

const NAV_ITEMS = [
  { route: ROUTES.DASHBOARD, label: "داشبورد", icon: "dashboard" },
  { route: ROUTES.FOOD,      label: "غذا",     icon: "utensils" },
  { route: ROUTES.HEALTH,    label: "سلامت",   icon: "heartPulse" },
  { route: ROUTES.SLEEP,     label: "خواب",     icon: "moon" },
  { route: ROUTES.ACTIVITY,  label: "فعالیت",  icon: "activity" },
  { route: ROUTES.REPORTS,   label: "گزارش‌ها", icon: "barChart" },
];

const BOTTOM_ITEMS = [
  { route: ROUTES.SETTINGS, label: "تنظیمات", icon: "settings" },
];

let unsubscribeRoute = null;
let unsubscribeProfile = null;

export function mountSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar__brand">
      <div class="sidebar__logo">${icon("heartPulse", { size: 22 })}</div>
      <div class="sidebar__brand-text">
        <div class="sidebar__brand-title">ردیاب فعالیت</div>
        <div class="sidebar__brand-sub">نسخه ${APP_VERSION}</div>
      </div>
    </div>

    <nav class="sidebar__nav">
      <div class="sidebar__section">منوی اصلی</div>
      ${NAV_ITEMS.map((it) => navLink(it)).join("")}
      <div class="sidebar__section">تنظیمات</div>
      ${BOTTOM_ITEMS.map((it) => navLink(it)).join("")}
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__user" data-user-trigger role="button" tabindex="0">
        <div class="sidebar__avatar" data-user-avatar></div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name" data-user-name>…</div>
          <div class="sidebar__user-mail" data-user-mail></div>
        </div>
        <span style="color:var(--color-text-4)">${icon("moreVertical", { size: 16 })}</span>
      </div>
    </div>
  `;

  // Click on nav
  delegate(sidebar, "click", "[data-route]", (e, el) => {
    e.preventDefault();
    navigate(el.dataset.route);
    // close mobile sidebar
    closeMobile();
  });

  // User dropdown
  const userTrigger = sidebar.querySelector("[data-user-trigger]");
  dropdown({
    trigger: userTrigger,
    align: "end",
    content: [
      { label: "تنظیمات", icon: "settings", onClick: () => navigate(ROUTES.SETTINGS) },
      { label: "گزارش‌ها", icon: "barChart", onClick: () => navigate(ROUTES.REPORTS) },
      { divider: true },
      {
        label: "خروج", icon: "logOut", variant: "danger",
        onClick: async () => {
          const ok = await confirm({
            title: "خروج",
            message: "از حساب کاربری خارج می‌شوید؟",
            variant: "warning",
            confirmLabel: "خروج",
          });
          if (!ok) return;
          await auth.signOut();
          toast.success("خارج شدید");
        },
      },
    ],
  });

  // Toggle collapse (desktop)
  // (invoked by header button)

  // Handle current route highlight
  updateActive(getCurrentRoute());
  unsubscribeRoute = bus.on("route:changed", ({ route }) => updateActive(route));

  // Profile updates
  renderUser();
  unsubscribeProfile = bus.on("profile:changed", renderUser);
  bus.on("state:user", renderUser);

  // Restore collapsed state
  const collapsed = storage.get(STORAGE_KEYS.SIDEBAR_COLLAPSED);
  if (collapsed) {
    document.body.classList.add("sidebar-collapsed");
    sidebar.classList.add("is-collapsed");
  }

  return function cleanup() {
    unsubscribeRoute?.();
    unsubscribeProfile?.();
  };
}

export function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  if (window.innerWidth <= 980) {
    sidebar.classList.toggle("is-open");
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) {
      overlay.hidden = !sidebar.classList.contains("is-open");
    }
  } else {
    sidebar.classList.toggle("is-collapsed");
    document.body.classList.toggle("sidebar-collapsed");
    storage.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, sidebar.classList.contains("is-collapsed"));
  }
}

export function closeMobile() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!sidebar) return;
  sidebar.classList.remove("is-open");
  if (overlay) overlay.hidden = true;
}

/* ---------- Helpers --------------------------------------------------- */
function navLink({ route, label, icon: iconName }) {
  return `
    <a class="sidebar__link" href="#/${route}" data-route="${route}" data-tooltip-position="left" data-tooltip="${label}">
      <span class="sidebar__icon">${icon(iconName, { size: 22 })}</span>
      <span class="sidebar__label">${label}</span>
    </a>
  `;
}

function updateActive(route) {
  document.querySelectorAll(".sidebar__link").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.route === route);
  });
}

function renderUser() {
  const user = store.get("user");
  const profile = store.get("profile");
  const nameEl = document.querySelector("[data-user-name]");
  const mailEl = document.querySelector("[data-user-mail]");
  const avatarEl = document.querySelector("[data-user-avatar]");

  if (!user) return;
  const displayName = profile?.display_name || user.email?.split("@")[0] || "کاربر";
  if (nameEl) nameEl.textContent = displayName;
  if (mailEl) mailEl.textContent = user.email || "";

  if (avatarEl) {
    if (profile?.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="" />`;
    } else {
      avatarEl.textContent = (displayName[0] || "؟").toUpperCase();
    }
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}