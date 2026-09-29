/* ============================================
   کامپوننت آمار زنده
   ============================================ */

const Stats = {
    container: null,
    animated: false,
    
    /**
     * رندر آمار
     */
    async render(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        // نمایش لودینگ
        this.container.innerHTML = `
            <div class="stats-grid">
                ${[1,2,3,4].map(() => `
                    <div class="stat-card skeleton-card">
                        <div class="skeleton skeleton-avatar"></div>
                        <div style="flex: 1;">
                            <div class="skeleton skeleton-text" style="width: 60%;"></div>
                            <div class="skeleton skeleton-title"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // دریافت آمار
        const stats = await CoinService.getStats();
        this.renderStats(stats);
    },
    
    /**
     * رندر آمار واقعی
     */
    renderStats(stats) {
        this.container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card stat-card-gold">
                    <div class="stat-icon stat-icon-gold">
                        <i class="ri-coins-line"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">میانگین سکه هر نفر</div>
                        <div class="stat-value" id="stat-avg">۰</div>
                        <div class="stat-change stat-change-up">
                            <i class="ri-arrow-up-line"></i>
                            <span>به‌روزرسانی زنده</span>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon stat-icon-primary">
                        <i class="ri-group-line"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">تعداد مشارکت‌کنندگان</div>
                        <div class="stat-value" id="stat-count">۰</div>
                        <div class="stat-change stat-change-up">
                            <i class="ri-user-add-line"></i>
                            <span>نفر</span>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon stat-icon-success">
                        <i class="ri-money-dollar-circle-line"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">میانگین مبلغ</div>
                        <div class="stat-value" id="stat-amount">۰</div>
                        <div class="stat-change stat-change-up">
                            <i class="ri-wallet-line"></i>
                            <span>تومان</span>
                        </div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon stat-icon-info">
                        <i class="ri-stack-line"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">مجموع سکه‌ها</div>
                        <div class="stat-value" id="stat-total">۰</div>
                        <div class="stat-change stat-change-up">
                            <i class="ri-trophy-line"></i>
                            <span>سکه</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // انیمیشن شماره‌ها
        this.animateStats(stats);
    },
    
    /**
     * انیمیشن شماره‌ها
     */
    animateStats(stats) {
        const avgEl = document.getElementById('stat-avg');
        const countEl = document.getElementById('stat-count');
        const amountEl = document.getElementById('stat-amount');
        const totalEl = document.getElementById('stat-total');
        
        if (avgEl) Helpers.animateNumber(avgEl, 0, stats.averageCoins, 1500, ' سکه');
        if (countEl) Helpers.animateNumber(countEl, 0, stats.participantsCount, 1500, '');
        if (amountEl) Helpers.animateNumber(amountEl, 0, stats.averageAmount, 1800, '');
        if (totalEl) Helpers.animateNumber(totalEl, 0, stats.totalCoins, 1800, '');
    },
    
    /**
     * به‌روزرسانی زنده
     */
    async refresh() {
        const stats = await CoinService.getStats();
        const avgEl = document.getElementById('stat-avg');
        const countEl = document.getElementById('stat-count');
        const amountEl = document.getElementById('stat-amount');
        const totalEl = document.getElementById('stat-total');
        
        if (avgEl) avgEl.textContent = Format.number(stats.averageCoins) + ' سکه';
        if (countEl) countEl.textContent = Format.number(stats.participantsCount);
        if (amountEl) amountEl.textContent = Format.number(stats.averageAmount);
        if (totalEl) totalEl.textContent = Format.number(stats.totalCoins);
    }
};