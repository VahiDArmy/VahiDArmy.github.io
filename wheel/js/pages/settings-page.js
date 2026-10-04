/**
 * منطق صفحه تنظیمات
 * @module settingsPage
 */

const SettingsPage = {
    DEFAULT_MODEL: 'google/gemini-2.0-flash-exp:free',

    init() {
        this._loadSettings();
        this._initGitHubSection();
        this._initOpenRouterSection();
        this._initModelDropdown();
        this._initFetchModelsButton();
        this._initTemperatureSlider();
        this._initDatabaseSection();
        this._initGeneralSection();
        this._initDangerSection();
    },

    _loadSettings() {
        const s = AppState.get('settings');

        this._setValue('input-github-token', s.githubToken);
        this._setValue('input-github-username', s.githubUsername);
        this._setValue('input-github-repo', s.githubRepo);

        let branch = s.githubBranch;
        if (!branch) {
            branch = LocalStorage.get('secret_githubBranch', null) ||
                     LocalStorage.get('githubBranch', null) ||
                     'main';
        }
        this._setValue('input-github-branch', branch);

        this._setValue('input-openrouter-key', s.openrouterApiKey);
        this._setValue('input-system-prompt', s.aiSystemPrompt);

        const savedModel = s.aiModel || this.DEFAULT_MODEL;
        this._selectModel(savedModel);

        const tempSlider = document.getElementById('input-ai-temp');
        if (tempSlider) {
            const tempVal = typeof s.aiTemperature === 'number' ? s.aiTemperature : 0.9;
            tempSlider.value = tempVal;
            this._updateTempDisplay(tempVal);
        }

        this._setChecked('toggle-particles', s.particlesEnabled);
        this._setChecked('toggle-confetti', s.confettiEnabled);
        this._setChecked('toggle-auto-sync', s.autoSync);
        this._setValue('input-sync-interval', Math.round((s.syncInterval || 60000) / 1000));
    },

    _selectModel(modelId) {
        const select = document.getElementById('input-ai-model');
        const customRow = document.getElementById('custom-model-row');
        const customInput = document.getElementById('input-custom-model');

        if (!select) return;

        const optionExists = Array.from(select.options).some((opt) => opt.value === modelId);

        if (optionExists && modelId !== 'custom') {
            select.value = modelId;
            if (customRow) customRow.style.display = 'none';
        } else {
            select.value = 'custom';
            if (customRow) customRow.style.display = 'block';
            if (customInput) customInput.value = modelId || '';
        }
    },

    _getSelectedModel() {
        const select = document.getElementById('input-ai-model');
        if (!select) return '';

        if (select.value === 'custom') {
            const customInput = document.getElementById('input-custom-model');
            return customInput ? customInput.value.trim() : '';
        }
        return select.value;
    },

    _initModelDropdown() {
        const select = document.getElementById('input-ai-model');
        const customRow = document.getElementById('custom-model-row');

        if (!select) return;

        select.addEventListener('change', () => {
            if (select.value === 'custom') {
                if (customRow) customRow.style.display = 'block';
                const customInput = document.getElementById('input-custom-model');
                if (customInput) customInput.focus();
            } else {
                if (customRow) customRow.style.display = 'none';
            }
        });
    },

    _initFetchModelsButton() {
        const btn = document.getElementById('fetch-models-btn');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = 'در حال دریافت...';

            try {
                const allModels = await OpenRouter.getModels();

                if (!allModels || allModels.length === 0) {
                    Notification.warning('لیست خالی دریافت شد');
                    return;
                }

                const freeModels = allModels.filter((m) => {
                    if (!m || !m.id) return false;
                    const promptPrice = parseFloat(m.pricing?.prompt || '0');
                    const completionPrice = parseFloat(m.pricing?.completion || '0');
                    return promptPrice === 0 && completionPrice === 0;
                });

                if (freeModels.length === 0) {
                    Notification.warning('مدل رایگانی یافت نشد');
                    return;
                }

                this._showModelsModal(freeModels);
            } catch (error) {
                Logger.error('SettingsPage.fetchModels', error);
                Notification.error('خطا در دریافت لیست: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    },

    _showModelsModal(freeModels) {
        // مرتب‌سازی: اول Google، بعد بقیه
        const sorted = [...freeModels].sort((a, b) => {
            const aGoogle = a.id && a.id.startsWith('google/') ? 0 : 1;
            const bGoogle = b.id && b.id.startsWith('google/') ? 0 : 1;
            if (aGoogle !== bGoogle) return aGoogle - bGoogle;
            return (a.name || a.id).localeCompare(b.name || b.id);
        });

        const content = `
            <div class="models-fetch-list">
                <p class="text-muted" style="margin-bottom: 12px;">
                    ${Utils.toPersianNumbers(sorted.length)} مدل رایگان در OpenRouter یافت شد
                </p>
                <input type="text" id="models-modal-search" class="input" placeholder="🔍 جستجو..." style="margin-bottom: 12px;">
                <div class="models-fetch-scroll" id="models-fetch-scroll">
                    ${sorted.map((m) => {
                        const isGoogle = m.id && m.id.startsWith('google/');
                        return `
                            <div class="models-fetch-item ${isGoogle ? 'is-google' : ''}" data-model-id="${this._escapeAttr(m.id)}" data-name="${this._escapeAttr((m.name || '').toLowerCase())}">
                                <div class="models-fetch-info">
                                    <div class="models-fetch-name">
                                        ${isGoogle ? '🌟 ' : ''}${this._escape(m.name || m.id)}
                                    </div>
                                    <div class="models-fetch-id"><code>${this._escape(m.id)}</code></div>
                                    ${m.context_length ? `<div class="models-fetch-meta">📏 ${Utils.toPersianNumbers(m.context_length)} توکن</div>` : ''}
                                </div>
                                <button class="btn btn-primary btn-sm" data-action="use" data-id="${this._escapeAttr(m.id)}" type="button">استفاده</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        Modal.open({
            title: '🌟 مدل‌های رایگان OpenRouter (لیست زنده)',
            content,
            size: 'lg',
            buttons: [{ label: 'بستن', class: 'btn-secondary' }],
        });

        setTimeout(() => {
            const searchInput = document.getElementById('models-modal-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    document.querySelectorAll('.models-fetch-item').forEach((item) => {
                        const name = item.dataset.name || '';
                        const id = (item.dataset.modelId || '').toLowerCase();
                        item.style.display = (name.includes(q) || id.includes(q)) ? '' : 'none';
                    });
                });
            }

            document.querySelectorAll('[data-action="use"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const modelId = btn.dataset.id;
                    this._selectModel(modelId);
                    this._saveField('aiModel', modelId);
                    Notification.success(`مدل انتخاب شد: ${modelId}`);
                    Modal.closeAll();
                });
            });
        }, 100);
    },

    _saveField(key, value) {
        AppState.set(`settings.${key}`, value);
        try {
            if (SQLStorage.isReady) SQLStorage.setSetting(key, value);
        } catch (e) {}
    },

    _initGitHubSection() {
        const saveBtn = document.getElementById('save-github-btn');
        const testBtn = document.getElementById('test-github-btn');
        const branchInput = document.getElementById('input-github-branch');

        if (branchInput) {
            branchInput.addEventListener('blur', () => {
                const v = branchInput.value.trim();
                if (v) this._saveField('githubBranch', v);
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                let username = this._getValue('input-github-username');
                let repo = this._getValue('input-github-repo');
                let branch = this._getValue('input-github-branch') || 'main';

                if (username.includes('/') && !repo) {
                    const parts = username.split('/').filter(Boolean);
                    if (parts.length >= 2) {
                        username = parts[0];
                        repo = parts[1];
                        this._setValue('input-github-username', username);
                        this._setValue('input-github-repo', repo);
                    }
                }

                const token = this._getValue('input-github-token');
                if (!token || !username || !repo) {
                    Notification.warning('فیلدهای ستاره‌دار الزامی هستند');
                    return;
                }

                this._saveField('githubToken', token);
                this._saveField('githubUsername', username);
                this._saveField('githubRepo', repo);
                this._saveField('githubBranch', branch);

                Notification.success('تنظیمات GitHub ذخیره شد');
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                const originalText = testBtn.textContent;
                testBtn.textContent = 'در حال تست...';

                let username = this._getValue('input-github-username');
                let repo = this._getValue('input-github-repo');
                let branch = this._getValue('input-github-branch') || 'main';

                if (username.includes('/') && !repo) {
                    const parts = username.split('/').filter(Boolean);
                    if (parts.length >= 2) {
                        username = parts[0];
                        repo = parts[1];
                        this._setValue('input-github-username', username);
                        this._setValue('input-github-repo', repo);
                    }
                }

                this._saveField('githubToken', this._getValue('input-github-token'));
                this._saveField('githubUsername', username);
                this._saveField('githubRepo', repo);
                this._saveField('githubBranch', branch);

                try {
                    const result = await GitHubStorage.testConnection();
                    if (result.success) {
                        Notification.success(result.message, 8000);
                        const newBranch = AppState.get('settings.githubBranch');
                        if (newBranch) this._setValue('input-github-branch', newBranch);
                    } else {
                        Notification.error(result.message, 12000);
                    }
                } catch (e) {
                    Notification.error('خطا: ' + e.message, 10000);
                }

                testBtn.disabled = false;
                testBtn.textContent = originalText;
            });
        }
    },

    _initOpenRouterSection() {
        const saveBtn = document.getElementById('save-openrouter-btn');
        const testBtn = document.getElementById('test-openrouter-btn');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const modelValue = this._getSelectedModel();
                if (!modelValue) {
                    Notification.warning('یک مدل انتخاب کنید');
                    return;
                }

                this._saveField('openrouterApiKey', this._getValue('input-openrouter-key'));
                this._saveField('aiModel', modelValue);
                this._saveField('aiTemperature', parseFloat(this._getValue('input-ai-temp')) || 0.9);
                this._saveField('aiSystemPrompt', this._getValue('input-system-prompt'));

                Notification.success(`تنظیمات ذخیره شد - مدل: ${modelValue}`);
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                testBtn.disabled = true;
                const originalText = testBtn.textContent;
                testBtn.textContent = 'در حال تست...';

                const modelValue = this._getSelectedModel();
                if (!modelValue) {
                    Notification.warning('یک مدل انتخاب کنید');
                    testBtn.disabled = false;
                    testBtn.textContent = originalText;
                    return;
                }

                this._saveField('openrouterApiKey', this._getValue('input-openrouter-key'));
                this._saveField('aiModel', modelValue);
                this._saveField('aiTemperature', parseFloat(this._getValue('input-ai-temp')) || 0.9);

                try {
                    const result = await OpenRouter.testConnection();
                    if (result.success) {
                        Notification.success(result.message, 8000);
                    } else {
                        Notification.error(result.message, 12000);
                    }
                } catch (e) {
                    Notification.error('خطای غیرمنتظره: ' + e.message, 10000);
                }

                testBtn.disabled = false;
                testBtn.textContent = originalText;
            });
        }
    },

    _initTemperatureSlider() {
        const tempSlider = document.getElementById('input-ai-temp');
        if (!tempSlider) return;

        tempSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0.9;
            this._updateTempDisplay(val);
        });

        tempSlider.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value) || 0.9;
            this._saveField('aiTemperature', val);
        });
    },

    _updateTempDisplay(val) {
        const el = document.getElementById('temp-value');
        if (!el) return;
        el.textContent = Utils.toPersianNumbers(val.toFixed(1));
    },

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
                    await SQLStorage.pushToGitHub('ارسال دستی');
                    this._renderDbInfo();
                } catch (e) {
                    Notification.error(e.message, 12000);
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

                const ok = await Modal.confirm('دیتابیس محلی با نسخه GitHub جایگزین شود؟', { danger: true });
                if (!ok) return;

                pullBtn.disabled = true;
                pullBtn.textContent = 'در حال دریافت...';

                try {
                    await SQLStorage.pullFromGitHub();
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._renderDbInfo();
                    Notification.success('داده‌ها بازنشانی شدند');
                } catch (e) {
                    Notification.error(e.message, 12000);
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

                const ok = await Modal.confirm('دیتابیس فعلی جایگزین شود؟', { danger: true });
                if (!ok) { uploadInput.value = ''; return; }

                try {
                    await SQLStorage.loadFromFile(file);
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._renderDbInfo();
                } catch (err) {
                    Notification.error('خطا: ' + err.message);
                } finally {
                    uploadInput.value = '';
                }
            });
        }

        const resetBtn = document.getElementById('db-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm('کل دیتابیس پاک شود؟', { danger: true });
                if (ok) {
                    await SQLStorage.reset();
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._renderDbInfo();
                }
            });
        }
    },

    _renderDbInfo() {
        const container = document.getElementById('db-info');
        if (!container) return;

        try {
            const info = SQLStorage.getInfo();
            if (!info) {
                container.innerHTML = '<p class="text-muted">در حال بارگذاری...</p>';
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

    _initGeneralSection() {
        const particlesToggle = document.getElementById('toggle-particles');
        if (particlesToggle) {
            particlesToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this._saveField('particlesEnabled', enabled);
                if (enabled) Particles.init('particles-canvas');
                else Particles.stop();
            });
        }

        const confettiToggle = document.getElementById('toggle-confetti');
        if (confettiToggle) {
            confettiToggle.addEventListener('change', (e) => {
                this._saveField('confettiEnabled', e.target.checked);
            });
        }

        const autoSyncToggle = document.getElementById('toggle-auto-sync');
        if (autoSyncToggle) {
            autoSyncToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this._saveField('autoSync', enabled);
                if (enabled) Sync.startAutoSync();
                else Sync.stopAutoSync();
            });
        }

        const syncInterval = document.getElementById('input-sync-interval');
        if (syncInterval) {
            syncInterval.addEventListener('change', (e) => {
                const seconds = parseInt(e.target.value) || 60;
                const ms = seconds * 1000;
                this._saveField('syncInterval', ms);
                if (AppState.get('settings.autoSync')) {
                    Sync.stopAutoSync();
                    Sync.startAutoSync();
                }
            });
        }
    },

    _initDangerSection() {
        const clearAllBtn = document.getElementById('clear-all-data');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm(
                    '⚠️ تمام داده‌ها پاک شود؟',
                    { danger: true, confirmLabel: 'بله، پاک کن' }
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

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    _escapeAttr(str) {
        return String(str || '')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
};

if (document.getElementById('db-info')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => SettingsPage.init(), 500);
    });
}

window.SettingsPage = SettingsPage;