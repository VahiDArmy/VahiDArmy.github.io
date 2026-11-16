/* ============================================================
   Entry point
   ============================================================ */
import { bootApp } from './app.js';

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
