/**
 * منطق صفحه تنظیمات
 * @module settingsPage
 */

const SettingsPage = {
    /**
     * راه‌اندازی
     */
    init() {
        this._loadSettings();
        this._initGitHubSection();
        this._initOpenRouterSection();
        this._initDatabaseSection();
        this._initGeneralSection();
        this._initDangerSection();
    },

    /**
     * بارگذاری تنظیمات فعلی
     */
    _loadSettings() {
        const s = AppState.get('settings');

        this._setValue('input-github-token', s.githubToken);
        this._setValue('input-github-username', s.githubUsername);
        this._setValue('input-github-repo', s.githubRepo);
        this._setValue('input-openrouter-key', s.openrouterApiKey);
        this._setValue('input-ai-model', s.aiModel);
        this._setValue('input-ai-temp', s.aiTemperature);
        this._setValue('input-system-prompt', s.aiSystemPrompt);
        this._setChecked('toggle-particles', s.particlesEnabled);
        this._setChecked('toggle-confetti', s.confettiEnabled);
        this._setChecked('toggle-auto-sync', s.autoSync);
        this._setValue('input-sync-interval', Math.round((s.syncInterval || 60000) / 1000));
    },

    /**
     * بخش GitHub
     */
    _initGitHubSection() {
        const saveBtn = document.getElementById('save-github-btn');
        const testBtn = document.getElementById('test-github-btn');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const settings = {
                    githubToken: this._getValue('input-github-token'),
                    githubUsername: this._getValue('input-github-username'),
                    githubRepo: this._getValue('input-github-repo'),
                };

                if (!settings.githubToken || !settings.githubUsername || !settings.githubRepo) {
                    Notification.warning('همه فیلدها الزامی است');
                    return;
                }

                Object.entries(settings).forEach(([k, v]) => {
                    AppState.set(`settings.${k}`, v);
                    SQLStorage.setSetting(k, v);
                });

                Notification.success('تنظیمات GitHub ذخیره شد');
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                testBtn.textContent = 'در حال تست...';

                // ذخیره موقت
                AppState.set('settings.githubToken', this._getValue('input-github-token'));
                AppState.set('settings.githubUsername', this._getValue('input-github-username'));
                AppState.set('settings.githubRepo', this._getValue('input-github-repo'));

                const result = await Sync.testGitHubConnection();
                if (result.success) {
                    Notification.success(result.message);
                } else {
                    Notification.error(result.message);
                }

                testBtn.disabled = false;
                testBtn.textContent = 'تست اتصال';
            });
        }
    },

    /**
     * بخش OpenRouter
     */
    _initOpenRouterSection() {
        const saveBtn = document.getElementById('save-openrouter-btn');
        const testBtn = document.getElementById('test-openrouter-btn');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const settings = {
                    openrouterApiKey: this._getValue('input-openrouter-key'),
                    aiModel: this._getValue('input-ai-model') || 'openrouter/free',
                    aiTemperature: parseFloat(this._getValue('input-ai-temp')) || 0.8,
                    aiSystemPrompt: this._getValue('input-system-prompt'),
                };

                Object.entries(settings).forEach(([k, v]) => {
                    AppState.set(`settings.${k}`, v);
                    SQLStorage.setSetting(k, v);
                });

                Notification.success('تنظیمات هوش مصنوعی ذخیره شد');
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                testBtn.textContent = 'در حال تست...';

                AppState.set('settings.openrouterApiKey', this._getValue('input-openrouter-key'));

                const ok = await OpenRouter.testConnection();
                if (ok) {
                    Notification.success('اتصال به OpenRouter برقرار است');
                } else {
                    Notification.error('خطا در اتصال - کلید را بررسی کنید');
                }

                testBtn.disabled = false;
                testBtn.textContent = 'تست اتصال';
            });
        }
    },

    /**
     * بخش دیتابیس
     */
    _initDatabaseSection() {
        this._renderDbInfo();

        const pushBtn = document.getElementById('db-push-github');
        if (pushBtn) {
            pushBtn.addEventListener('click', async () => {
                if (!GitHubStorage.isConfigured()) {
                    Notification.warning('ابتدا تنظیمات GitHub را وارد کنید');
                    return;
                }

                pushBtn.disabled = true;
                pushBtn.textContent = 'در حال ارسال...';

                try {
                    await SQLStorage.pushToGitHub('ارسال دستی از تنظیمات');
                    this._renderDbInfo();
                } catch (e) {
                    Notification.error('خطا: ' + e.message);
                } finally {
                    pushBtn.disabled = false;
                    pushBtn.textContent = '☁️ ارسال به GitHub';
                }
            });
        }

        const pullBtn = document.getElementById('db-pull-github');
        if (pullBtn) {
            pullBtn.addEventListener('click', async () => {
                if (!GitHubStorage.isConfigured()) {
                    Notification.warning('ابتدا تنظیمات GitHub را وارد کنید');
                    return;
                }

                const ok = await Modal.confirm(
                    'دیتابیس محلی با نسخه GitHub جایگزین شود؟',
                    { danger: true }
                );
                if (!ok) return;

                pullBtn.disabled = true;
                pullBtn.textContent = 'در حال دریافت...';

                try {
                    await SQLStorage.pullFromGitHub();
                    // رفرش state
                    App._loadDataFromSQL();
                    this._renderDbInfo();
                    Notification.success('داده‌ها بازنشانی شدند');
                } catch (e) {
                    Notification.error('خطا: ' + e.message);
                } finally {
                    pullBtn.disabled = false;
                    pullBtn.textContent = '⬇️ دریافت از GitHub';
                }
            });
        }

        const downloadBtn = document.getElementById('db-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                SQLStorage.downloadDatabase();
                Notification.success('فایل دیتابیس دانلود شد');
            });
        }

        const uploadInput = document.getElementById('db-upload');
        if (uploadInput) {
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const ok = await Modal.confirm('دیتابیس فعلی با فایل انتخابی جایگزین شود؟', { danger: true });
                if (!ok) return;

                try {
                    await SQLStorage.loadFromFile(file);
                    App._loadDataFromSQL();
                    this._renderDbInfo();
                } catch (err) {
                    Notification.error('خطا در بارگذاری: ' + err.message);
                }
            });
        }

        const resetBtn = document.getElementById('db-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm(
                    '⚠️ کل دیتابیس پاک شود؟ این عمل غیرقابل بازگشت است!',
                    { danger: true, confirmLabel: 'بله، پاک کن' }
                );
                if (ok) {
                    await SQLStorage.reset();
                    App._loadDataFromSQL();
                    this._renderDbInfo();
                }
            });
        }
    },

    /**
     * نمایش اطلاعات دیتابیس
     */
    _renderDbInfo() {
        const container = document.getElementById('db-info');
        if (!container) return;

        const info = SQLStorage.getInfo();
        if (!info) {
            container.innerHTML = '<p class="text-muted">دیتابیس بارگذاری نشده</p>';
            return;
        }

        container.innerHTML = `
            <div class="db-info-grid">
                <div class="db-info-item">
                    <div class="db-info-label">حجم فایل</div>
                    <div class="db-info-value">${info.sizeFormatted}</div>
                </div>
                <div class="db-info-item">
                    <div class="db-info-label">افراد</div>
                    <div class="db-info-value">${Utils.toPersianNumbers(info.peopleCount)}</div>
                </div>
                <div class="db-info-item">
                    <div class="db-info-label">آیتم‌ها</div>
                    <div class="db-info-value">${Utils.toPersianNumbers(info.itemsCount)}</div>
                </div>
                <div class="db-info-item">
                    <div class="db-info-label">چرخش‌ها</div>
                    <div class="db-info-value">${Utils.toPersianNumbers(info.historyCount)}</div>
                </div>
                <div class="db-info-item">
                    <div class="db-info-label">داستان‌ها</div>
                    <div class="db-info-value">${Utils.toPersianNumbers(info.storiesCount)}</div>
                </div>
            </div>
        `;
    },

    /**
     * بخش تنظیمات عمومی
     */
    _initGeneralSection() {
        const particlesToggle = document.getElementById('toggle-particles');
        if (particlesToggle) {
            particlesToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                AppState.set('settings.particlesEnabled', enabled);
                SQLStorage.setSetting('particlesEnabled', enabled);
                if (enabled) Particles.init('particles-canvas');
                else Particles.stop();
            });
        }

        const confettiToggle = document.getElementById('toggle-confetti');
        if (confettiToggle) {
            confettiToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                AppState.set('settings.confettiEnabled', enabled);
                SQLStorage.setSetting('confettiEnabled', enabled);
            });
        }

        const autoSyncToggle = document.getElementById('toggle-auto-sync');
        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                AppState.set('settings.autoSync', enabled);
                SQLStorage.setSetting('autoSync', enabled);
                if (enabled) Sync.startAutoSync();
                else Sync.stopAutoSync();
            });
        }

        const syncInterval = document.getElementById('input-sync-interval');
        if (syncInterval) {
            syncInterval.addEventListener('change', (e) => {
                const seconds = parseInt(e.target.value) || 60;
                const ms = seconds * 1000;
                AppState.set('settings.syncInterval', ms);
                SQLStorage.setSetting('syncInterval', ms);
                if (AppState.get('settings.autoSync')) {
                    Sync.stopAutoSync();
                    Sync.startAutoSync();
                }
            });
        }
    },

    /**
     * بخش خطرناک
     */
    _initDangerSection() {
        const clearAllBtn = document.getElementById('clear-all-data');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm(
                    '⚠️ تمام داده‌ها (افراد، آیتم‌ها، تاریخچه، داستان‌ها) پاک شود؟',
                    { danger: true, confirmLabel: 'بله، همه را پاک کن' }
                );
                if (ok) {
                    await SQLStorage.reset();
                    App._loadDataFromSQL();
                    this._renderDbInfo();
                    Notification.success('همه داده‌ها پاک شدند');
                }
            });
        }
    },

    /**
     * کمک‌کننده‌ها
     */
    _setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    },

    _getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    },

    _setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
    },
};

if (document.getElementById('db-info')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => SettingsPage.init(), 500);
    });
}

window.SettingsPage = SettingsPage;