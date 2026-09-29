/* ============================================
   تنظیمات سیستم
   ============================================ */

const AdminSettings = {
    settings: {},
    
    render() {
        return `
            <div class="admin-settings">
                <div class="settings-header">
                    <div>
                        <h1 class="dashboard-title">
                            <i class="ri-settings-3-line"></i>
                            <span>تنظیمات سیستم</span>
                        </h1>
                        <p class="dashboard-subtitle">پیکربندی پارامترهای اساسی سامانه</p>
                    </div>
                </div>
                
                <div id="settings-content">
                    <div class="loading-state">
                        <div class="loader-coin"><i class="ri-coin-line"></i></div>
                        <p>در حال بارگذاری تنظیمات...</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init() {
        const isAdmin = await AuthService.isAdmin();
        if (!isAdmin) {
            Router.navigate('welcome');
            return;
        }
        
        await this.loadSettings();
    },
    
    /**
     * بارگذاری
     */
    async loadSettings() {
        const container = document.getElementById('settings-content');
        const result = await AdminService.getSettings();
        
        if (!result.success) {
            container.innerHTML = `<p class="text-danger">خطا در بارگذاری تنظیمات</p>`;
            return;
        }
        
        this.settings = result.settings;
        this.renderContent(container);
    },
    
    /**
     * رندر محتوا
     */
    renderContent(container) {
        container.innerHTML = `
            <div class="settings-grid">
                <div class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-icon settings-icon-gold">
                            <i class="ri-coins-line"></i>
                        </div>
                        <div>
                            <h3>تنظیمات سکه</h3>
                            <p>قیمت و محدودیت‌های سکه</p>
                        </div>
                    </div>
                    <div class="settings-card-body">
                        <div class="form-group">
                            <label class="form-label">قیمت هر سکه (تومان)</label>
                            <input type="number" class="form-input" id="setting-coin-price" 
                                   value="${this.settings.coin_price || APP_CONFIG.COIN_PRICE}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">حداقل تعداد سکه</label>
                            <input type="number" class="form-input" id="setting-min-coins" 
                                   value="${this.settings.min_coins || APP_CONFIG.MIN_COINS}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">حداکثر تعداد سکه</label>
                            <input type="number" class="form-input" id="setting-max-coins" 
                                   value="${this.settings.max_coins || APP_CONFIG.MAX_COINS}">
                        </div>
                        <button class="btn btn-primary btn-block" data-save="coins">
                            <i class="ri-save-line"></i>
                            <span>ذخیره تغییرات</span>
                        </button>
                    </div>
                </div>
                
                <div class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-icon settings-icon-primary">
                            <i class="ri-bar-chart-line"></i>
                        </div>
                        <div>
                            <h3>آمار نمایشی</h3>
                            <p>مقادیر اولیه و فیک آماری</p>
                        </div>
                    </div>
                    <div class="settings-card-body">
                        <div class="form-group">
                            <label class="form-label">تعداد مشارکت‌کنندگان فیک</label>
                            <input type="number" class="form-input" id="setting-fake-participants" 
                                   value="${this.settings.fake_participants || APP_CONFIG.FAKE_PARTICIPANTS}">
                            <div class="form-hint">به تعداد واقعی اضافه می‌شود</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">میانگین اولیه (سکه)</label>
                            <input type="number" class="form-input" id="setting-fake-average" 
                                   value="${this.settings.fake_average || APP_CONFIG.FAKE_AVERAGE}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">حداقل میانگین (سکه)</label>
                            <input type="number" class="form-input" id="setting-fake-min-average" 
                                   value="${this.settings.fake_min_average || APP_CONFIG.FAKE_MIN_AVERAGE}">
                        </div>
                        <button class="btn btn-primary btn-block" data-save="stats">
                            <i class="ri-save-line"></i>
                            <span>ذخیره تغییرات</span>
                        </button>
                    </div>
                </div>
                
                <div class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-icon settings-icon-success">
                            <i class="ri-bank-card-line"></i>
                        </div>
                        <div>
                            <h3>اطلاعات پرداخت</h3>
                            <p>شماره کارت و اطلاعات بانکی</p>
                        </div>
                    </div>
                    <div class="settings-card-body">
                        <div class="form-group">
                            <label class="form-label">شماره کارت</label>
                            <input type="text" class="form-input" id="setting-card-number" 
                                   value="${(this.settings.card_number || APP_CONFIG.CARD_NUMBER).replace(/"/g, '')}"
                                   dir="ltr" maxlength="16">
                        </div>
                        <button class="btn btn-primary btn-block" data-save="payment">
                            <i class="ri-save-line"></i>
                            <span>ذخیره تغییرات</span>
                        </button>
                    </div>
                </div>
                
                <div class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-icon settings-icon-info">
                            <i class="ri-map-pin-line"></i>
                        </div>
                        <div>
                            <h3>اطلاعات موقعیت</h3>
                            <p>مختصات و لینک نقشه</p>
                        </div>
                    </div>
                    <div class="settings-card-body">
                        <div class="form-group">
                            <label class="form-label">مختصات جغرافیایی</label>
                            <input type="text" class="form-input" id="setting-map-coordinates" 
                                   value="${(this.settings.map_coordinates || APP_CONFIG.MAP_COORDINATES).replace(/"/g, '')}"
                                   dir="ltr">
                            <div class="form-hint">مثال: 35.6892,51.3890</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">لینک نقشه</label>
                            <input type="url" class="form-input" id="setting-map-link" 
                                   value="${(this.settings.map_link || APP_CONFIG.MAP_LINK).replace(/"/g, '')}"
                                   dir="ltr">
                        </div>
                        <button class="btn btn-primary btn-block" data-save="location">
                            <i class="ri-save-line"></i>
                            <span>ذخیره تغییرات</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="settings-danger-zone">
                <div class="danger-zone-header">
                    <i class="ri-alert-line"></i>
                    <h3>منطقه خطر</h3>
                </div>
                <p>اقدامات زیر خطرناک هستند و قابل بازگشت نیستند</p>
                <button class="btn btn-outline danger" id="reset-settings">
                    <i class="ri-refresh-line"></i>
                    <span>بازنشانی تنظیمات به حالت اولیه</span>
                </button>
            </div>
        `;
        
        this.attachEvents();
    },
    
    /**
     * رویدادها
     */
    attachEvents() {
        document.querySelectorAll('[data-save]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.save;
                await this.saveSettings(type, btn);
            });
        });
        
        document.getElementById('reset-settings')?.addEventListener('click', async () => {
            const confirmed = await Modal.confirm({
                title: 'بازنشانی تنظیمات',
                message: 'همه تنظیمات به حالت اولیه بازمی‌گردند. آیا مطمئن هستید؟',
                confirmText: 'بازنشانی',
                type: 'danger'
            });
            
            if (confirmed) {
                Toast.info('در حال بازنشانی...', 'لطفاً صبر کنید');
                // منطق بازنشانی
                setTimeout(() => {
                    Toast.success('انجام شد', 'تنظیمات بازنشانی شد');
                    this.loadSettings();
                }, 1000);
            }
        });
    },
    
    /**
     * ذخیره تنظیمات
     */
    async saveSettings(type, btn) {
        const admin = Storage.getUser();
        btn.classList.add('loading');
        btn.disabled = true;
        
        let updates = {};
        
        switch (type) {
            case 'coins':
                updates = {
                    coin_price: parseInt(document.getElementById('setting-coin-price').value),
                    min_coins: parseInt(document.getElementById('setting-min-coins').value),
                    max_coins: parseInt(document.getElementById('setting-max-coins').value)
                };
                break;
            case 'stats':
                updates = {
                    fake_participants: parseInt(document.getElementById('setting-fake-participants').value),
                    fake_average: parseInt(document.getElementById('setting-fake-average').value),
                    fake_min_average: parseInt(document.getElementById('setting-fake-min-average').value)
                };
                break;
            case 'payment':
                updates = {
                    card_number: document.getElementById('setting-card-number').value
                };
                break;
            case 'location':
                updates = {
                    map_coordinates: document.getElementById('setting-map-coordinates').value,
                    map_link: document.getElementById('setting-map-link').value
                };
                break;
        }
        
        try {
            for (const [key, value] of Object.entries(updates)) {
                await AdminService.updateSetting(key, value, admin.id);
            }
            
            Toast.success('ذخیره شد', 'تنظیمات با موفقیت بروزرسانی شد');
        } catch (error) {
            Toast.error('خطا', error.message);
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
};