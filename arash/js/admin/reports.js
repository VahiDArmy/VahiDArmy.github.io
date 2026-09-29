/* ============================================
   گزارش‌ها
   ============================================ */

const AdminReports = {
    report: null,
    range: { from: null, to: null },
    
    render() {
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        return `
            <div class="admin-reports">
                <div class="reports-header">
                    <div>
                        <h1 class="dashboard-title">
                            <i class="ri-file-chart-line"></i>
                            <span>گزارش‌ها</span>
                        </h1>
                        <p class="dashboard-subtitle">گزارش‌گیری تفصیلی از فعالیت‌های سامانه</p>
                    </div>
                </div>
                
                <div class="reports-filters">
                    <div class="date-range">
                        <div class="date-input-wrap">
                            <label>از تاریخ</label>
                            <input type="date" id="date-from" class="form-input" value="${monthAgo}">
                        </div>
                        <div class="date-input-wrap">
                            <label>تا تاریخ</label>
                            <input type="date" id="date-to" class="form-input" value="${today}">
                        </div>
                    </div>
                    
                    <div class="quick-ranges">
                        <button class="quick-range-btn" data-range="today">امروز</button>
                        <button class="quick-range-btn" data-range="week">۷ روز اخیر</button>
                        <button class="quick-range-btn active" data-range="month">۳۰ روز اخیر</button>
                        <button class="quick-range-btn" data-range="quarter">۳ ماه اخیر</button>
                        <button class="quick-range-btn" data-range="year">یک سال اخیر</button>
                    </div>
                    
                    <div class="reports-actions">
                        <button class="btn btn-primary" id="generate-report">
                            <i class="ri-search-line"></i>
                            <span>تولید گزارش</span>
                        </button>
                        <button class="btn btn-success" id="export-excel">
                            <i class="ri-file-excel-2-line"></i>
                            <span>Excel</span>
                        </button>
                        <button class="btn btn-danger" id="export-pdf">
                            <i class="ri-file-pdf-2-line"></i>
                            <span>PDF</span>
                        </button>
                    </div>
                </div>
                
                <div id="report-content">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="ri-file-chart-line"></i>
                        </div>
                        <h3 class="empty-state-title">گزارشی تولید نشده است</h3>
                        <p class="empty-state-text">بازه تاریخ مورد نظر را انتخاب کرده و روی «تولید گزارش» کلیک کنید</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init() {
        const isAdmin = await AuthService.isAdmin();
        if (!isAdmin) {
            Router.navigate('welcome');
            return;
        }
        
        this.attachEvents();
    },
    
    /**
     * رویدادها
     */
    attachEvents() {
        // بازه‌های سریع
        document.querySelectorAll('.quick-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quick-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const range = btn.dataset.range;
                const to = new Date();
                const from = new Date();
                
                switch (range) {
                    case 'today': from.setHours(0, 0, 0, 0); break;
                    case 'week': from.setDate(from.getDate() - 7); break;
                    case 'month': from.setDate(from.getDate() - 30); break;
                    case 'quarter': from.setMonth(from.getMonth() - 3); break;
                    case 'year': from.setFullYear(from.getFullYear() - 1); break;
                }
                
                document.getElementById('date-from').value = from.toISOString().split('T')[0];
                document.getElementById('date-to').value = to.toISOString().split('T')[0];
            });
        });
        
        document.getElementById('generate-report')?.addEventListener('click', async () => {
            await this.generateReport();
        });
        
        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.exportCSV();
        });
        
        document.getElementById('export-pdf')?.addEventListener('click', () => {
            Toast.info('به زودی', 'خروجی PDF به زودی اضافه می‌شود');
        });
    },
    
    /**
     * تولید گزارش
     */
    async generateReport() {
        const from = document.getElementById('date-from').value;
        const to = document.getElementById('date-to').value;
        
        if (!from || !to) {
            Toast.warning('توجه', 'لطفاً بازه تاریخ را انتخاب کنید');
            return;
        }
        
        const btn = document.getElementById('generate-report');
        btn.classList.add('loading');
        btn.disabled = true;
        
        const container = document.getElementById('report-content');
        container.innerHTML = `
            <div class="loading-state">
                <div class="loader-coin"><i class="ri-coin-line"></i></div>
                <p>در حال تولید گزارش...</p>
            </div>
        `;
        
        try {
            const result = await AdminService.getReport(from, to + 'T23:59:59');
            
            if (result.success) {
                this.report = result.report;
                this.renderReport(result.report, from, to);
            } else {
                Toast.error('خطا', result.error);
            }
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    },
    
    /**
     * رندر گزارش
     */
    renderReport(report, from, to) {
        const container = document.getElementById('report-content');
        const s = report.summary;
        
        container.innerHTML = `
            <div class="report-info">
                <i class="ri-calendar-range-line"></i>
                <span>گزارش از <strong>${Format.date(from)}</strong> تا <strong>${Format.date(to)}</strong></span>
            </div>
            
            <div class="report-stats">
                <div class="report-stat">
                    <div class="report-stat-icon primary"><i class="ri-file-list-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.total)}</div>
                    <div class="report-stat-label">کل تراکنش‌ها</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-icon success"><i class="ri-check-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.approved)}</div>
                    <div class="report-stat-label">تایید شده</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-icon warning"><i class="ri-time-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.pending)}</div>
                    <div class="report-stat-label">در انتظار</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-icon danger"><i class="ri-close-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.rejected)}</div>
                    <div class="report-stat-label">رد شده</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-icon gold"><i class="ri-coins-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.totalCoins)}</div>
                    <div class="report-stat-label">مجموع سکه</div>
                </div>
                <div class="report-stat">
                    <div class="report-stat-icon gold"><i class="ri-money-dollar-circle-line"></i></div>
                    <div class="report-stat-value">${Format.number(s.totalAmount)}</div>
                    <div class="report-stat-label">مجموع مبلغ (تومان)</div>
                </div>
            </div>
            
            <div class="report-table-wrap">
                <div class="report-table-header">
                    <h3>جزئیات تراکنش‌ها</h3>
                    <span class="badge badge-primary">${Format.number(report.transactions.length)} مورد</span>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>کاربر</th>
                                <th>موبایل</th>
                                <th>تعداد سکه</th>
                                <th>مبلغ</th>
                                <th>وضعیت</th>
                                <th>تاریخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.transactions.length === 0 ? `
                                <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">موردی در این بازه وجود ندارد</td></tr>
                            ` : report.transactions.map(t => {
                                const status = Format.status(t.status);
                                return `
                                    <tr>
                                        <td><strong>${Helpers.escapeHtml(t.user?.name || 'نامشخص')}</strong></td>
                                        <td dir="ltr" style="text-align: right;">${Format.phone(t.user?.phone || '')}</td>
                                        <td>${Format.coin(t.coin_count)}</td>
                                        <td>${Format.price(t.amount)}</td>
                                        <td><span class="badge ${status.class}">${status.text}</span></td>
                                        <td>${Format.date(t.created_at)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },
    
    /**
     * خروجی CSV
     */
    exportCSV() {
        if (!this.report || this.report.transactions.length === 0) {
            Toast.warning('خروجی', 'ابتدا گزارشی تولید کنید');
            return;
        }
        
        const headers = ['نام', 'موبایل', 'تعداد سکه', 'مبلغ', 'وضعیت', 'تاریخ'];
        const rows = this.report.transactions.map(t => [
            t.user?.name || '',
            t.user?.phone || '',
            t.coin_count,
            t.amount,
            Format.status(t.status).text,
            Format.date(t.created_at)
        ]);
        
        const csv = [
            '\uFEFF' + headers.join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        Helpers.downloadFile(csv, `report_${Date.now()}.csv`, 'text/csv;charset=utf-8');
        Toast.success('دانلود شد', 'فایل گزارش با موفقیت دانلود شد');
    }
};