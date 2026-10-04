/**
 * منطق صفحه اصلی
 * @module homePage
 */

const HomePage = {
    /**
     * راه‌اندازی
     */
    init() {
        this._renderStats();
        this._renderRecentWinners();
        this._initPreviewWheel();
        this._initKeyboard();
    },

    /**
     * نمایش آمار
     */
    _renderStats() {
        const people = AppState.get('people') || [];
        const starred = people.filter((p) => p.starred).length;
        const history = AppState.get('history') || [];
        const stories = AppState.get('stories') || [];

        this._setText('stat-people', Utils.toPersianNumbers(people.length));
        this._setText('stat-starred', Utils.toPersianNumbers(starred));
        this._setText('stat-spins', Utils.toPersianNumbers(history.length));
        this._setText('stat-stories', Utils.toPersianNumbers(stories.length));
    },

    /**
     * نمایش آخرین برندگان
     */
    _renderRecentWinners() {
        const container = document.getElementById('recent-winners-list');
        if (!container) return;

        const history = (AppState.get('history') || []).slice(0, 5);

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <p>هنوز هیچ چرخشی انجام نشده است</p>
                    <a href="wheel.html" class="btn btn-primary btn-sm">اولین چرخش را انجام بده</a>
                </div>
            `;
            return;
        }

        container.innerHTML = history
            .map((h) => {
                const winnerName = h.winner_name || h.winner?.name || h.winner?.label || 'نامشخص';
                const typeIcon = h.spinType === 'starred' ? '⭐' : '🎲';
                const typeText = h.spinType === 'starred' ? 'از ستاره‌دارها' : 'تصادفی';
                return `
                    <div class="winner-card">
                        <div class="winner-icon">${typeIcon}</div>
                        <div class="winner-info">
                            <div class="winner-name">${this._escape(winnerName)}</div>
                            <div class="winner-meta">
                                <span>${typeText}</span>
                                <span class="dot-sep">•</span>
                                <span>${Utils.formatDate(h.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');
    },

    /**
     * گردونه پیش‌نمایش
     */
    _initPreviewWheel() {
        const canvas = document.getElementById('preview-wheel');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const size = 300;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 20;
        const colors = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#f97316'];
        const segments = 8;
        const anglePer = (2 * Math.PI) / segments;

        let rotation = 0;
        const animate = () => {
            ctx.clearRect(0, 0, size, size);
            rotation += 0.008;

            for (let i = 0; i < segments; i++) {
                const start = rotation + i * anglePer;
                const end = start + anglePer;

                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r, start, end);
                ctx.closePath();
                ctx.fillStyle = colors[i % colors.length];
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // مرکز
            ctx.beginPath();
            ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎡', cx, cy);

            requestAnimationFrame(animate);
        };
        animate();
    },

    /**
     * میانبرهای کیبورد
     */
    _initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.target.matches('input, textarea')) {
                window.location.href = 'wheel.html';
            }
        });
    },

    /**
     * کمک‌کننده
     */
    _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

// راه‌اندازی در صفحه خانه
if (document.getElementById('recent-winners-list')) {
    document.addEventListener('DOMContentLoaded', () => HomePage.init());
}

window.HomePage = HomePage;