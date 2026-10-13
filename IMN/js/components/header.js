/**
 * Top bar (header) — page title, date, actions, notifications, user menu.
 */

import { $, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { navigate, getCurrentRoute } from "../router.js";
import { toggleSidebar } from "./sidebar.js";
import { dropdown } from "./dropdown.js";
import { toast } from "./toast.js";
import { todayISO, addDays, formatRelative } from "../utils/date.js";

const PAGE_META = {
  dashboard: { title: "داشبورد", subtitle: "خلاصه امروز" },
  food:      { title: "غذا و وعده‌ها", subtitle: "ثبت غذا و کالری" },
  health:    { title: "سلامت", subtitle: "انسولین، قند، فشار و وزن" },
  sleep:     { title: "خواب", subtitle: "ساعت خواب و بیداری" },
  activity:  { title: "فعالیت و ورزش", subtitle: "پیاده‌روی و ورزش" },
  reports:   { title: "گزارش‌ها", subtitle: "تحلیل جامع" },
  settings:  { title: "تنظیمات", subtitle: "حساب و اهداف" },
};

let unsubscribeRoute = null;
let unsubscribeDate = null;

export function mountHeader() {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  topbar.innerHTML = `
    <button class="topbar__hamburger" data-toggle-sidebar type="button" aria-label="منو">
      ${icon("menu", { size: 22 })}
    </button>

    <div class="topbar__title">
      <div class="topbar__title-main" data-page-title>—</div>
      <div class="topbar__title-sub" data-page-sub></div>
    </div>

    <div class="topbar__left">
      <div class="date-chip" data-date-chip role="button" tabindex="0" title="تغییر تاریخ">
        ${icon("calendar", { size: 16 })}
        <span data-date-chip-label></span>
      </div>

      <button class="icon-btn" data-action="offline-indicator" type="button" hidden title="قطع اتصال">
        ${icon("wifiOff", { size: 18 })}
      </button>

      <button class="icon-btn" data-action="search" type="button" title="جستجو">
        ${icon("search", { size: 20 })}
      </button>

      <div data-notif-slot></div>

      <button class="icon-btn" data-action="quick-add" type="button" title="افزودن سریع">
        ${icon("plus", { size: 20 })}
      </button>
    </div>
  `;

  // Toggle sidebar
  delegate(topbar, "click", "[data-toggle-sidebar]", () => toggleSidebar());

  // Date chip — opens compact date switcher
  delegate(topbar, "click", "[data-date-chip]", (e) => {
    openDatePicker(e.currentTarget);
  });

  // Search — opens command palette-ish (reuse reports search? simple prompt)
  delegate(topbar, "click", "[data-action='search']", () => {
    toast.info("از جستجوی درون صفحه‌ها استفاده کنید");
  });

  // Quick add — dropdown of quick actions
  delegate(topbar, "click", "[data-action='quick-add']", (e) => {
    dropdown({
      trigger: e.currentTarget,
      content: [
        { label: "افزودن غذا", icon: "utensils", onClick: () => navigate("food") },
        { label: "ثبت انسولین", icon: "syringe", onClick: () => navigate("health") },
        { label: "ثبت قند خون", icon: "droplet", onClick: () => navigate("health") },
        { label: "ثبت فشار خون", icon: "stethoscope", onClick: () => navigate("health") },
        { label: "ثبت وزن", icon: "scale", onClick: () => navigate("health") },
        { divider: true },
        { label: "ثبت خواب", icon: "moon", onClick: () => navigate("sleep") },
        { label: "ثبت فعالیت", icon: "walk", onClick: () => navigate("activity") },
      ],
    }).open();
  });

  // Notifications placeholder (empty state)
  renderNotifications();

  // React to route change
  updatePageTitle(getCurrentRoute());
  unsubscribeRoute = bus.on("route:changed", ({ route }) => updatePageTitle(route));

  // React to date changes
  updateDateChip(store.get("selectedDate"));
  unsubscribeDate = bus.on("state:selectedDate", (iso) => updateDateChip(iso));

  // Online/offline
  bus.on("state:online", (online) => {
    const el = topbar.querySelector("[data-action='offline-indicator']");
    if (el) el.hidden = !!online;
  });

  return function cleanup() {
    unsubscribeRoute?.();
    unsubscribeDate?.();
  };
}

function updatePageTitle(route) {
  const meta = PAGE_META[route] || { title: "—", subtitle: "" };
  const titleEl = document.querySelector("[data-page-title]");
  const subEl = document.querySelector("[data-page-sub]");
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
}

function updateDateChip(iso) {
  const label = document.querySelector("[data-date-chip-label]");
  if (label) label.textContent = formatRelative(iso);
}

function openDatePicker(trigger) {
  const current = store.get("selectedDate") || todayISO();
  dropdown({
    trigger,
    align: "end",
    closeOnSelect: true,
    content: [
      { label: "امروز", icon: "calendar", onClick: () => store.setSelectedDate(todayISO()) },
      { label: "دیروز", icon: "chevronRight", onClick: () => store.setSelectedDate(addDays(todayISO(), -1)) },
      { label: "پریروز", icon: "chevronRight", onClick: () => store.setSelectedDate(addDays(todayISO(), -2)) },
      { divider: true },
      { label: "۳ روز پیش", onClick: () => store.setSelectedDate(addDays(todayISO(), -3)) },
      { label: "۵ روز پیش", onClick: () => store.setSelectedDate(addDays(todayISO(), -5)) },
      { label: "۷ روز پیش", onClick: () => store.setSelectedDate(addDays(todayISO(), -7)) },
    ],
  }).open();
}

function renderNotifications() {
  const slot = document.querySelector("[data-notif-slot]");
  if (!slot) return;
  slot.innerHTML = `
    <button class="icon-btn" data-action="notifications" type="button" title="اعلان‌ها">
      ${icon("bell", { size: 20 })}
    </button>
  `;
  slot.querySelector("[data-action='notifications']").addEventListener("click", (e) => {
    dropdown({
      trigger: e.currentTarget,
      content: [
        { header: "اعلان‌ها" },
        { label: "هیچ اعلان جدیدی ندارید", icon: "info" },
      ],
    }).open();
  });
}