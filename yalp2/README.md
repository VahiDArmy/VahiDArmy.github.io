# سوپرمارکت‌یار

دفترچهٔ خرید و امتیاز فروشگاه‌های آنلاین — SPA با Supabase

## راه‌اندازی

1. **Supabase SQL** — به ترتیب این دو فایل را در SQL Editor پروژه اجرا کن:
   - `/assets/sql/schema.sql` (جداول اصلی `sm_*` + RLS + trigger)
   - `/assets/sql/schema-2.sql` (جدول `sm_shares` + RPC عمومی)

2. **آیکن‌های PWA** — سه فایل PNG را در `/assets/icons/` قرار بده:
   - `icon-192.png` (192×192)
   - `icon-512.png` (512×512)
   - `icon-maskable-512.png` (512×512 با حاشیهٔ ~20٪)

   یک SVG (لوگو) را با [realfavicongenerator.net](https://realfavicongenerator.net) یا هر ابزار آنلاین به PNG تبدیل کن. تا آماده نشدن، مرورگر آیکن پیش‌فرض نشان می‌دهد — PWA همچنان کار می‌کند.

3. **دیپلوی** — کل فایل‌ها را روی هر static host بگذار (Netlify / Vercel / Cloudflare Pages / GitHub Pages). هیچ build step لازم نیست.

4. **دامنه** — در Supabase Dashboard → Authentication → URL Configuration، دامنهٔ سایت را به `Site URL` و `Redirect URLs` اضافه کن (برای OAuth و reset password).

## پیکربندی Supabase

- `assets/js/config.js` — URL و publishable key
- `assets/js/supabase.js` — کلاینت singleton
- جدول‌ها با پیشوند `sm_` — بدون تداخل با جداول دیگر

## فهرست کامل فایل‌ها

