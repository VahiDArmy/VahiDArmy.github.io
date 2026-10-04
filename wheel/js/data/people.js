/**
 * مدیریت افراد - متصل به SQLStorage
 * @module people
 */

const People = {
    /**
     * دریافت همه افراد
     */
    getAll() {
        return AppState.get('people') || [];
    },

    /**
     * دریافت فرد با شناسه
     */
    getById(id) {
        return this.getAll().find((p) => p.id === id);
    },

    /**
     * افزودن فرد
     */
    add(person) {
        const newPerson = SQLStorage.addPerson(person);
        if (!newPerson) return null;

        const normalized = {
            ...newPerson,
            starred: newPerson.starred === 1,
            createdAt: newPerson.created_at,
            updatedAt: newPerson.updated_at,
        };

        const people = this.getAll();
        people.push(normalized);
        AppState.set('people', people);

        Notification.success(`«${normalized.name}» با موفقیت افزوده شد`);
        this._sync();
        return normalized;
    },

    /**
     * ویرایش فرد
     */
    update(id, updates) {
        const updated = SQLStorage.updatePerson(id, updates);
        if (!updated) return null;

        const normalized = {
            ...updated,
            starred: updated.starred === 1,
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

    /**
     * حذف فرد
     */
    remove(id) {
        const person = this.getById(id);
        if (!person) return false;

        SQLStorage.removePerson(id);

        const people = this.getAll().filter((p) => p.id !== id);
        AppState.set('people', people);

        Notification.info(`«${person.name}» حذف شد`);
        this._sync();
        return true;
    },

    /**
     * تغییر وضعیت ستاره
     */
    toggleStar(id) {
        const person = this.getById(id);
        if (!person) return null;
        return this.update(id, { starred: !person.starred });
    },

    /**
     * حذف همه
     */
    clear() {
        const people = this.getAll();
        people.forEach((p) => SQLStorage.removePerson(p.id));
        AppState.set('people', []);
        this._sync();
        Notification.info('همه افراد حذف شدند');
    },

    /**
     * جستجو
     */
    search(query) {
        const q = query.toLowerCase();
        return this.getAll().filter((p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    },

    /**
     * دریافت ستاره‌دارها
     */
    getStarred() {
        return this.getAll().filter((p) => p.starred);
    },

    /**
     * مرتب‌سازی
     */
    sort(by = 'name', order = 'asc') {
        const people = [...this.getAll()];
        people.sort((a, b) => {
            let comparison = 0;
            if (by === 'name') comparison = a.name.localeCompare(b.name, 'fa');
            else if (by === 'date') comparison = (a.createdAt || 0) - (b.createdAt || 0);
            else if (by === 'starred') comparison = (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
            return order === 'asc' ? comparison : -comparison;
        });
        return people;
    },

    /**
     * همگام‌سازی با GitHub
     */
    async _sync() {
        await SQLStorage.saveNow();
        if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
            try {
                await GitHubStorage.savePeople(this.getAll());
            } catch (e) {
                console.error('خطا در همگام‌سازی افراد:', e);
            }
        }
    },
};

window.People = People;