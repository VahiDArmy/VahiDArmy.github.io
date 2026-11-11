import { icon } from "./icons.js";
import { getState, setState, setTheme, setMobileMenu } from "./store.js";
import { navigate } from "./router.js";
import { signOut } from "./api.js";
import { avatar } from "./components.js";
import { escapeHtml } from "./utils.js";
import {
  initDropdowns,
  initCopyButtons,
  initScrollTop,
  closeDropdowns,
  toast,
} from "./ui.js";
import { initCommandPalette } from "./command.js";

let initialized = false;
let cleanups = [];

const SHELL_STYLE_ID = "shell-runtime-styles";

function injectShellStyles() {
  if (document.getElementById(SHELL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHELL_STYLE_ID;
  style.textContent = `
    @media (max-width: 760px) {
      .public-nav { display: none !important; }
      .topbar__breadcrumb { display: none; }
      .topbar__search {
        flex: 0 0 auto !important;
        width: 2.7rem;
        padding: 0 !important;
        justify-content: center;
      }
      .topbar__search .search-label,
      .topbar__search .kbd-row { display: none; }
      .public-header__inner { height: 4.25rem; }
    }
    @media (max-width: 520px) {
      .topbar__actions .btn--primary .btn-label { display: none; }
      .topbar__actions .btn--primary { width: 2.7rem; padding: 0; }
    }
  `;
  document.head.append(style);
}

function runCleanup() {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.warn("cleanup failed", error);
    }
  });
  cleanups = [];
}

function isActive(path, item) {
  if (item.match) return item.match(path);
  if (item.exact) return path === item.path;
  return path === item.path || path.startsWith(`${item.path}/`);
}

function navLink(item, path) {
  const active = isActive(path, item);
  return `
    <a class="nav__link ${active ? "is-active" : ""}" href="${item.href}">
      <span class="nav__icon">${icon(item.icon, 18)}</span>
      <span class="nav__label">${escapeHtml(item.label)}</span>
      ${item.badge ? `<span class="nav__badge">${escapeHtml(item.badge)}</span>` : ""}
    </a>
  `;
}

function brand({ compact = false } = {}) {
  return `
    <a class="brand" href="#/" aria-label="نظریه — خانه">
      <span class="brand__mark"><span class="brand__star"></span></span>
      ${compact
        ? ""
        : `<span class="brand__text">
            <span class="brand__title">نظریه</span>
            <span class="brand__tag">THEORY STUDIO</span>
          </span>`}
    </a>
  `;
}

function themeToggle() {
  const state = getState();
  return `
    <button class="icon-btn" type="button" data-theme-toggle aria-label="تغییر ظاهر" data-tooltip="ظاهر">
      ${icon(state.theme === "dark" ? "sun" : "moon", 18)}
    </button>
  `;
}

function commandButton({ compact = false } = {}) {
  if (compact) {
    return `<button class="icon-btn" type="button" data-command-open aria-label="جست‌وجو" data-tooltip="جست‌وجو">${icon("search", 18)}</button>`;
  }
  return `
    <button class="btn btn--ghost topbar__search" type="button" data-command-open style="justify-content:flex-start;color:var(--text-muted)">
      ${icon("search", 16)}
      <span class="search-label" style="flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis">جست‌وجو در نظریه‌ها…</span>
      <span class="kbd-row"><kbd>⌘</kbd><kbd>K</kbd></span>
    </button>
  `;
}

function userDropdown(state, { compact = false } = {}) {
  const profile = state.profile || {};
  const name = profile.full_name || profile.username || state.user?.email?.split("@")[0] || "کاربر";
  const username = profile.username || "";
  return `
    <div class="dropdown">
      <button class="user-mini" type="button" data-dropdown-toggle aria-expanded="false" aria-label="منوی حساب" style="${compact ? "width:auto;padding:.2rem" : "width:100%"}">
        ${avatar(profile, "sm")}
        ${compact
          ? ""
          : `<span class="user-mini__copy">
              <span class="user-mini__name">${escapeHtml(name)}</span>
              <span class="user-mini__meta">${username ? `@${escapeHtml(username)}` : "حساب من"}</span>
            </span>`}
        ${icon("chevron-down", 14)}
      </button>
      <div class="dropdown__menu dropdown__menu--end">
        <div class="dropdown__label">${escapeHtml(name)}</div>
        <a class="dropdown__item" href="#/profile/${encodeURIComponent(username)}">${icon("user", 15)} پروفایل من</a>
        <a class="dropdown__item" href="#/dashboard">${icon("dashboard", 15)} داشبورد</a>
        <a class="dropdown__item" href="#/new">${icon("plus", 15)} نظریهٔ تازه</a>
        <a class="dropdown__item" href="#/settings">${icon("settings", 15)} تنظیمات</a>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item is-danger" type="button" data-shell-signout>${icon("logout", 15)} خروج از حساب</button>
      </div>
    </div>
  `;
}

function sidebarNav(state, path) {
  const user = state.user;
  const mainItems = [
    { href: "#/", path: "/", label: "خانه", icon: "home", exact: true },
    { href: "#/explore", path: "/explore", label: "کاوش", icon: "compass" },
  ];
  const spaceItems = [
    { href: "#/dashboard", path: "/dashboard", label: "داشبورد", icon: "dashboard", auth: true },
    { href: "#/new", path: "/new", label: "نظریهٔ تازه", icon: "plus", auth: true, match: (value) => value === "/new" || value.startsWith("/edit/") },
  ];
  const accountItems = [
    { href: "#/profile", path: "/profile", label: "پروفایل", icon: "user", auth: true, match: (value) => value === "/profile" || value.startsWith("/profile/") },
    { href: "#/settings", path: "/settings", label: "تنظیمات", icon: "settings", auth: true },
  ];

  const renderGroup = (label, items) => {
    const filtered = items.filter((item) => !item.auth || user);
    if (!filtered.length) return "";
    return `
      <div class="nav-group">
        <div class="nav-group__label">${escapeHtml(label)}</div>
        <nav class="nav">${filtered.map((item) => navLink(item, path)).join("")}</nav>
      </div>
    `;
  };

  return `
    ${renderGroup("فضای نظریه", mainItems)}
    ${user ? renderGroup("فضای من", spaceItems) : ""}
    ${user ? renderGroup("حساب", accountItems) : ""}
  `;
}

function sidebarFooter(state) {
  if (!state.user) {
    return `
      <div class="sidebar-card">
        <div class="sidebar-card__title">به نظریه خوش آمدی</div>
        <p class="sidebar-card__text">وارد شو تا نظریه بسازی، ذخیره کنی و منتشر کنی.</p>
        <a class="btn btn--primary btn--sm btn--block" href="#/login">${icon("login", 14)} ورود</a>
      </div>
    `;
  }
  return userDropdown(state);
}

function sidebar(state, path) {
  return `
    <aside class="sidebar">
      <div class="sidebar__top">
        ${brand()}
        <button class="icon-btn mobile-menu-btn" type="button" data-mobile-close aria-label="بستن منو">${icon("x", 18)}</button>
      </div>
      <div class="sidebar__body">
        ${sidebarNav(state, path)}
      </div>
      <div class="sidebar__footer">
        ${sidebarFooter(state)}
      </div>
    </aside>
  `;
}

function topbar(state, view, route, ctx) {
  const title = view.title || route.title || "نظریه";
  return `
    <header class="topbar">
      <button class="icon-btn mobile-menu-btn" type="button" data-mobile-menu aria-label="باز کردن منو">${icon("menu", 20)}</button>
      <div class="topbar__breadcrumb">
        <a href="#/">خانه</a>
        <span class="sep">/</span>
        <span class="current">${escapeHtml(title)}</span>
      </div>
      <div class="topbar__spacer"></div>
      ${commandButton()}
      <div class="topbar__actions">
        ${themeToggle()}
        ${state.user
          ? `<a class="btn btn--primary btn--sm" href="#/new">${icon("plus", 15)}<span class="btn-label"> نظریهٔ تازه</span></a>`
          : `<a class="btn btn--outline btn--sm" href="#/login">${icon("login", 14)} ورود</a>`}
        ${state.user ? userDropdown(state, { compact: true }) : ""}
      </div>
    </header>
  `;
}

function publicNav(path) {
  const items = [
    { href: "#/", path: "/", label: "خانه", exact: true },
    { href: "#/explore", path: "/explore", label: "کاوش" },
  ];
  return `
    <nav class="public-nav" aria-label="ناوبری اصلی">
      ${items
        .map(
          (item) =>
            `<a class="public-nav__link ${isActive(path, item) ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>`
        )
        .join("")}
    </nav>
  `;
}

function publicHeader(state, path) {
  return `
    <header class="public-header" data-public-header>
      <div class="container public-header__inner">
        ${brand()}
        ${publicNav(path)}
        <div class="public-header__actions">
          ${commandButton({ compact: true })}
          ${themeToggle()}
          ${state.user
            ? `<a class="btn btn--primary btn--sm" href="#/new">${icon("plus", 14)}<span class="btn-label"> نظریهٔ تازه</span></a>
               ${userDropdown(state, { compact: true })}`
            : `<a class="btn btn--ghost btn--sm" href="#/login">${icon("login", 14)} ورود</a>
               <a class="btn btn--primary btn--sm" href="#/login?mode=register">${icon("sparkles", 14)}<span class="btn-label"> شروع</span></a>`}
        </div>
      </div>
    </header>
  `;
}

function publicFooter() {
  return `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <div>
          ${brand()}
          <p class="site-footer__copy" style="margin-top:.75rem">نظریه — فضایی برای ثبت، پرورش و روایت ایده‌ها.</p>
        </div>
        <div class="site-footer__links">
          <a href="#/">خانه</a>
          <a href="#/explore">کاوش</a>
          <a href="#/login?mode=register">ساخت حساب</a>
        </div>
        <p class="site-footer__copy">ساخته‌شده برای ایده‌هایی که هنوز کامل نیستند.</p>
      </div>
    </footer>
  `;
}

function appLayout({ view, route, ctx, state }) {
  return `
    <div class="app-shell" data-app-shell>
      ${sidebar(state, ctx.path)}
      <div class="main">
        ${topbar(state, view, route, ctx)}
        <main class="content" data-view-content>${view.html}</main>
      </div>
    </div>
  `;
}

function publicLayout({ view, route, ctx, state }) {
  return `
    ${publicHeader(state, ctx.path)}
    <main class="content" data-view-content>${view.html}</main>
    ${publicFooter()}
  `;
}

function updatePublicHeader() {
  document.querySelectorAll("[data-public-header]").forEach((header) => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  });
}

function updateOnlineBanner() {
  const state = getState();
  let banner = document.querySelector("[data-offline-banner]");
  if (!state.online) {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "offline-banner";
      banner.dataset.offlineBanner = "";
      banner.innerHTML = `${icon("alert", 14)} اتصال اینترنت قطع است. تغییرات ممکن است ذخیره نشوند.`;
      document.body.append(banner);
    }
  } else {
    banner?.remove();
  }
}

function openMobileMenu() {
  const shell = document.querySelector("[data-app-shell]");
  if (!shell) return;
  shell.classList.add("is-mobile-open");
  setMobileMenu(true);
  if (!document.querySelector("[data-mobile-backdrop]")) {
    const backdrop = document.createElement("div");
    backdrop.className = "mobile-drawer-backdrop";
    backdrop.dataset.mobileBackdrop = "";
    document.body.append(backdrop);
  }
}

function closeMobileMenu() {
  document.querySelector("[data-app-shell]")?.classList.remove("is-mobile-open");
  document.querySelector("[data-mobile-backdrop]")?.remove();
  setMobileMenu(false);
}

function updateThemeButtons() {
  const state = getState();
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.innerHTML = icon(state.theme === "dark" ? "sun" : "moon", 18);
  });
}

export function renderShell({ route, ctx, view }) {
  if (!view || view.skip) return;
  runCleanup();
  closeMobileMenu();
  closeDropdowns();

  const state = getState();
  const appRoot = document.getElementById("app");
  if (!appRoot) return;

  const layout = view.layout || route.layout || "public";
  let html = "";

  if (layout === "auth") {
    html = view.html;
  } else if (layout === "app") {
    html = appLayout({ view, route, ctx, state });
  } else {
    html = publicLayout({ view, route, ctx, state });
  }

  appRoot.innerHTML = html;

  const content = appRoot.querySelector("[data-view-content]") || appRoot;
  if (typeof view.mount === "function") {
    try {
      const result = view.mount(content);
      if (typeof result === "function") cleanups.push(result);
      if (result && typeof result.then === "function") {
        result.catch((error) => console.error("mount failed", error));
      }
    } catch (error) {
      console.error("mount failed", error);
    }
  }

  requestAnimationFrame(() => {
    updatePublicHeader();
    updateOnlineBanner();
    updateThemeButtons();
  });
}

export function initShell() {
  if (initialized) return;
  initialized = true;

  injectShellStyles();
  initDropdowns();
  initCopyButtons();
  initScrollTop();
  initCommandPalette();

  window.addEventListener(
    "scroll",
    () => {
      updatePublicHeader();
    },
    { passive: true }
  );

  window.addEventListener("online", updateOnlineBanner);
  window.addEventListener("offline", updateOnlineBanner);

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-mobile-menu]")) {
      event.preventDefault();
      openMobileMenu();
      return;
    }

    if (event.target.closest("[data-mobile-close]") || event.target.closest("[data-mobile-backdrop]")) {
      event.preventDefault();
      closeMobileMenu();
      return;
    }

    if (event.target.closest("[data-theme-toggle]")) {
      event.preventDefault();
      const current = getState().theme;
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
      updateThemeButtons();
      toast({
        type: "info",
        title: next === "dark" ? "حالت تاریک" : "حالت روشن",
        duration: 1500,
      });
      return;
    }

    const signoutButton = event.target.closest("[data-shell-signout]");
    if (signoutButton) {
      event.preventDefault();
      try {
        await signOut();
        setState({ user: null, profile: null, session: null, authReady: true });
        closeDropdowns();
        closeMobileMenu();
        navigate("/");
        toast({ type: "info", title: "از حساب خارج شدی" });
      } catch (error) {
        toast({ type: "error", title: "خروج انجام نشد", message: error.message });
      }
      return;
    }

    if (window.innerWidth <= 1024 && event.target.closest(".sidebar a")) {
      closeMobileMenu();
    }
  });

  updateOnlineBanner();
}
