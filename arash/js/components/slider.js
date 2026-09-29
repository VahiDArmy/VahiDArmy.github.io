/* ============================================
   کامپوننت اسلایدر انتخاب سکه
   نسخه ۲.۰ - اسلایدر بازه‌ای + ورودی دقیق
   ============================================ */

const CoinSlider = {
    container: null,
    value: 5,
    min: 1,
    max: 200,
    step: 1,
    onChange: null,
    quickValues: [1, 5, 10, 25, 50, 100],
    
    /**
     * رندر
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.min = options.min || APP_CONFIG.MIN_COINS || 1;
        this.max = options.max || APP_CONFIG.MAX_COINS || 200;
        this.step = options.step || 1;
        this.value = options.defaultValue || 5;
        this.onChange = options.onChange || null;
        this.quickValues = options.quickValues || [1, 5, 10, 25, 50, 100];
        
        // اطمینان از محدوده
        this.value = Helpers.clamp(this.value, this.min, this.max);
        
        this.container.innerHTML = `
            <div class="coin-slider-v2">
                <div class="coin-slider-v2-header">
                    <div class="coin-slider-v2-title">
                        <i class="ri-coins-line"></i>
                        <span>تعداد سکه‌های مشارکت خود را انتخاب کنید</span>
                    </div>
                    <div class="coin-slider-v2-hint">هر سکه معادل ۱۰۰,۰۰۰ تومان</div>
                </div>
                
                <!-- نمایش بزرگ عدد انتخابی -->
                <div class="coin-slider-v2-display">
                    <div class="coin-slider-v2-count">
                        <span class="coin-count-number" id="coin-display-number">${Format.number(this.value)}</span>
                        <span class="coin-count-label">سکه</span>
                    </div>
                    <div class="coin-slider-v2-price" id="coin-display-price">
                        ${Format.price(this.value * APP_CONFIG.COIN_PRICE)}
                    </div>
                </div>
                
                <!-- اسلایدر بازه‌ای -->
                <div class="coin-slider-v2-range">
                    <div class="range-labels-top">
                        <span class="range-label-min">${Format.number(this.min)}</span>
                        <span class="range-label-max">${Format.number(this.max)}+</span>
                    </div>
                    <div class="range-wrapper">
                        <input 
                            type="range" 
                            id="coin-range" 
                            class="coin-range-input"
                            min="${this.min}" 
                            max="${this.max}" 
                            step="${this.step}" 
                            value="${this.value}"
                        >
                        <div class="range-progress" id="range-progress"></div>
                    </div>
                    <div class="range-marks" id="range-marks"></div>
                </div>
                
                <!-- ورودی عدد دقیق -->
                <div class="coin-slider-v2-input">
                    <label class="coin-input-label">
                        <i class="ri-edit-line"></i>
                        <span>یا عدد دقیق وارد کنید:</span>
                    </label>
                    <div class="coin-input-group">
                        <button class="coin-input-btn" id="coin-btn-minus" type="button" aria-label="کاهش">
                            <i class="ri-subtract-line"></i>
                        </button>
                        <input 
                            type="number" 
                            id="coin-number-input" 
                            class="coin-number-input"
                            value="${this.value}"
                            min="${this.min}"
                            max="10000"
                            step="1"
                            inputmode="numeric"
                        >
                        <button class="coin-input-btn" id="coin-btn-plus" type="button" aria-label="افزایش">
                            <i class="ri-add-line"></i>
                        </button>
                    </div>
                    <div class="coin-input-hint">
                        می‌توانید هر عدد دلخواهی وارد کنید
                    </div>
                </div>
                
                <!-- انتخاب‌های سریع -->
                <div class="coin-slider-v2-quick">
                    <div class="quick-label">پیشنهاد سریع:</div>
                    <div class="quick-buttons" id="quick-buttons">
                        ${this.quickValues.map(v => `
                            <button class="quick-btn ${v === this.value ? 'active' : ''}" data-value="${v}" type="button">
                                ${Format.number(v)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.attachEvents();
        this.updateUI();
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        const rangeInput = this.container.querySelector('#coin-range');
        const numberInput = this.container.querySelector('#coin-number-input');
        const minusBtn = this.container.querySelector('#coin-btn-minus');
        const plusBtn = this.container.querySelector('#coin-btn-plus');
        
        // اسلایدر
        rangeInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.setValue(val, 'slider');
        });
        
        // ورودی عدد
        numberInput.addEventListener('input', (e) => {
            // فقط اعداد
            let val = e.target.value.replace(/[^0-9]/g, '');
            if (val === '') {
                return; // اجازه به کاربر برای تایپ
            }
            const num = parseInt(val);
            if (!isNaN(num)) {
                // اگر کمتر از min، اجباری نکن (تا کاربر بتواند تایپ کند)
                if (num >= this.min) {
                    this.setValue(num, 'input');
                }
            }
        });
        
        numberInput.addEventListener('blur', (e) => {
            // در خروج از فیلد، اگر مقدار نامعتبر بود اصلاح کن
            let val = parseInt(e.target.value) || this.min;
            val = Helpers.clamp(val, this.min, 10000);
            this.setValue(val, 'input');
        });
        
        numberInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                numberInput.blur();
            }
        });
        
        // دکمه‌های +/- (پله‌ای)
        minusBtn.addEventListener('click', () => {
            const newVal = Math.max(this.min, this.value - this.getStepForCurrentValue());
            this.setValue(newVal, 'button');
        });
        
        plusBtn.addEventListener('click', () => {
            const newVal = Math.min(10000, this.value + this.getStepForCurrentValue());
            this.setValue(newVal, 'button');
        });
        
        // دکمه‌های سریع
        this.container.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.dataset.value);
                this.setValue(val, 'quick');
            });
        });
    },
    
    /**
     * دریافت گام مناسب بر اساس مقدار فعلی
     */
    getStepForCurrentValue() {
        if (this.value < 10) return 1;
        if (this.value < 50) return 5;
        if (this.value < 100) return 10;
        if (this.value < 500) return 25;
        return 50;
    },
    
    /**
     * تنظیم مقدار
     */
    setValue(val, source = 'manual') {
        val = parseInt(val) || this.min;
        
        // اگر از سمت ورودی آمده، محدودیت اسلایدر را اعمال نکن
        if (source === 'input' && val > this.max) {
            this.value = val;
        } else {
            this.value = Helpers.clamp(val, this.min, Math.max(this.max, val));
        }
        
        this.updateUI();
        
        // فراخوانی callback
        if (this.onChange) {
            this.onChange({
                count: this.value,
                price: this.value * APP_CONFIG.COIN_PRICE
            });
        }
    },
    
    /**
     * به‌روزرسانی UI
     */
    updateUI() {
        const val = this.value;
        
        // نمایش عدد
        const displayNumber = this.container.querySelector('#coin-display-number');
        const displayPrice = this.container.querySelector('#coin-display-price');
        
        if (displayNumber) {
            displayNumber.textContent = Format.number(val);
            displayNumber.classList.add('pulse-anim');
            setTimeout(() => displayNumber.classList.remove('pulse-anim'), 300);
        }
        if (displayPrice) displayPrice.textContent = Format.price(val * APP_CONFIG.COIN_PRICE);
        
        // اسلایدر
        const rangeInput = this.container.querySelector('#coin-range');
        if (rangeInput) {
            // اگر مقدار بیش از max باشد، اسلایدر را در max نگهدار
            rangeInput.value = Math.min(val, this.max);
            
            // نوار پیشرفت
            const progress = this.container.querySelector('#range-progress');
            if (progress) {
                const percent = ((Math.min(val, this.max) - this.min) / (this.max - this.min)) * 100;
                progress.style.width = percent + '%';
            }
        }
        
        // ورودی عدد
        const numberInput = this.container.querySelector('#coin-number-input');
        if (numberInput && document.activeElement !== numberInput) {
            numberInput.value = val;
        }
        
        // دکمه‌های سریع
        this.container.querySelectorAll('.quick-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.value) === val);
        });
    },
    
    /**
     * دریافت مقدار فعلی
     */
    getValue() {
        return {
            count: this.value,
            price: this.value * APP_CONFIG.COIN_PRICE
        };
    }
};