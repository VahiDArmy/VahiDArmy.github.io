/**
 * Application entry point.
 *
 * Responsibilities:
 *  1. Install global error handlers FIRST so any crash is visible.
 *  2. Init theme.
 *  3. Init auth — subscribes to auth changes.
 *  4. If signed in → bootstrap data, mount shell, start router.
 *  5. If signed out → show auth screen.
 *  6. If anything fails hard, show a boot-error card instead of a blank page.
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

/* =====================================================================
   1. Global error surfaces — installed before anything else runs so
      even the earliest failures are visible instead of a blank page.
   ===================================================================== */

let bootFinished = false;

function showBootError(err, extra = "") {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (appShell) appShell.hidden = true;
  if (!authScreen) return;
  authScreen.hidden = false;
  authScreen.innerHTML = `
    <div class="auth-card anim-fade-in-up" style="max-width:620px">
      <div class="auth-brand">
        <div class="auth-brand__logo" style="background:var(--gradient-danger)">✕</div>
        <div class="auth-brand__title">خطا در راه‌اندازی برنامه</div>
        <div class="auth-brand__sub">اطلاعات زیر به شناسایی مشکل کمک می‌کند</div>
      </div>
      <div class="auth-message is-error" style="display:block;margin-bottom:14px;white-space:pre-wrap;word-break:break-word">${escapeHtml(err?.message || String(err || "خطای نامشخص"))}</div>
      ${extra ? `<div class="text-xs text-muted" style="margin-bottom:12px;line-height:1.8">${extra}</div>` : ""}
      <div class="text-xs text-muted" style="line-height:1.9;margin-bottom:14px">
        بررسی کنید:
        <br>• فایل <code>supabase-config.js</code> در ریشه پروژه وجود دارد و در <code>index.html</code> قبل از <code>app.js</code> بارگذاری شده است.
        <br>• آدرس Supabase و کلید قابل انتشار صحیح هستند.
        <br>• فایل <code>supabase-schema.sql</code> در SQL Editor اجرا شده است.
        <br>• صفحه از طریق HTTP (نه <code>file://</code>) باز شده است.
      </div>
      <button class="btn btn--secondary btn--block" onclick="location.reload()">تلاش مجدد</button>
    </div>
  `;
}

window.addEventListener("error", (e) => {
  if (bootFinished) return;
  showBootError(e.error || e.message || new Error("خطای بارگذاری"));
});
window.addEventListener("unhandledrejection", (e) => {
  if (bootFinished) return;
  showBootError(e.reason || new Error("خطای بارگذاری نامشخص"));
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[c]));
}

/* =====================================================================
   2. Boot sequence
   ===================================================================== */

async function main() {
  // Theme FIRST — no flash, no dependency on remote resources
  theme.init();

  // Footer year
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Top progress bar
  mountTopProgress();

  // If Supabase is missing entirely, show setup instructions
  if (!isConfigured) {
    showSetupWarning();
    bootFinished = true;
    return;
  }

  // If the client failed to construct (bad key / bad URL / network),
  // surface it visibly instead of a blank page
  if (!clientReady) {
    showBootError(
      new Error(clientErrorMessage || "اتصال به Supabase برقرار نشد"),
      "بررسی کنید که آدرس و کلید به‌درستی در <code>supabase-config.js</code> وارد شده‌اند."
    );
    bootFinished = true;
    return;
  }

  // Subscribe to auth changes BEFORE calling auth.init() so we never
  // miss an event.
  bus.on("auth:changed", onAuthChanged);

  // Init auth with a hard timeout so we never hang on a bad network.
  let session = null;
  try {
    session = await withTimeout(auth.init(), 8000, "AUTH_INIT_TIMEOUT");
  } catch (err) {
    console.error("[app] auth.init failed", err);
    if (err?.message === "AUTH_INIT_TIMEOUT") {
      toast.warning("اتصال کند است — لطفاً وضعیت خود را بررسی کنید");
    }
    // Fall through — show auth screen so the user isn't stuck
    session = null;
  }

  if (!session) {
    showAuth();
  }
  // If session exists, onAuthChanged has already fired and mounted the shell.

  // Close mobile sidebar on route change
  bus.on("route:changed", () => {
    if (window.innerWidth <= 980) closeMobile();
  });

  // Online / offline warnings
  bus.on("state:online", (online) => {
    if (online) toast.success("اتصال بازگشت", { duration: 2000 });
    else toast.warning("اتصال اینترنت قطع شد", { duration: 3000 });
  });

  // Auto-wire any declarative tooltips
  tooltip.initAll();

  bootFinished = true;
}

/* =====================================================================
   3. Auth transitions
   ===================================================================== */

let shellMounted = false;
let shellCleanup = null;

async function onAuthChanged({ user }) {
  if (user) {
    if (!shellMounted) await showApp();
  } else {
    if (shellMounted) unmountApp();
    showAuth();
  }
}

function showAuth() {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  mountAuth();
}

/* =====================================================================
   4. App shell
   ===================================================================== */

async function showApp() {
  unmountAuth();

  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");
  if (authScreen) authScreen.hidden = true;
  if (appShell) appShell.hidden = false;

  try {
    await withTimeout(bootstrap(), 15000, "BOOTSTRAP_TIMEOUT").catch((err) => {
      console.warn("[app] bootstrap warning", err);
    });
  } catch (err) {
    console.error("[app] bootstrap failed", err);
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

/* =====================================================================
   5. Top progress bar
   ===================================================================== */

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

/* =====================================================================
   6. Setup warning (Supabase not configured)
   ===================================================================== */

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
        فایل <code>supabase-config.js</code> را در ریشه پروژه بسازید و مقادیر واقعی را وارد کنید:
      </p>
      <pre style="background:rgba(0,0,0,0.35);padding:14px;border-radius:10px;font-size:12px;overflow-x:auto;direction:ltr;text-align:left;border:1px solid var(--color-border-2)">window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "sb_publishable_..."
};</pre>
    </div>
  `;
}

/* =====================================================================
   7. Go
   ===================================================================== */

main().catch((err) => {
  console.error("[app] fatal", err);
  showBootError(err);
  bootFinished = true;
});