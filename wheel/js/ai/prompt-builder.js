/**
 * ساخت پرامپت برای هوش مصنوعی
 * @module promptBuilder
 */

const PromptBuilder = {
    /**
     * ساخت پرامپت داستان از بافت
     */
    buildStoryPrompt(context = {}) {
        const {
            winner = null,
            allPeople = [],
            descriptions = {},
            items = [],
            mode = 'single',
            tone = 'funny',
            length = 'medium',
            extras = '',
        } = context;

        const parts = [];

        // ۱. دستور اصلی
        parts.push(this._getMainInstruction(tone, length));

        // ۲. شخصیت اصلی
        if (winner) {
            parts.push(this._buildWinnerSection(winner));
        }

        // ۳. سایر شخصیت‌ها
        if (allPeople && allPeople.length > 1) {
            parts.push(this._buildOtherPeopleSection(allPeople, winner));
        }

        // ۴. توصیفات
        const descSection = this._buildDescriptionsSection(descriptions);
        if (descSection) parts.push(descSection);

        // ۵. آیتم‌ها
        if (items && items.length > 0) {
            parts.push(this._buildItemsSection(items));
        }

        // ۶. حالت بازی
        parts.push(this._buildModeSection(mode));

        // ۷. توضیحات اضافه کاربر
        if (extras && extras.trim()) {
            parts.push(`توضیحات اضافی از کاربر: ${extras.trim()}`);
        }

        // ۸. الزامات پایانی
        parts.push(this._buildFinalRequirements(length));

        return parts.join('\n\n');
    },

    /**
     * دستور اصلی
     */
    _getMainInstruction(tone, length) {
        const toneMap = {
            funny: 'طنزآمیز و خنده‌دار',
            epic: 'حماسی و پرتنش',
            romantic: 'عاشقانه و احساسی',
            mystery: 'معمایی و پر از رمز و راز',
            sarcastic: 'طعنه‌آمیز و کنایه‌دار',
            absurd: 'پوچ‌گرایانه و سورئال',
        };

        const toneText = toneMap[tone] || toneMap.funny;

        return `تو یک داستان‌نویس خلاق فارسی‌زبان هستی که داستان‌های کوتاه ${toneText} می‌نویسد.
داستانی که می‌نویسی باید **کاملاً به زبان فارسی** باشد، روان، جذاب و با پایان‌بندی غیرمنتظره.`;
    },

    /**
     * بخش برنده
     */
    _buildWinnerSection(winner) {
        const name = winner.name || winner.label || 'شخصیت ناشناس';
        let text = `**شخصیت اصلی داستان:** «${name}»`;

        if (winner.description && winner.description.trim()) {
            text += `\nتوصیف این شخصیت: ${winner.description}`;
        }

        if (winner.starred) {
            text += `\nنکته: این شخصیت «ستاره‌دار» انتخاب شده است.`;
        }

        return text;
    },

    /**
     * بخش سایر افراد
     */
    _buildOtherPeopleSection(allPeople, winner) {
        const others = allPeople
            .filter((p) => p.id !== winner?.id)
            .map((p) => p.name)
            .filter(Boolean);

        if (others.length === 0) return '';

        return `**سایر شخصیت‌های حاضر:** ${others.join('، ')}`;
    },

    /**
     * بخش توصیفات
     */
    _buildDescriptionsSection(descriptions) {
        const entries = Object.entries(descriptions).filter(
            ([, v]) => v && v.trim()
        );
        if (entries.length === 0) return '';

        const lines = entries.map(([key, value]) => `- ${key}: ${value}`);
        return `**توصیفات موجود در بافت داستان:**\n${lines.join('\n')}`;
    },

    /**
     * بخش آیتم‌ها
     */
    _buildItemsSection(items) {
        const labels = items
            .map((i) => (typeof i === 'string' ? i : i.label))
            .filter(Boolean);
        if (labels.length === 0) return '';
        return `**آیتم‌های حاضر در داستان:** ${labels.join('، ')}`;
    },

    /**
     * بخش حالت بازی
     */
    _buildModeSection(mode) {
        if (mode === 'elimination') {
            return `**حالت بازی:** این داستان در یک بازی حذفی روایت می‌شود. شخصیت‌ها یکی‌یکی از دور خارج می‌شوند و پایان باید حس پایان یک رقابت را داشته باشد.`;
        }
        return `**حالت بازی:** این داستان در یک بازی انتخابی روایت می‌شود که در آن یک برنده انتخاب شده است.`;
    },

    /**
     * الزامات پایانی
     */
    _buildFinalRequirements(length) {
        const lengthMap = {
            short: 'حدود ۸۰ تا ۱۲۰ کلمه',
            medium: 'حدود ۱۵۰ تا ۲۵۰ کلمه',
            long: 'حدود ۳۰۰ تا ۵۰۰ کلمه',
        };
        const lengthText = lengthMap[length] || lengthMap.medium;

        return `**الزامات نهایی:**
- طول داستان: ${lengthText}
- داستان باید یک **تیتر خلاقانه** در ابتدا داشته باشد (با ## علامت‌گذاری کن)
- از تمام شخصیت‌ها و آیتم‌های ذکرشده استفاده کن
- پایان‌بندی باید **غافلگیرکننده** باشد
- از تکرار و کلیشه پرهیز کن
- داستان را با علامت‌های نگارشی مناسب و پاراگراف‌بندی درست بنویس`;
    },

    /**
     * ساخت پرامپت سیستم
     */
    getSystemPrompt() {
        return AppState.get('settings.aiSystemPrompt') ||
            'تو یک داستان‌نویس خلاق، بامزه و فارسی‌زبان هستی که داستان‌های کوتاه و خنده‌دار می‌نویسد. همیشه به زبان فارسی پاسخ می‌دهی.';
    },

    /**
     * تخمین تعداد کلمات
     */
    estimateWords(text) {
        return text.trim().split(/\s+/).length;
    },
};

window.PromptBuilder = PromptBuilder;