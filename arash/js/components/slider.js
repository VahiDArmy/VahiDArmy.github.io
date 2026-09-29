/* ============================================
   کامپوننت اسلایدر انتخاب سکه
   ============================================ */

const CoinSlider = {
    container: null,
    currentIndex: 0,
    coins: [],
    onChange: null,
    
    /**
     * رندر
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.coins = CoinService.getCoinTiers();
        this.currentIndex = options.defaultIndex || 2; // پیش‌فرض: سکه طلایی
        this.onChange = options.onChange || null;
        
        this.container.innerHTML = `
            <div class="coin-slider">
                <div class="coin-slider-header">
                    <div class="coin-slider-title">
                        <i class="ri-coins-line"></i>
                        <span>تعداد سکه‌های مشارکت خود را انتخاب کنید</span>
                    </div>
                    <div class="coin-slider-hint">هر سکه معادل ۱۰۰,۰۰۰ تومان</div>
                </div>
                
                <div class="coin-slider-track" id="coin-slider-track"></div>
                
                <div class="coin-slider-nav">
                    <button class="coin-nav-btn" id="coin-prev" aria-label="قبلی">
                        <i class="ri-arrow-right-s-line"></i>
                    </button>
                    <div class="coin-slider-dots" id="coin-dots"></div>
                    <button class="coin-nav-btn" id="coin-next" aria-label="بعدی">
                        <i class="ri-arrow-left-s-line"></i>
                    </button>
                </div>
                
                <div class="coin-slider-preview" id="coin-preview"></div>
                
                <div class="coin-slider-quick">
                    <div class="quick-label">انتخاب سریع:</div>
                    <div class="quick-buttons" id="quick-buttons"></div>
                </div>
            </div>
        `;
        
        this.renderSlides();
        this.renderDots();
        this.renderQuickButtons();
        this.updatePreview();
        this.attachEvents();
        this.goTo(this.currentIndex, false);
    },
    
    /**
     * رندر اسلایدها
     */
    renderSlides() {
        const track = this.container.querySelector('#coin-slider-track');
        track.innerHTML = this.coins.map((coin, idx) => `
            <div class="coin-slide ${idx === this.currentIndex ? 'active' : ''}" data-index="${idx}">
                <div class="coin-slide-inner" style="--coin-color: ${coin.color}; --coin-gradient: ${coin.gradient}">
                    <div class="coin-slide-icon">
                        <i class="${coin.icon}"></i>
                    </div>
                    <div class="coin-slide-count">
                        <span class="coin-num">${Format.number(coin.count)}</span>
                        <span class="coin-label">سکه</span>
                    </div>
                    <h3 class="coin-slide-title">${coin.title}</h3>
                    <p class="coin-slide-subtitle">${coin.subtitle}</p>
                    <div class="coin-slide-price">${Format.price(coin.price)}</div>
                    <ul class="coin-slide-features">
                        ${coin.features.map(f => `
                            <li><i class="ri-check-line"></i> ${f}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    },
    
    /**
     * رندر نقاط
     */
    renderDots() {
        const dots = this.container.querySelector('#coin-dots');
        dots.innerHTML = this.coins.map((_, idx) => `
            <button class="coin-dot ${idx === this.currentIndex ? 'active' : ''}" data-index="${idx}" aria-label="اسلاید ${idx + 1}"></button>
        `).join('');
    },
    
    /**
     * رندر دکمه‌های سریع
     */
    renderQuickButtons() {
        const quick = this.container.querySelector('#quick-buttons');
        const commonCounts = [1, 3, 5, 10, 20, 50];
        
        quick.innerHTML = commonCounts.map(count => {
            const coin = this.coins.find(c => c.count === count);
            if (!coin) return '';
            const idx = this.coins.indexOf(coin);
            return `<button class="quick-btn" data-index="${idx}">${Format.number(count)}</button>`;
        }).join('');
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        // دکمه‌های ناوبری
        this.container.querySelector('#coin-prev').addEventListener('click', () => this.prev());
        this.container.querySelector('#coin-next').addEventListener('click', () => this.next());
        
        // نقاط
        this.container.querySelectorAll('.coin-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                this.goTo(parseInt(dot.dataset.index));
            });
        });
        
        // دکمه‌های سریع
        this.container.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.goTo(parseInt(btn.dataset.index));
            });
        });
        
        // اسلایدها
        this.container.querySelectorAll('.coin-slide').forEach(slide => {
            slide.addEventListener('click', () => {
                const idx = parseInt(slide.dataset.index);
                if (idx !== this.currentIndex) this.goTo(idx);
            });
        });
        
        // کیبورد
        document.addEventListener('keydown', (e) => {
            if (!this.container || !document.body.contains(this.container)) return;
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
            
            if (e.key === 'ArrowRight') this.prev();
            if (e.key === 'ArrowLeft') this.next();
        });
        
        // Swipe
        this.attachSwipe();
    },
    
    /**
     * پشتیبانی از Swipe
     */
    attachSwipe() {
        const track = this.container.querySelector('#coin-slider-track');
        let startX = 0;
        let isDragging = false;
        
        track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        track.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            const endX = e.changedTouches[0].clientX;
            const diff = endX - startX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) this.prev();
                else this.next();
            }
            isDragging = false;
        }, { passive: true });
    },
    
    /**
     * رفتن به اسلاید
     */
    goTo(index, animate = true) {
        if (index < 0 || index >= this.coins.length) return;
        
        this.currentIndex = index;
        const track = this.container.querySelector('#coin-slider-track');
        
        // موقعیت
        const trackWidth = track.offsetWidth;
        track.style.transform = `translateX(${index * 100}%)`;
        
        // به‌روزرسانی کلاس‌ها
        this.container.querySelectorAll('.coin-slide').forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
        
        this.container.querySelectorAll('.coin-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        this.container.querySelectorAll('.quick-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.index) === index);
        });
        
        this.updatePreview();
        
        if (this.onChange) {
            this.onChange(this.coins[index]);
        }
    },
    
    /**
     * بعدی
     */
    next() {
        if (this.currentIndex < this.coins.length - 1) {
            this.goTo(this.currentIndex + 1);
        }
    },
    
    /**
     * قبلی
     */
    prev() {
        if (this.currentIndex > 0) {
            this.goTo(this.currentIndex - 1);
        }
    },
    
    /**
     * به‌روزرسانی پیش‌نمایش
     */
    updatePreview() {
        const coin = this.coins[this.currentIndex];
        const preview = this.container.querySelector('#coin-preview');
        
        preview.innerHTML = `
            <div class="preview-box">
                <div class="preview-item">
                    <div class="preview-icon" style="background: ${coin.gradient}">
                        <i class="ri-coins-line"></i>
                    </div>
                    <div>
                        <div class="preview-label">تعداد سکه</div>
                        <div class="preview-value">${Format.coin(coin.count)}</div>
                    </div>
                </div>
                <div class="preview-item">
                    <div class="preview-icon" style="background: linear-gradient(135deg, #10B981, #059669)">
                        <i class="ri-money-dollar-circle-line"></i>
                    </div>
                    <div>
                        <div class="preview-label">مبلغ قابل پرداخت</div>
                        <div class="preview-value">${Format.price(coin.price)}</div>
                    </div>
                </div>
                <div class="preview-item">
                    <div class="preview-icon" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED)">
                        <i class="ri-gift-line"></i>
                    </div>
                    <div>
                        <div class="preview-label">پکیج انتخاب شده</div>
                        <div class="preview-value">${coin.title}</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * دریافت انتخاب فعلی
     */
    getValue() {
        return this.coins[this.currentIndex];
    }
};