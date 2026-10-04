/**
 * ذخیره‌سازی در GitHub
 * @module githubStorage
 */

const GitHubStorage = {
    baseUrl: 'https://api.github.com',

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
        if (!branch) branch = 'main';

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
            console.error('❌ خطای شبکه:', networkError);
            throw new Error(
                `اتصال به GitHub برقرار نشد. بررسی کنید:\n` +
                `• اتصال اینترنت\n` +
                `• VPN (ممکن است GitHub را بلاک کند)\n` +
                `• نام کاربری/مخزن: ${config.owner}/${config.repo}`
            );
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`پاسخ نامعتبر از GitHub (کد ${response.status})`);
        }

        if (!response.ok) {
            const msg = data?.message || `خطای ${response.status}`;
            const isSecretError = /secret|scanning|repository rule/i.test(msg);

            if (isSecretError) {
                throw new Error(
                    `GitHub اجازه ذخیره را نداد (کد ${response.status}):\n` +
                    `دلیل: شناسایی اطلاعات حساس (Secret)\n` +
                    `این خطا از سیاست امنیتی مخزن است.`
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

    async getFileSha(path) {
        const config = this.getConfig();
        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
            );
            return data.sha || null;
        } catch (e) {
            return null;
        }
    },

    async getFile(path) {
        const config = this.getConfig();
        try {
            const data = await this.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
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
        const encodedContent = btoa(
            unescape(encodeURIComponent(JSON.stringify(content, null, 2)))
        );

        let sha = await this.getFileSha(path);

        const body = {
            message,
            content: encodedContent,
            branch: config.branch,
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

            // ⚠️ روی خطای Secret هرگز retry نکن
            if (is409 && !isSecretError && attempt <= 2) {
                console.log(`⚠️ تداخل نسخه - تلاش مجدد (${attempt}/2)...`);
                await Utils.delay(800 * attempt);
                return await this.saveFile(path, content, message, attempt + 1);
            }

            throw error;
        }
    },

    async saveBinaryFile(path, base64Content, message = 'به‌روزرسانی فایل باینری', attempt = 1) {
        const config = this.getConfig();
        let sha = await this.getFileSha(path);

        const body = {
            message,
            content: base64Content,
            branch: config.branch,
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

            // ⚠️ روی خطای Secret هرگز retry نکن
            if (is409 && !isSecretError && attempt <= 2) {
                console.log(`⚠️ تداخل فایل باینری - تلاش مجدد (${attempt}/2)...`);
                await Utils.delay(800 * attempt);
                return await this.saveBinaryFile(path, base64Content, message, attempt + 1);
            }

            throw error;
        }
    },

    async savePeople(people) {
        return await this.saveFile('data/people.json', people, 'به‌روزرسانی لیست افراد');
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
            return { success: false, message: 'توکن GitHub وارد نشده است' };
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

            try {
                await this.request(
                    `/repos/${config.owner}/${config.repo}/branches/${config.branch}`
                );
            } catch (e) {
                return {
                    success: false,
                    message: `شاخه «${config.branch}» پیدا نشد. main یا master`,
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
};

window.GitHubStorage = GitHubStorage;