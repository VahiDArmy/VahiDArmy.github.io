/**
 * Hash-based router.
 *
 * Routes look like:  #/dashboard, #/food?date=2025-01-15, #/reports?range=weekly
 *
 * Each page module exports:
 *   { title, subtitle, icon, render(container, params) -> cleanup | void }
 */

import { bus } from "./core/event-bus.js";
import { store } from "./core/state.js";
import { ROUTES } from "./config/constants.js";
import { toast } from "./components/toast.js";

const PAGE_LOADERS = {
  [ROUTES.DASHBOARD]: () => import("./pages/dashboard.page.js"),
  [ROUTES.FOOD]:      () => import("./pages/food.page.js"),
  [ROUTES.HEALTH]:    () => import("./pages/health.page.js"),
  [ROUTES.SLEEP]:     () => import("./pages/sleep.page.js"),
  [ROUTES.ACTIVITY]:  () => import("./pages/activity.page.js"),
  [ROUTES.REPORTS]:   () => import("./pages/reports.page.js"),
  [ROUTES.SETTINGS]:  () => import("./pages/settings.page.js"),
};

const DEFAULT_ROUTE = ROUTES.DASHBOARD;

let currentCleanup = null;
let currentRoute = null;
let currentParams = null;
let containerEl = null;
let navToken = 0;

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const path = pathPart || DEFAULT_ROUTE;
  const params = Object.fromEntries(new URLSearchParams(queryPart));
  return { route: path, params };
}

function buildHash(route, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "")
  ).toString();
  return `#/${route}${qs ? "?" + qs : ""}`;
}

export function initRouter(container) {
  containerEl = container;
  window.addEventListener("hashchange", onHashChange);
  onHashChange();
}

export function navigate(route, params = {}, { replace = false } = {}) {
  const next = buildHash(route, params);
  if (replace) {
    history.replaceState(null, "", next);
    onHashChange();
  } else if (window.location.hash === next) {
    onHashChange();
  } else {
    window.location.hash = next;
  }
}

export function reload() {
  onHashChange();
}

export function getCurrentRoute() {
  return currentRoute;
}

export function getCurrentParams() {
  return { ...currentParams };
}

async function onHashChange() {
  const { route, params } = parseHash();
  const loader = PAGE_LOADERS[route];

  if (!loader) {
    if (route !== DEFAULT_ROUTE) {
      navigate(DEFAULT_ROUTE, {}, { replace: true });
      return;
    }
  }

  const myToken = ++navToken;

  try {
    if (typeof currentCleanup === "function") currentCleanup();
  } catch (err) {
    console.error("[router] cleanup error", err);
  }
  currentCleanup = null;
  currentRoute = route;
  currentParams = params;
  store.setRoute(route);

  containerEl.innerHTML = `
    <div class="loader-root" style="position:relative;inset:auto;min-height:60vh;background:transparent;backdrop-filter:none">
      <div class="loader-root__inner">
        <div class="spinner"></div>
        <span>در حال بارگذاری…</span>
      </div>
    </div>
  `;

  let mod;
  try {
    mod = await loader();
  } catch (err) {
    console.error("[router] failed to load page", err);
    if (myToken !== navToken) return;
    containerEl.innerHTML = `
      <div class="empty" style="min-height:60vh">
        <div class="empty__art">
          <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12" y2="17.5"/>
          </svg>
        </div>
        <div class="empty__title">خطا در بارگذاری صفحه</div>
        <div class="empty__text">لطفاً صفحه را دوباره بارگذاری کنید.</div>
      </div>
    `;
    return;
  }

  if (myToken !== navToken) return;

  const page = mod.default || mod;
  if (!page || typeof page.render !== "function") {
    console.error("[router] page module has no render()", route);
    return;
  }

  bus.emit("route:changed", { route, params, page });

  containerEl.innerHTML = "";
  containerEl.setAttribute("data-page", route);

  try {
    const cleanup = await page.render(containerEl, params);
    if (myToken !== navToken) {
      if (typeof cleanup === "function") cleanup();
      return;
    }
    currentCleanup = typeof cleanup === "function" ? cleanup : null;
  } catch (err) {
    console.error("[router] render error", err);
    toast.error("خطا در نمایش صفحه");
    containerEl.innerHTML = `
      <div class="empty" style="min-height:60vh">
        <div class="empty__title">مشکلی پیش آمد</div>
        <div class="empty__text">${escapeHtml(err?.message || "")}</div>
      </div>
    `;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}