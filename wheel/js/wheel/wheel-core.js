/**
 * هسته گردونه - با resize پایدار و redraw امن
 * @module wheelCore
 */

const WheelCore = {
    canvas: null,
    ctx: null,
    items: [],
    rotation: 0,
    isSpinning: false,
    spinVelocity: 0,
    friction: 0.985,
    minVelocity: 0.001,
    spinDuration: 5000,
    pointerAngle: -Math.PI / 2,

    _lastSize: 0,
    _lastDpr: 0,
    _resizeObserver: null,
    _resizeTimer: null,

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d', { alpha: true });

        this.resize();

        // ResizeObserver روی wrapper - بهتر از window.resize
        const wrap = this.canvas.parentElement;
        if (wrap && 'ResizeObserver' in window) {
            this._resizeObserver = new ResizeObserver(
                Utils.debounce(() => this.resize(), 150)
            );
            this._resizeObserver.observe(wrap);
        }

        // fallback برای مرورگرهای قدیمی
        window.addEventListener('resize', Utils.debounce(() => this.resize(), 200));
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 300);
        });

        // ✅ Redraw وقتی صفحه دوباره visible می‌شود
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.render(), 100);
            }
        });

        // ✅ Redraw بعد از اسکرول (debounced - فقط یکبار)
        window.addEventListener('scroll', Utils.debounce(() => {
            this.render();
        }, 250), { passive: true });

        // ✅ Redraw وقتی وارد viewport می‌شود
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.render();
                    }
                });
            }, { threshold: 0.1 });
            io.observe(this.canvas);
        }

        this.render();
    },

    /**
     * تنظیم اندازه - با cache و بدون redraw غیرضروری
     */
    resize() {
        if (!this.canvas || !this.ctx) return;

        // اندازه‌ی هدف بر اساس والد
        const wrap = this.canvas.parentElement;
        let available = window.innerWidth - 60;
        if (wrap && wrap.parentElement) {
            const parentWidth = wrap.parentElement.clientWidth;
            if (parentWidth > 0) available = parentWidth - 40;
        }

        const maxSize = Utils.isMobile() ? 320 : 500;
        const size = Math.max(200, Math.min(maxSize, available));

        // cap DPR روی 2 برای صرفه‌جویی حافظه
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // اگر تغییری نداشته، فقط render کن
        if (this._lastSize === size && this._lastDpr === dpr) {
            this.render();
            return;
        }

        this._lastSize = size;
        this._lastDpr = dpr;

        // ست کردن اندازه بافر
        this.canvas.width = Math.floor(size * dpr);
        this.canvas.height = Math.floor(size * dpr);
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';

        // reset transform (ست کردن width خودش reset می‌کند اما محکم کاری)
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // مقادیر هندسی
        this.size = size;
        this.centerX = size / 2;
        this.centerY = size / 2;
        this.radius = size / 2 - 15;

        this.render();
    },

    /**
     * تنظیم آیتم‌ها
     */
    setItems(items) {
        this.items = (items || []).map((item, index) => ({
            ...item,
            color: item.color || Utils.randomColor(),
            weight: item.weight || 1,
            index,
        }));
        this.render();
    },

    /**
     * رندر
     */
    render() {
        if (!this.ctx || !this.canvas) return;

        const { ctx, centerX, centerY, radius, items, rotation } = this;
        const size = this.size;

        // پاک کردن
        ctx.clearRect(0, 0, size, size);

        if (items.length === 0) {
            this._drawEmptyWheel(ctx, centerX, centerY, radius);
            this._drawCenterHub(ctx, centerX, centerY);
            this._drawPointer(ctx, centerX, centerY, radius);
            return;
        }

        const anglePerItem = (2 * Math.PI) / items.length;

        items.forEach((item, i) => {
            const startAngle = rotation + i * anglePerItem;
            const endAngle = startAngle + anglePerItem;

            // قطاع
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            // گرادیان سبک (بدون گرادیان شعاعی سنگین)
            ctx.fillStyle = item.color;
            ctx.fill();

            // حاشیه
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // متن
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + anglePerItem / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = Utils.getContrastColor(item.color);
            ctx.font = 'bold 15px Vazirmatn, sans-serif';

            const label = item.label || item.name || '';
            const maxWidth = radius - 40;
            const displayLabel = label.length > 12 ? label.substring(0, 11) + '…' : label;
            ctx.fillText(displayLabel, radius - 20, 0);

            ctx.restore();
        });

        this._drawCenterHub(ctx, centerX, centerY);
        this._drawPointer(ctx, centerX, centerY, radius);
    },

    _drawCenterHub(ctx, cx, cy) {
        // مرکز
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
        ctx.fillStyle = '#111118';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎡', cx, cy);
    },

    _drawPointer(ctx, cx, cy, radius) {
        const angle = this.pointerAngle;
        const pointerLength = 26;
        const pointerWidth = 18;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(radius - 5, 0);
        ctx.lineTo(radius + pointerLength - 5, -pointerWidth / 2);
        ctx.lineTo(radius + pointerLength - 5, pointerWidth / 2);
        ctx.closePath();

        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    },

    _drawEmptyWheel(ctx, cx, cy, radius) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '16px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('لیست خالی است', cx, cy + radius / 2 + 20);
    },

    _lighten(hex, percent) {
        const rgb = Utils.hexToRgb(hex);
        if (!rgb) return hex;
        const { r, g, b } = rgb;
        const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
        const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
        const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
        return `rgb(${newR}, ${newG}, ${newB})`;
    },

    // ═══════════════════════════════════════════
    // Spin
    // ═══════════════════════════════════════════

    spinRandom() {
        if (this.isSpinning || this.items.length === 0) return;
        this.isSpinning = true;

        const targetRotation = this.rotation + (Math.random() * 10 + 5) * Math.PI * 2;
        const duration = this.spinDuration;
        const startRotation = this.rotation;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this._easeOutCubic(progress);

            this.rotation = startRotation + (targetRotation - startRotation) * eased;
            this.render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isSpinning = false;
                this._onSpinComplete();
            }
        };

        requestAnimationFrame(animate);
    },

    spinToItem(itemIndex, duration = 5000) {
        if (this.isSpinning || this.items.length === 0) return;
        if (itemIndex < 0 || itemIndex >= this.items.length) return;

        this.isSpinning = true;
        const anglePerItem = (2 * Math.PI) / this.items.length;
        const targetAngle = -itemIndex * anglePerItem - anglePerItem / 2;
        const currentRotation = this.rotation % (2 * Math.PI);
        let diff = targetAngle - currentRotation;

        while (diff < 0) diff += 2 * Math.PI;
        const targetRotation = this.rotation + diff + (Math.random() * 5 + 5) * Math.PI * 2;

        const startRotation = this.rotation;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this._easeOutQuint(progress);

            this.rotation = startRotation + (targetRotation - startRotation) * eased;
            this.render();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isSpinning = false;
                this._onSpinComplete();
            }
        };

        requestAnimationFrame(animate);
    },

    spinStarred() {
        const starred = this.items.filter((item) => item.starred);
        if (starred.length === 0) return;
        const randomStarred = Utils.randomPick(starred);
        const index = this.items.findIndex((item) => item.id === randomStarred.id);
        this.spinToItem(index);
    },

    _onSpinComplete() {
        const winner = this.getCurrentItem();
        if (winner) {
            AppState.set('wheel.lastResult', winner);
            if (AppState.get('settings.confettiEnabled') && typeof Confetti !== 'undefined') {
                Confetti.celebrate();
            }
            if (window.WheelPage) {
                WheelPage.onSpinComplete(winner);
            }
        }
    },

    getCurrentItem() {
        if (this.items.length === 0) return null;
        const anglePerItem = (2 * Math.PI) / this.items.length;
        const normalizedRotation = ((-this.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const pointerFromTop = (this.pointerAngle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
        const adjustedAngle = (pointerFromTop + normalizedRotation) % (2 * Math.PI);
        const index = Math.floor(adjustedAngle / anglePerItem) % this.items.length;
        return this.items[index];
    },

    _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    _easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); },
};

window.WheelCore = WheelCore;