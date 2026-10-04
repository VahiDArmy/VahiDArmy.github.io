/**
 * ساخت پرامپت هوش مصنوعی
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
            length = 'medium',
            extras = '',
        } = context;

        const parts = [];
        parts.push(this._getMainInstruction(tone, topic));

        if (winner) parts.push(this._buildMainCharacterSection(winner));
        if (supportingCharacters.length > 0) parts.push(this._buildSupportingSection(supportingCharacters));
        if (items.length > 0) parts.push(this._buildItemsSection(items, type));
        if (extras && extras.trim()) parts.push(`## 📌 درخواست ویژه‌ی کاربر:\n${extras.trim()}`);

        parts.push(this._buildFinalRules(length));

        return parts.join('\n\n');
    },

    _getMainInstruction(tone, topic) {
        const toneMap = {
            funny: 'طنزآمیز، بامزه و سرگرم‌کننده',
            epic: 'حماسی، پرتنش و پرهیجان',
            romantic: 'عاشقانه، احساسی و لطیف',
            mystery: 'معمایی، پر از رمز و راز',
            sarcastic: 'طعنه‌آمیز و کنایه‌دار',
            absurd: 'پوچ‌گرا و سورئال',
        };
        const toneText = toneMap[tone] || toneMap.funny;

        let text = `تو یک داستان‌نویس خلاق و فارسی‌زبان هستی که داستان‌های کوتاه ${toneText} می‌نویسد.`;
        text += `\n\n**وظیفه:** یک داستان کوتاه به زبان فارسی بنویس که حول شخصیت اصلی بچرخد و ویژگی‌های زیر را رعایت کند.`;

        if (topic && topic.trim()) {
            text += `\n\n**موضوع / محور داستان:** ${topic.trim()}`;
            text += `\nداستان باید حول این موضوع بچرخد اما نه به شکلی مستقیم و کلیشه‌ای.`;
        }

        return text;
    },

    _buildMainCharacterSection(winner) {
        const name = winner.name || winner.label || 'شخصیت ناشناس';
        let text = `## 🎭 شخصیت اصلی: «${name}»\n`;

        if (winner.description && winner.description.trim()) {
            text += `**توصیف:**\n${winner.description}`;
        } else {
            text += `(توصیفی ارائه نشده - شخصیتی جذاب و بامزه برای او بساز)`;
        }

        return text;
    },

    _buildSupportingSection(characters) {
        const lines = characters.map((c, i) => {
            let line = `${i + 1}. **${c.name}**`;
            if (c.description && c.description.trim()) {
                line += ` — ${c.description}`;
            }
            return line;
        });

        return `## 👥 شخصیت‌های فرعی (باید در داستان حاضر باشند و هرکدام نقش داشته باشند):
${lines.join('\n')}

این شخصیت‌ها را وارد جریان داستان کن - نه فقط اسمشان را ببر. هرکدام باید دیالوگ، رفتار یا نقشی داشته باشند.`;
    },

    _buildItemsSection(items, type) {
        const lines = items.map((it) => {
            const label = typeof it === 'string' ? it : it.label;
            const qty = typeof it === 'object' && it.quantity ? it.quantity : 1;
            const desc = typeof it === 'object' && it.description ? ` (${it.description})` : '';
            return `- **${label}** × **${qty}** عدد${desc}`;
        });

        let intro;
        if (type === 'receive') {
            intro = `## 🎁 آیتم‌هایی که برنده در پایان دریافت می‌کند:`;
        } else {
            intro = `## 🎁 آیتم‌هایی که برنده موظف است تهیه کند:`;
        }

        let text = `${intro}\n${lines.join('\n')}\n\n`;
        text += `**نکات مهم درباره آیتم‌ها:**
- تعداد دقیق هر آیتم را در داستان رعایت کن (مثلاً اگر نوشته "۵ عدد پفک"، حتماً ۵ عدد در داستان باشد)
- آیتم‌ها باید در **جریان داستان** استفاده شوند، نه فقط اسمشان برده شود
- نحوه‌ی به دست آوردن/تهیه/دریافت آن‌ها بخشی از داستان باشد`;

        return text;
    },

    _buildFinalRules(length) {
        const lengthMap = {
            short: 'حدود ۸۰ تا ۱۲۰ کلمه',
            medium: 'حدود ۱۵۰ تا ۲۵۰ کلمه',
            long: 'حدود ۳۰۰ تا ۵۰۰ کلمه',
        };
        const lengthText = lengthMap[length] || lengthMap.medium;

        return `## ✅ الزامات نهایی:
- **طول:** ${lengthText}
- **تیتر:** با ## شروع کن (تیتر خلاقانه)
- **پاراگراف‌بندی:** هر پاراگراف با یک خط خالی جدا شود
- **شخصیت اصلی:** در تمام داستان حاضر باشد و محور باشد
- **شخصیت‌های فرعی:** همه‌شان نقشی داشته باشند
- **آیتم‌ها:** همه‌شان با تعداد دقیق در داستان به کار روند
- **پایان:** غیرمنتظره و لذت‌بخش
- **زبان:** روان، طبیعی، بدون ترجمه‌زدگی`;
    },

    getSystemPrompt() {
        return AppState.get('settings.aiSystemPrompt') ||
            'تو یک داستان‌نویس خلاق، بامزه و فارسی‌زبان هستی که داستان‌های کوتاه و خنده‌دار می‌نویسد.';
    },

    estimateWords(text) {
        return (text || '').trim().split(/\s+/).length;
    },
};

window.PromptBuilder = PromptBuilder;