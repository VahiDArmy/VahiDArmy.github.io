/**
 * ساخت پرامپت - با تأکید قوی روی زبان فارسی
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

        return `🔴 **دستور قطعی و مهم:**

تو یک داستان‌نویس خلاق فارسی‌زبان هستی.

**⚠️ تمام خروجی تو باید ۱۰۰٪ به زبان فارسی باشد.**
- حتی یک کلمه انگلیسی ننویس
- هیچ فکر و تحلیلی ننویس
- فقط داستان بنویس
- از ابتدا تا انتها فارسی

**وظیفه:** یک داستان به زبان فارسی با لحن ${toneText} بنویس.

داستان باید حول **شخصیت اصلی** بچرخد و او را محور همه‌چیز قرار دهد.

**⚠️ نکته مهم:** اگر می‌خواهی «فکر کنی» یا «تحلیل کنی»، این کار را نکن. فقط مستقیم داستان را بنویس.`;
    },

    _buildTopicSection(topic) {
        return `## 🧭 جهت‌گیری موضوعی داستان:
موضوع پیشنهادی: «${topic.trim()}»

این موضوع را به عنوان **جهت‌گیری** در نظر بگیر. اگر مسیر بهتری پیدا کردی، آزاد باش.`;
    },

    _buildMainCharacterSection(winner) {
        const name = winner.name || winner.label || 'شخصیت ناشناس';
        let text = `## 🎭 شخصیت اصلی: «${name}»\n`;

        if (winner.description && winner.description.trim()) {
            text += `**ویژگی‌ها:**\n${winner.description}\n\n`;
            text += `این ویژگی‌ها را **کاملاً جدی بگیر**. تمام رفتار، دیالوگ‌ها، تصمیم‌ها و واکنش‌های این شخصیت باید مستقیماً از این ویژگی‌ها بیرون بیایند.`;
        } else {
            text += `(توصیفی ثبت نشده - شخصیتی جذاب و باورپذیر برایش بساز)`;
        }

        return text;
    },

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

**نکات:**
- همه‌ی این افراد باید در داستان **حضور واقعی** داشته باشند
- هرکدام باید رفتار، دیالوگ یا واکنش مختص خودش داشته باشد
- اگر ویژگی‌ای دارند، آن ویژگی‌ها باید در رفتارشان **دیده شود** نه گفته شود
- با شخصیت اصلی تعامل داشته باشند`;
    },

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

        return `${intro}\n${labels.join('\n')}\n\n**نکات:**
- همه‌ی این آیتم‌ها باید در **جریان داستان** ظاهر شوند
- نه فقط اسمشان - بلکه نقش داشته باشند
- نحوه‌ی تهیه یا دریافتشان بخشی از روایت باشد`;
    },

    _buildFinalRules() {
        return `## ✅ اصول نهایی:
- **زبان:** 🔴 **فقط فارسی** - حتی یک کلمه انگلیسی ننویس
- **تیتر:** با یک تیتر خلاقانه شروع کن (با ##)
- **پاراگراف‌بندی:** هر پاراگراف با خط خالی جدا شود
- **شخصیت اصلی:** در تمام داستان محور و فعال باشد
- **شخصیت‌های فرعی:** همه حضور مؤثر داشته باشند
- **آیتم‌ها:** همه در جریان داستان به کار گرفته شوند
- **پایان:** غیرمنتظره و لذت‌بخش
- **زبان:** روان، طبیعی، بدون ترجمه‌زدگی

🔴 **تأکید نهایی:** اگر یک کلمه غیرفارسی یا یک خط تحلیل یا reasoning در خروجی باشد، داستان رد می‌شود. فقط داستان فارسی بنویس.`;
    },

    getSystemPrompt() {
        const custom = AppState.get('settings.aiSystemPrompt');
        if (custom && custom.trim()) return custom;

        return `تو یک داستان‌نویس حرفه‌ای فارسی‌زبان هستی.

🔴 **قوانین قطعی:**
1. خروجی تو باید **۱۰۰٪ فارسی** باشد
2. هیچ reasoning، تحلیل، یا توضیح انگلیسی ننویس
3. فقط و فقط داستان بنویس
4. از ابتدا تا انتها فارسی
5. اگر کلمه‌ای معادل فارسی ندارد، از معادل رایج فارسی استفاده کن

**نقش تو:** نوشتن داستان‌های جذاب، بامزه و سرگرم‌کننده.`;
    },

    estimateWords(text) {
        return (text || '').trim().split(/\s+/).length;
    },
};

window.PromptBuilder = PromptBuilder;