/**
 * Topbar — no sidebar.
 *
 * Layout (RTL):
 *   [start] Subject button (opens subject picker)
 *   [end]   Offline indicator • Search • Theme toggle • Settings • Profile
 *
 * All actions open their own dropdown / modal so the topbar stays simple.
 */

import { createElement, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { navigate } from "../router.js";
import { dropdown } from "./dropdown.js";
import { toast } from "./toast.js";
import { confirm } from "./confirm.js";
import { auth } from "../services/auth.service.js";
import { theme } from "../config/theme.js";
import { mountSubjectButton } from "./subject-picker.js";
import { ROUTES } from "../config/constants.js";

let subjectButtonRef = null;
const unsubscribers = [];

export function mountHeader() {
  const topbar = document.getElementById("topbar");
  if (!topbar) return () => {};

  topbar.innerHTML = `
    <div class="topbar__start" data-subject-slot></div>
    <div class="topbar__end">
      <button class="icon-btn" id="offline-indicator" type="button" title="بدون اتصال" hidden>
        ${icon("wifiOff", { size: 18 })}
      </button>

      <button class="icon-btn" id="theme-toggle" type="button" title="تغییر پوسته">
        ${icon(theme.current === "dark" ? "sun" : "moon", { size: 19 })}
      </button>

      <button class="icon-btn" id="settings-btn" type="button" title="تنظیمات">
        ${icon("settings", { size: 19 })}
      </button>

      <div class="profile-trigger" id="profile-trigger" role="button" tabindex="0" aria-haspopup="menu">
        <span class="profile-trigger__avatar" data-avatar>?</span>
        <span class="profile-trigger__name" data-name>…</span>
      </div>
    </div>
  `;

  // Subject button (RTL start)
  const subjectSlot = topbar.querySelector("[data-subject-slot]");
  subjectButtonRef = mountSubjectButton(subjectSlot, { current: store.get("route") });

  // Theme toggle
  topbar.querySelector("#theme-toggle").addEventListener("click", () => {
    const next = theme.toggle();
    const el = topbar.querySelector("#theme-toggle");
    el.innerHTML = icon(next === "dark" ? "sun" : "moon", { size: 19 });
    toast.success(next === "dark" ? "پوسته تیره" : "پوسته روشن", { duration: 1800 });
  });

  // Settings
  topbar.querySelector("#settings-btn").addEventListener("click", () => navigate(ROUTES.SETTINGS));

  // Profile dropdown
  setupProfileMenu(topbar.querySelector("#profile-trigger"));

  // Render user
  renderUser();
  unsubscribers.push(bus.on("profile:changed", renderUser));
  unsubscribers.push(bus.on("state:user", renderUser));

  // Offline indicator
  bus.on("state:online", (online) => {
    const el = topbar.querySelector("#offline-indicator");
    if (el) el.hidden = !!online;
  });
  if (!store.get("online")) {
    topbar.querySelector("#offline-indicator").hidden = false;
  }
  topbar.querySelector("#offline-indicator").addEventListener("click", () => {
    toast.warning("اتصال اینترنت قطع است");
  });

  return function cleanup() {
    unsubscribers.forEach((off) => off());
    unsubscribers.length = 0;
    subjectButtonRef = null;
  };
}

/* --------------------------------------------------------------
   Called by the router when the route changes, so the subject
   button reflects the current subject (and hides on settings).
   -------------------------------------------------------------- */
export function updateHeaderForRoute(route) {
  if (!subjectButtonRef) return;
  if (route === ROUTES.SETTINGS) {
    // Settings has no "subject" — keep the button showing "داشبورد"
    subjectButtonRef.update(ROUTES.DASHBOARD);
  } else {
    subjectButtonRef.update(route);
  }
}

/* --------------------------------------------------------------
   Profile menu
   -------------------------------------------------------------- */
function setupProfileMenu(trigger) {
  if (!trigger) return;
  dropdown({
    trigger,
    align: "end",
    content: [
      {
        header: "حساب کاربری",
      },
      {
        label: "تنظیمات",
        icon: "settings",
        onClick: () => navigate(ROUTES.SETTINGS),
      },
      {
        label: "گزارش‌ها",
        icon: "barChart",
        onClick: () => navigate(ROUTES.REPORTS),
      },
      { divider: true },
      {
        label: "خروج",
        icon: "logOut",
        variant: "danger",
        onClick: async () => {
          const ok = await confirm({
            title: "خروج از حساب",
            message: "از حساب کاربری خارج می‌شوید؟",
            variant: "warning",
            confirmLabel: "خروج",
          });
          if (!ok) return;
          try {
            await auth.signOut();
            toast.success("خارج شدید");
          } catch {
            toast.error("خروج ناموفق بود");
          }
        },
      },
    ],
  });
}

/* --------------------------------------------------------------
   Render avatar / name
   -------------------------------------------------------------- */
function renderUser() {
  const user = store.get("user");
  const profile = store.get("profile");
  if (!user) return;

  const nameEl = document.querySelector("[data-name]");
  const avatarEl = document.querySelector("[data-avatar]");
  if (!nameEl || !avatarEl) return;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "کاربر";
  nameEl.textContent = displayName;

  if (profile?.avatar_url) {
    avatarEl.innerHTML = `<img src="${escapeAttr(profile.avatar_url)}" alt="" />`;
  } else {
    avatarEl.textContent = (displayName[0] || "?").toUpperCase();
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[c]));
}

/* Prevent the profile trigger's own tap from firing twice through
   the dropdown's click handler. The dropdown component already
   stops propagation, so nothing extra needed here. */

/* Export for tests / debugging */
export function _getSubjectButtonRef() {
  return subjectButtonRef;
}