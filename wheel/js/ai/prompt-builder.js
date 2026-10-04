/**
 * ساخت پرامپت هوش مصنوعی
 * - موضوع اختیاری
 * - بدون تأکید روی تعداد
 * - تأکید روی شخصیت‌پردازی و ویژگی‌ها
 * - بدون تعیین طول
 * @module promptBuilder
 */

const PromptBuilder = {
    buildStoryPrompt(context = {}) {
        const {
            winner = null,
            supportingCharacters = [],
            topic = '',
            items = [],
            type = 'provide',
            tone = 'funny',
            extras = '',
        } = context;

        const parts = [];

        parts.push(this._getMainInstruction(tone));
        if (topic && topic.trim()) parts.push(this._buildTopicSection(topic));
        if (winner) parts.push(this._buildMainCharacterSection(winner));
        if (supportingCharacters.length > 0) parts.push(this._buildSupportingSection(supportingCharacters));
        if (items.length > 0) parts.push(this._buildItemsSection(items, type));
        if (extras && extras.trim()) parts.push(`## 📌 درخواست ویژه‌ی کاربر:\n${extras.trim()}`);

        parts.push(this._buildFinalRules());

        return parts.join('\n\n');
    },

    /**
     * دستور اصلی
     */
    _getMainInstruction(tone) {
        const toneMap = {
            funny: 'طنزآمیز، بامزه و سرگرم‌کننده',
            epic: 'حماسی، پرتنش و پرهیجان',
            romantic: 'عاشقانه، احساسی و لطیف',
            mystery: 'معمایی، پر از رمز و راز',
            sarcastic: 'طعنه‌آمیز و کنایه‌دار',
            absurd: 'پوچ‌گرا و سورئال',
        };
        const toneText = toneMap[tone] || toneMap.funny;

        return `تو یک داستان‌نویس خلاق، بامزه و فارسی‌زبان هستی.

**وظیفه:** یک داستان به زبان فارسی بنویس با لحنی ${toneText}.

داستان باید حول **شخصیت اصلی** بچرخد و او را محور همه‌چیز قرار دهد.`;
    },

    /**
     * موضوع (اختیاری)
     */
    _buildTopicSection(topic) {
        return `## 🧭 جهت‌گیری موضوعی داستان:
موضوع پیشنهادی: «${topic.trim()}»

این موضوع را به عنوان **جهت‌گیری** در نظر بگیر، نه یک چارچوب سخت. اگر مسیر داستان جایی دیگر رفت که بهتر بود، آزاد باش. اما به طور کلی بافت داستان به این سمت متمایل باشد.`;
    },

    /**
     * شخصیت اصلی - تأکید قوی روی ویژگی‌ها
     */
    _buildMainCharacterSection(winner) {
        const name = winner.name || winner.label || 'شخصیت ناشناس';
        let text = `## 🎭 شخصیت اصلی: «${name}»\n`;

        if (winner.description && winner.description.trim()) {
            text += `**ویژگی‌ها و شخصیت این فرد:**\n${winner.description}\n\n`;
            text += `این ویژگی‌ها را **کاملاً جدی بگیر**. تمام رفتار، دیالوگ‌ها، تصمیم‌ها و واکنش‌های این شخصیت در داستان باید مستقیماً از این ویژگی‌ها بیرون بیایند. اگر کسی این داستان را بخواند، باید بتواند این شخصیت را از روی رفتارش بشناسد.`;
        } else {
            text += `(توصیفی برای این فرد ثبت نشده - شخصیتی جذاب، منحصر به فرد و باورپذیر برایش بساز که در طول داستان ثابت بماند)`;
        }

        return text;
    },

    /**
     * شخصیت‌های فرعی - تأکید روی استفاده از ویژگی‌هایشان
     */
    _buildSupportingSection(characters) {
        const lines = characters.map((c, i) => {
            let line = `${i + 1}. **${c.name}**`;
            if (c.description && c.description.trim()) {
                line += `\n   ویژگی‌ها: ${c.description}`;
            }
            return line;
        });

        return `## 👥 شخصیت‌های فرعی:
${lines.join('\n')}

**نکات مهم درباره شخصیت‌های فرعی:**
- همه‌ی این افراد باید در داستان **حضور واقعی** داشته باشند (نه فقط اسمشان برده شود)
- هرکدام باید **رفتار، دیالوگ یا واکنش** مختص خودش داشته باشد
- اگر ویژگی‌ای برایشان ذکر شده، آن ویژگی‌ها باید در رفتارشان **دیده شود** نه اینکه مستقیم گفته شود
- آن‌ها باید با شخصیت اصلی **تعامل** داشته باشند و داستان را پیش ببرند`;
    },

    /**
     * آیتم‌ها - بدون تأکید روی تعداد
     */
    _buildItemsSection(items, type) {
        const labels = items.map((it) => {
            const label = typeof it === 'string' ? it : it.label;
            return `- ${label}`;
        });

        let intro;
        if (type === 'receive') {
            intro = `## 🎁 آیتم‌های داستان (برنده در پایان این‌ها را دریافت می‌کند):`;
        } else {
            intro = `## 🎁 آیتم‌های داستان (برنده موظف است این‌ها را تهیه کند):`;
        }

        let text = `${intro}\n${labels.join('\n')}\n\n`;
        text += `**نکات مهم درباره آیتم‌ها:**
- همه‌ی این آیتم‌ها باید در **جریان داستان** ظاهر شوند
- نه فقط اسمشان - بلکه باید نقش داشته باشند، استفاده شوند، یا موقعیتی حولشان ساخته شود
- نحوه‌ی به دست آوردن، تهیه کردن یا دریافت کردنشان باید بخشی از روایت باشد`;

        return text;
    },

    /**
     * قوانین نهایی - بدون تعیین طول
     */
    _buildFinalRules() {
        return `## ✅ اصول نهایی:
- **تیتر:** داستان را با یک تیتر خلاقانه شروع کن (با ##)
- **پاراگراف‌بندی:** هر پاراگراف با یک خط خالی جدا شود
- **شخصیت اصلی:** در تمام داستان حاضر، محور و فعال باشد - ویژگی‌هایش را نشان بده
- **شخصیت‌های فرعی:** همه‌شان حضور مؤثر داشته باشند
- **آیتم‌ها:** همه‌شان در جریان داستان به کار گرفته شوند
- **پایان:** غیرمنتظره، باورپذیر و لذت‌بخش
- **زبان:** روان، طبیعی، بدون ترجمه‌زدگی و بدون کلیشه
- **آزادی خلاقیت:** خودت را محدود نکن. اگر مسیر بهتری برای داستان پیدا کردی، آن را انتخاب کن.`;
    },

    getSystemPrompt() {
        return AppState.get('settings.aiSystemPrompt') ||
            'تو یک داستان‌نویس خلاق، بامزه و فارسی‌زبان هستی که داستان‌های جذاب و سرگرم‌کننده می‌نویسد.';
    },

    estimateWords(text) {
        return (text || '').trim().split(/\s+/).length;
    },
};

window.PromptBuilder = PromptBuilder;