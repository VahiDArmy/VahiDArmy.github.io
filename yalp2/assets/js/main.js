/* ============================================================
   Entry point
   ============================================================ */
import { bootApp } from './app.js';
import { initTheme } from './components/theme.js';

// Theme must be applied before any rendering to avoid flash
initTheme();

// Register Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // مسیر SW هم باید نسبی باشد
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[SW] registered', reg.scope))
      .catch((err) => console.warn('[SW] registration failed', err));
  });
}

bootApp().catch((err) => {
  console.error('[boot]', err);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:grid;place-content:center;text-align:center;padding:24px;gap:12px">
        <div style="font-size:32px">⚠️</div>
        <div style="font-size:18px;font-weight:700">خطا در راه‌اندازی</div>
        <div style="color:rgba(243,244,255,.7);font-size:13px;max-width:520px">
          ${String(err?.message || err)}
        </div>
        <button onclick="location.reload()" style="
          background:linear-gradient(135deg,#8b5cf6,#6366f1,#22d3ee);
          color:white;border:0;border-radius:12px;padding:10px 20px;
          font-family:inherit;font-weight:600;cursor:pointer
        ">تلاش مجدد</button>
      </div>`;
  }
});
