// =============================================================
// پنل تفسیر المیزان
// =============================================================
const MizanPanel = (function () {

  // ============================================================
  // 0) DOM
  // ============================================================
  const mizanEmpty   = document.getElementById('mizanEmpty');
  const mizanContent = document.getElementById('mizanContent');
  const mizanLoading = document.getElementById('mizanLoading');
  const mizanError   = document.getElementById('mizanError');
  const mizanRange   = document.getElementById('mizanRange');
  const mizanSection = document.getElementById('mizanTafsirSection');

  const mizanPager    = document.getElementById('mizanPager');
  const mizanPrevBtn  = document.getElementById('mizanPrevBtn');
  const mizanNextBtn  = document.getElementById('mizanNextBtn');
  const mizanPageInfo = document.getElementById('mizanPageInfo');
  const mizanTocBtn   = document.getElementById('mizanTocBtn');
  const mizanTocModal = document.getElementById('mizanTocModal');
  const mizanTocClose = document.getElementById('mizanTocClose');
  const mizanTocList  = document.getElementById('mizanTocList');
  const mizanNoteBtn  = document.getElementById('mizanNoteAddBtn');

  const mizanTaggerBtn   = document.getElementById('mizanTaggerBtn');
  const mizanTaggerLabel = document.getElementById('mizanTaggerLabel');
  
  // ★ اصلاح (مورد ۳ و ۴): مخفی کردن دکمه تفکیک آیه‌ای که کد آن وجود ندارد
  if (mizanTaggerBtn) mizanTaggerBtn.style.display = 'none';

  const mizanTaggerRawModal  = document.getElementById('mizanTaggerRawModal');
  const mizanTaggerRawClose  = document.getElementById('mizanTaggerRawClose');
  // ...

  const mizanNoteModal     = document.getElementById('mizanNoteModal');
  // ...

  const readPageBtnWrapper = document.createElement('div');
  readPageBtnWrapper.className = 'mizan-read-page-wrapper';
  
  const readPageBtn = document.createElement('button');
  readPageBtn.type = 'button';
  readPageBtn.className = 'mizan-read-page-btn';
  readPageBtn.innerHTML = 'علامت‌گذاری خوانده‌شده';
  
  readPageBtnWrapper.appendChild(readPageBtn);
  
  const mizanContainer = document.getElementById('mizanTafsirContainer');
  if (mizanContainer) {
    mizanContainer.appendChild(readPageBtnWrapper);
  }

  // ============================================================
  // 1) STATE
  // ============================================================
  let mizanPages = [];
  let mizanCurrentPage = 0;
  let mizanContentKeys = [];
  let mizanSaveTimer = null;
  let mizanNotes = [];
  let mizanReadPages = new Set(); 
  
  let pendingNoteAnchor = null;
  // ...

  // ============================================================
  // ... (بقیه توابع دقیقاً مثل نسخه قبلی که فرستادم هستند)
  // ============================================================

  function updateMizanPagerUI() {
    if (!mizanPager) return;
    if (mizanPages.length <= 1) { mizanPager.classList.add('hidden'); readPageBtnWrapper.style.display = 'none'; return; }
    mizanPager.classList.remove('hidden');
    
    const total = mizanPages.length; const cur = mizanCurrentPage;
    const isRead = mizanReadPages.has(String(cur));
    
    const curStr = UI.toPersianDigits(cur + 1);
    if (mizanPageInfo) {
      mizanPageInfo.innerHTML = `صفحهٔ <span class="${isRead ? 'mizan-page-num--read' : ''}">${curStr}</span> از ${UI.toPersianDigits(total)}`;
    }
    
    readPageBtnWrapper.style.display = 'block';
    if (isRead) {
      readPageBtn.innerHTML = '✓ خوانده شد';
      readPageBtn.classList.add('is-read');
    } else {
      readPageBtn.innerHTML = 'علامت‌گذاری خوانده‌شده';
      readPageBtn.classList.remove('is-read');
    }

    if (mizanPrevBtn) mizanPrevBtn.disabled = cur === 0;
    if (mizanNextBtn) mizanNextBtn.disabled = cur >= total - 1;
  }

  // ... (بقیه کد دقیقاً مثل قبل)
})();