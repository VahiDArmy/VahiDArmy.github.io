/* ============================================================================
   THEME SWITCHER
   ============================================================================ */

(function (window) {
  "use strict";

  const Storage = window.Storage;

  const ThemeSwitcher = {
    init() {
      const saved = Storage.getTheme() || "dark";
      this.apply(saved, false);
    },

    apply(theme, persist = true) {
      document.documentElement.setAttribute("data-theme", theme);
      if (persist) Storage.setTheme(theme);

      // Update toggle icon
      const btn = document.getElementById("theme-toggle");
      if (btn) {
        const icon = btn.querySelector("i");
        if (icon) {
          icon.className = theme === "dark" ? "ri-moon-line" : "ri-sun-line";
        }
      }

      // Update meta theme color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme === "dark" ? "#0a0d14" : "#f4f6fb";

      // Refresh charts
      setTimeout(() => {
        if (window.Charts) window.Charts.refreshTheme();
      }, 50);
    },

    toggle() {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      this.apply(next);
      window.Toast?.info(
        next === "dark" ? "حالت تیره فعال شد" : "حالت روشن فعال شد",
        "ظاهر",
        { duration: 1800 }
      );
    },

    setDensity(density) {
      if (density === "compact" || density === "comfortable") {
        document.documentElement.setAttribute("data-density", density);
        Storage.set("density", density);
      }
    },

    setContrast(high) {
      if (high) document.documentElement.setAttribute("data-contrast", "high");
      else document.documentElement.removeAttribute("data-contrast");
      Storage.set("contrast", high ? "high" : "normal");
    },
  };

  window.ThemeSwitcher = ThemeSwitcher;
})(window);