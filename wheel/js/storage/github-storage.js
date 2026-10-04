/**
 * ذخیره‌سازی در GitHub
 * @module githubStorage
 */

const GitHubStorage = {
    baseUrl: 'https://api.github.com',

    /**
     * تنظیمات
     */
    getConfig() {
        let username = (AppState.get('settings.githubUsername') || '').trim();
        let repo = (AppState.get('settings.githubRepo') || '').trim();
        let branch = (AppState.get('settings.githubBranch') || '').trim();

        // اگر کاربر اشتباهاً username/repo وارد کرده باشد، جدا کن
        if (username.includes('/')) {
            const parts = username.split('/').filter(Boolean);
            if (parts.length >= 2 && !repo) {
                username = parts[0];
                repo = parts[1];
            } else {
                username = parts[0];
            }
        }

        // پاکسازی اسلش اضافی
        repo = repo.replace(/^\/+|\/+$/g, '');

        // اگر شاخه خالی بود، پیش‌فرض main
        if (!branch) branch = 'main';

        return {
            token: (AppState.get('settings.githubToken') || '').trim(),
            owner: username,
            repo: repo,
            branch: branch,
        };
    },

    /**
     * بررسی اعتبار تنظیمات
     */
    isConfigured() {
        const config = this.getConfig();
        return !!(config.token && config.owner && config.repo);
    },

    /**
     * درخواست به GitHub API
     */
    async request(endpoint, options = {}) {
        const config = this.getConfig();
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        let response;
        try {
            response = await fetch(url, { ...options, headers });
        } catch (networkError) {
            console.error('❌ خطای شبکه در GitHub API:', networkError);
            console.error('URL:', url);
            throw new Error(
                `اتصال به GitHub برقرار نشد. بررسی کنید:\n` +
                `۱. اتصال اینترنت\n` +
                `۲. VPN (ممکن است GitHub API را بلاک کند)\n` +
                `۳. نام کاربری و مخزن: ${config.owner}/${config.repo}`
            );
        }

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw new Error(`پاسخ نامعتبر از GitHub (کد ${response.status})`);
        }

        if (!response.ok) {
            const msg = data?.message || `خطای ${response.status}`;
            
            // ترجمه خطاهای رایج
            if (response.status === 401) {
                throw new Error('توکن نامعتبر است (۴۰۱). توکن را در تنظیمات بررسی کنید.');
            }
            if (response.status === 403) {
                throw new Error(
                    'دسترسی رد شد (۴۰۳). احتمالاً توکن دسترسی repo ندارد یا rate limit پر شده.'
                );
            }
            if (response.status === 404) {
                throw new Error(
                    `مخزن پیدا نشد (۴۰۴). بررسی کنید:\n` +
                    `نام کاربری: ${config.owner}\n` +
                    `نام مخزن: ${config.repo}\n` +
                    `شاخه: ${config.branch}`
                );
            }
            if (response.status === 409) {
                throw new Error('تداخل نسخه (۴۰۹). دوباره تلاش کنید.');
            }
            if (response.status === 422) {
                throw new Error('داده نامعتبر (۴۲۲): ' + msg);
            }

            throw new Error(msg);
        }

        return data;
    },

    /**
     * دریافت فایل
     */
    async getFile(path) {
        const config = this.getConfig();
        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
            );
            const content = decodeURIComponent(escape(atob(data.content)));
            return {
                content: JSON.parse(content),
                sha: data.sha,
            };
        } catch (error) {
            if (error.message.includes('۴۰۴') || error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    },

    /**
     * ذخیره فایل
     */
    async saveFile(path, content, message = 'به‌روزرسانی خودکار') {
        const config = this.getConfig();
        const encodedContent = btoa(
            unescape(encodeURIComponent(JSON.stringify(content, null, 2)))
        );

        let sha = null;
        try {
            const existing = await this.getFile(path);
            if (existing) sha = existing.sha;
        } catch (e) {
            // فایل وجود ندارد
        }

        const body = {
            message,
            content: encodedContent,
            branch: config.branch,
        };
        if (sha) body.sha = sha;

        return await this.request(
            `/repos/${config.owner}/${config.repo}/contents/${path}`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            }
        );
    },

    /**
     * ذخیره افراد
     */
    async savePeople(people) {
        return await this.saveFile('data/people.json', people, 'به‌روزرسانی لیست افراد');
    },

    /**
     * ذخیره آیتم‌ها
     */
    async saveItems(items) {
        return await this.saveFile('data/items.json', items, 'به‌روزرسانی آیتم‌ها');
    },

    /**
     * ذخیره توصیفات
     */
    async saveDescriptions(descriptions) {
        return await this.saveFile('data/descriptions.json', descriptions, 'به‌روزرسانی توصیفات');
    },

    /**
     * ذخیره تاریخچه
     */
    async saveHistory(history) {
        return await this.saveFile('data/history.json', history, 'به‌روزرسانی تاریخچه');
    },

    /**
     * ذخیره تنظیمات
     */
    async saveSettings(settings) {
        return await this.saveFile('data/settings.json', settings, 'به‌روزرسانی تنظیمات');
    },

    /**
     * بارگذاری همه داده‌ها
     */
    async loadAll() {
        const [people, items, descriptions, history, settings] = await Promise.allSettled([
            this.getFile('data/people.json'),
            this.getFile('data/items.json'),
            this.getFile('data/descriptions.json'),
            this.getFile('data/history.json'),
            this.getFile('data/settings.json'),
        ]);

        const unwrap = (r) => (r.status === 'fulfilled' && r.value ? r.value.content : null);

        return {
            people: unwrap(people) || [],
            items: unwrap(items) || [],
            descriptions: unwrap(descriptions) || {},
            history: unwrap(history) || [],
            settings: unwrap(settings),
        };
    },

    /**
     * تست اتصال - کامل
     */
    async testConnection() {
        const config = this.getConfig();

        // چک ۱: وجود توکن
        if (!config.token) {
            return { success: false, message: 'توکن GitHub وارد نشده است' };
        }

        // چک ۲: کاربر جاری
        try {
            await this.request('/user');
        } catch (e) {
            return { success: false, message: 'توکن نامعتبر: ' + e.message };
        }

        // چک ۳: وجود مخزن
        if (!config.owner || !config.repo) {
            return {
                success: false,
                message: 'نام کاربری یا نام مخزن وارد نشده است',
            };
        }

        try {
            const repoInfo = await this.request(
                `/repos/${config.owner}/${config.repo}`
            );

            // چک ۴: وجود شاخه
            try {
                await this.request(
                    `/repos/${config.owner}/${config.repo}/branches/${config.branch}`
                );
            } catch (e) {
                return {
                    success: false,
                    message: `شاخه «${config.branch}» در مخزن «${config.repo}» پیدا نشد. ` +
                             `شاخه‌های موجود: main, master یا...`,
                };
            }

            return {
                success: true,
                message: `اتصال کامل: ${repoInfo.full_name} (شاخه: ${config.branch})`,
            };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    /**
     * بررسی وجود شاخه
     */
    async checkBranch() {
        const config = this.getConfig();
        if (!config.owner || !config.repo) return null;

        try {
            await this.request(
                `/repos/${config.owner}/${config.repo}/branches/${config.branch}`
            );
            return true;
        } catch (e) {
            return false;
        }
    },
};

window.GitHubStorage = GitHubStorage;