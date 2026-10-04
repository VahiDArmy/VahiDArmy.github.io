/**
 * ذخیره‌سازی در GitHub
 * @module githubStorage
 */

const GitHubStorage = {
    baseUrl: 'https://api.github.com',
    _defaultBranchCache: null,

    getConfig() {
        let username = (AppState.get('settings.githubUsername') || '').trim();
        let repo = (AppState.get('settings.githubRepo') || '').trim();
        let branch = (AppState.get('settings.githubBranch') || '').trim();

        if (username.includes('/')) {
            const parts = username.split('/').filter(Boolean);
            if (parts.length >= 2 && !repo) {
                username = parts[0];
                repo = parts[1];
            } else {
                username = parts[0];
            }
        }

        repo = repo.replace(/^\/+|\/+$/g, '');

        return {
            token: (AppState.get('settings.githubToken') || '').trim(),
            owner: username,
            repo: repo,
            branch: branch,
        };
    },

    isConfigured() {
        const config = this.getConfig();
        return !!(config.token && config.owner && config.repo);
    },

    /**
     * تشخیص خودکار شاخه اصلی مخزن
     */
    async detectDefaultBranch() {
        const config = this.getConfig();
        if (!config.token || !config.owner || !config.repo) return null;
        if (this._defaultBranchCache) return this._defaultBranchCache;

        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}`,
                {},
                true // skipBranchCheck
            );
            const branch = data.default_branch || 'main';
            this._defaultBranchCache = branch;
            console.log('🔍 شاخه پیش‌فرض مخزن:', branch);
            return branch;
        } catch (e) {
            return null;
        }
    },

    async request(endpoint, options = {}, skipBranchCheck = false) {
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
            console.error('❌ خطای شبکه:', networkError);
            throw new Error(
                `اتصال به GitHub برقرار نشد.\n` +
                `بررسی کنید: اینترنت، VPN، نام مخزن`
            );
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`پاسخ نامعتبر از GitHub (${response.status})`);
        }

        if (!response.ok) {
            const msg = data?.message || `خطای ${response.status}`;
            const isSecretError = /secret|scanning|repository rule/i.test(msg);

            if (isSecretError) {
                throw new Error(
                    `GitHub اجازه ذخیره را نداد (${response.status}):\n` +
                    `دلیل: شناسایی اطلاعات حساس (Secret)\n` +
                    `از سیاست امنیتی مخزن است.`
                );
            }

            if (response.status === 401) {
                throw new Error('توکن نامعتبر است (۴۰۱)');
            }
            if (response.status === 403) {
                throw new Error('دسترسی رد شد (۴۰۳). توکن باید repo داشته باشد.');
            }
            if (response.status === 404) {
                throw new Error(`موردی پیدا نشد (۴۰۴): ${msg}`);
            }
            if (response.status === 409) {
                throw new Error(`تداخل نسخه (۴۰۹): ${msg}`);
            }
            if (response.status === 422) {
                throw new Error(`داده نامعتبر (۴۲۲): ${msg}`);
            }

            throw new Error(msg);
        }

        return data;
    },

    /**
     * شاخه‌ی واقعی برای استفاده
     */
    async resolveBranch() {
        const config = this.getConfig();

        // اگر کاربر تعیین کرده، از همان استفاده کن
        if (config.branch) {
            // تست کن که شاخه وجود دارد
            try {
                await this.request(
                    `/repos/${config.owner}/${config.repo}/branches/${config.branch}`
                );
                return config.branch;
            } catch (e) {
                console.warn(`شاخه «${config.branch}» پیدا نشد، تشخیص خودکار...`);
            }
        }

        // تشخیص خودکار
        const detected = await this.detectDefaultBranch();
        if (detected) {
            // ذخیره برای استفاده بعدی
            AppState.set('settings.githubBranch', detected);
            try {
                if (SQLStorage.isReady) SQLStorage.setSetting('githubBranch', detected);
            } catch (e) {}
            return detected;
        }

        // آخرین تلاش
        for (const b of ['main', 'master']) {
            try {
                await this.request(
                    `/repos/${config.owner}/${config.repo}/branches/${b}`
                );
                return b;
            } catch (e) {}
        }

        return config.branch || 'main';
    },

    async getFileSha(path) {
        const config = this.getConfig();
        const branch = await this.resolveBranch();
        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branch}`
            );
            return data.sha || null;
        } catch (e) {
            return null;
        }
    },

    async getFile(path) {
        const config = this.getConfig();
        const branch = await this.resolveBranch();
        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branch}`
            );
            const raw = decodeURIComponent(
                escape(atob((data.content || '').replace(/\n/g, '')))
            );
            let parsed = null;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
            return { content: parsed, sha: data.sha };
        } catch (error) {
            return null;
        }
    },

    async saveFile(path, content, message = 'به‌روزرسانی خودکار', attempt = 1) {
        const config = this.getConfig();
        const branch = await this.resolveBranch();
        const encodedContent = btoa(
            unescape(encodeURIComponent(JSON.stringify(content, null, 2)))
        );

        let sha = await this.getFileSha(path);

        const body = {
            message,
            content: encodedContent,
            branch: branch,
        };
        if (sha) body.sha = sha;

        try {
            return await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(body),
                }
            );
        } catch (error) {
            const is409 = error.message.includes('۴۰۹') || error.message.includes('409');
            const isSecretError = /secret|scanning|repository rule/i.test(error.message);

            if (is409 && !isSecretError && attempt <= 2) {
                console.log(`⚠️ تداخل - تلاش مجدد (${attempt}/2)`);
                await Utils.delay(800 * attempt);
                return await this.saveFile(path, content, message, attempt + 1);
            }

            throw error;
        }
    },

    async saveBinaryFile(path, base64Content, message = 'به‌روزرسانی فایل باینری', attempt = 1) {
        const config = this.getConfig();
        const branch = await this.resolveBranch();
        let sha = await this.getFileSha(path);

        const body = {
            message,
            content: base64Content,
            branch: branch,
        };
        if (sha) body.sha = sha;

        try {
            return await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(body),
                }
            );
        } catch (error) {
            const is409 = error.message.includes('۴۰۹') || error.message.includes('409');
            const isSecretError = /secret|scanning|repository rule/i.test(error.message);

            if (is409 && !isSecretError && attempt <= 2) {
                console.log(`⚠️ تداخل فایل باینری - تلاش مجدد (${attempt}/2)`);
                await Utils.delay(800 * attempt);
                return await this.saveBinaryFile(path, base64Content, message, attempt + 1);
            }

            throw error;
        }
    },

    async savePeople(people) {
        return await this.saveFile('data/people.json', people, 'به‌روزرسانی افراد');
    },

    async saveItems(items) {
        return await this.saveFile('data/items.json', items, 'به‌روزرسانی آیتم‌ها');
    },

    async saveDescriptions(descriptions) {
        return await this.saveFile('data/descriptions.json', descriptions, 'به‌روزرسانی توصیفات');
    },

    async saveHistory(history) {
        return await this.saveFile('data/history.json', history, 'به‌روزرسانی تاریخچه');
    },

    async loadAll() {
        const [people, items, descriptions, history] = await Promise.allSettled([
            this.getFile('data/people.json'),
            this.getFile('data/items.json'),
            this.getFile('data/descriptions.json'),
            this.getFile('data/history.json'),
        ]);

        const unwrap = (r) => (r.status === 'fulfilled' && r.value ? r.value.content : null);

        return {
            people: unwrap(people) || [],
            items: unwrap(items) || [],
            descriptions: unwrap(descriptions) || {},
            history: unwrap(history) || [],
        };
    },

    async testConnection() {
        const config = this.getConfig();

        if (!config.token) {
            return { success: false, message: 'توکن وارد نشده است' };
        }

        try {
            await this.request('/user');
        } catch (e) {
            return { success: false, message: 'توکن نامعتبر: ' + e.message };
        }

        if (!config.owner || !config.repo) {
            return { success: false, message: 'نام کاربری یا مخزن وارد نشده' };
        }

        try {
            const repoInfo = await this.request(
                `/repos/${config.owner}/${config.repo}`
            );

            const defaultBranch = repoInfo.default_branch || 'main';

            // اگر شاخه کاربر پیدا نشد، شاخه پیش‌فرض را ذخیره کن
            const userBranch = config.branch;
            if (userBranch && userBranch !== defaultBranch) {
                try {
                    await this.request(
                        `/repos/${config.owner}/${config.repo}/branches/${userBranch}`
                    );
                } catch (e) {
                    // شاخه کاربر وجود ندارد، شاخه پیش‌فرض را ذخیره کن
                    AppState.set('settings.githubBranch', defaultBranch);
                    try {
                        if (SQLStorage.isReady) {
                            SQLStorage.setSetting('githubBranch', defaultBranch);
                        }
                    } catch (err) {}
                    return {
                        success: true,
                        message: `اتصال موفق. شاخه «${userBranch}» نبود، شاخه «${defaultBranch}» تنظیم شد.`,
                    };
                }
            }

            return {
                success: true,
                message: `اتصال کامل: ${repoInfo.full_name} (شاخه: ${defaultBranch})`,
            };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },
};

window.GitHubStorage = GitHubStorage;