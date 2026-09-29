/* ============================================
   کامپوننت اسلایدر انتخاب سکه
   نسخه ۳.۰ - حرفه‌ای، ساده، دقیق
   ============================================ */

const CoinSlider = {
    container: null,
    value: 5,
    min: 1,
    max: 20,
    onChange: null,
    quickValues: [1, 2, 5, 10, 15, 20],
    pricePerCoin: 100000,
    
    /**
     * رندر
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.min = options.min ?? 1;
        this.max = options.max ?? 20;
        this.value = Helpers.clamp(options.defaultValue ?? 5, this.min, this.max);
        this.onChange = options.onChange || null;
        this.quickValues = options.quickValues || [1, 2, 5, 10, 15, 20];
        this.pricePerCoin = options.pricePerCoin || APP_CONFIG.COIN_PRICE;
        
        this.container.innerHTML = `
            <div class="coin-slider-pro">
                
                <!-- باکس اول: عنوان -->
                <div class="coin-slider-pro-title">
                    <div class="csp-title-icon">
                        <i class="ri-coins-line"></i>
                    </div>
                    <div class="csp-title-text">
                        <h3>تعداد سکه‌های مشارکت خود را انتخاب کنید</h3>
                        <p>هر سکه معادل ${Format.price(this.pricePerCoin)} • حداکثر ${Format.number(this.max)} سکه</p>
                    </div>
                </div>
                
                <!-- نمایش بزرگ عدد -->
                <div class="coin-slider-pro-display">
                    <div class="csp-display-inner">
                        <div class="csp-display-count">
                            <span class="csp-num" id="csp-number">${Format.number(this.value)}</span>
                            <span class="csp-unit">سکه</span>
                        </div>
                        <div class="csp-display-price" id="csp-price">
                            ${Format.price(this.value * this.pricePerCoin)}
                        </div>
                    </div>
                </div>
                
                <!-- اسلایدر حرفه‌ای -->
                <div class="coin-slider-pro-track">
                    <div class="csp-track-labels">
                        <span class="csp-label-min">${Format.number(this.min)}</span>
                        <span class="csp-label-mid">${Format.number(Math.round(this.max / 2))}</span>
                        <span class="csp-label-max">${Format.number(this.max)}</span>
                    </div>
                    
                    <div class="csp-track-wrapper">
                        <div class="csp-track-bg"></div>
                        <div class="csp-track-fill" id="csp-fill"></div>
                        <div class="csp-track-ticks" id="csp-ticks"></div>
                        <input 
                            type="range" 
                            id="csp-range" 
                            class="csp-range"
                            min="${this.min}" 
                            max="${this.max}" 
                            step="1" 
                            value="${this.value}"
                            aria-label="تعداد سکه"
                        >
                    </div>
                </div>
                
                <!-- کنترل +/- (یک سکه) -->
                <div class="coin-slider-pro-control">
                    <button class="csp-ctrl-btn csp-ctrl-minus" id="csp-minus" type="button" aria-label="کاهش یک سکه">
                        <i class="ri-subtract-line"></i>
                        <span class="csp-ctrl-label">یک سکه کمتر</span>
                    </button>
                    
                    <div class="csp-ctrl-value">
                        <span id="csp-ctrl-num">${Format.number(this.value)}</span>
                    </div>
                    
                    <button class="csp-ctrl-btn csp-ctrl-plus" id="csp-plus" type="button" aria-label="افزایش یک سکه">
                        <span class="csp-ctrl-label">یک سکه بیشتر</span>
                        <i class="ri-add-line"></i>
                    </button>
                </div>
                
                <!-- انتخاب سریع -->
                <div class="coin-slider-pro-quick">
                    <div class="csp-quick-label">
                        <i class="ri-flashlight-line"></i>
                        <span>انتخاب سریع</span>
                    </div>
                    <div class="csp-quick-grid" id="csp-quick">
                        ${this.quickValues.map(v => `
                            <button class="csp-quick-btn ${v === this.value ? 'active' : ''}" 
                                    data-value="${v}" 
                                    type="button">
                                <span class="csp-quick-num">${Format.number(v)}</span>
                                <span class="csp-quick-unit">سکه</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.renderTicks();
        this.attachEvents();
        this.updateUI();
    },
    
    /**
     * رندر تیک‌های روی اسلایدر
     */
    renderTicks() {
        const ticksContainer = this.container.querySelector('#csp-ticks');
        if (!ticksContainer) return;
        
        // تیک در هر سکه
        const ticks = [];
        const total = this.max - this.min;
        
        // اگر بازه کوچک است، هر سکه یک تیک
        // اگر بزرگ است، پله‌ای
        if (total <= 20) {
            for (let i = this.min; i <= this.max; i++) {
                ticks.push(i);
            }
        } else {
            const step = Math.ceil(total / 15);
            for (let i = this.min; i <= this.max; i += step) {
                ticks.push(i);
            }
            if (ticks[ticks.length - 1] !== this.max) ticks.push(this.max);
        }
        
        ticksContainer.innerHTML = ticks.map(t => {
            const pos = ((t - this.min) / total) * 100;
            const isMajor = t === this.min || t === this.max || t === Math.round(this.max / 2);
            return `<span class="csp-tick ${isMajor ? 'csp-tick-major' : ''}" style="right: ${pos}%"></span>`;
        }).join('');
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        const rangeInput = this.container.querySelector('#csp-range');
        const minusBtn = this.container.querySelector('#csp-minus');
        const plusBtn = this.container.querySelector('#csp-plus');
        
        // اسلایدر
        rangeInput.addEventListener('input', (e) => {
            this.setValue(parseInt(e.target.value));
        });
        
        // دکمه‌های +/- (یک سکه)
        minusBtn.addEventListener('click', () => {
            if (this.value > this.min) {
                this.setValue(this.value - 1);
            }
        });
        
        plusBtn.addEventListener('click', () => {
            if (this.value < this.max) {
                this.setValue(this.value + 1);
            }
        });
        
        // دکمه‌های سریع
        this.container.querySelectorAll('.csp-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setValue(parseInt(btn.dataset.value));
            });
        });
        
        // کیبورد
        rangeInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.value > this.min) this.setValue(this.value - 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.value < this.max) this.setValue(this.value + 1);
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.setValue(this.min);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.setValue(this.max);
            }
        });
    },
    
    /**
     * تنظیم مقدار
     */
    setValue(val) {
        const newVal = Helpers.clamp(parseInt(val), this.min, this.max);
        if (newVal === this.value) return;
        
        this.value = newVal;
        this.updateUI();
        this.animateNumber();
        
        if (this.onChange) {
            this.onChange({
                count: this.value,
                price: this.value * this.pricePerCoin
            });
        }
    },
    
    /**
     * به‌روزرسانی UI
     */
    updateUI() {
        const val = this.value;
        const percent = ((val - this.min) / (this.max - this.min)) * 100;
        
        // عدد بزرگ
        const numEl = this.container.querySelector('#csp-number');
        const priceEl = this.container.querySelector('#csp-price');
        const ctrlNum = this.container.querySelector('#csp-ctrl-num');
        const rangeInput = this.container.querySelector('#csp-range');
        const fill = this.container.querySelector('#csp-fill');
        
        if (numEl) numEl.textContent = Format.number(val);
        if (priceEl) priceEl.textContent = Format.price(val * this.pricePerCoin);
        if (ctrlNum) ctrlNum.textContent = Format.number(val);
        
        // اسلایدر
        if (rangeInput) rangeInput.value = val;
        if (fill) fill.style.width = percent + '%';
        
        // دکمه‌های سریع
        this.container.querySelectorAll('.csp-quick-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.value) === val);
        });
        
        // غیرفعال کردن دکمه‌های +/- در مرزها
        const minusBtn = this.container.querySelector('#csp-minus');
        const plusBtn = this.container.querySelector('#csp-plus');
        if (minusBtn) minusBtn.disabled = val <= this.min;
        if (plusBtn) plusBtn.disabled = val >= this.max;
    },
    
    /**
     * انیمیشن عدد
     */
    animateNumber() {
        const numEl = this.container.querySelector('#csp-number');
        if (!numEl) return;
        numEl.classList.remove('csp-num-pulse');
        void numEl.offsetWidth; // reflow
        numEl.classList.add('csp-num-pulse');
    },
    
    /**
     * دریافت مقدار
     */
    getValue() {
        return {
            count: this.value,
            price: this.value * this.pricePerCoin
        };
    }
};