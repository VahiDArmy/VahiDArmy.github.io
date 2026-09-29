/* ============================================
   مدیریت مشارکت‌کنندگان
   نسخه ۲.۰ - حذف هوشمند با هشدار
   ============================================ */

const AdminParticipants = {
    participants: [],
    filtered: [],
    currentFilter: 'all',
    searchQuery: '',
    
    render() {
        return `
            <div class="admin-participants">
                <div class="participants-header">
                    <div>
                        <h1 class="dashboard-title">
                            <i class="ri-group-line"></i>
                            <span>مدیریت مشارکت‌کنندگان</span>
                        </h1>
                        <p class="dashboard-subtitle">مشاهده، بررسی و مدیریت فیش‌های ارسالی</p>
                    </div>
                </div>
                
                <div class="participants-toolbar">
                    <div class="toolbar-search">
                        <i class="ri-search-line"></i>
                        <input type="text" id="search-input" placeholder="جستجو بر اساس نام یا شماره موبایل...">
                        <button class="search-clear" id="search-clear" style="display: none;">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>
                    
                    <div class="toolbar-filters">
                        <button class="filter-btn active" data-filter="all">
                            <i class="ri-apps-2-line"></i>
                            <span>همه</span>
                        </button>
                        <button class="filter-btn" data-filter="pending">
                            <i class="ri-time-line"></i>
                            <span>در انتظار</span>
                        </button>
                        <button class="filter-btn" data-filter="approved">
                            <i class="ri-check-line"></i>
                            <span>تایید شده</span>
                        </button>
                        <button class="filter-btn" data-filter="rejected">
                            <i class="ri-close-line"></i>
                            <span>رد شده</span>
                        </button>
                    </div>
                    
                    <div class="toolbar-actions">
                        <button class="btn btn-secondary btn-sm" id="export-participants">
                            <i class="ri-download-2-line"></i>
                            <span>خروجی</span>
                        </button>
                    </div>
                </div>
                
                <div class="filter-summary" id="filter-summary"></div>
                
                <div id="participants-list">
                    <div class="loading-state">
                        <div class="loader-coin"><i class="ri-coin-line"></i></div>
                        <p>در حال بارگذاری...</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init() {
        const isAdmin = await AuthService.isAdmin();
        if (!isAdmin) {
            Toast.error('دسترسی', 'دسترسی غیرمجاز');
            Router.navigate('welcome');
            return;
        }
        
        await this.loadParticipants();
        this.attachEvents();
    },
    
    async loadParticipants() {
        const result = await AdminService.getParticipants();
        
        if (!result.success) {
            Toast.error('خطا', result.error);
            return;
        }
        
        this.participants = result.participants;
        this.applyFilters();
    },
    
    applyFilters() {
        let filtered = [...this.participants];
        
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(p => p.status === this.currentFilter);
        }
        
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p => 
                p.user?.name?.toLowerCase().includes(q) ||
                p.user?.phone?.includes(q) ||
                p.id?.toLowerCase().includes(q)
            );
        }
        
        this.filtered = filtered;
        this.renderList();
        this.renderSummary();
    },
    
    renderSummary() {
        const summary = document.getElementById('filter-summary');
        if (!summary) return;
        
        const counts = {
            all: this.participants.length,
            pending: this.participants.filter(p => p.status === 'pending').length,
            approved: this.participants.filter(p => p.status === 'approved').length,
            rejected: this.participants.filter(p => p.status === 'rejected').length
        };
        
        summary.innerHTML = `
            <div class="summary-item">
                <span>نمایش</span>
                <strong>${Format.number(this.filtered.length)}</strong>
                <span>از ${Format.number(this.participants.length)} مورد</span>
            </div>
            <div class="summary-badges">
                <span class="summary-badge badge-pending">
                    <i class="ri-time-line"></i>
                    ${Format.number(counts.pending)} در انتظار
                </span>
                <span class="summary-badge badge-approved">
                    <i class="ri-check-line"></i>
                    ${Format.number(counts.approved)} تایید شده
                </span>
                <span class="summary-badge badge-rejected">
                    <i class="ri-close-line"></i>
                    ${Format.number(counts.rejected)} رد شده
                </span>
            </div>
        `;
    },
    
    renderList() {
        const container = document.getElementById('participants-list');
        
        if (this.filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="ri-inbox-line"></i>
                    </div>
                    <h3 class="empty-state-title">موردی یافت نشد</h3>
                    <p class="empty-state-text">${this.searchQuery ? 'نتیجه‌ای برای جستجوی شما وجود ندارد' : 'هنوز مشارکتی در این بخش ثبت نشده است'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="table-container">
                <table class="table participants-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"></th>
                            <th>کاربر</th>
                            <th>شماره موبایل</th>
                            <th>تعداد سکه</th>
                            <th>مبلغ</th>
                            <th>وضعیت</th>
                            <th>تاریخ ثبت</th>
                            <th style="width: 120px;">اقدامات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filtered.map(p => this.renderRow(p)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        this.attachRowEvents();
    },
    
    renderRow(p) {
        const status = Format.status(p.status);
        
        return `
            <tr data-id="${p.id}">
                <td>
                    <div class="row-avatar" style="background: ${Helpers.randomColor()}">
                        ${Helpers.getInitials(p.user?.name || 'کاربر')}
                    </div>
                </td>
                <td>
                    <div class="cell-user">
                        <strong>${Helpers.escapeHtml(p.user?.name || 'نامشخص')}</strong>
                        <span class="cell-id">#${p.id.substring(0, 8)}</span>
                    </div>
                </td>
                <td>
                    <div class="cell-phone">${Format.phone(p.user?.phone || '')}</div>
                </td>
                <td>
                    <div class="cell-coins">
                        <i class="ri-coins-line"></i>
                        <strong>${Format.number(p.coin_count)}</strong>
                    </div>
                </td>
                <td>
                    <div class="cell-amount">${Format.price(p.amount)}</div>
                </td>
                <td>
                    <span class="badge ${status.class}">
                        <i class="${status.icon}"></i>
                        ${status.text}
                    </span>
                </td>
                <td>
                    <div class="cell-date">${Format.date(p.created_at)}</div>
                    <div class="cell-time">${Format.timeAgo(p.created_at)}</div>
                </td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn action-view" data-action="view" data-id="${p.id}" title="مشاهده جزئیات">
                            <i class="ri-eye-line"></i>
                        </button>
                        ${p.status === 'pending' ? `
                            <button class="action-btn action-approve" data-action="approve" data-id="${p.id}" title="تایید">
                                <i class="ri-check-line"></i>
                            </button>
                            <button class="action-btn action-reject" data-action="reject" data-id="${p.id}" title="رد">
                                <i class="ri-close-line"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn action-delete" data-action="delete" data-id="${p.id}" title="حذف">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },
    
    attachRowEvents() {
        document.querySelectorAll('.row-actions .action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                switch (action) {
                    case 'view':
                        await this.viewParticipant(id);
                        break;
                    case 'approve':
                        await this.approve(id);
                        break;
                    case 'reject':
                        await this.reject(id);
                        break;
                    case 'delete':
                        await this.delete(id);
                        break;
                }
            });
        });
        
        document.querySelectorAll('.participants-table tbody tr').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                const id = tr.dataset.id;
                this.viewParticipant(id);
            });
        });
    },
    
    async viewParticipant(id) {
        const p = this.participants.find(x => x.id === id);
        if (!p) return;
        
        let receiptHtml = '<p class="text-muted">فیشی آپلود نشده است</p>';
        
        if (p.receipt_url) {
            const url = await PaymentService.getReceiptUrl(p.receipt_url);
            if (url) {
                receiptHtml = `
                    <div class="receipt-preview-large">
                        <img src="${url}" alt="فیش" id="receipt-image" onclick="window.open('${url}', '_blank')">
                    </div>
                `;
            }
        } else if (p.receipt_text) {
            receiptHtml = `
                <div class="receipt-text-box">
                    <pre>${Helpers.escapeHtml(p.receipt_text)}</pre>
                </div>
            `;
        }
        
        const status = Format.status(p.status);
        
        const content = `
            <div class="participant-detail">
                <div class="detail-status-header status-${p.status}">
                    <div class="detail-status-icon-lg">
                        <i class="${status.icon}"></i>
                    </div>
                    <div>
                        <h3>${status.text}</h3>
                        <p>ثبت شده در ${Format.dateTime(p.created_at)}</p>
                    </div>
                </div>
                
                <div class="detail-sections">
                    <div class="detail-section">
                        <h4><i class="ri-user-line"></i> اطلاعات کاربر</h4>
                        <div class="detail-info-grid">
                            <div class="detail-info-item">
                                <span>نام کاربر</span>
                                <strong>${Helpers.escapeHtml(p.user?.name || 'نامشخص')}</strong>
                            </div>
                            <div class="detail-info-item">
                                <span>شماره موبایل</span>
                                <strong dir="ltr">${Format.phone(p.user?.phone || '')}</strong>
                            </div>
                            <div class="detail-info-item">
                                <span>شناسه تراکنش</span>
                                <strong>#${p.id.substring(0, 12)}</strong>
                            </div>
                            <div class="detail-info-item">
                                <span>آخرین ورود</span>
                                <strong>${p.user?.last_login ? Format.date(p.user.last_login) : '—'}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="ri-coins-line"></i> اطلاعات تراکنش</h4>
                        <div class="detail-info-grid">
                            <div class="detail-info-item highlight">
                                <span>تعداد سکه</span>
                                <strong class="text-gold">${Format.coin(p.coin_count)}</strong>
                            </div>
                            <div class="detail-info-item highlight">
                                <span>مبلغ</span>
                                <strong class="text-gold">${Format.price(p.amount)}</strong>
                            </div>
                            <div class="detail-info-item">
                                <span>قیمت هر سکه</span>
                                <strong>${Format.price(APP_CONFIG.COIN_PRICE)}</strong>
                            </div>
                            <div class="detail-info-item">
                                <span>نوع فیش</span>
                                <strong>${p.receipt_type === 'image' ? 'تصویری' : p.receipt_type === 'text' ? 'متنی' : '—'}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="ri-file-image-line"></i> فیش ارسالی</h4>
                        ${receiptHtml}
                    </div>
                    
                    ${p.admin_note ? `
                        <div class="detail-section">
                            <h4><i class="ri-message-line"></i> یادداشت ادمین</h4>
                            <div class="admin-note-box">
                                ${Helpers.escapeHtml(p.admin_note)}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${p.reviewed_at ? `
                        <div class="detail-section">
                            <h4><i class="ri-shield-check-line"></i> اطلاعات بررسی</h4>
                            <div class="detail-info-grid">
                                <div class="detail-info-item">
                                    <span>تاریخ بررسی</span>
                                    <strong>${Format.dateTime(p.reviewed_at)}</strong>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                ${p.status === 'pending' ? `
                    <div class="detail-edit-section">
                        <h4><i class="ri-edit-line"></i> ویرایش مقدار سکه (اختیاری)</h4>
                        <div class="edit-coins-box">
                            <button class="counter-btn" data-counter="minus">
                                <i class="ri-subtract-line"></i>
                            </button>
                            <input type="number" id="edit-coin-count" value="${p.coin_count}" min="1" max="100" class="counter-input">
                            <button class="counter-btn" data-counter="plus">
                                <i class="ri-add-line"></i>
                            </button>
                            <div class="edit-amount">
                                <span>مبلغ:</span>
                                <strong id="edit-amount">${Format.price(p.amount)}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-edit-section">
                        <h4><i class="ri-chat-3-line"></i> یادداشت برای کاربر (اختیاری)</h4>
                        <textarea id="admin-note" class="form-input" rows="3" placeholder="در صورت نیاز توضیحی برای کاربر بنویسید..."></textarea>
                    </div>
                ` : ''}
            </div>
        `;
        
        const footer = p.status === 'pending' ? `
            <button class="btn btn-danger" id="modal-reject">
                <i class="ri-close-line"></i>
                <span>رد کردن</span>
            </button>
            <button class="btn btn-success" id="modal-approve">
                <i class="ri-check-line"></i>
                <span>تایید و افزودن سکه</span>
            </button>
        ` : `
            <button class="btn btn-secondary" id="modal-close">بستن</button>
        `;
        
        const modal = Modal.show({
            title: 'جزئیات مشارکت',
            content,
            footer,
            size: 'lg'
        });
        
        this.attachModalEvents(modal, p);
    },
    
    attachModalEvents(modal, p) {
        const coinInput = modal.querySelector('#edit-coin-count');
        const amountDisplay = modal.querySelector('#edit-amount');
        
        if (coinInput) {
            coinInput.addEventListener('input', () => {
                const val = parseInt(coinInput.value) || 0;
                const amount = val * APP_CONFIG.COIN_PRICE;
                if (amountDisplay) amountDisplay.textContent = Format.price(amount);
            });
        }
        
        modal.querySelectorAll('[data-counter]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!coinInput) return;
                const current = parseInt(coinInput.value) || 1;
                const action = btn.dataset.counter;
                const newVal = action === 'plus' ? current + 1 : Math.max(1, current - 1);
                coinInput.value = newVal;
                coinInput.dispatchEvent(new Event('input'));
            });
        });
        
        modal.querySelector('#modal-close')?.addEventListener('click', () => Modal.close());
        
        modal.querySelector('#modal-approve')?.addEventListener('click', async () => {
            const newCount = parseInt(coinInput?.value) || p.coin_count;
            const note = modal.querySelector('#admin-note')?.value.trim() || '';
            
            await this.approve(p.id, newCount, note);
            Modal.close();
        });
        
        modal.querySelector('#modal-reject')?.addEventListener('click', async () => {
            const note = modal.querySelector('#admin-note')?.value.trim() || '';
            await this.reject(p.id, note);
            Modal.close();
        });
    },
    
    async approve(id, newCount = null, note = '') {
        const admin = Storage.getUser();
        const p = this.participants.find(x => x.id === id);
        
        if (newCount && p && newCount !== p.coin_count) {
            await AdminService.updateTransaction(id, { coin_count: newCount }, admin.id);
        }
        
        const result = await AdminService.approveTransaction(id, admin.id, note);
        
        if (result.success) {
            Toast.success('تایید شد', 'تراکنش با موفقیت تایید و سکه‌ها به کاربر اضافه شد');
            await this.loadParticipants();
        } else {
            Toast.error('خطا', result.error);
        }
    },
    
    async reject(id, note = '') {
        const admin = Storage.getUser();
        
        const result = await AdminService.rejectTransaction(id, admin.id, note);
        
        if (result.success) {
            Toast.warning('رد شد', 'تراکنش رد شد');
            await this.loadParticipants();
        } else {
            Toast.error('خطا', result.error);
        }
    },
    
    /**
     * ✅ حذف هوشمند - با هشدار مخصوص هر وضعیت
     */
    async delete(id) {
        const p = this.participants.find(x => x.id === id);
        if (!p) return;
        
        // ساخت پیام بر اساس وضعیت
        let message = '';
        let warningType = 'danger';
        
        if (p.status === 'approved') {
            message = `
                این تراکنش <strong style="color: var(--color-success-600);">تایید شده</strong> است و
                <strong style="color: var(--color-danger-600);">${Format.coin(p.coin_count)}</strong>
                از سکه‌های کاربر کم خواهد شد.
                <br><br>
                آیا مطمئن هستید؟
            `;
        } else if (p.status === 'pending') {
            message = `
                این تراکنش در وضعیت <strong style="color: var(--color-warning-600);">در انتظار</strong> است.
                با حذف، این درخواست کاملاً پاک می‌شود.
                <br><br>
                آیا مطمئن هستید؟
            `;
        } else if (p.status === 'rejected') {
            message = `
                این تراکنش <strong style="color: var(--color-danger-600);">رد شده</strong> است.
                با حذف، این رکورد کاملاً پاک می‌شود.
                <br><br>
                آیا مطمئن هستید؟
            `;
        }
        
        const confirmed = await Modal.confirm({
            title: 'حذف تراکنش',
            message,
            confirmText: 'بله، حذف کن',
            cancelText: 'انصراف',
            type: warningType
        });
        
        if (!confirmed) return;
        
        const admin = Storage.getUser();
        const loadingToast = Toast.loading('در حال حذف...', 'لطفاً صبر کنید');
        
        const result = await AdminService.deleteTransaction(id, admin.id);
        
        Toast.dismiss(loadingToast);
        
        if (result.success) {
            if (p.status === 'approved') {
                Toast.success('حذف شد', `${Format.coin(p.coin_count)} از کاربر کم و تراکنش حذف شد`);
            } else {
                Toast.success('حذف شد', 'تراکنش با موفقیت حذف شد');
            }
            await this.loadParticipants();
        } else {
            Toast.error('خطا در حذف', result.error);
        }
    },
    
    attachEvents() {
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear');
        
        searchInput?.addEventListener('input', Helpers.debounce((e) => {
            this.searchQuery = e.target.value;
            clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
            this.applyFilters();
        }, 300));
        
        clearBtn?.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            clearBtn.style.display = 'none';
            this.applyFilters();
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.applyFilters();
            });
        });
        
        document.getElementById('export-participants')?.addEventListener('click', () => {
            this.exportCSV();
        });
    },
    
    exportCSV() {
        if (this.filtered.length === 0) {
            Toast.warning('خروجی', 'داده‌ای برای خروجی وجود ندارد');
            return;
        }
        
        const headers = ['نام', 'موبایل', 'تعداد سکه', 'مبلغ (تومان)', 'وضعیت', 'تاریخ'];
        const rows = this.filtered.map(p => [
            p.user?.name || '',
            p.user?.phone || '',
            p.coin_count,
            p.amount,
            Format.status(p.status).text,
            Format.date(p.created_at)
        ]);
        
        const csvContent = [
            '\uFEFF' + headers.join(','),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        Helpers.downloadFile(csvContent, `participants_${Date.now()}.csv`, 'text/csv;charset=utf-8');
        Toast.success('خروجی', 'فایل با موفقیت دانلود شد');
    }
};