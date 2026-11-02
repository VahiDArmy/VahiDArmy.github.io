/* ==========================================================================
   app.js — نقطه ورود برنامه، راه‌اندازی اولیه و هماهنگی ماژول‌ها
   ========================================================================== */

import { CONFIG } from './config.js';
import { $, sleep } from './utils.js';
import { toast } from './toast.js';
import { initTheme } from './theme.js';
import { initParticles } from './particles.js';
import { initAuth, renderAuthView } from './auth.js';
import { initRouter, navigate } from './router.js';
import { initCounters, fetchAndRenderCounters } from './counters.js';
import { initSurah, renderSurahView } from './surah.js';
import { initTafsir } from './tafsir.js';
import { store } from './store.js';

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

    // ۳. راه‌اندازی احراز هویت (در صورت خطای شبکه، برنامه متوقف نمی‌شود)
    try {
      await initAuth();
    } catch (authErr) {
      console.warn('[app] Auth initialization failed or skipped (offline?)', authErr);
    }

    // ۴. راه‌اندازی شمارنده‌ها
    initCounters();

    // ۵. راه‌اندازی مسیریابی
    initRouter();

    // ۶. راه‌اندازی سوره و تفسیر
    initSurah();
    initTafsir();

    // ۷. رندر اولیه صفحه احراز هویت
    renderAuthView();

    // ۸. مدیریت رویدادهای سراسری
    setupGlobalEvents();

  } catch (err) {
    console.error('[app] Initialization failed', err);
    toast('خطا در راه‌اندازی برنامه', 'error');
  } finally {
    // ۹. آماده‌سازی نهایی: همیشه اسپلش را مخفی کن، حتی اگر خطا رخ داده باشد
    await sleep(CONFIG.ui.splashMinDuration);
    hideSplash();
    store.set({ ready: true });
    console.log('[app] Quran 56 App initialized (with or without network).');
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
  window.addEventListener('q56:route-changed', (e) => {
    const route = e.detail.route;
    if (route === 'auth') renderAuthView();
    if (route === 'surah') {
      const content = $('#surahContent');
      if (content && content.children.length === 0) renderSurahView();
    }
  });

  window.addEventListener('q56:navigate', (e) => {
    if (e.detail?.route) navigate(e.detail.route);
  });

  window.addEventListener('q56:toggle-theme', (e) => {
    const newTheme = e.detail?.theme;
    if (newTheme) import('./theme.js').then(m => m.applyTheme(newTheme));
  });

  window.addEventListener('q56:apply-theme', (e) => {
    const newTheme = e.detail?.theme;
    if (newTheme) import('./theme.js').then(m => m.applyTheme(newTheme));
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('is-open');
      setTimeout(() => e.target.remove(), 300);
    }
  });

  const brand = $('#brand');
  if (brand) {
    brand.addEventListener('click', () => {
      if (window.location.hash !== '#surah') navigate('surah');
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const { toggleTheme } = await import('./theme.js');
      toggleTheme();
    });
  }

  const authBtn = $('#authBtn');
  if (authBtn) {
    authBtn.addEventListener('click', () => navigate('auth'));
  }

  const header = $('#siteHeader');
  window.addEventListener('scroll', () => {
    if (!header) return;
    if (window.scrollY > 10) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }, { passive: true });

  window.addEventListener('online', () => {
    toast('اتصال به اینترنت برقرار شد', 'success');
    fetchAndRenderCounters();
  });
  
  window.addEventListener('offline', () => {
    toast('اتصال به اینترنت قطع شد', 'error');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}