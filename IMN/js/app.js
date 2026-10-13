/**
 * Application entry point.
 *
 * Layout: full-width page with a topbar and a day-swiper strip.
 * No sidebar.
 */

import { theme } from "./config/theme.js";
import { isConfigured, clientReady, clientErrorMessage } from "./config/supabase.js";
import { store } from "./core/state.js";
import { bus } from "./core/event-bus.js";
import { auth } from "./services/auth.service.js";
import { bootstrap } from "./bootstrap.js";
import { initRouter, navigate } from "./router.js";
import { mountHeader, updateHeaderForRoute } from "./components/header.js";
import { mountDaySwiper } from "./components/day-swiper.js";
import { tooltip } from "./components/tooltip.js";
import { toast } from "./components/toast.js";
import { mountAuth, unmountAuth } from "./pages/auth.page.js";
import { STORAGE_KEYS, ROUTES } from "./config/constants.js";
import { storage } from "./core/storage.js";
import { withTimeout } from "./utils/async.js";
import { todayISO, addDays } from "./utils/date.js";

/* ---------- Boot progress helpers (inline HTML) ---------- */
function bootProgress(msg) { try { window.__appBootProgress?.(msg); } catch {} }
function bootDone() { try { window.__appBooted?.(); } catch {} }
function bootFail(err, hint) {
  try {
    if (hint) {
      const status = document.getElementById("boot-status");
      if (status) status.dataset.hint = hint;
    }
    window.__appBootError?.(err);
  } catch {}
}

/* ---------- Routes that show the day swiper ---------- */
const SWIPER_ROUTES = new Set([
  ROUTES.DASHBOARD,
  ROUTES.FOOD,
  ROUTES.HEALTH,
  ROUTES.SLEEP,
  ROUTES.ACTIVITY,
]);

/* ---------- Main boot ---------- */
async function main() {
  bootProgress("آماده‌سازی رابط کاربری…");
  theme.init();

  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  mountTopProgress();

  if (!isConfigured) {
    bootFail(new Error("Supabase پیکربندی نشده است"));
    return;
  }
  if (!clientReady) {
    bootFail(new Error(clientErrorMessage || "اتصال به Supabase برقرار نشد"));
    return;
  }

  bus.on("auth:changed", onAuthChanged);

  bootProgress("بررسی نشست کاربر…");
  let session = null;
  try {
    session = await withTimeout(auth.init(), 8000, "AUTH_INIT_TIMEOUT");
  } catch (err) {
    console.error("[app] auth.init failed", err);
    session = null;
  }

  if (!session) {
    bootProgress("نمایش صفحه ورود…");
    showAuth();
  }

  bus.on("state:online", (online) => {
    if (online) toast.success("اتصال بازگشت", { duration: 2000 });
    else toast.warning("اتصال اینترنت قطع شد", { duration: 3000 });
  });

  tooltip.initAll();
  bootDone();
}

/* ---------- Auth transitions ---------- */
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

/* ---------- App shell ---------- */
let daySwiperRef = null;
const shellUnsubscribers = [];

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

  // Mount topbar
  const headerCleanup = mountHeader();

  // Mount day swiper
  const swiperSlot = document.getElementById("day-swiper-slot");
  if (swiperSlot) {
    daySwiperRef = mountDaySwiper(swiperSlot, {
      date: store.get("selectedDate") || todayISO(),
      onChange: (iso) => {
        store.setSelectedDate(iso);
        bus.emit("date:changed", iso);
      },
    });
  }

  // Router
  const container = document.getElementById("page-container");
  initRouter(container);

  // Route → update header subject button + swiper visibility
  shellUnsubscribers.push(
    bus.on("route:changed", ({ route }) => {
      updateHeaderForRoute(route);
      const showSwiper = SWIPER_ROUTES.has(route);
      if (swiperSlot) swiperSlot.style.display = showSwiper ? "" : "none";
    })
  );

  // Date changes (from anywhere) → update the swiper selection
  shellUnsubscribers.push(
    bus.on("state:selectedDate", (iso) => {
      daySwiperRef?.setDate(iso);
    })
  );

  const last = storage.get(STORAGE_KEYS.LAST_PAGE);
  const validRoute = Object.values(ROUTES).includes(last) ? last : ROUTES.DASHBOARD;
  if (!window.location.hash) {
    navigate(validRoute, {}, { replace: true });
  }

  shellMounted = true;
  shellCleanup = () => {
    headerCleanup?.();
    daySwiperRef?.destroy?.();
    daySwiperRef = null;
    shellUnsubscribers.forEach((off) => off());
    shellUnsubscribers.length = 0;
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

/* ---------- Top progress bar ---------- */
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

/* ---------- Go ---------- */
main().catch((err) => {
  console.error("[app] fatal", err);
  bootFail(err);
});