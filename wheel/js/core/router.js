/**
 * مدیریت مسیریابی بین صفحات
 * @module router
 */

const Router = {
    routes: {
        '/': 'home',
        '/index.html': 'home',
        '/wheel.html': 'wheel',
        '/description.html': 'description',
        '/ai.html': 'ai',
        '/history.html': 'history',
        '/settings.html': 'settings',
    },

    /**
     * راه‌اندازی
     */
    init() {
        const path = window.location.pathname;
        const page = this._resolvePage(path);
        AppState.set('ui.currentPage', page);
        this._highlightActiveNav();
        this._initLinkHandlers();
        console.log(`📍 صفحه فعلی: ${page}`);
    },

    /**
     * تشخیص صفحه از مسیر
     */
    _resolvePage(path) {
        // حذف نام مخزن از مسیر (برای GitHub Pages)
        const cleanPath = path.replace(/^\/[^/]+\//, '/');
        const filename = cleanPath.split('/').pop() || 'index.html';
        
        for (const [route, page] of Object.entries(this.routes)) {
            if (route.endsWith(filename) || route === cleanPath) {
                return page;
            }
        }
        return 'home';
    },

    /**
     * هایلایت لینک فعال
     */
    _highlightActiveNav() {
        const currentFile = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-link').forEach((link) => {
            const href = link.getAttribute('href');
            if (href === currentFile || (currentFile === '' && href === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },

    /**
     * مدیریت کلیک لینک‌ها برای انیمیشن
     */
    _initLinkHandlers() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
            if (link.target === '_blank') return;

            // ذخیره قبل از انتقال
            SQLStorage.saveNow();
        });
    },

    /**
     * انتقال به صفحه
     */
    navigate(path) {
        window.location.href = path;
    },
};

window.Router = Router;