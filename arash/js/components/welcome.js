/* ============================================
   صفحه خوش‌آمدگویی
   ============================================ */

const WelcomePage = {
    render() {
        return `
            <div class="welcome-page">
                <!-- پس‌زمینه ذرات -->
                <div class="bg-particles" id="bg-particles"></div>
                
                <!-- هدر -->
                <div class="welcome-hero">
                    <div class="hero-badge animate-fade-in-down">
                        <i class="ri-sparkling-2-fill"></i>
                        <span>هدیه‌ای برای آغاز زیبا</span>
                    </div>
                    
                    <h1 class="hero-title animate-fade-in-up">
                        <span class="hero-title-line">شادباش</span>
                        <span class="hero-title-line gradient">ازدواج</span>
                    </h1>
                    
                    <p class="hero-subtitle animate-fade-in-up delay-200">
                        در جشن عروسی عزیزانتان سهیم شوید و با هدیه‌ای ماندگار،
                        شادی این لحظه‌های ناب را برای همیشه جاودانه کنید.
                    </p>
                    
                    <div class="hero-actions animate-fade-in-up delay-300">
                        <a href="#auth" class="btn btn-gold btn-xl btn-pulse-gold" data-nav>
                            <i class="ri-heart-3-fill"></i>
                            <span>می‌خواهم مشارکت کنم</span>
                            <i class="ri-arrow-left-line"></i>
                        </a>
                    </div>
                    
                    <!-- انیمیشن سکه‌های شناور -->
                    <div class="hero-coins">
                        ${[1,2,3,4,5].map(i => `
                            <div class="floating-coin" style="--delay: ${i * 0.5}s; --x: ${Math.random() * 100}%;">
                                <i class="ri-coins-fill"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- توضیحات سکه -->
                <section class="welcome-section">
                    <div class="section-header">
                        <div class="section-badge">ارزش هر سکه</div>
                        <h2 class="section-title">یک سکه، هزار آرزو</h2>
                        <p class="section-subtitle">
                            هر سکه معادل <strong>۱۰۰,۰۰۰ تومان</strong> است و در جمع‌آوری هدیه عروسی شریک می‌شود
                        </p>
                    </div>
                    
                    <div class="value-showcase">
                        <div class="value-card animate-fade-in-up">
                            <div class="value-icon">
                                <i class="ri-coins-line"></i>
                            </div>
                            <div class="value-amount">۱ سکه</div>
                            <div class="value-price">۱۰۰,۰۰۰ تومان</div>
                            <div class="value-desc">شروع یک همراهی زیبا</div>
                        </div>
                        
                        <div class="value-equals">
                            <i class="ri-equal-line"></i>
                        </div>
                        
                        <div class="value-card value-card-gift animate-fade-in-up delay-200">
                            <div class="value-icon">
                                <i class="ri-heart-2-line"></i>
                            </div>
                            <div class="value-amount">یک هدیه ارزشمند</div>
                            <div class="value-price">شادی جاودان</div>
                            <div class="value-desc">یادگاری از طرف شما</div>
                        </div>
                    </div>
                </section>
                
                <!-- آمار زنده -->
                <section class="welcome-section">
                    <div class="section-header">
                        <div class="section-badge">آمار زنده</div>
                        <h2 class="section-title">همراهان این جشن</h2>
                        <p class="section-subtitle">ببینید چند نفر تا امروز در این شادی سهیم شده‌اند</p>
                    </div>
                    
                    <div id="stats-container"></div>
                </section>
                
                <!-- ویژگی‌ها -->
                <section class="welcome-section">
                    <div class="section-header">
                        <div class="section-badge">چرا شادباش ازدواج؟</div>
                        <h2 class="section-title">تجربه‌ای متفاوت از هدیه دادن</h2>
                    </div>
                    
                    <div class="features-grid">
                        <div class="feature-card stagger-item">
                            <div class="feature-icon feature-icon-pink">
                                <i class="ri-shield-check-line"></i>
                            </div>
                            <h3>امنیت کامل</h3>
                            <p>اطلاعات شما با رمزنگاری پیشرفته محافظت می‌شود</p>
                        </div>
                        
                        <div class="feature-card stagger-item">
                            <div class="feature-icon feature-icon-gold">
                                <i class="ri-flashlight-line"></i>
                            </div>
                            <h3>تایید سریع</h3>
                            <p>فیش‌های شما در کوتاه‌ترین زمان بررسی و تایید می‌شوند</p>
                        </div>
                        
                        <div class="feature-card stagger-item">
                            <div class="feature-icon feature-icon-green">
                                <i class="ri-gift-2-line"></i>
                            </div>
                            <h3>هدیه ماندگار</h3>
                            <p>یادگاری نفیس و ماندگار از طرف شما برای عروس و داماد</p>
                        </div>
                        
                        <div class="feature-card stagger-item">
                            <div class="feature-icon feature-icon-blue">
                                <i class="ri-customer-service-2-line"></i>
                            </div>
                            <h3>پشتیبانی ۲۴/۷</h3>
                            <p>تیم پشتیبانی همیشه آماده پاسخگویی به شماست</p>
                        </div>
                    </div>
                </section>
                
                <!-- مراحل -->
                <section class="welcome-section">
                    <div class="section-header">
                        <div class="section-badge">فقط در ۴ گام</div>
                        <h2 class="section-title">چطور مشارکت کنم؟</h2>
                    </div>
                    
                    <div class="steps-container">
                        <div class="step-item stagger-item">
                            <div class="step-number">۱</div>
                            <div class="step-content">
                                <h3>ثبت‌نام سریع</h3>
                                <p>با نام و شماره موبایل خود وارد شوید</p>
                            </div>
                        </div>
                        
                        <div class="step-item stagger-item">
                            <div class="step-number">۲</div>
                            <div class="step-content">
                                <h3>انتخاب سکه</h3>
                                <p>تعداد سکه‌های مورد نظر خود را انتخاب کنید</p>
                            </div>
                        </div>
                        
                        <div class="step-item stagger-item">
                            <div class="step-number">۳</div>
                            <div class="step-content">
                                <h3>واریز مبلغ</h3>
                                <p>مبلغ را به شماره کارت اعلامی واریز نمایید</p>
                            </div>
                        </div>
                        
                        <div class="step-item stagger-item">
                            <div class="step-number">۴</div>
                            <div class="step-content">
                                <h3>ارسال فیش</h3>
                                <p>فیش واریزی خود را آپلود کرده و منتظر تایید باشید</p>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- CTA نهایی -->
                <section class="welcome-cta">
                    <div class="cta-card">
                        <div class="cta-icon">
                            <i class="ri-heart-2-fill"></i>
                        </div>
                        <h2>آماده‌اید در این شادی سهیم شوید؟</h2>
                        <p>همین حالا مشارکت خود را شروع کنید و بخشی از این لحظه‌های زیبا باشید</p>
                        <a href="#auth" class="btn btn-gold btn-xl btn-pulse-gold" data-nav>
                            <i class="ri-arrow-left-line"></i>
                            <span>شروع مشارکت</span>
                        </a>
                    </div>
                </section>
                
                <!-- فوتر صفحه -->
                <footer class="welcome-footer">
                    <p>© ${new Date().getFullYear()} شادباش ازدواج - تمامی حقوق محفوظ است</p>
                    <p class="footer-made">ساخته شده با <i class="ri-heart-fill"></i> برای شادی شما</p>
                </footer>
            </div>
        `;
    },
    
    async init() {
        // ایجاد ذرات
        this.createParticles();
        
        // رندر آمار
        await Stats.render('stats-container');
        
        // انیمیشن ورود
        this.setupScrollAnimations();
    },
    
    /**
     * ایجاد ذرات پس‌زمینه
     */
    createParticles() {
        const container = document.getElementById('bg-particles');
        if (!container) return;
        
        const count = Helpers.isMobile() ? 10 : 20;
        const colors = ['#EC4899', '#F59E0B', '#8B5CF6', '#10B981'];
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (10 + Math.random() * 10) + 's';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.width = particle.style.height = (4 + Math.random() * 6) + 'px';
            container.appendChild(particle);
        }
    },
    
    /**
     * انیمیشن‌های اسکرول
     */
    setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fade-in-up 0.6s ease forwards';
                }
            });
        }, { threshold: 0.1 });
        
        document.querySelectorAll('.welcome-section').forEach(section => {
            observer.observe(section);
        });
    }
};