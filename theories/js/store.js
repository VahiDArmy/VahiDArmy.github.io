const STORAGE_KEYS = {
  theme: "nazariyeh-theme",
  sidebar: "nazariyeh-sidebar",
};

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

function getStoredSidebar() {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebar) === "collapsed";
  } catch {
    return false;
  }
}

const listeners = new Set();

const state = {
  user: null,
  profile: null,
  session: null,
  authReady: false,
  theme: getStoredTheme(),
  sidebarCollapsed: getStoredSidebar(),
  mobileMenuOpen: false,
  commandOpen: false,
  online: navigator.onLine,
  unreadCount: 0,
};

export function getState() {
  return state;
}

export function setState(patch, options = {}) {
  const previous = { ...state };
  Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  if (options.persistTheme) persistTheme(state.theme);
  if (options.persistSidebar) persistSidebar(state.sidebarCollapsed);
  if (options.silent) return;
  listeners.forEach((listener) => listener(state, previous));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyTheme(theme = state.theme) {
  let resolved = theme;
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolved === "light" ? "#f7f5ff" : "#080812"
  );
}

export function setTheme(theme) {
  setState({ theme }, { persistTheme: true });
  applyTheme(theme);
}

function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    // ignore
  }
}

export function toggleSidebar() {
  setState({ sidebarCollapsed: !state.sidebarCollapsed }, { persistSidebar: true });
}

export function setSidebarCollapsed(collapsed) {
  setState({ sidebarCollapsed: Boolean(collapsed) }, { persistSidebar: true });
}

function persistSidebar(collapsed) {
  try {
    localStorage.setItem(STORAGE_KEYS.sidebar, collapsed ? "collapsed" : "expanded");
  } catch {
    // ignore
  }
}

export function setMobileMenu(open) {
  setState({ mobileMenuOpen: Boolean(open) });
}

export function setOnline(online) {
  setState({ online: Boolean(online) });
}

export function initStore() {
  applyTheme(state.theme);
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (state.theme === "system") applyTheme("system");
  });
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
}
