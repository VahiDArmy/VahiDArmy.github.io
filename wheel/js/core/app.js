/**
 * راه‌انداز اصلی برنامه
 * @module app
 */

const App = {
    /**
     * راه‌اندازی
     */
    async init() {
        console.log('🚀 راه‌اندازی گردونه شانس...');

        // راه‌اندازی نوتیفیکیشن
        Notification.init();

        // راه‌اندازی کانفتی
        Confetti.init();

        // راه‌اندازی پس‌زمینه ذرات
        if (AppState.get('settings.particlesEnabled')) {
            Particles.init('particles-canvas');
        }

        // بارگذاری داده‌ها از LocalStorage
        LocalStorage.loadAll();

        // راه‌اندازی تم
        Theme.init();

        // راه‌اندازی رویدادها
        Events.init();

        // راه‌اندازی گردونه
        WheelCore.init('wheel-canvas');

        // بارگذاری افراد
        const people = AppState.get('people') || [];
        WheelCore.setItems(people);

        // راه‌اندازی صفحه
        Router.init();

        // بررسی همگام‌سازی خودکار
        if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
            Sync.startAutoSync();
        }

        console.log('✅ برنامه با موفقیت راه‌اندازی شد');
    },
};

// راه‌اندازی پس از بارگذاری DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;