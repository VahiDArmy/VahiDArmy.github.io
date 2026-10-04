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
        this._initTemperatureSlider();
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
        this._setValue('input-ai-model', s.aiModel || 'meta-llama/llama-3.3-70b-instruct:free');
        this._setValue('input-system-prompt', s.aiSystemPrompt);

        // اسلایدر دما - با مقدار پیش‌فرض درست
        const tempSlider = document.getElementById('input-ai-temp');
        if (tempSlider) {
            const tempVal = typeof s.aiTemperature === 'number' ? s.aiTemperature : 0.8;
            tempSlider.value = tempVal;
            this._updateTempDisplay(tempVal);
        }

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
                    try {
                        if (SQLStorage.isReady) SQLStorage.setSetting(k, v);
                    } catch (e) {}
                });

                Notification.success('تنظیمات GitHub ذخیره شد');
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                const originalText = testBtn.textContent;
                testBtn.textContent = 'در حال تست...';

                AppState.set('settings.githubToken', this._getValue('input-github-token'));
                AppState.set('settings.githubUsername', this._getValue('input-github-username'));
                AppState.set('settings.githubRepo', this._getValue('input-github-repo'));

                try {
                    const result = await Sync.testGitHubConnection();
                    if (result.success) {
                        Notification.success(result.message);
                    } else {
                        Notification.error(result.message, 8000);
                    }
                } catch (e) {
                    Notification.error('خطا: ' + e.message, 8000);
                }

                testBtn.disabled = false;
                testBtn.textContent = originalText;
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
                let modelValue = this._getValue('input-ai-model');
                
                // اگر خالی یا اشتباه بود، پیش‌فرض بگذار
                if (!modelValue || modelValue === 'openrouter/free') {
                    modelValue = OpenRouter.DEFAULT_MODEL;
                    this._setValue('input-ai-model', modelValue);
                }

                const settings = {
                    openrouterApiKey: this._getValue('input-openrouter-key'),
                    aiModel: modelValue,
                    aiTemperature: parseFloat(this._getValue('input-ai-temp')) || 0.8,
                    aiSystemPrompt: this._getValue('input-system-prompt'),
                };

                Object.entries(settings).forEach(([k, v]) => {
                    AppState.set(`settings.${k}`, v);
                    try {
                        if (SQLStorage.isReady) SQLStorage.setSetting(k, v);
                    } catch (e) {}
                });

                Notification.success('تنظیمات هوش مصنوعی ذخیره شد');
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                const originalText = testBtn.textContent;
                testBtn.textContent = 'در حال تست...';

                // ذخیره‌ی موقت مقادیر در State
                let modelValue = this._getValue('input-ai-model');
                if (!modelValue || modelValue === 'openrouter/free') {
                    modelValue = OpenRouter.DEFAULT_MODEL;
                    this._setValue('input-ai-model', modelValue);
                }

                AppState.set('settings.openrouterApiKey', this._getValue('input-openrouter-key'));
                AppState.set('settings.aiModel', modelValue);
                AppState.set('settings.aiTemperature', parseFloat(this._getValue('input-ai-temp')) || 0.8);

                try {
                    const result = await OpenRouter.testConnection();
                    
                    if (result.success) {
                        Notification.success(result.message, 6000);
                    } else {
                        // نمایش خطای واقعی
                        Notification.error(result.message, 10000);
                        
                        // لاگ کامل در کنسول برای دیباگ
                        console.error('جزئیات خطا:', result.error);
                    }
                } catch (e) {
                    Notification.error('خطای غیرمنتظره: ' + e.message, 10000);
                    console.error(e);
                }

                testBtn.disabled = false;
                testBtn.textContent = originalText;
            });
        }
    },

    /**
     * اسلایدر دما - جداگانه و کامل
     */
    _initTemperatureSlider() {
        const tempSlider = document.getElementById('input-ai-temp');
        if (!tempSlider) return;

        // به‌روزرسانی نمایش مقدار هنگام کشیدن
        tempSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0.8;
            this._updateTempDisplay(val);
        });

        // ذخیره هنگام رها کردن
        tempSlider.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value) || 0.8;
            
            AppState.set('settings.aiTemperature', val);
            
            try {
                if (SQLStorage.isReady) {
                    SQLStorage.setSetting('aiTemperature', val);
                }
            } catch (err) {
                console.error('خطا در ذخیره دما:', err);
            }
        });
    },

    /**
     * به‌روزرسانی نمایش عدد دما
     */
    _updateTempDisplay(val) {
        const el = document.getElementById('temp-value');
        if (!el) return;
        el.textContent = Utils.toPersianNumbers(val.toFixed(1));
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
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
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

                const ok = await Modal.confirm(
                    'دیتابیس فعلی با فایل انتخابی جایگزین شود؟',
                    { danger: true }
                );
                if (!ok) {
                    uploadInput.value = '';
                    return;
                }

                try {
                    await SQLStorage.loadFromFile(file);
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._renderDbInfo();
                } catch (err) {
                    Notification.error('خطا در بارگذاری: ' + err.message);
                } finally {
                    uploadInput.value = '';
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
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
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

        try {
            const info = SQLStorage.getInfo();
            if (!info) {
                container.innerHTML = '<p class="text-muted">دیتابیس در حال بارگذاری است...</p>';
                setTimeout(() => this._renderDbInfo(), 1000);
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
        } catch (e) {
            container.innerHTML = '<p class="text-muted">دیتابیس در دسترس نیست</p>';
        }
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
                try {
                    if (SQLStorage.isReady) SQLStorage.setSetting('particlesEnabled', enabled);
                } catch (err) {}
                if (enabled) Particles.init('particles-canvas');
                else Particles.stop();
            });
        }

        const confettiToggle = document.getElementById('toggle-confetti');
        if (confettiToggle) {
            confettiToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                AppState.set('settings.confettiEnabled', enabled);
                try {
                    if (SQLStorage.isReady) SQLStorage.setSetting('confettiEnabled', enabled);
                } catch (err) {}
            });
        }

        const autoSyncToggle = document.getElementById('toggle-auto-sync');
        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                AppState.set('settings.autoSync', enabled);
                try {
                    if (SQLStorage.isReady) SQLStorage.setSetting('autoSync', enabled);
                } catch (err) {}
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
                try {
                    if (SQLStorage.isReady) SQLStorage.setSetting('syncInterval', ms);
                } catch (err) {}
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
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
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
        if (el) el.value = value == null ? '' : value;
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