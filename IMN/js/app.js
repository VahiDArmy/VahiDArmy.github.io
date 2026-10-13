/**
 * Application entry point.
 *
 * Responsibilities:
 *  1. Init theme (applies data-theme before anything renders).
 *  2. Init auth — subscribes to auth changes.
 *  3. If signed in → bootstrap data, mount shell, start router.
 *  4. If signed out → show auth page.
 *  5. Clean shutdown of listeners on unload.
 */

import { theme } from "./config/theme.js";
import { isConfigured } from "./config/supabase.js";
import { store } from "./core/state.js";
import { bus } from "./core/event-bus.js";
import { auth } from "./services/auth.service.js";
import { bootstrap } from "./bootstrap.js";
import { initRouter, navigate, getCurrentRoute } from "./router.js";
import { mountSidebar, closeMobile } from "./components/sidebar.js";
import { mountHeader } from "./components/header.js";
import { tooltip } from "./components/tooltip.js";
import { toast } from "./components/toast.js";
import { mountAuth, unmountAuth } from "./pages/auth.page.js";
import { STORAGE_KEYS, ROUTES } from "./config/constants.js";
import { storage } from "./core/storage.js";

/* ---------- Boot ------------------------------------------------------ */
const cleanups = [];

async function main() {
  // 1. Theme FIRST so there's no flash of unstyled theme
  theme.init();

  // 2. Setup footer year
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // 3. Bind top progress bar to route loads
  mountTopProgress();

  // 4. Guard: Supabase not configured
  if (!isConfigured) {
    showSetupWarning();
    return;
  }

  // 5. Init auth and listen for state changes
  bus.on("auth:changed", onAuthChanged);

  try {
    const session = await auth.init();
    if (!session) {
      showAuth();
    }
    // If session exists, onAuthChanged was already fired by auth listener.
  } catch (err) {
    console.error("[app] auth init failed", err);
    toast.error("خطا در راه‌اندازی سرویس احراز هویت");
    showAuth();
  }

  // 6. Close mobile sidebar on navigation
  bus.on("route:changed", () => {
    if (window.innerWidth <= 980) closeMobile();
  });

  // 7. Warn when going offline/online
  bus.on("state:online", (online) => {
    if (online) toast.success("اتصال بازگشت", { duration: 2000 });
    else toast.warning("اتصال اینترنت قطع شد", { duration: 3000 });
  });

  // 8. Init global tooltips
  const detachTooltips = tooltip.initAll();
  cleanups.push(detachTooltips);
}

/* ---------- Auth transitions ----------------------------------------- */
let shellMounted = false;
let shellCleanup = null;

async function onAuthChanged({ event, user }) {
  if (user) {
    // Just signed in
    if (!shellMounted) {
      await showApp();
    } else {
      // already mounted — just refresh data
      try { await bootstrap(); } catch {}
    }
  } else {
    // Signed out
    if (shellMounted) {
      unmountApp();
    }
    showAuth();
  }
}

/* ---------- Auth screen ---------------------------------------------- */
function showAuth() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  mountAuth();
}

/* ---------- App shell ------------------------------------------------- */
async function showApp() {
  unmountAuth();

  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = true;
  if (appShell) appShell.hidden = false;

  // Bootstrap data
  try {
    await bootstrap();
  } catch (err) {
    console.error("[app] bootstrap failed", err);
  }

  // Mount sidebar + header once
  const sidebarCleanup = mountSidebar();
  const headerCleanup = mountHeader();

  // Start router
  const container = document.getElementById("page-container");
  initRouter(container);

  // Restore last page
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
  function start() {
    clearInterval(timer);
    bar.style.width = "15%";
    let w = 15;
    timer = setInterval(() => {
      w = Math.min(90, w + Math.random() * 10);
      bar.style.width = w + "%";
    }, 250);
  }
  function finish() {
    clearInterval(timer);
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.width = "0%";
    }, 300);
  }

  bus.on("route:changed", () => { start(); setTimeout(finish, 350); });
}

/* ---------- Setup warning -------------------------------------------- */
function showSetupWarning() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (appShell) appShell.hidden = true;
  if (!authScreen) return;
  authScreen.hidden = false;
  authScreen.innerHTML = `
    <div class="auth-card anim-fade-in-up" style="max-width:560px">
      <div class="auth-brand">
        <div class="auth-brand__logo" style="background:var(--gradient-danger)">⚠</div>
        <div class="auth-brand__title">تنظیمات لازم است</div>
        <div class="auth-brand__sub">اتصال به Supabase پیکربندی نشده است</div>
      </div>
      <p class="text-sm text-muted" style="line-height:1.9;margin-bottom:16px">
        برای استفاده از این برنامه، باید اطلاعات اتصال به Supabase را در فایل
        <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-family:var(--font-mono)">supabase-config.js</code>
        کنار <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-family:var(--font-mono)">index.html</code>
        قرار دهید:
      </p>
      <pre style="background:rgba(0,0,0,0.35);padding:14px;border-radius:10px;font-size:12px;overflow-x:auto;direction:ltr;text-align:left;border:1px solid var(--color-border-2)">window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-KEY"
};</pre>
      <p class="text-xs text-muted" style="margin-top:16px;line-height:1.8">
        همچنین فایل <code>supabase-schema.sql</code> را در پنل Supabase (SQL Editor) اجرا کنید
        تا جداول، سیاست‌های امنیتی (RLS) و ایندکس‌ها ساخته شوند.
      </p>
    </div>
  `;
}

/* ---------- Global error handlers ------------------------------------ */
window.addEventListener("error", (e) => {
  console.error("[global] error", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[global] unhandled rejection", e.reason);
});

/* ---------- Go ------------------------------------------------------- */
main().catch((err) => {
  console.error("[app] fatal", err);
  const authScreen = document.getElementById("auth-screen");
  if (authScreen) {
    authScreen.hidden = false;
    authScreen.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-brand__logo" style="background:var(--gradient-danger)">✕</div>
          <div class="auth-brand__title">خطای راه‌اندازی</div>
          <div class="auth-brand__sub">${escapeHtml(err?.message || "خطای نامشخص")}</div>
        </div>
      </div>
    `;
  }
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[c]));
}