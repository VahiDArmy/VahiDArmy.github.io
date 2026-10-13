/**
 * Application entry point.
 *
 * Inline HTML boot screen (index.html) already displays before this file
 * runs. Our job is to:
 *   1. Hide the boot screen once we know what to show.
 *   2. Never leave the user stuck — every failure path renders something.
 */

import { theme } from "./config/theme.js";
import { isConfigured, clientReady, clientErrorMessage } from "./config/supabase.js";
import { store } from "./core/state.js";
import { bus } from "./core/event-bus.js";
import { auth } from "./services/auth.service.js";
import { bootstrap } from "./bootstrap.js";
import { initRouter, navigate } from "./router.js";
import { mountSidebar, closeMobile } from "./components/sidebar.js";
import { mountHeader } from "./components/header.js";
import { tooltip } from "./components/tooltip.js";
import { toast } from "./components/toast.js";
import { mountAuth, unmountAuth } from "./pages/auth.page.js";
import { STORAGE_KEYS, ROUTES } from "./config/constants.js";
import { storage } from "./core/storage.js";
import { withTimeout } from "./utils/async.js";

/* ---------- Boot screen helpers (delegated to inline HTML) ------------ */
function bootProgress(msg) {
  try { window.__appBootProgress?.(msg); } catch {}
}
function bootDone() {
  try { window.__appBooted?.(); } catch {}
}
function bootFail(err, hint) {
  try {
    if (hint) {
      const status = document.getElementById("boot-status");
      if (status) status.dataset.hint = hint;
    }
    window.__appBootError?.(err);
  } catch {}
}

/* ---------- Main boot ------------------------------------------------ */
async function main() {
  bootProgress("آماده‌سازی رابط کاربری…");

  // 1. Theme
  theme.init();

  // 2. Footer year
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // 3. Top progress bar
  mountTopProgress();

  // 4. Guard: not configured
  if (!isConfigured) {
    bootFail(
      new Error("Supabase پیکربندی نشده است"),
      "فایل supabase-config.js را بسازید و url/anonKey را وارد کنید."
    );
    return;
  }

  // 5. Guard: client failed (bad key / CDN blocked / network)
  if (!clientReady) {
    bootFail(
      new Error(clientErrorMessage || "اتصال به Supabase برقرار نشد"),
      "اتصال اینترنت و دسترسی به CDN ها را بررسی کنید."
    );
    return;
  }

  // 6. Subscribe to auth BEFORE init so we don't miss the first event
  bus.on("auth:changed", onAuthChanged);

  // 7. Auth init with hard timeout
  bootProgress("بررسی نشست کاربر…");
  let session = null;
  try {
    session = await withTimeout(auth.init(), 8000, "AUTH_INIT_TIMEOUT");
  } catch (err) {
    console.error("[app] auth.init failed", err);
    session = null;
  }

  // 8. Show whatever screen is appropriate
  if (!session) {
    bootProgress("نمایش صفحه ورود…");
    showAuth();
  }
  // If a session exists, onAuthChanged already fired.

  // 9. Global hooks
  bus.on("route:changed", () => {
    if (window.innerWidth <= 980) closeMobile();
  });
  bus.on("state:online", (online) => {
    if (online) toast.success("اتصال بازگشت", { duration: 2000 });
    else toast.warning("اتصال اینترنت قطع شد", { duration: 3000 });
  });
  tooltip.initAll();

  // 10. All good — hide the boot screen
  bootDone();
}

/* ---------- Auth transitions ----------------------------------------- */
let shellMounted = false;
let shellCleanup = null;

async function onAuthChanged({ user }) {
  try {
    if (user) {
      if (!shellMounted) await showApp();
    } else {
      if (shellMounted) unmountApp();
      showAuth();
    }
    bootDone();
  } catch (err) {
    console.error("[app] onAuthChanged failed", err);
    bootFail(err);
  }
}

function showAuth() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  mountAuth();
}

/* ---------- App shell ------------------------------------------------ */
async function showApp() {
  unmountAuth();

  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = true;
  if (appShell) appShell.hidden = false;

  bootProgress("بارگذاری داده‌های اولیه…");
  try {
    await withTimeout(bootstrap(), 15000, "BOOTSTRAP_TIMEOUT");
  } catch (err) {
    console.warn("[app] bootstrap warning (continuing)", err);
  }

  const sidebarCleanup = mountSidebar();
  const headerCleanup = mountHeader();

  const container = document.getElementById("page-container");
  initRouter(container);

  const last = storage.get(STORAGE_KEYS.LAST_PAGE);
  const validRoute = Object.values(ROUTES).includes(last) ? last : ROUTES.DASHBOARD;
  if (!window.location.hash) {
    navigate(validRoute, {}, { replace: true });
  }

  shellMounted = true;
  shellCleanup = () => {
    sidebarCleanup?.();
    headerCleanup?.();
  };
}

function unmountApp() {
  shellMounted = false;
  try { shellCleanup?.(); } catch {}
  shellCleanup = null;
  const appShell = document.getElementById("app-shell");
  if (appShell) appShell.hidden = true;
  store.reset();
}

/* ---------- Top progress bar ----------------------------------------- */
function mountTopProgress() {
  const el = document.createElement("div");
  el.className = "top-progress";
  el.innerHTML = '<div class="top-progress__bar"></div>';
  document.body.appendChild(el);
  const bar = el.querySelector(".top-progress__bar");

  let timer = null;
  bus.on("route:changed", () => {
    clearInterval(timer);
    bar.style.width = "15%";
    let w = 15;
    timer = setInterval(() => {
      w = Math.min(90, w + Math.random() * 10);
      bar.style.width = w + "%";
    }, 250);
    setTimeout(() => {
      clearInterval(timer);
      bar.style.width = "100%";
      setTimeout(() => (bar.style.width = "0%"), 300);
    }, 350);
  });
}

/* ---------- Go ------------------------------------------------------- */
main().catch((err) => {
  console.error("[app] fatal", err);
  bootFail(err);
});