/* ============================================
   جدول حرفه‌ای مشارکت‌کنندگان
   نسخه ۱.۰ - با خروجی PNG
   ============================================ */

const Leaderboard = {
    container: null,
    data: [],
    title: 'مشارکت‌کنندگان',
    subtitle: '',
    
    /**
     * رندر جدول
     * @param {string} containerId
     * @param {object} options - { title, subtitle, data: [{name, amount}] }
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
            // بارگذاری html2canvas اگر لازم است
            await this.ensureHtml2Canvas();
            
            const wrapper = document.getElementById('lb-wrapper');
            
            // ✅ آماده‌سازی برای عکس: حذف دکمه دانلود
            const downloadBtnEl = wrapper.querySelector('.lb-download-btn');
            if (downloadBtnEl) downloadBtnEl.style.visibility = 'hidden';
            
            const canvas = await html2canvas(wrapper, {
                scale: 3,
                backgroundColor: '#FFFFFF',
                logging: false,
                useCORS: true,
                allowTaint: true,
                windowWidth: wrapper.scrollWidth,
                windowHeight: wrapper.scrollHeight
            });
            
            // بازگرداندن دکمه
            if (downloadBtnEl) downloadBtnEl.style.visibility = 'visible';
            
            // دانلود
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `shadbash-participants-${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
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
     * اطمینان از بارگذاری html2canvas
     */
    async ensureHtml2Canvas() {
        if (typeof html2canvas !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
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
        
        // به‌روزرسانی فوتر
        const statEls = document.querySelectorAll('.lb-stat strong');
        if (statEls[0]) statEls[0].textContent = Format.number(this.data.length);
        if (statEls[1]) statEls[1].textContent = Format.price(this.getTotal());
    }
};