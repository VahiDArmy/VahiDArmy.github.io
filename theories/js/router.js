import { parseHash, buildQuery, scrollToTop } from "./utils.js";

const routes = [];
let renderer = null;
let notFoundHandler = null;
let current = null;

export function registerRoutes(list = []) {
  routes.length = 0;
  routes.push(...list);
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

export function setRenderer(fn) {
  renderer = fn;
}

export function getCurrentRoute() {
  return current;
}

export function navigate(path, { replace = false, scroll = true } = {}) {
  const target = path.startsWith("#") ? path.slice(1) : path;
  const hash = `#${target.startsWith("/") ? target : `/${target}`}`;
  if (location.hash === hash) {
    resolveRoute({ scroll });
    return;
  }
  if (replace) {
    history.replaceState(null, "", hash);
    resolveRoute({ scroll });
  } else {
    location.hash = hash;
  }
}

export function replaceQuery(query) {
  const parsed = parseHash();
  const path = parsed.path === "/" ? "/" : parsed.path;
  navigate(`${path}${buildQuery(query)}`, { replace: true });
}

export function buildPath(base, query = {}) {
  return `${base}${buildQuery(query)}`;
}

function matchPath(pattern, segments) {
  const parts = pattern.split("/").filter(Boolean);
  if (pattern === "/" && segments.length === 0) return {};
  if (parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const segment = segments[i];
    if (part.startsWith(":")) {
      params[part.slice(1)] = decodeURIComponent(segment);
    } else if (part !== segment) {
      return null;
    }
  }
  return params;
}

function findRoute(path) {
  const cleanPath = path === "" ? "/" : path;
  const segments = cleanPath.split("/").filter(Boolean);
  for (const route of routes) {
    const params = matchPath(route.path, segments);
    if (params) return { route, params };
  }
  return null;
}

export function resolveRoute({ scroll = true } = {}) {
  if (!renderer) return;
  const parsed = parseHash();
  const found = findRoute(parsed.path);
  const ctx = {
    path: parsed.path,
    segments: parsed.segments,
    query: parsed.query,
    params: found?.params || {},
  };

  if (!found) {
    if (notFoundHandler) {
      current = { route: { path: "*", layout: "public", title: "صفحه پیدا نشد" }, ctx };
      const view = notFoundHandler(ctx);
      renderer({ route: current.route, ctx, view });
      if (scroll) scrollToTop("instant");
    }
    return;
  }

  const { route } = found;
  current = { route, ctx };

  Promise.resolve()
    .then(async () => {
      if (route.before) {
        const redirect = await route.before(ctx);
        if (redirect) {
          navigate(redirect, { replace: true, scroll: false });
          return null;
        }
      }
      return route.view(ctx);
    })
    .then((view) => {
      if (!view) return;
      renderer({ route, ctx, view });
      if (scroll) scrollToTop("instant");
      document.title = `${view.title || route.title || "نظریه"} | نظریه`;
    })
    .catch((error) => {
      console.error("route error", error);
      const view = {
        title: "خطا",
        layout: route.layout || "public",
        html: `
          <div class="container page">
            <div class="empty">
              <div class="empty__icon">${""}</div>
              <h1 class="empty__title">چیزی درست پیش نرفت</h1>
              <p class="empty__text">${String(error?.message || "خطای نامشخص")}</p>
              <div class="empty__actions">
                <button class="btn btn--primary" onclick="location.reload()">تلاش دوباره</button>
                <a class="btn btn--outline" href="#/">بازگشت به خانه</a>
              </div>
            </div>
          </div>
        `,
      };
      renderer({ route, ctx, view });
    });
}

export function startRouter() {
  window.addEventListener("hashchange", () => resolveRoute({ scroll: true }));
  resolveRoute({ scroll: false });
}

export function refreshRoute() {
  resolveRoute({ scroll: false });
}

export { parseHash, buildQuery };
