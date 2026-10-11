/**
 * پیکربندی اصلی برنامه
 * شامل تمام تنظیمات ثابت و قابل تغییر برنامه
 */
const AppConfig = {
  // اطلاعات برنامه
  app: {
    name: 'مدیریت پایگاه داده',
    nameEn: 'Database Manager',
    version: '2.0.0',
    description: 'ابزار حرفه‌ای مدیریت و مشاهده پایگاه داده SQLite در مرورگر',
    author: 'تیم توسعه',
    year: new Date().getFullYear()
  },

  // تنظیمات پایگاه داده
  database: {
    defaultPageSize: 50,
    maxPageSize: 500,
    pageSizeOptions: [10, 25, 50, 100, 250, 500],
    maxRowsPreview: 10000,
    queryTimeout: 30000,
    autoSave: true,
    autoSaveInterval: 60000,
    maxHistorySize: 100,
    supportedExtensions: ['.db', '.sqlite', '.sqlite3', '.db3', '.sql'],
    maxFileSize: 500 * 1024 * 1024
  },

  // تنظیمات نمایش
  display: {
    defaultTheme: 'dark',
    availableThemes: ['dark', 'light', 'high-contrast'],
    defaultLanguage: 'fa',
    availableLanguages: ['fa', 'en'],
    direction: 'rtl',
    fontFamily: 'Vazirmatn',
    fontFallback: 'Tahoma, Arial, sans-serif',
    animationsEnabled: true,
    animationDuration: 300,
    tableRowHeight: 48,
    sidebarWidth: 280,
    sidebarCollapsedWidth: 72
  },

  // تنظیمات صادرات
  export: {
    formats: [
      { id: 'json', label: 'JSON', icon: 'json', mimeType: 'application/json', extension: '.json' },
      { id: 'csv', label: 'CSV', icon: 'csv', mimeType: 'text/csv', extension: '.csv' },
      { id: 'sql', label: 'SQL', icon: 'sql', mimeType: 'text/plain', extension: '.sql' },
      { id: 'xml', label: 'XML', icon: 'xml', mimeType: 'application/xml', extension: '.xml' },
      { id: 'excel', label: 'Excel', icon: 'excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
      { id: 'html', label: 'HTML', icon: 'html', mimeType: 'text/html', extension: '.html' },
      { id: 'markdown', label: 'Markdown', icon: 'markdown', mimeType: 'text/markdown', extension: '.md' },
      { id: 'yaml', label: 'YAML', icon: 'yaml', mimeType: 'text/yaml', extension: '.yaml' },
      { id: 'tsv', label: 'TSV', icon: 'tsv', mimeType: 'text/tab-separated-values', extension: '.tsv' },
      { id: 'sqlite', label: 'SQLite DB', icon: 'database', mimeType: 'application/x-sqlite3', extension: '.sqlite' }
    ],
    defaultFormat: 'json',
    includeSchema: true,
    includeData: true,
    prettyPrint: true,
    compression: false
  },

  // تنظیمات ورودی
  import: {
    acceptedFormats: ['.db', '.sqlite', '.sqlite3', '.db3', '.sql', '.json', '.csv'],
    maxFileSize: 500 * 1024 * 1024,
    chunkSize: 1024 * 1024,
    showPreview: true,
    previewRows: 10
  },

  // تنظیمات کلیدهای میانبر
  keyboardShortcuts: {
    'Ctrl+N': 'newDatabase',
    'Ctrl+O': 'openDatabase',
    'Ctrl+S': 'saveDatabase',
    'Ctrl+Shift+S': 'saveAs',
    'Ctrl+E': 'exportDatabase',
    'Ctrl+I': 'importDatabase',
    'Ctrl+Enter': 'executeQuery',
    'Ctrl+Shift+Enter': 'executeSelectedQuery',
    'Ctrl+/': 'toggleComment',
    'Ctrl+Z': 'undo',
    'Ctrl+Y': 'redo',
    'Ctrl+F': 'search',
    'Ctrl+H': 'replace',
    'Ctrl+Shift+F': 'globalSearch',
    'Escape': 'closeModal',
    'F5': 'refreshData',
    'F11': 'toggleFullscreen',
    'Ctrl+K': 'quickCommand',
    'Ctrl+P': 'quickOpen',
    'Ctrl+B': 'toggleSidebar',
    'Ctrl+Shift+P': 'commandPalette'
  },

  // تنظیمات API
  api: {
    baseUrl: '/api',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },

  // تنظیمات ذخیره‌سازی
  storage: {
    prefix: 'dbmanager_',
    keys: {
      theme: 'theme',
      language: 'language',
      sidebarState: 'sidebar_state',
      recentFiles: 'recent_files',
      queryHistory: 'query_history',
      settings: 'settings',
      lastDatabase: 'last_database'
    },
    maxRecentFiles: 10,
    maxQueryHistory: 100
  },

  // تنظیمات چارت
  charts: {
    colors: [
      '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
      '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#06b6d4', '#3b82f6'
    ],
    animationDuration: 800,
    responsive: true,
    maintainAspectRatio: false
  },

  // تنظیمات اعلان‌ها
  notifications: {
    defaultDuration: 5000,
    maxVisible: 5,
    position: 'top-left',
    types: {
      success: { icon: 'check-circle', color: '#22c55e' },
      error: { icon: 'x-circle', color: '#ef4444' },
      warning: { icon: 'alert-triangle', color: '#f59e0b' },
      info: { icon: 'info', color: '#3b82f6' }
    }
  },

  // تنظیمات صفحه‌بندی
  pagination: {
    showFirstLast: true,
    showPrevNext: true,
    maxVisiblePages: 7,
    showPageSizeSelector: true,
    showTotal: true
  },

  // تنظیمات جدول
  table: {
    sortable: true,
    filterable: true,
    resizableColumns: true,
    selectable: true,
    multiSelect: true,
    showRowNumbers: true,
    showColumnTypes: true,
    stickyHeader: true,
    virtualScroll: true,
    virtualScrollBuffer: 20,
    editable: true,
    contextMenu: true,
    dragAndDrop: true,
    exportable: true,
    columnVisibility: true,
    columnOrdering: true,
    rowExpansion: true,
    cellCopy: true,
    rowCopy: true,
    selectAll: true,
    keyboardNavigation: true
  }
};

// فریز کردن شیء برای جلوگیری از تغییرات ناخواسته
Object.freeze(AppConfig);