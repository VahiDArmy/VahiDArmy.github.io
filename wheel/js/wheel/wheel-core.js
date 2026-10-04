/**
 * هسته گردونه
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
    pointerAngle: -Math.PI / 2, // بالا

    /**
     * راه‌اندازی
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.render();
    },

    /**
     * تنظیم اندازه
     */
    resize() {
        if (!this.canvas) return;
        const size = Utils.isMobile() ? 320 : 500;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.ctx.scale(dpr, dpr);
        this.size = size;
        this.centerX = size / 2;
        this.centerY = size / 2;
        this.radius = size / 2 - 20;
    },

    /**
     * تنظیم آیتم‌ها
     */
    setItems(items) {
        this.items = items.map((item, index) => ({
            ...item,
            color: item.color || Utils.randomColor(),
            weight: item.weight || 1,
            index,
        }));
        this.render();
    },

    /**
     * رندر گردونه
     */
    render() {
        if (!this.ctx) return;
        const { ctx, centerX, centerY, radius, items, rotation } = this;
        
        ctx.clearRect(0, 0, this.size, this.size);

        if (items.length === 0) {
            this._drawEmptyWheel(ctx, centerX, centerY, radius);
            return;
        }

        const anglePerItem = (2 * Math.PI) / items.length;

        items.forEach((item, i) => {
            const startAngle = rotation + i * anglePerItem;
            const endAngle = startAngle + anglePerItem;

            // رسم قطاع
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            // گرادیان
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );
            gradient.addColorStop(0, this._lighten(item.color, 20));
            gradient.addColorStop(1, item.color);
            ctx.fillStyle = gradient;
            ctx.fill();

            // حاشیه
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // متن
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + anglePerItem / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = Utils.getContrastColor(item.color);
            ctx.font = 'bold 16px Vazirmatn, sans-serif';
            ctx.fillText(item.label || item.name, radius - 20, 6);
            
            // ستاره
            if (item.starred) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = '14px sans-serif';
                ctx.fillText('⭐', radius - 45, -10);
            }
            ctx.restore();
        });

        // مرکز
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
        centerGradient.addColorStop(0, '#333');
        centerGradient.addColorStop(1, '#111');
        ctx.fillStyle = centerGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // لوگوی مرکز
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎡', centerX, centerY);

        // اشاره‌گر
        this._drawPointer(ctx, centerX, centerY, radius);
    },

    /**
     * رسم اشاره‌گر
     */
    _drawPointer(ctx, cx, cy, radius) {
        const angle = this.pointerAngle;
        const pointerLength = 30;
        const pointerWidth = 20;

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

    /**
     * رسم گردونه خالی
     */
    _drawEmptyWheel(ctx, cx, cy, radius) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '18px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('لیست خالی است', cx, cy);
    },

    /**
     * روشن‌تر کردن رنگ
     */
    _lighten(hex, percent) {
        const rgb = Utils.hexToRgb(hex);
        if (!rgb) return hex;
        const { r, g, b } = rgb;
        const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
        const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
        const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
        return `rgb(${newR}, ${newG}, ${newB})`;
    },

    /**
     * چرخش عادی (تصادفی کامل)
     */
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
            
            // easing
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

    /**
     * چرخش به سمت آیتم خاص
     */
    spinToItem(itemIndex, duration = 5000) {
        if (this.isSpinning || this.items.length === 0) return;
        if (itemIndex < 0 || itemIndex >= this.items.length) return;
        
        this.isSpinning = true;
        const anglePerItem = (2 * Math.PI) / this.items.length;
        const targetAngle = -itemIndex * anglePerItem - anglePerItem / 2;
        const currentRotation = this.rotation % (2 * Math.PI);
        let diff = targetAngle - currentRotation;
        
        // اطمینان از چرخش کامل
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

    /**
     * چرخش از بین ستاره‌دارها
     */
    spinStarred() {
        const starred = this.items.filter((item) => item.starred);
        if (starred.length === 0) {
            console.warn('هیچ آیتم ستاره‌داری وجود ندارد');
            return;
        }
        const randomStarred = Utils.randomPick(starred);
        const index = this.items.findIndex((item) => item.id === randomStarred.id);
        this.spinToItem(index);
    },

    /**
     * تکمیل چرخش
     */
    _onSpinComplete() {
        const winner = this.getCurrentItem();
        if (winner) {
            AppState.set('wheel.lastResult', winner);
            if (AppState.get('settings.confettiEnabled')) {
                Confetti.celebrate();
            }
            if (window.WheelPage) {
                WheelPage.onSpinComplete(winner);
            }
        }
    },

    /**
     * دریافت آیتم فعلی
     */
    getCurrentItem() {
        if (this.items.length === 0) return null;
        const anglePerItem = (2 * Math.PI) / this.items.length;
        const normalizedRotation = ((-this.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const pointerFromTop = (this.pointerAngle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
        const adjustedAngle = (pointerFromTop + normalizedRotation) % (2 * Math.PI);
        const index = Math.floor(adjustedAngle / anglePerItem) % this.items.length;
        return this.items[index];
    },

    /**
     * Easing
     */
    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    _easeOutQuint(t) {
        return 1 - Math.pow(1 - t, 5);
    },
};

window.WheelCore = WheelCore;