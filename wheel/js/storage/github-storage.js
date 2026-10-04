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
        return {
            token: AppState.get('settings.githubToken'),
            owner: AppState.get('settings.githubUsername'),
            repo: AppState.get('settings.githubRepo'),
            branch: 'main',
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

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `خطای GitHub: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('خطای GitHub API:', error);
            throw error;
        }
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
            if (error.message.includes('404')) {
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
        const encodedContent = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
        
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
        const [people, items, descriptions, history, settings] = await Promise.all([
            this.getFile('data/people.json'),
            this.getFile('data/items.json'),
            this.getFile('data/descriptions.json'),
            this.getFile('data/history.json'),
            this.getFile('data/settings.json'),
        ]);

        return {
            people: people?.content || [],
            items: items?.content || [],
            descriptions: descriptions?.content || {},
            history: history?.content || [],
            settings: settings?.content || null,
        };
    },

    /**
     * بررسی اتصال
     */
    async testConnection() {
        try {
            await this.request('/user');
            return true;
        } catch (error) {
            return false;
        }
    },
};

window.GitHubStorage = GitHubStorage;