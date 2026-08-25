// مدیریت تم روشن/تیره — پیش‌فرض: دارک نئون
(function () {
  const STORAGE_KEY = 'raisemind-theme';
  const root = document.documentElement;

  function applyTheme(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStoredTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  // اعمال فوری قبل از رندر برای جلوگیری از فلش تم
  const stored = getStoredTheme();
  applyTheme(stored === 'light' ? 'light' : 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(getStoredTheme() === 'light' ? 'light' : 'dark');
    btn.addEventListener('click', function () {
      const isLight = root.getAttribute('data-theme') === 'light';
      const next = isLight ? 'dark' : 'light';
      applyTheme(next);
      setStoredTheme(next);
    });
  });
})();
