/**
 * پس‌زمینه ذرات
 * @module particles
 */

const Particles = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,
    mouse: { x: -1000, y: -1000 },

    /**
     * راه‌اندازی
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.createParticles(60);
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
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
    createParticles(count) {
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.1,
            });
        }
    },

    /**
     * انیمیشن
     */
    animate() {
        if (!this.ctx) return;
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.particles.forEach((p) => {
            // حرکت
            p.x += p.vx;
            p.y += p.vy;

            // برخورد با لبه‌ها
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            // رسم
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`;
            ctx.fill();

            // اتصال به ذرات نزدیک
            this.particles.forEach((p2) => {
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });
        });

        this.animationId = requestAnimationFrame(() => this.animate());
    },

    /**
     * توقف
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    },
};

window.Particles = Particles;