/**
 * راه‌انداز برنامه
 * مسئول راه‌اندازی اولیه تمام بخش‌ها
 */
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initSteps = [];
    this.errors = [];
    this.startTime = 0;
    this.listeners = new Map();
    this.initPromise = null;
  }

  /**
   * ثبت مرحله راه‌اندازی
   */
  addStep(name, fn, options = {}) {
    this.initSteps.push({
      name,
      fn,
      required: options.required !== false,
      timeout: options.timeout || 30000,
      priority: options.priority || 0
    });

    this.initSteps.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /**
   * راه‌اندازی
   */
  async initialize() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._runInitialization();
    return this.initPromise;
  }

  /**
   * اجرای راه‌اندازی
   */
  async _runInitialization() {
    if (this.initialized) {
      return { success: true, alreadyInitialized: true };
    }

    this.startTime = performance.now();
    this.emit('started');

    const results = [];

    for (const step of this.initSteps) {
      const stepStart = performance.now();

      this.emit('stepStarted', { name: step.name });

      try {
        const result = step.timeout > 0
          ? await this._runWithTimeout(step.fn, step.timeout, step.name)
          : await step.fn();

        const duration = performance.now() - stepStart;

        results.push({
          name: step.name,
          success: true,
          duration,
          result
        });

        this.emit('stepCompleted', { name: step.name, duration, result });

        if (step.name === 'ui') {
          this._hideLoadingScreen();
        }
      } catch (error) {
        const duration = performance.now() - stepStart;

        results.push({
          name: step.name,
          success: false,
          duration,
          error: error.message
        });

        this.errors.push({ step: step.name, error });
        this.emit('stepFailed', { name: step.name, error });

        console.error(`خطا در مرحله "${step.name}":`, error);

        if (step.required) {
          this.initialized = false;
          this.emit('failed', { step: step.name, error, results });
          throw error;
        }
      }
    }

    const totalDuration = performance.now() - this.startTime;
    this.initialized = true;

    const summary = {
      success: true,
      totalDuration,
      steps: results,
      errors: this.errors
    };

    this.emit('completed', summary);

    console.log(`راه‌اندازی در ${totalDuration.toFixed(2)}ms کامل شد`);

    return summary;
  }

  /**
   * اجرا با تایم‌اوت
   */
  _runWithTimeout(fn, timeout, name) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`مرحله "${name}" در ${timeout}ms به پایان نرسید`));
      }, timeout);

      Promise.resolve()
        .then(() => fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * مخفی کردن صفحه بارگذاری
   */
  _hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
  }

  /**
   * نمایش خطا
   */
  _showError(error) {
    console.error('خطای راه‌اندازی:', error);

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <div class="loading-error">
          <div class="loading-error-icon">⚠</div>
          <h2>خطا در راه‌اندازی برنامه</h2>
          <p>${StringUtils.escapeHtml(error.message)}</p>
          <button onclick="location.reload()" class="btn btn-primary">تلاش مجدد</button>
        </div>
      `;
    }
  }

  /**
   * ثبت شنونده
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  /**
   * انتشار رویداد
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`خطا در شنونده "${event}":`, error);
        }
      });
    }
  }

  /**
   * بازنشانی
   */
  reset() {
    this.initialized = false;
    this.errors = [];
    this.initPromise = null;
    this.initSteps = [];
    return this;
  }
}

/**
 * تعریف مراحل راه‌اندازی
 */
async function setupApplication() {
  const initializer = new AppInitializer();

  // مرحله 1: بارگذاری تنظیمات
  initializer.addStep('config', async () => {
    console.log('بارگذاری تنظیمات...');
    const settings = await storageService.loadSettings();

    if (settings) {
      if (settings.theme) {
        applyTheme(settings.theme);
      }
      if (settings.language) {
        stateManager.set('app.language', settings.language);
      }
    }

    return { loaded: true };
  }, { priority: 1 });

  // مرحله 2: اعمال تم
  initializer.addStep('theme', async () => {
    console.log('اعمال تم...');
    const savedTheme = stateManager.get('app.theme') || 'dark';
    applyTheme(savedTheme);
    return { theme: savedTheme };
  }, { priority: 2 });

  // مرحله 3: راه‌اندازی sql.js
  initializer.addStep('database', async () => {
    console.log('راه‌اندازی موتور پایگاه داده...');
    await databaseService.initialize();
    return { initialized: true };
  }, { priority: 3, timeout: 60000 });

  // مرحله 4: راه‌اندازی Storage
  initializer.addStep('storage', async () => {
    console.log('راه‌اندازی ذخیره‌سازی...');
    try {
      await storageService.init();
    } catch (e) {
      console.warn('IndexedDB در دسترس نیست:', e);
    }
    return { initialized: true };
  }, { priority: 4, required: false });

  // مرحله 5: ثبت مسیرها
  initializer.addStep('routes', async () => {
    console.log('ثبت مسیرها...');
    router.register('/', () => showView('dashboard'), { title: 'داشبورد' });
    router.register('/dashboard', () => showView('dashboard'), { title: 'داشبورد' });
    router.register('/tables', () => showView('tables'), { title: 'جداول' });
    router.register('/tables/:name', (ctx) => showView('table-detail', ctx.params), { title: 'جدول' });
    router.register('/query', () => showView('query'), { title: 'کوئری' });
    router.register('/schema', () => showView('schema'), { title: 'ساختار' });
    router.register('/export', () => showView('export'), { title: 'صادرات' });
    router.register('/import', () => showView('import'), { title: 'واردات' });
    router.register('/settings', () => showView('settings'), { title: 'تنظیمات' });
    router.register('/about', () => showView('about'), { title: 'درباره' });

    router.notFoundHandler = () => showView('not-found');
    return { registered: true };
  }, { priority: 5 });

  // مرحله 6: راه‌اندازی UI
  initializer.addStep('ui', async () => {
    console.log('راه‌اندازی رابط کاربری...');
    setupEventListeners();
    setupKeyboardShortcuts();
    setupDragAndDrop();
    return { initialized: true };
  }, { priority: 6 });

  // مرحله 7: راه‌اندازی روتر
  initializer.addStep('router', async () => {
    console.log('راه‌اندازی روتر...');
    router.start();
    return { started: true };
  }, { priority: 7 });

  // مرحله 8: بارگذاری آخرین پایگاه داده
  initializer.addStep('restore', async () => {
    console.log('بازیابی آخرین وضعیت...');
    const lastDb = storageService.get('lastDatabase');
    if (lastDb) {
      stateManager.set('database.lastOpened', lastDb);
    }
    return { restored: true };
  }, { priority: 8, required: false });

  try {
    const result = await initializer.initialize();
    console.log('راه‌اندازی موفق:', result);
    return result;
  } catch (error) {
    initializer._showError(error);
    throw error;
  }
}

// متغیرها و توابع کمکی
let appInitializer = null;

async function startApp() {
  appInitializer = new AppInitializer();
  return setupApplication();
}

window.startApp = startApp;
window.AppInitializer = AppInitializer;