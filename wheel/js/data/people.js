/**
 * مدیریت افراد
 * - getAll = همه افراد جعبه ابزار
 * - getInWheel = افرادی که در گردونه هستند
 * @module people
 */

const People = {
    // ═══════════════════════════════════════════
    // جعبه ابزار (همه افراد)
    // ═══════════════════════════════════════════

    getAll() {
        return AppState.get('people') || [];
    },

    getById(id) {
        return this.getAll().find((p) => p.id === id);
    },

    // ═══════════════════════════════════════════
    // گردونه (کارگاه)
    // ═══════════════════════════════════════════

    getInWheel() {
        return this.getAll().filter((p) => p.inWheel);
    },

    getStarredInWheel() {
        return this.getInWheel().filter((p) => p.starred);
    },

    /** افزودن به گردونه (بدون تغییر دیتابیس) */
    addToWheel(id) {
        const person = this.getById(id);
        if (!person || person.inWheel) return false;

        SQLStorage.addPersonToWheel(id);

        const people = this.getAll();
        const index = people.findIndex((p) => p.id === id);
        if (index !== -1) {
            people[index] = { ...people[index], inWheel: true };
            AppState.set('people', people);
        }
        return true;
    },

    /** حذف از گردونه (فرد در دیتابیس می‌ماند) */
    removeFromWheel(id) {
        const person = this.getById(id);
        if (!person) return false;

        SQLStorage.removePersonFromWheel(id);

        const people = this.getAll();
        const index = people.findIndex((p) => p.id === id);
        if (index !== -1) {
            people[index] = { ...people[index], inWheel: false };
            AppState.set('people', people);
        }
        return true;
    },

    /** افزودن گروهی به گردونه */
    addManyToWheel(ids) {
        ids.forEach((id) => this.addToWheel(id));
    },

    // ═══════════════════════════════════════════
    // افزودن فرد جدید (به جعبه ابزار)
    // ═══════════════════════════════════════════

    /**
     * افزودن فرد جدید
     * @param {object} person - اطلاعات فرد
     * @param {boolean} [inWheel=true] - اگر true، بلافاصله در گردونه هم قرار می‌گیرد
     */
    add(person, inWheel = true) {
        const newPerson = SQLStorage.addPerson({ ...person, in_wheel: inWheel });
        if (!newPerson) return null;

        const normalized = {
            ...newPerson,
            starred: newPerson.starred === 1,
            inWheel: newPerson.in_wheel === 1,
            createdAt: newPerson.created_at,
            updatedAt: newPerson.updated_at,
        };

        const people = this.getAll();
        people.push(normalized);
        AppState.set('people', people);

        this._sync();
        return normalized;
    },

    // ═══════════════════════════════════════════
    // ویرایش
    // ═══════════════════════════════════════════

    update(id, updates) {
        // ترجمه inWheel به in_wheel
        const mapped = { ...updates };
        if ('inWheel' in mapped) {
            mapped.inWheel = mapped.inWheel ? 1 : 0;
        }

        const updated = SQLStorage.updatePerson(id, mapped);
        if (!updated) return null;

        const normalized = {
            ...updated,
            starred: updated.starred === 1,
            inWheel: updated.in_wheel === 1,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
        };

        const people = this.getAll();
        const index = people.findIndex((p) => p.id === id);
        if (index !== -1) {
            people[index] = normalized;
            AppState.set('people', people);
        }

        this._sync();
        return normalized;
    },

    // ═══════════════════════════════════════════
    // حذف (واقعی از دیتابیس)
    // ═══════════════════════════════════════════

    remove(id) {
        const person = this.getById(id);
        if (!person) return false;

        SQLStorage.removePerson(id);

        const people = this.getAll().filter((p) => p.id !== id);
        AppState.set('people', people);

        this._sync();
        return true;
    },

    clear() {
        const people = this.getAll();
        people.forEach((p) => SQLStorage.removePerson(p.id));
        AppState.set('people', []);
        this._sync();
    },

    toggleStar(id) {
        const person = this.getById(id);
        if (!person) return null;
        return this.update(id, { starred: !person.starred });
    },

    // ═══════════════════════════════════════════
    // جستجو و مرتب‌سازی
    // ═══════════════════════════════════════════

    search(query, list = null) {
        const src = list || this.getAll();
        const q = (query || '').toLowerCase();
        return src.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    },

    sort(by = 'name', order = 'asc', list = null) {
        const src = [...(list || this.getAll())];
        src.sort((a, b) => {
            let cmp = 0;
            if (by === 'name') cmp = a.name.localeCompare(b.name, 'fa');
            else if (by === 'date') cmp = (a.createdAt || 0) - (b.createdAt || 0);
            else if (by === 'starred') cmp = (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
            return order === 'asc' ? cmp : -cmp;
        });
        return src;
    },

    async _sync() {
        await SQLStorage.saveNow();
    },
};

window.People = People;