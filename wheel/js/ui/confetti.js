/**
 * کانفتی
 * @module confetti
 */

const Confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,
    isRunning: false,

    /**
     * راه‌اندازی
     */
    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1000';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    /**
     * تنظیم اندازه
     */
    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    /**
     * ایجاد ذرات
     */
    createParticles(count = 150, originX, originY) {
        const colors = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
        const ox = originX ?? window.innerWidth / 2;
        const oy = originY ?? window.innerHeight / 2;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 12 + 4;
            this.particles.push({
                x: ox,
                y: oy,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 5,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                gravity: 0.25,
                drag: 0.98,
                life: 1,
                decay: Math.random() * 0.01 + 0.005,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
            });
        }
    },

    /**
     * شروع انیمیشن
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._animate();
    },

    /**
     * انیمیشن
     */
    _animate() {
        if (!this.ctx) return;
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.particles = this.particles.filter((p) => p.life > 0);

        this.particles.forEach((p) => {
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.life -= p.decay;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this._animate());
        } else {
            this.isRunning = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    },

    /**
     * جشن گرفتن
     */
    celebrate() {
        this.createParticles(180);
        this.start();
        
        // انفجار دوم بعد از کمی تأخیر
        setTimeout(() => {
            this.createParticles(120, window.innerWidth * 0.3, window.innerHeight * 0.4);
            this.createParticles(120, window.innerWidth * 0.7, window.innerHeight * 0.4);
            if (!this.isRunning) this.start();
        }, 300);
    },

    /**
     * توقف
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.particles = [];
        this.isRunning = false;
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },
};

window.Confetti = Confetti;