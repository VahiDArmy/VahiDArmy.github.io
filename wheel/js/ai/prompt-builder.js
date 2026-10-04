/**
 * ساخت پرامپت هوش مصنوعی
 * - برنده = شخصیت اصلی
 * - سایر افراد گردونه = شخصیت‌های فرعی
 * - آیتم‌ها = عناصر داستان
 * @module promptBuilder
 */

const PromptBuilder = {
    buildStoryPrompt(context = {}) {
        const {
            winner = null,
            supportingCharacters = [],
            items = [],
            descriptions = {},
            tone = 'funny',
            length = 'medium',
            extras = '',
        } = context;

        const parts = [];

        parts.push(this._getMainInstruction(tone));

        // شخصیت اصلی
        if (winner) {
            parts.push(this._buildMainCharacterSection(winner));
        }

        // شخصیت‌های فرعی
        if (supportingCharacters.length > 0) {
            parts.push(this._buildSupportingSection(supportingCharacters));
        }

        // آیتم‌ها
        if (items.length > 0) {
            parts.push(this._buildItemsSection(items));
        }

        // توصیفات اضافی
        const descSection = this._buildDescriptionsSection(descriptions);
        if (descSection) parts.push(descSection);

        // توضیحات کاربر
        if (extras && extras.trim()) {
            parts.push(`**درخواست ویژه از کاربر:** ${extras.trim()}`);
        }

        // قوانین نهایی
        parts.push(this._buildFinalRules(length));

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

        return `تو یک داستان‌نویس خلاق و فارسی‌زبان هستی.
وظیفه‌ی تو: نوشتن یک داستان کوتاه ${toneText} به زبان فارسی.

**قوانین کلی:**
- داستان باید یک **تیتر خلاقانه** داشته باشد (با ## در ابتدا)
- داستان باید **شخصیت‌محور** باشد؛ یعنی حول شخصیت اصلی بچرخد
- **شخصیت اصلی** داستان، فردی است که در بخش «شخصیت اصلی» معرفی می‌شود
- **شخصیت‌های فرعی** حتماً باید در داستان نقش داشته باشند (نه فقط اسمشان بیاید)
- **آیتم‌های داده‌شده** باید در جریان داستان استفاده شوند (نه فقط اسم برده شوند)
- لحن، حالت و رفتار شخصیت‌ها باید با توصیفاتشان هماهنگ باشد
- پایان‌بندی باید **غافلگیرکننده** باشد
- از کلیشه و تکرار پرهیز کن`;
    },

    _buildMainCharacterSection(winner) {
        const name = winner.name || winner.label || 'شخصیت ناشناس';
        let text = `## 🎭 شخصیت اصلی داستان: «${name}»\n`;

        if (winner.description && winner.description.trim()) {
            text += `**توصیف شخصیت:**\n${winner.description}`;
        } else {
            text += `**توصیف شخصیت:** (توصیفی ارائه نشده - آزاد باش تا شخصیتی جذاب برای او بسازی)`;
        }

        return text;
    },

    _buildSupportingSection(characters) {
        const lines = characters.map((c, i) => {
            let line = `${i + 1}. **${c.name}**`;
            if (c.description && c.description.trim()) {
                line += ` — ${c.description}`;
            } else {
                line += ` — (بدون توصیف خاص)`;
            }
            return line;
        });

        return `## 👥 شخصیت‌های فرعی (باید در داستان نقش داشته باشند):
${lines.join('\n')}

این شخصیت‌ها را در جریان داستان وارد کن و به هرکدام نقشی بده.`;
    },

    _buildItemsSection(items) {
        const lines = items.map((it) => {
            const label = typeof it === 'string' ? it : it.label;
            const desc = typeof it === 'object' && it.description ? ` — ${it.description}` : '';
            return `- ${label}${desc}`;
        });

        return `## 🎁 آیتم‌های قابل استفاده در داستان:
${lines.join('\n')}

این آیتم‌ها را در جریان داستان به کار بگیر (نه فقط اسمشان را ببر).`;
    },

    _buildDescriptionsSection(descriptions) {
        // فقط توصیفاتی که به افراد داده نشده را می‌گیریم تا دوباره تکرار نشود
        const entries = Object.entries(descriptions)
            .filter(([, v]) => v && v.trim());
        if (entries.length === 0) return '';

        // اگر قبلاً در بخش‌های قبل آمده، اینجا تکرار نکن
        // اینجا فقط به عنوان مرجع کلی هست
        return ''; // دیگر نیازی نیست - قبلاً در بخش‌های اصلی آمده
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
- **تیتر:** با ## شروع کن
- **پاراگراف‌بندی:** هر پاراگراف با یک خط خالی جدا شود
- **شخصیت اصلی:** حتماً در تمام داستان حاضر باشد
- **شخصیت‌های فرعی:** همه‌شان حداقل یک بار در داستان ظاهر شوند و نقشی داشته باشند
- **آیتم‌ها:** همه‌شان در جریان داستان استفاده شوند
- **پایان:** غیرمنتظره و لذت‌بخش
- **زبان:** روان، طبیعی و مناسب داستان`;
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