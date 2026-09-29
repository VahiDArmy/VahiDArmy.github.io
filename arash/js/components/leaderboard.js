/* ============================================
   جدول حرفه‌ای مشارکت‌کنندگان
   نسخه ۲.۰ - با خروجی PNG بهینه برای فارسی
   استفاده از html-to-image (بهتر برای RTL)
   ============================================ */

const Leaderboard = {
    container: null,
    data: [],
    title: 'مشارکت‌کنندگان',
    subtitle: '',
    
    /**
     * رندر جدول
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.data = options.data || [];
        this.title = options.title || 'مشارکت‌کنندگان';
        this.subtitle = options.subtitle || '';
        
        this.container.innerHTML = `
            <div class="leaderboard-wrapper" id="lb-wrapper">
                
                <!-- هدر -->
                <div class="leaderboard-header">
                    <div class="lb-header-content">
                        <div class="lb-header-icon">
                            <i class="ri-trophy-fill"></i>
                        </div>
                        <div class="lb-header-text">
                            <h2 class="lb-title">${Helpers.escapeHtml(this.title)}</h2>
                            ${this.subtitle ? `<p class="lb-subtitle">${Helpers.escapeHtml(this.subtitle)}</p>` : ''}
                        </div>
                    </div>
                    
                    <button class="lb-download-btn" id="lb-download" title="دانلود تصویر">
                        <i class="ri-download-2-line"></i>
                        <span>PNG</span>
                    </button>
                </div>
                
                <!-- جدول -->
                <div class="leaderboard-table" id="lb-table">
                    
                    <!-- سرستون‌ها -->
                    <div class="lb-row lb-row-head">
                        <div class="lb-cell lb-cell-row">
                            <span>ردیف</span>
                        </div>
                        <div class="lb-cell lb-cell-name">
                            <span>نام</span>
                        </div>
                        <div class="lb-cell lb-cell-amount">
                            <span>مبلغ</span>
                        </div>
                    </div>
                    
                    <!-- ردیف‌ها -->
                    <div class="lb-rows" id="lb-rows">
                        ${this.renderRows()}
                    </div>
                </div>
                
                <!-- فوتر -->
                <div class="leaderboard-footer">
                    <div class="lb-footer-stats">
                        <div class="lb-stat">
                            <i class="ri-user-line"></i>
                            <span><strong>${Format.number(this.data.length)}</strong> نفر</span>
                        </div>
                        <div class="lb-stat">
                            <i class="ri-money-dollar-circle-line"></i>
                            <span>مجموع: <strong>${Format.price(this.getTotal())}</strong></span>
                        </div>
                    </div>
                    <div class="lb-footer-brand">
                        <i class="ri-heart-2-fill"></i>
                        <span>شادباش ازدواج</span>
                    </div>
                </div>
            </div>
        `;
        
        this.attachEvents();
    },
    
    /**
     * رندر ردیف‌ها
     */
    renderRows() {
        if (this.data.length === 0) {
            return `
                <div class="lb-empty">
                    <i class="ri-inbox-line"></i>
                    <p>هنوز مشارکتی ثبت نشده است</p>
                </div>
            `;
        }
        
        return this.data.map((item, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `lb-rank-${rank}` : '';
            const isTop = rank <= 3;
            
            return `
                <div class="lb-row ${isTop ? 'lb-row-top' : ''}">
                    <div class="lb-cell lb-cell-row">
                        <div class="lb-rank ${rankClass}">
                            ${isTop 
                                ? `<i class="ri-medal-fill"></i>` 
                                : `<span>${Format.number(rank)}</span>`
                            }
                        </div>
                    </div>
                    <div class="lb-cell lb-cell-name">
                        <span class="lb-name">${Helpers.escapeHtml(item.name || '—')}</span>
                    </div>
                    <div class="lb-cell lb-cell-amount">
                        <span class="lb-amount">${Format.price(item.amount || 0)}</span>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * مجموع مبالغ
     */
    getTotal() {
        return this.data.reduce((sum, item) => sum + (item.amount || 0), 0);
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        const downloadBtn = document.getElementById('lb-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPNG());
        }
    },
    
    /**
     * دانلود PNG
     */
    async downloadPNG() {
        const btn = document.getElementById('lb-download');
        const originalHTML = btn.innerHTML;
        
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = `<i class="ri-loader-4-line"></i><span>...</span>`;
        
        try {
            // ✅ ۱. اطمینان از بارگذاری کامل فونت وزیرمتن
            await this.waitForFonts();
            
            // ✅ ۲. اطمینان از بارگذاری html-to-image
            await this.ensureHtmlToImage();
            
            const wrapper = document.getElementById('lb-wrapper');
            
            // ✅ ۳. مخفی کردن دکمه دانلود به صورت موقت
            const downloadBtnEl = wrapper.querySelector('.lb-download-btn');
            const originalVisibility = downloadBtnEl?.style.visibility;
            if (downloadBtnEl) {
                downloadBtnEl.style.visibility = 'hidden';
            }
            
            // ✅ ۴. صبر کوتاه برای اعمال تغییرات
            await Helpers.delay(150);
            
            // ✅ ۵. تبدیل به PNG با html-to-image
            const dataUrl = await htmlToImage.toPng(wrapper, {
                quality: 1.0,
                pixelRatio: 3,
                backgroundColor: '#FFFFFF',
                cacheBust: true,
                skipFonts: false,
                
                // ✅ مخفی کردن دکمه دانلود در کلون نهایی
                filter: (node) => {
                    if (node.classList && node.classList.contains('lb-download-btn')) {
                        return false;
                    }
                    return true;
                },
                
                // ✅ استایل‌های اضافی برای کلون
                style: {
                    direction: 'rtl',
                    fontFamily: "'Vazirmatn', -apple-system, sans-serif"
                },
                
                // ✅ کیفیت و اندازه
                width: wrapper.offsetWidth,
                height: wrapper.offsetHeight
            });
            
            // ✅ ۶. بازگرداندن دکمه
            if (downloadBtnEl) {
                downloadBtnEl.style.visibility = originalVisibility || '';
            }
            
            // ✅ ۷. دانلود فایل
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `shadbash-leaderboard-${timestamp}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            Toast.success('دانلود شد', 'تصویر جدول با موفقیت ذخیره شد');
            
        } catch (error) {
            console.error('خطا در تولید PNG:', error);
            Toast.error('خطا', 'خطا در تولید تصویر. لطفاً مجدداً تلاش کنید.');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    },
    
    /**
     * ✅ انتظار برای بارگذاری کامل فونت‌ها
     */
    async waitForFonts() {
        // بارگذاری صریح فونت وزیرمتن در سایزهای مختلف
        if (document.fonts && document.fonts.load) {
            try {
                await Promise.all([
                    document.fonts.load('700 16px Vazirmatn'),
                    document.fonts.load('900 24px Vazirmatn'),
                    document.fonts.load('400 14px Vazirmatn'),
                    document.fonts.load('500 16px Vazirmatn'),
                    document.fonts.load('bold 16px Vazirmatn'),
                    document.fonts.load('normal 14px Vazirmatn')
                ]);
            } catch (e) {
                console.warn('خطا در بارگذاری فونت:', e);
            }
        }
        
        // انتظار برای همه فونت‌ها
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        
        // صبر کوتاه اضافی برای اطمینان
        await Helpers.delay(200);
    },
    
    /**
     * ✅ اطمینان از بارگذاری html-to-image
     */
    async ensureHtmlToImage() {
        if (typeof htmlToImage !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('خطا در بارگذاری html-to-image'));
            document.head.appendChild(script);
        });
    },
    
    /**
     * به‌روزرسانی داده
     */
    setData(newData) {
        this.data = newData;
        const rowsContainer = document.getElementById('lb-rows');
        if (rowsContainer) {
            rowsContainer.innerHTML = this.renderRows();
        }
        
        const statEls = document.querySelectorAll('.lb-stat strong');
        if (statEls[0]) statEls[0].textContent = Format.number(this.data.length);
        if (statEls[1]) statEls[1].textContent = Format.price(this.getTotal());
    }
};