import { initStore, setState, getState } from "./store.js";
import {
  getSession,
  onAuthStateChange,
  ensureProfile,
} from "./api.js";
import {
  registerRoutes,
  setRenderer,
  setNotFound,
  startRouter,
  navigate,
  getCurrentRoute,
} from "./router.js";
import { renderShell, initShell } from "./shell.js";
import { buildQuery } from "./utils.js";
import { icon } from "./icons.js";
import { toast } from "./ui.js";

import { renderLanding } from "./views/landing.js";
import { renderExplore } from "./views/explore.js";
import { renderTheory } from "./views/theory.js";
import { renderEditor } from "./views/editor.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderProfile } from "./views/profile.js";
import { renderSettings } from "./views/settings.js";
import { renderAuth } from "./views/auth.js";
import { renderNotFound } from "./views/notfound.js";

function requireAuth(ctx) {
  if (getState().user) return null;
  const next = `${ctx.path}${buildQuery(ctx.query)}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function isProtectedPath(path) {
  return (
    path === "/dashboard" ||
    path === "/new" ||
    path === "/settings" ||
    path === "/profile" ||
    path.startsWith("/edit/")
  );
}

const routes = [
  {
    path: "/",
    layout: "public",
    title: "خانه",
    view: renderLanding,
  },
  {
    path: "/explore",
    layout: "public",
    title: "کاوش",
    view: renderExplore,
  },
  {
    path: "/theory/:slug",
    layout: "public",
    title: "نظریه",
    view: renderTheory,
  },
  {
    path: "/login",
    layout: "auth",
    title: "ورود",
    view: renderAuth,
  },
  {
    path: "/new",
    layout: "app",
    title: "نظریهٔ تازه",
    before: requireAuth,
    view: renderEditor,
  },
  {
    path: "/edit/:slug",
    layout: "app",
    title: "ویرایش نظریه",
    before: requireAuth,
    view: renderEditor,
  },
  {
    path: "/dashboard",
    layout: "app",
    title: "داشبورد",
    before: requireAuth,
    view: renderDashboard,
  },
  {
    path: "/profile",
    layout: "app",
    title: "پروفایل",
    before: requireAuth,
    view: renderProfile,
  },
  {
    path: "/profile/:username",
    layout: "app",
    title: "پروفایل",
    view: renderProfile,
  },
  {
    path: "/settings",
    layout: "app",
    title: "تنظیمات",
    before: requireAuth,
    view: renderSettings,
  },
];

function showFatal(error) {
  console.error("fatal boot error", error);
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="notfound">
      <div>
        <div class="notfound__code">!</div>
        <h1 class="notfound__title">برنامه بالا نیامد</h1>
        <p class="notfound__text">${String(error?.message || "خطای نامشخص")}</p>
        <div class="notfound__actions">
          <button class="btn btn--primary" type="button" onclick="location.reload()">${icon("refresh", 16)} تلاش دوباره</button>
          <a class="btn btn--outline" href="#/">${icon("home", 16)} خانه</a>
        </div>
      </div>
    </div>
  `;
}

function wireAuthEvents() {
  onAuthStateChange((event, session) => {
    if (!session?.user) {
      setState({ user: null, profile: null, session: null, authReady: true });
      const current = getCurrentRoute();
      if (current && isProtectedPath(current.ctx.path)) {
        navigate(`/login?next=${encodeURIComponent(current.ctx.path)}`, { replace: true });
      }
      return;
    }

    setState({ user: session.user, session, authReady: true });

    ensureProfile(session.user)
      .then((profile) => {
        setState({ profile, authReady: true });
      })
      .catch((error) => {
        console.warn("profile sync failed", error);
        setState({ authReady: true });
      });

    const current = getCurrentRoute();
    if (event === "PASSWORD_RECOVERY") {
      navigate("/settings?tab=security", { replace: true });
      toast({ type: "info", title: "رمز تازه را تعیین کن" });
      return;
    }

    if (event === "SIGNED_IN" && current?.ctx.path === "/login" && !current.ctx.query.mode) {
      navigate("/dashboard", { replace: true });
    }
  });
}

async function initializeAuth() {
  try {
    const { session } = await getSession();
    if (session?.user) {
      const profile = await ensureProfile(session.user).catch(() => null);
      setState({
        user: session.user,
        profile,
        session,
        authReady: true,
      });
    } else {
      setState({ authReady: true });
    }
  } catch (error) {
    console.warn("session restore failed", error);
    setState({ authReady: true });
  }
}

async function boot() {
  initStore();
  initShell();
  wireAuthEvents();
  await initializeAuth();

  registerRoutes(routes);
  setRenderer(renderShell);
  setNotFound(renderNotFound);
  startRouter();
}

boot().catch(showFatal);
