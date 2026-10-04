/**
 * مدیریت تاریخچه - متصل به SQLStorage
 * @module history
 */

const History = {
    /**
     * دریافت همه
     */
    getAll() {
        return AppState.get('history') || [];
    },

    /**
     * افزودن رکورد
     */
    add(record) {
        SQLStorage.addHistory(record);

        const entry = {
            id: Utils.generateId('hist'),
            winner: record.winner,
            winner_name: record.winner?.name || record.winner?.label || '',
            mode: record.mode || 'single',
            spinType: record.spinType || 'random',
            timestamp: Date.now(),
        };

        const history = [entry, ...this.getAll()].slice(0, 500);
        AppState.set('history', history);

        this._sync();
        return entry;
    },

    /**
     * حذف رکورد
     */
    remove(id) {
        // SQLStorage فعلاً removeById ندارد، پس بازسازی می‌کنیم
        // برای سادگی، همه را پاک و مجدد اضافه می‌کنیم
        const history = this.getAll().filter((h) => h.id !== id);
        SQLStorage.clearHistory();
        history.reverse().forEach((h) => SQLStorage.addHistory(h));
        AppState.set('history', history);
        this._sync();
    },

    /**
     * پاک کردن همه
     */
    clear() {
        SQLStorage.clearHistory();
        AppState.set('history', []);
        this._sync();
        Notification.info('تاریخچه پاک شد');
    },

    /**
     * فیلتر بر اساس بازه زمانی
     */
    filterByDate(startDate, endDate) {
        return this.getAll().filter((h) => {
            return h.timestamp >= startDate && h.timestamp <= endDate;
        });
    },

    /**
     * فیلتر بر اساس نوع چرخش
     */
    filterByType(spinType) {
        return this.getAll().filter((h) => h.spinType === spinType);
    },

    /**
     * آمار
     */
    getStats() {
        const history = this.getAll();
        const peopleWins = {};
        let randomCount = 0;
        let starredCount = 0;

        history.forEach((h) => {
            if (h.winner_name) {
                peopleWins[h.winner_name] = (peopleWins[h.winner_name] || 0) + 1;
            }
            if (h.spinType === 'random') randomCount++;
            if (h.spinType === 'starred') starredCount++;
        });

        // پیدا کردن پربرنده‌ترین
        let topWinner = null;
        let maxWins = 0;
        Object.entries(peopleWins).forEach(([name, wins]) => {
            if (wins > maxWins) {
                maxWins = wins;
                topWinner = { name, wins };
            }
        });

        return {
            total: history.length,
            randomCount,
            starredCount,
            peopleWins,
            topWinner,
            lastSpin: history[0] || null,
        };
    },

    /**
     * همگام‌سازی
     */
    async _sync() {
        await SQLStorage.saveNow();
        if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
            try {
                await GitHubStorage.saveHistory(this.getAll());
            } catch (e) {
                console.error('خطا در همگام‌سازی تاریخچه:', e);
            }
        }
    },
};

window.History = History;