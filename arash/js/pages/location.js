/* ============================================
   صفحه موقعیت روی نقشه
   ============================================ */

const LocationPage = {
    render() {
        return `
            <div class="location-page">
                <div class="page-header">
                    <div class="page-badge">
                        <i class="ri-map-pin-2-fill"></i>
                        <span>دعوت ویژه</span>
                    </div>
                    <h1 class="page-title">دعوت به صبحانه 🍳</h1>
                    <p class="page-subtitle">
                        از شما دعوت می‌کنیم برای مشاهده موقعیت دقیق، روی دکمه زیر کلیک کنید
                    </p>
                </div>
                
                <div class="location-card">
                    <div class="location-header">
                        <div class="location-icon-wrap">
                            <div class="location-icon-pulse"></div>
                            <div class="location-icon">
                                <i class="ri-map-pin-2-fill"></i>
                            </div>
                        </div>
                        <div class="location-title">
                            <h2>مهمانی صبحانه</h2>
                            <p>محل برگزاری و مختصات دقیق</p>
                        </div>
                    </div>
                    
                    <div class="location-map">
                        <img src="${APP_CONFIG.MAP_IMAGE}" alt="نقشه موقعیت" 
                             onerror="this.parentElement.classList.add('no-image')">
                        <div class="map-grid-overlay"></div>
                        <div class="map-pin">
                            <i class="ri-map-pin-2-fill"></i>
                            <div class="map-pin-shadow"></div>
                        </div>
                        <div class="map-coordinates">
                            <i class="ri-crosshair-2-line"></i>
                            <span>${APP_CONFIG.MAP_COORDINATES}</span>
                        </div>
                    </div>
                    
                    <div class="location-info">
                        <div class="info-block">
                            <div class="info-icon info-icon-pink">
                                <i class="ri-map-pin-line"></i>
                            </div>
                            <div class="info-content">
                                <span class="info-label">آدرس</span>
                                <span class="info-value">تهران، خیابان ولیعصر، پلاک ۱۲۳</span>
                            </div>
                        </div>
                        
                        <div class="info-block">
                            <div class="info-icon info-icon-gold">
                                <i class="ri-time-line"></i>
                            </div>
                            <div class="info-content">
                                <span class="info-label">زمان برگزاری</span>
                                <span class="info-value">جمعه ساعت ۹:۰۰ صبح</span>
                            </div>
                        </div>
                        
                        <div class="info-block">
                            <div class="info-icon info-icon-green">
                                <i class="ri-crosshair-2-line"></i>
                            </div>
                            <div class="info-content">
                                <span class="info-label">مختصات جغرافیایی</span>
                                <span class="info-value" style="direction: ltr;">${APP_CONFIG.MAP_COORDINATES}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="location-actions">
                        <a href="${APP_CONFIG.MAP_LINK}" target="_blank" rel="noopener" class="btn btn-primary btn-lg btn-block">
                            <i class="ri-road-map-line"></i>
                            <span>مشاهده روی نقشه گوگل</span>
                            <i class="ri-external-link-line"></i>
                        </a>
                        
                        <button class="btn btn-secondary btn-block" id="copy-coords-btn">
                            <i class="ri-file-copy-line"></i>
                            <span>کپی مختصات</span>
                        </button>
                    </div>
                    
                    <div class="location-note">
                        <i class="ri-information-line"></i>
                        <span>لطفاً جهت هماهنگی و رزرو، حضور خود را به پشتیبانی اطلاع دهید</span>
                    </div>
                </div>
                
                <div class="location-cta">
                    <a href="#status" class="btn btn-ghost" data-nav>
                        <i class="ri-arrow-right-line"></i>
                        <span>بازگشت</span>
                    </a>
                </div>
            </div>
        `;
    },
    
    init() {
        document.getElementById('copy-coords-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const success = await Helpers.copyToClipboard(APP_CONFIG.MAP_COORDINATES);
            
            if (success) {
                Toast.success('کپی شد', 'مختصات با موفقیت کپی شد');
                btn.innerHTML = '<i class="ri-check-line"></i><span>کپی شد</span>';
                
                setTimeout(() => {
                    btn.innerHTML = '<i class="ri-file-copy-line"></i><span>کپی مختصات</span>';
                }, 2000);
            }
        });
    }
};