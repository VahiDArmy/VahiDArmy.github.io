/* ==========================================================================
   app.js — نقطه ورود برنامه، راه‌اندازی اولیه و هماهنگی ماژول‌ها
   ========================================================================== */

import { CONFIG } from './config.js';
import { $, sleep, device, toast } from './utils.js';
import { initTheme } from './theme.js';
import { initParticles } from './particles.js';
import { initAuth, renderAuthView } from './auth.js';
import { initRouter, navigate } from './router.js';
import { initCounters, fetchAndRenderCounters } from './counters.js';
import { initSurah, renderSurahView } from './surah.js';
import { initTafsir } from './tafsir.js';
import { store } from './store.js';

// متغیرهای وضعیت
let isInitialized = false;

async function bootstrap() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    // ۱. تنظیمات تم اولیه (از localStorage)
    const theme = initTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // ۲. راه‌اندازی ذرات پس‌زمینه
    initParticles();

    // ۳. راه‌اندازی احراز هویت (این باید قبل از شمارنده‌ها اجرا شود)
    await initAuth();

    // ۴. راه‌اندازی شمارنده‌ها
    initCounters();

    // ۵. راه‌اندازی مسیریابی
    initRouter();

    // ۶. راه‌اندازی سوره و تفسیر
    initSurah();
    initTafsir();

    // ۷. رندر اولیه صفحه احراز هویت (حتی اگر مخفی باشد)
    renderAuthView();

    // ۸. مدیریت رویدادهای سراسری
    setupGlobalEvents();

    // ۹. آماده‌سازی نهایی و مخفی کردن اسپلش
    await sleep(CONFIG.ui.splashMinDuration);
    hideSplash();

    // تنظیم وضعیت آماده در Store
    store.set({ ready: true });

    console.log('[app] Quran 56 App initialized successfully.');

  } catch (err) {
    console.error('[app] Initialization failed', err);
    toast('خطا در راه‌اندازی برنامه', 'error');
  }
}

function hideSplash() {
  const splash = $('#splash');
  if (splash) {
    splash.classList.add('is-hidden');
    setTimeout(() => {
      splash.remove();
    }, 800);
  }
}

function setupGlobalEvents() {
  // مدیریت تغییر مسیر
  window.addEventListener('q56:route-changed', (e) => {
    const route = e.detail.route;
    
    // اگر به مسیر احراز هویت رفتیم، دوباره رندر شود
    if (route === 'auth') {
      renderAuthView();
    }
    
    // اگر به مسیر سوره رفتیم، شاید نیاز به رفرش باشد
    if (route === 'surah') {
      // فقط اگر محتوا خالی است رندر شود (برای جلوگیری از از دست رفتن اسکرول)
      const content = $('#surahContent');
      if (content && content.children.length === 0) {
        renderSurahView();
      }
    }
  });

  // رویدادهای سفارشی برای ناوبری
  window.addEventListener('q56:navigate', (e) => {
    if (e.detail?.route) navigate(e.detail.route);
  });

  // تغییر تم از داخل پروفایل
  window.addEventListener('q56:toggle-theme', (e) => {
    const newTheme = e.detail?.theme;
    if (newTheme) {
      import('./theme.js').then(m => m.applyTheme(newTheme));
    }
  });

  // اعمال تم از سمت سرور
  window.addEventListener('q56:apply-theme', (e) => {
    const newTheme = e.detail?.theme;
    if (newTheme) {
      import('./theme.js').then(m => m.applyTheme(newTheme));
    }
  });

  // بستن مودال با کلیک روی پس‌زمینه (اضافه شده برای اطمینان)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('is-open');
      setTimeout(() => e.target.remove(), 300);
    }
  });

  // مدیریت کلیک روی برند (هاور افکت)
  const brand = $('#brand');
  if (brand) {
    brand.addEventListener('click', () => {
      // اگر در صفحه تفسیر هستیم، به سوره برگردیم
      if (window.location.hash !== '#surah') {
        navigate('surah');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // مدیریت کلیک روی دکمه‌های تغییر تم
  const themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const { toggleTheme } = await import('./theme.js');
      toggleTheme();
    });
  }

  // مدیریت دکمه حساب کاربری
  const authBtn = $('#authBtn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      navigate('auth');
    });
  }

  // اضافه کردن کلاس is-scrolled به هدر در هنگام اسکرول
  let lastScrollY = window.scrollY;
  const header = $('#siteHeader');
  
  window.addEventListener('scroll', () => {
    if (!header) return;
    const scrollY = window.scrollY;
    
    if (scrollY > 10) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
    
    lastScrollY = scrollY;
  }, { passive: true });

  // مدیریت آفلاین/آنلاین
  window.addEventListener('online', () => {
    toast('اتصال به اینترنت برقرار شد', 'success');
    fetchAndRenderCounters();
  });
  
  window.addEventListener('offline', () => {
    toast('اتصال به اینترنت قطع شد', 'error');
  });

  // مدیریت دکمه بازگشت در مرورگر
  window.addEventListener('popstate', () => {
    // router خودش هندل می‌کند
  });
}

// اجرای برنامه هنگام آماده شدن DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // اگر اسکریپت بعد از لود DOM اجرا شد
  bootstrap();
}