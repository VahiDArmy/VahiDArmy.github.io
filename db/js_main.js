/**
 * فایل اصلی برنامه
 * راه‌اندازی و مدیریت نماها
 */

// ============================================
// متغیرهای سراسری
// ============================================

let navbar = null;
let sidebar = null;
let currentView = null;
let viewInstances = new Map();

// ============================================
// مدیریت نماها
// ============================================

/**
 * نمایش یک نما
 */
function showView(viewName, params = {}) {
  const contentEl = document.getElementById('app-content');
  if (!contentEl) return;

  // نابودی نمای قبلی
  if (currentView && viewInstances.has(currentView)) {
    const oldView = viewInstances.get(currentView);
    try {
      oldView.destroy();
    } catch (error) {
      console.error('خطا در نابودی نمای قبلی:', error);
    }
    viewInstances.delete(currentView);
  }

  // ایجاد نمای جدید
  let viewInstance = null;

  switch (viewName) {
    case 'dashboard':
      viewInstance = new DashboardView();
      break;
    case 'tables':
      viewInstance = new TablesView();
      break;
    case 'table-detail':
      viewInstance = new TableDetailView(params);
      break;
    case 'query':
      viewInstance = new QueryView();
      break;
    case 'schema':
      viewInstance = new SchemaView();
      break;
    case 'export':
      viewInstance = new ExportView();
      break;
    case 'import':
      viewInstance = new ImportView();
      break;
    case 'settings':
      viewInstance = new SettingsView();
      break;
    case 'about':
      viewInstance = new AboutView();
      break;
    case 'not-found':
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">صفحه یافت نشد</div>
          <div class="empty-state-description">آدرس درخواستی وجود ندارد</div>
          <a href="#/dashboard" class="btn btn-primary">بازگشت به داشبورد</a>
        </div>
      `;
      return;
    default:
      viewInstance = new DashboardView();
  }

  currentView = viewName;
  stateManager.set('app.currentView', viewName);

  // رندر
  Promise.resolve(viewInstance.render())
    .then((element) => {
      contentEl.innerHTML = '';
      contentEl.appendChild(element);

      viewInstances.set(viewName, viewInstance);

      // انیمیشن ورود
      element.classList.add('view-entering');
      requestAnimationFrame(() => {
        element.classList.remove('view-entering');
      });

      // اسکرول به بالا
      contentEl.scrollTop = 0;
    })
    .catch((error) => {
      console.error('خطا در رندر نما:', error);
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-title">خطا در بارگذاری</div>
          <div class="empty-state-description">${StringUtils.escapeHtml(error.message)}</div>
        </div>
      `;
    });
}

/**
 * نابودی همه نماها
 */
function destroyAllViews() {
  viewInstances.forEach((view, key) => {
    try {
      view.destroy();
    } catch (error) {
      console.error(`خطا در نابودی نمای ${key}:`, error);
    }
  });
  viewInstances.clear();
  currentView = null;
}

// ============================================
// بارگذاری جداول
// ============================================

function loadTablesList() {
  if (!stateManager.get('database.loaded')) {
    stateManager.set('database.tables', []);
    return [];
  }

  try {
    const tables = databaseService.getTables();
    stateManager.set('database.tables', tables);
    return tables;
  } catch (error) {
    console.error('خطا در بارگذاری جداول:', error);
    return [];
  }
}

// ============================================
// اعمال تم
// ============================================

function applyTheme(themeName) {
  const theme = ThemeConfig[themeName] || ThemeConfig.dark;

  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  document.documentElement.setAttribute('data-theme', themeName);
  stateManager.set('app.theme', themeName);
}

// ============================================
// راه‌اندازی رویدادها
// ============================================

function setupEventListeners() {
  // وضعیت سایدبار
  stateManager.subscribe('app.sidebarCollapsed', (collapsed) => {
    const appBody = document.querySelector('.app-body');
    if (appBody) {
      appBody.classList.toggle('sidebar-collapsed', collapsed);
    }
  });

  // رویدادهای پایگاه داده
  databaseService.on('databaseLoaded', () => {
    loadTablesList();
  });

  databaseService.on('databaseCreated', () => {
    stateManager.set('database.tables', []);
  });

  // هشدار خروج
  window.addEventListener('beforeunload', (e) => {
    if (stateManager.get('database.dirty')) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

// ============================================
// کلیدهای میانبر سراسری
// ============================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const ctrl = e.ctrlKey || e.metaKey;

    // Escape
    if (e.key === 'Escape') {
      if (modalService.getActiveModal()) return;
      contextMenu.hide();
    }

    // Ctrl+N
    if (ctrl && e.key === 'n' && !isInput) {
      e.preventDefault();
      handleNewDatabase();
    }

    // Ctrl+O
    if (ctrl && e.key === 'o') {
      e.preventDefault();
      handleOpenDatabase();
    }

    // Ctrl+S
    if (ctrl && e.key === 's') {
      e.preventDefault();
      handleSaveDatabase();
    }

    // Ctrl+E
    if (ctrl && e.key === 'e' && !isInput) {
      e.preventDefault();
      router.navigate('/export');
    }

    // Ctrl+I
    if (ctrl && e.key === 'i' && !isInput) {
      e.preventDefault();
      router.navigate('/import');
    }

    // Ctrl+B
    if (ctrl && e.key === 'b' && !isInput) {
      e.preventDefault();
      stateManager.set('app.sidebarCollapsed', !stateManager.get('app.sidebarCollapsed'));
    }

    // Ctrl+K
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      document.querySelector('.navbar-search-input')?.focus();
    }

    // F5
    if (e.key === 'F5' && !isInput) {
      e.preventDefault();
      if (currentView && viewInstances.has(currentView)) {
        const view = viewInstances.get(currentView);
        if (typeof view._refresh === 'function') view._refresh();
        if (typeof view._loadData === 'function') view._loadData();
        if (typeof view._loadTables === 'function') view._loadTables();
        if (typeof view._loadSchema === 'function') view._loadSchema();
      }
    }
  });
}

// ============================================
// هندلرهای فایل
// ============================================

async function handleNewDatabase() {
  const confirmed = await modalService.confirm(
    'پایگاه داده فعلی بسته و یکی جدید ایجاد شود؟',
    { title: 'پایگاه داده جدید' }
  );

  if (!confirmed) return;

  await databaseService.createDatabase();
  stateManager.set('database.loaded', true);
  stateManager.set('database.name', 'database.db');
  stateManager.set('database.size', 0);
  stateManager.set('database.dirty', false);

  notificationService.success('پایگاه داده جدید ایجاد شد');
  loadTablesList();
  router.navigate('/dashboard');
}

async function handleOpenDatabase() {
  try {
    const file = await FileUtils.openDialog({
      accept: '.db,.sqlite,.sqlite3,.db3,.sql'
    });

    if (!file) return;

    const validation = FileUtils.validate(file, {
      accept: ['.db', '.sqlite', '.sqlite3', '.db3', '.sql'],
      maxSize: AppConfig.database.maxFileSize
    });

    if (!validation.valid) {
      notificationService.error(validation.errors[0]);
      return;
    }

    const data = await FileUtils.readUint8Array(file);
    await databaseService.loadDatabase(data, file.name);

    stateManager.set('database.loaded', true);
    stateManager.set('database.name', file.name);
    stateManager.set('database.size', file.size);
    stateManager.set('database.dirty', false);

    storageService.set('lastDatabase', {
      name: file.name,
      size: file.size,
      timestamp: Date.now()
    });

    notificationService.success(`"${file.name}" بارگذاری شد`);
    loadTablesList();
    router.navigate('/dashboard');
  } catch (error) {
    notificationService.error(`خطا: ${error.message}`);
  }
}

function handleSaveDatabase() {
  if (!stateManager.get('database.loaded')) {
    notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
    return;
  }

  try {
    const data = databaseService.exportDatabase();
    const filename = stateManager.get('database.name') || 'database.db';

    FileUtils.downloadUint8Array(data, filename, 'application/x-sqlite3');

    stateManager.set('database.dirty', false);
    stateManager.set('database.lastSaved', Date.now());

    notificationService.success('پایگاه داده ذخیره شد');
  } catch (error) {
    notificationService.error(`خطا: ${error.message}`);
  }
}

// ============================================
// Drag and Drop
// ============================================

function setupDragAndDrop() {
  const body = document.body;

  let dragCounter = 0;

  body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;

    dragCounter++;
    body.classList.add('dragging-file');
  });

  body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  body.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      body.classList.remove('dragging-file');
    }
  });

  body.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    body.classList.remove('dragging-file');

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // اگر روی uploader خاصی نیست، از این‌جا مدیریت کن
    if (e.target.closest('.file-uploader-dropzone')) return;

    const supportedExts = ['.db', '.sqlite', '.sqlite3', '.db3', '.sql', '.json', '.csv'];
    const validFiles = files.filter(f => {
      const ext = FileUtils.getExtension(f.name);
      return supportedExts.includes(ext);
    });

    if (validFiles.length === 0) {
      notificationService.warning('فرمت فایل پشتیبانی نمی‌شود');
      return;
    }

    router.navigate('/import');
    setTimeout(() => {
      const view = viewInstances.get('import');
      if (view && view.uploader) {
        view.uploader.setFiles(validFiles);
      }
    }, 100);
  });
}

// ============================================
// راه‌اندازی اولیه
// ============================================

async function bootstrap() {
  try {
    console.log('شروع راه‌اندازی...');

    // راه‌اندازی tooltip
    tooltip.init();

    // راه‌اندازی contextMenu
    contextMenu.init();

    // راه‌اندازی navbar
    const navbarContainer = document.getElementById('app-navbar');
    if (navbarContainer) {
      navbar = new Navbar();
      navbarContainer.appendChild(navbar.render());
    }

    // راه‌اندازی sidebar
    const sidebarContainer = document.getElementById('app-sidebar');
    if (sidebarContainer) {
      sidebar = new Sidebar();
      sidebarContainer.appendChild(sidebar.render());
    }

    // راه‌اندازی برنامه
    await startApp();

    // بارگذاری جداول اگر پایگاه داده‌ای هست
    if (stateManager.get('database.loaded')) {
      loadTablesList();
    }

    // پیام خوش‌آمد
    setTimeout(() => {
      notificationService.info('به مدیریت پایگاه داده خوش آمدید', {
        title: 'خوش آمدید',
        duration: 4000
      });
    }, 1000);

    console.log('راه‌اندازی کامل شد');
  } catch (error) {
    console.error('خطا در راه‌اندازی:', error);

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <div class="loading-error">
          <div class="loading-error-icon">⚠</div>
          <h2>خطا در راه‌اندازی</h2>
          <p>${StringUtils.escapeHtml(error.message)}</p>
          <button onclick="location.reload()" class="btn btn-primary">تلاش مجدد</button>
        </div>
      `;
    }
  }
}

// ============================================
// راه‌اندازی
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// ============================================
// صادرات به window
// ============================================

window.showView = showView;
window.loadTablesList = loadTablesList;
window.applyTheme = applyTheme;
window.handleNewDatabase = handleNewDatabase;
window.handleOpenDatabase = handleOpenDatabase;
window.handleSaveDatabase = handleSaveDatabase;
window.destroyAllViews = destroyAllViews;