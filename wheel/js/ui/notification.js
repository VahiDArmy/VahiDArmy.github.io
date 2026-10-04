/**
 * سیستم نوتیفیکیشن
 * @module notification
 */

const Notification = {
    container: null,
    defaultDuration: 4000,

    /**
     * راه‌اندازی
     */
    init() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    },

    /**
     * نمایش نوتیفیکیشن
     */
    show(message, type = 'info', duration = this.defaultDuration) {
        if (!this.container) this.init();

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-content">
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close">×</button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this._dismiss(notification));

        this.container.appendChild(notification);

        // انیمیشن ورود
        requestAnimationFrame(() => {
            notification.classList.add('notification-show');
        });

        // حذف خودکار
        if (duration > 0) {
            setTimeout(() => this._dismiss(notification), duration);
        }

        return notification;
    },

    /**
     * حذف نوتیفیکیشن
     */
    _dismiss(notification) {
        notification.classList.remove('notification-show');
        notification.classList.add('notification-hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    },

    /**
     * میان‌برها
     */
    success(message, duration) {
        return this.show(message, 'success', duration);
    },

    error(message, duration) {
        return this.show(message, 'error', duration);
    },

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },

    info(message, duration) {
        return this.show(message, 'info', duration);
    },
};

window.Notification = Notification;