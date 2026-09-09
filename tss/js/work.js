// =============================================================
// صفحهٔ کار — یک «آیهٔ در حال کار» واحد
// =============================================================
(async function () {
  const stickyFrame = document.getElementById('workAyahFrame');
  const selectRow = { surah: document.getElementById('formSurahSelect'), ayah: document.getElementById('formAyahSelect') };
  const prevBtn = document.getElementById('workPrevBtn');
  const nextBtn = document.getElementById('workNextBtn');
  const tafsirsListEl = document.getElementById('workTafsirsList');
  const tafsirForm = document.getElementById('tafsirForm');
  const tafsirContent = document.getElementById('tafsirContent');
  const tafsirTags = document.getElementById('tafsirTags');
  const editBanner = document.getElementById('editBanner');
  const submitBtn = document.getElementById('submitBtn');

  // المان‌های تفسیر روان جاوید
  const ravanTafsirContainer = document.getElementById('ravanTafsirContainer');
  const ravanTafsirEmpty = document.getElementById('ravanTafsirEmpty');
  const ravanTafsirContent = document.getElementById('ravanTafsirContent');
  const ravanTafsirLoading = document.getElementById('ravanTafsirLoading');
  const ravanTafsirError = document.getElementById('ravanTafsirError');
  const ravanTafsirLoadBtn = document.getElementById('ravanTafsirLoadBtn');
  const ravanTafsirDeleteBtn = document.getElementById('ravanTafsirDeleteBtn');
  const ravanTafsirManualBtn = document.getElementById('ravanTafsirManualBtn');
  const ravanTafsirManualInput = document.getElementById('ravanTafsirManualInput');
  const ravanTafsirManualSubmit = document.getElementById('ravanTafsirManualSubmit');
  const ravanTafsirManualCancel = document.getElementById('ravanTafsirManualCancel');

  function parseTags(str) {
    return Array.from(
      new Set(
        str
          .split(/[,،]/)
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
  }

  let editingId = null;
  let current = { surah: 1, ayah: 1 };
  let detectedLink = null;

  const index = await QuranData.getIndex();
  UI.populateSurahSelect(selectRow.surah, index, 1);

  // --- تعیین آیهٔ شروع ---
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    current = { surah: Number(params.get('surah')), ayah: Number(params.get('ayah')) };
  } else {
    const meta = await Store.getSiteMeta();
    current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
  }

  // ============================================================
  // توابع کمکی
  // ============================================================

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
  }

  function replaceAtCursor(textarea, start, end, text) {
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
  }

  // ============================================================
  // توابع اصلی
  // ============================================================

  async function refreshProgress() {
    const p = await Store.getProgress();
    const surahMeta = (await QuranData.getIndex()).find((s) => s.number === p.bookmarkSurah);
    document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
    document.getElementById('bookmarkLabel').textContent =
      `تا سورهٔ ${surahMeta.name_fa}، آیهٔ ${UI.toPersianDigits(p.bookmarkAyah)}`;
    document.getElementById('tafsirCountLabel').textContent =
      `${UI.toPersianDigits(p.tafsirCount)} تفسیر در این دور`;
    UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
    return p;
  }

  // --- ثبت آخرین آیه بررسی‌شده ---
  async function setBookmark() {
    const surahName = index.find(s => s.number === current.surah)?.name_fa || current.surah;
    const confirmed = confirm(
      `آیهٔ جاری (سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(current.ayah)}) به عنوان آخرین آیهٔ بررسی‌شده ثبت شود؟`
    );
    if (!confirmed) return;

    const { error } = await sb
      .from('site_meta')
      .update({ bookmark_surah: current.surah, bookmark_ayah: current.ayah })
      .eq('id', 1);
    if (error) {
      UI.toast('خطا در ثبت نشانک');
      console.error(error);
      return;
    }
    UI.toast(`نشانک ثبت شد: سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(current.ayah)} ✦`);
    await refreshProgress();
  }

  // --- رفتن به آیهٔ نشانگر ---
  async function goToBookmark() {
    const meta = await Store.getSiteMeta();
    const surah = meta.bookmark_surah;
    const ayah = meta.bookmark_ayah;
    current = { surah, ayah };
    await renderCurrentAyah();
    const frame = document.getElementById('workAyahFrame');
    if (frame) {
      setTimeout(() => {
        frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }

  // ============================================================
  // توابع دریافت تفسیر روان جاوید
  // ============================================================

  // دریافت تفسیر از دیتابیس
  async function getRavanTafsirFromDB(surah, ayah) {
    const { data, error } = await sb
      .from('ravan_tafsirs')
      .select('content')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .maybeSingle();
    if (error) {
      console.error('خطا در دریافت از دیتابیس:', error);
      throw error;
    }
    return data;
  }

  // ذخیره تفسیر در دیتابیس
  async function saveRavanTafsirToDB(surah, ayah, content) {
    const { error } = await sb
      .from('ravan_tafsirs')
      .upsert(
        { surah, ayah, content, updated_at: new Date().toISOString() },
        { onConflict: 'surah, ayah' }
      );
    if (error) {
      console.error('خطا در ذخیره در دیتابیس:', error);
      throw error;
    }
  }

  // حذف تفسیر از دیتابیس
  async function deleteRavanTafsirFromDB(surah, ayah) {
    const { error } = await sb
      .from('ravan_tafsirs')
      .delete()
      .eq('surah', surah)
      .eq('ayah', ayah);
    if (error) {
      console.error('خطا در حذف از دیتابیس:', error);
      throw error;
    }
  }

  // دریافت تفسیر از ویکی از طریق corsproxy
  async function fetchRavanTafsirFromWiki(surah, ayah) {
    // پیدا کردن نام سوره به فارسی
    const surahData = index.find(s => s.number === surah);
    const surahName = surahData?.name_fa || surah;

    // ساخت URL صفحه ویکی - دقیقاً به فرمت نمونه کاربر
    const wikiPath = `%D8%A2%DB%8C%D9%87_${ayah}_%D8%B3%D9%88%D8%B1%D9%87_${encodeURIComponent(surahName)}`;
    const wikiUrl = `https://wiki.ahlolbait.com/${wikiPath}`;

    // ساخت آدرس پروکسی
    const proxyUrl = `https://corsproxy.io/?key=ce9413ae&url=${encodeURIComponent(wikiUrl)}`;

    console.log('📡 درخواست به:', proxyUrl);

    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`دریافت صفحه با خطا مواجه شد (کد ${response.status})`);
    }

    const html = await response.text();
    console.log('📄 HTML دریافت شد، طول:', html.length);

    // استخراج بخش تفسیر روان جاوید
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // روش اول: جستجوی مستقیم در textContent
    const text = doc.body.textContent || '';
    console.log('📝 متن استخراج شده، طول:', text.length);

    // جستجوی بخش "تفسیر" بعد از "تفسیر روان جاوید (ثقفی تهرانى)"
    // الگو: تفسیر روان جاوید (ثقفی تهرانى) ... تفسیر [متن اصلی]
    const tafsirRegex = /تفسیر روان جاوید\s*\(ثقفی تهرانى\)[\s\S]*?(تفسیر\s*[\n\r]*)([\s\S]*?)(?=جلد\s+\d+\s+صفحه\s+\d+|$)/i;
    const match = text.match(tafsirRegex);

    if (match && match[2]) {
      let tafsirText = match[2].trim();
      // پاکسازی متن
      tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
      if (tafsirText.length > 20) {
        return tafsirText;
      }
    }

    // روش دوم: اگر روش اول جواب نداد، جستجوی ساده‌تر
    const simpleRegex = /تفسیر\s*[\n\r]*([\s\S]*?)(?=جلد\s+\d+\s+صفحه\s+\d+|$)/i;
    const simpleMatch = text.match(simpleRegex);
    if (simpleMatch && simpleMatch[1]) {
      let tafsirText = simpleMatch[1].trim();
      tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
      // حذف ترجمه و متن آیه اگر در ابتدا باشند
      tafsirText = tafsirText.replace(/^[\s\S]*?ترجمه‌[\s\S]*?تفسیر\s*/i, '');
      if (tafsirText.length > 20) {
        return tafsirText;
      }
    }

    throw new Error('متن تفسیر روان جاوید در صفحه یافت نشد');
  }

  // نمایش حالت‌های مختلف
  function showRavanTafsirState(state, data) {
    // مخفی کردن همه
    ravanTafsirEmpty.classList.add('hidden');
    ravanTafsirLoading.classList.add('hidden');
    ravanTafsirContent.classList.add('hidden');
    ravanTafsirError.classList.add('hidden');
    ravanTafsirManualBtn.classList.add('hidden');
    ravanTafsirManualInput.classList.add('hidden');
    ravanTafsirDeleteBtn.classList.add('hidden');
    ravanTafsirLoadBtn.classList.remove('hidden');

    switch (state) {
      case 'empty':
        ravanTafsirEmpty.classList.remove('hidden');
        ravanTafsirDeleteBtn.classList.add('hidden');
        break;
      case 'loading':
        ravanTafsirLoading.classList.remove('hidden');
        ravanTafsirDeleteBtn.classList.add('hidden');
        break;
      case 'content':
        ravanTafsirContent.classList.remove('hidden');
        ravanTafsirContent.innerHTML = data;
        ravanTafsirDeleteBtn.classList.remove('hidden');
        break;
      case 'error':
        ravanTafsirError.classList.remove('hidden');
        ravanTafsirError.innerHTML = data;
        ravanTafsirManualBtn.classList.remove('hidden');
        ravanTafsirDeleteBtn.classList.add('hidden');
        break;
    }
  }

  // بارگذاری تفسیر روان جاوید برای آیه جاری (با دکمه)
  async function loadRavanTafsir(surah, ayah) {
    // نمایش حالت بارگذاری
    showRavanTafsirState('loading');

    try {
      // ۱. بررسی دیتابیس
      const dbData = await getRavanTafsirFromDB(surah, ayah);
      if (dbData && dbData.content) {
        showRavanTafsirState('content', dbData.content);
        return;
      }

      // ۲. دریافت از ویکی
      try {
        const content = await fetchRavanTafsirFromWiki(surah, ayah);
        await saveRavanTafsirToDB(surah, ayah, content);
        showRavanTafsirState('content', content);
        return;
      } catch (wikiError) {
        console.warn('⚠️ دریافت از ویکی失敗:', wikiError);
        // ادامه برای دریافت دستی
      }

      // ۳. نمایش خطا و گزینه دریافت دستی
      showRavanTafsirState('error', `
        <p>تفسیر روان جاوید برای این آیه یافت نشد.</p>
        <p style="font-size:0.8rem; color:var(--text-faint);">می‌توانید آدرس صفحه ویکی را به صورت دستی وارد کنید.</p>
        <p style="font-size:0.75rem; color:var(--text-faint);">فرمت آدرس: https://wiki.ahlolbait.com/آیه_XX_سوره_نامسوره</p>
      `);

    } catch (error) {
      console.error('❌ خطا در بارگذاری تفسیر روان جاوید:', error);
      showRavanTafsirState('error', `
        <p>خطا در بارگذاری تفسیر روان جاوید</p>
        <p style="font-size:0.8rem; color:var(--text-faint);">${error.message || 'خطای ناشناخته'}</p>
        <p style="font-size:0.75rem; color:var(--text-faint); margin-top:8px;">لطفاً کنسول مرورگر را بررسی کنید (F12)</p>
      `);
    }
  }

  // حذف تفسیر روان جاوید از دیتابیس
  async function deleteRavanTafsir(surah, ayah) {
    const confirmed = confirm('آیا تفسیر روان جاوید ذخیره‌شده برای این آیه حذف شود؟');
    if (!confirmed) return;

    try {
      await deleteRavanTafsirFromDB(surah, ayah);
      UI.toast('تفسیر روان جاوید حذف شد');
      // پس از حذف، کارت را به حالت خالی برگردان
      showRavanTafsirState('empty');
    } catch (error) {
      console.error('❌ خطا در حذف تفسیر:', error);
      UI.toast('خطا در حذف تفسیر');
    }
  }

  // دریافت دستی از آدرس وارد شده توسط کاربر
  async function fetchRavanTafsirManual(url) {
    try {
      showRavanTafsirState('loading');

      // ساخت آدرس پروکسی
      const proxyUrl = `https://corsproxy.io/?key=ce9413ae&url=${encodeURIComponent(url)}`;

      console.log('📡 درخواست دستی به:', proxyUrl);

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error(`دریافت صفحه با خطا مواجه شد (کد ${response.status})`);
      }

      const html = await response.text();
      console.log('📄 HTML دستی دریافت شد، طول:', html.length);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const text = doc.body.textContent || '';
      console.log('📝 متن استخراج شده دستی، طول:', text.length);

      // جستجوی بخش "تفسیر" بعد از "تفسیر روان جاوید (ثقفی تهرانى)"
      const tafsirRegex = /تفسیر روان جاوید\s*\(ثقفی تهرانى\)[\s\S]*?(تفسیر\s*[\n\r]*)([\s\S]*?)(?=جلد\s+\d+\s+صفحه\s+\d+|$)/i;
      const match = text.match(tafsirRegex);

      if (match && match[2]) {
        let tafsirText = match[2].trim();
        tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
        if (tafsirText.length > 20) {
          await saveRavanTafsirToDB(current.surah, current.ayah, tafsirText);
          showRavanTafsirState('content', tafsirText);
          return;
        }
      }

      // روش دوم: جستجوی ساده‌تر
      const simpleRegex = /تفسیر\s*[\n\r]*([\s\S]*?)(?=جلد\s+\d+\s+صفحه\s+\d+|$)/i;
      const simpleMatch = text.match(simpleRegex);
      if (simpleMatch && simpleMatch[1]) {
        let tafsirText = simpleMatch[1].trim();
        tafsirText = tafsirText.replace(/\[\d+\]/g, '').replace(/\[ویرایش\]/g, '').trim();
        tafsirText = tafsirText.replace(/^[\s\S]*?ترجمه‌[\s\S]*?تفسیر\s*/i, '');
        if (tafsirText.length > 20) {
          await saveRavanTafsirToDB(current.surah, current.ayah, tafsirText);
          showRavanTafsirState('content', tafsirText);
          return;
        }
      }

      throw new Error('متن تفسیر روان جاوید در صفحه یافت نشد');

    } catch (error) {
      console.error('❌ خطا در دریافت دستی:', error);
      showRavanTafsirState('error', `
        <p>خطا در دریافت از آدرس وارد شده</p>
        <p style="font-size:0.8rem; color:var(--text-faint);">${error.message || 'خطای ناشناخته'}</p>
        <p style="font-size:0.75rem; color:var(--text-faint); margin-top:8px;">لطفاً کنسول مرورگر را بررسی کنید (F12)</p>
      `);
    }
  }

  // --- ابزار تشخیص ارجاع در موقعیت مکان‌نما ---
  function detectLinkAtCursor(textarea) {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const linkRegex = /\[\[(\d{1,3}):(\d{1,3})(?:\|([^\]]{1,120}))?\]\]/g;
    let match;
    let found = null;
    while ((match = linkRegex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (cursorPos >= start && cursorPos <= end) {
        found = {
          surah: Number(match[1]),
          ayah: Number(match[2]),
          excerpt: match[3] ? match[3].trim() : null,
          start: start,
          end: end,
          fullMatch: match[0]
        };
        break;
      }
    }
    return found;
  }

  // --- به‌روزرسانی دکمه‌ی لینک ---
  function updateLinkButton() {
    const linkBtn = document.getElementById('openLinkToolBtn');
    const detected = detectLinkAtCursor(tafsirContent);
    detectedLink = detected;
    if (detected) {
      const surahName = index.find(s => s.number === detected.surah)?.name_fa || detected.surah;
      linkBtn.textContent = `✎ ویرایش ارجاع به سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(detected.ayah)}`;
      linkBtn.style.color = 'var(--violet)';
      linkBtn.style.borderColor = 'var(--violet)';
    } else {
      linkBtn.textContent = '﹢ لینک به آیهٔ دیگر';
      linkBtn.style.color = '';
      linkBtn.style.borderColor = '';
    }
  }

  // --- باز کردن پاپ‌آپ لینک ---
  function openLinkModal(targetSurah, targetAyah) {
    const s = targetSurah || current.surah;
    const a = targetAyah || current.ayah;
    UI.populateSurahSelect(linkSurahSelect, index, s);
    QuranData.getSurah(s).then(surahData => {
      UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, a);
      updateLinkPreview();
    });
    linkToolModal.hidden = false;
  }

  function closeLinkModal() {
    linkToolModal.hidden = true;
  }

  async function updateLinkPreview() {
    const s = Number(linkSurahSelect.value);
    const a = Number(linkAyahSelect.value);
    const surahData = await QuranData.getSurah(s);
    const ayahObj = surahData.ayahs.find((x) => x.v === a) || surahData.ayahs[0];
    linkAyahPreview.innerHTML = `
      <p style="margin:0 0 8px; font-family:var(--font-quran); font-size:1.15rem; line-height:2.2;">${ayahObj.ar}</p>
      <p style="margin:0; color:var(--text-dim);">${ayahObj.fa}</p>`;
  }

  function exitEditMode() {
    editingId = null;
    editBanner.hidden = true;
    tafsirContent.value = '';
    tafsirTags.value = '';
    submitBtn.textContent = 'ثبت تفسیر';
    updateLinkButton();
  }

  function enterEditMode(t) {
    editingId = t.id;
    editBanner.hidden = false;
    tafsirContent.value = t.content;
    tafsirTags.value = (t.tags || []).join(', ');
    submitBtn.textContent = 'به‌روزرسانی تفسیر';
    tafsirContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tafsirContent.focus();
    updateLinkButton();
  }

  async function renderTafsirsList() {
    const tafsirs = await Store.getTafsirsForAyah(current.surah, current.ayah);
    if (!tafsirs.length) {
      tafsirsListEl.innerHTML = `<p style="color:var(--text-faint); font-size:0.85rem; text-align:center; padding:16px 0;">هنوز تفسیری برای این آیه ثبت نشده — اولین نفر باشید.</p>`;
      return;
    }
    tafsirsListEl.innerHTML = tafsirs
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        const needsClamp = t.content.length > 220 || (t.content.match(/\n/g) || []).length > 2;
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body${needsClamp ? ' is-clamped' : ''}" data-body="${t.id}">${AyahLinks.renderContent(t.content, index, (seg) => UI.highlightTags(seg, t.tags))}</p>
          ${needsClamp ? `<button class="tafsir-card__more" data-toggle="${t.id}">نمایش کامل</button>` : ''}
          ${
            t.tags && t.tags.length
              ? `<div class="tag-pills">${t.tags
                  .map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` }))
                  .join('')}</div>`
              : ''
          }
          <div class="tafsir-card__actions">
            <button class="btn btn--sm" data-edit="${t.id}">ویرایش</button>
            <button class="btn btn--sm" data-delete="${t.id}">حذف</button>
          </div>
        </div>`;
      })
      .join('');

    tafsirsListEl.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle');
        const body = tafsirsListEl.querySelector(`[data-body="${id}"]`);
        body.classList.toggle('is-clamped');
        btn.textContent = body.classList.contains('is-clamped') ? 'نمایش کامل' : 'بستن';
      });
    });

    tafsirsListEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = tafsirs.find((x) => x.id === btn.getAttribute('data-edit'));
        enterEditMode(t);
      });
    });

    tafsirsListEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete');
        if (!confirm('همین یک تفسیر حذف شود؟ (تفسیرهای دیگر این آیه دست‌نخورده می‌مانند)')) return;
        await Store.deleteTafsir(id);
        if (editingId === id) exitEditMode();
        UI.toast('تفسیر حذف شد');
        await renderTafsirsList();
        await refreshProgress();
      });
    });
  }

  async function renderCurrentAyah() {
    ayahSkeleton(stickyFrame);
    exitEditMode();

    const surahData = await QuranData.getSurah(current.surah);
    const ayahData = surahData.ayahs.find((a) => a.v === current.ayah) || surahData.ayahs[0];
    current.ayah = ayahData.v;

    selectRow.surah.value = current.surah;
    UI.populateAyahSelect(selectRow.ayah, surahData.ayah_count, current.ayah);

    renderAyahFrame(stickyFrame, ayahData, surahData, {
      marked: await Store.isMarked(current.surah, current.ayah),
      onToggleMark: async (btn) => {
        const nowMarked = !btn.classList.contains('is-marked');
        await Store.toggleMark(current.surah, current.ayah, nowMarked);
        btn.classList.toggle('is-marked', nowMarked);
        btn.setAttribute('aria-pressed', String(nowMarked));
      },
    });

    prevBtn.disabled = current.surah === 1 && current.ayah === 1;
    nextBtn.disabled = current.surah === 114 && current.ayah === surahData.ayah_count;

    await refreshProgress();
    await renderTafsirsList();

    // بررسی وجود تفسیر در دیتابیس و نمایش مناسب
    try {
      const dbData = await getRavanTafsirFromDB(current.surah, current.ayah);
      if (dbData && dbData.content) {
        showRavanTafsirState('content', dbData.content);
      } else {
        showRavanTafsirState('empty');
      }
    } catch (error) {
      console.error('خطا در بررسی دیتابیس روان جاوید:', error);
      showRavanTafsirState('empty');
    }
  }

  // ============================================================
  // راه‌اندازی ابزار لینک
  // ============================================================

  const linkToolModal = document.getElementById('linkToolModal');
  const openLinkToolBtn = document.getElementById('openLinkToolBtn');
  const cancelLinkBtn = document.getElementById('cancelLinkBtn');
  const insertLinkBtn = document.getElementById('insertLinkBtn');
  const linkSurahSelect = document.getElementById('linkSurahSelect');
  const linkAyahSelect = document.getElementById('linkAyahSelect');
  const linkAyahPreview = document.getElementById('linkAyahPreview');

  openLinkToolBtn.addEventListener('click', async () => {
    tafsirContent.blur();
    if (detectedLink) {
      openLinkModal(detectedLink.surah, detectedLink.ayah);
    } else {
      openLinkModal(current.surah, current.ayah);
    }
  });

  cancelLinkBtn.addEventListener('click', closeLinkModal);
  linkToolModal.addEventListener('click', (e) => {
    if (e.target === linkToolModal) closeLinkModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !linkToolModal.hidden) closeLinkModal();
  });

  linkSurahSelect.addEventListener('change', async () => {
    const surahData = await QuranData.getSurah(Number(linkSurahSelect.value));
    UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, 1);
    await updateLinkPreview();
  });
  linkAyahSelect.addEventListener('change', updateLinkPreview);

  insertLinkBtn.addEventListener('click', () => {
    const s = Number(linkSurahSelect.value);
    const a = Number(linkAyahSelect.value);
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    const withinPreview = selection && selection.anchorNode && linkAyahPreview.contains(selection.anchorNode);
    const excerpt = withinPreview && selectedText ? selectedText : null;
    const newLink = AyahLinks.makeToken(s, a, excerpt);

    if (detectedLink) {
      replaceAtCursor(tafsirContent, detectedLink.start, detectedLink.end, newLink);
      detectedLink = null;
    } else {
      insertAtCursor(tafsirContent, newLink);
    }
    closeLinkModal();
    tafsirContent.focus();
    updateLinkButton();
  });

  // --- رویدادهای تشخیص ارجاع ---
  tafsirContent.addEventListener('input', updateLinkButton);
  tafsirContent.addEventListener('click', updateLinkButton);
  tafsirContent.addEventListener('keyup', updateLinkButton);
  tafsirContent.addEventListener('select', updateLinkButton);

  // ============================================================
  // رویدادهای تفسیر روان جاوید
  // ============================================================

  // دکمه بارگذاری
  ravanTafsirLoadBtn.addEventListener('click', () => {
    loadRavanTafsir(current.surah, current.ayah);
  });

  // دکمه حذف
  ravanTafsirDeleteBtn.addEventListener('click', () => {
    deleteRavanTafsir(current.surah, current.ayah);
  });

  // دکمه دریافت دستی
  ravanTafsirManualBtn.addEventListener('click', () => {
    ravanTafsirError.classList.add('hidden');
    ravanTafsirManualInput.classList.remove('hidden');
  });

  ravanTafsirManualSubmit.addEventListener('click', () => {
    const input = ravanTafsirManualInput.querySelector('input');
    const url = input?.value?.trim();
    if (url) {
      fetchRavanTafsirManual(url);
    }
  });

  ravanTafsirManualCancel.addEventListener('click', () => {
    ravanTafsirManualInput.classList.add('hidden');
    // برگشت به حالت خطا
    const errorHtml = ravanTafsirError.innerHTML;
    if (errorHtml) {
      ravanTafsirError.classList.remove('hidden');
    } else {
      showRavanTafsirState('empty');
    }
  });

  // ============================================================
  // رویدادهای فرم و ناوبری
  // ============================================================

  document.getElementById('goToCurrentBtn').addEventListener('click', goToBookmark);
  document.getElementById('setBookmarkBtn').addEventListener('click', setBookmark);
  editBanner.querySelector('[data-cancel-edit]').addEventListener('click', exitEditMode);

  document.getElementById('endRoundBtn').addEventListener('click', async () => {
    const p = await Store.getProgress();
    const ok = confirm(
      `دور ${UI.toPersianDigits(p.round)} با پیشرفت ${UI.toPersianDigits(p.percent.toFixed(2))}٪ خواندن (${UI.toPersianDigits(p.tafsirCount)} تفسیر نوشته‌شده) بسته می‌شود و دور ${UI.toPersianDigits(p.round + 1)} از آیهٔ اول شروع می‌شود. ادامه می‌دهید؟`
    );
    if (!ok) return;
    const newRound = await Store.endRound();
    UI.toast(`دور ${UI.toPersianDigits(newRound)} آغاز شد ✦`);
    current = { surah: 1, ayah: 1 };
    await renderCurrentAyah();
  });

  selectRow.surah.addEventListener('change', async () => {
    current = { surah: Number(selectRow.surah.value), ayah: 1 };
    await renderCurrentAyah();
  });
  selectRow.ayah.addEventListener('change', async () => {
    current.ayah = Number(selectRow.ayah.value);
    await renderCurrentAyah();
  });

  prevBtn.addEventListener('click', async () => {
    if (current.ayah > 1) {
      current.ayah -= 1;
    } else if (current.surah > 1) {
      const prevSurah = await QuranData.getSurah(current.surah - 1);
      current = { surah: current.surah - 1, ayah: prevSurah.ayah_count };
    } else return;
    await renderCurrentAyah();
  });

  nextBtn.addEventListener('click', async () => {
    const surahData = await QuranData.getSurah(current.surah);
    if (current.ayah < surahData.ayah_count) {
      current.ayah += 1;
    } else if (current.surah < 114) {
      current = { surah: current.surah + 1, ayah: 1 };
    } else return;
    await renderCurrentAyah();
  });

  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;
    const tags = parseTags(tafsirTags.value);

    if (editingId) {
      await Store.updateTafsir(editingId, content, tags);
      await Store.syncAyahLinks(editingId, current.surah, current.ayah, AyahLinks.extract(content));
      UI.toast('تفسیر به‌روزرسانی شد');
      exitEditMode();
      await renderTafsirsList();
    } else {
      const newTafsir = await Store.addTafsir({ surah: current.surah, ayah: current.ayah, content, tags });
      await Store.syncAyahLinks(newTafsir.id, current.surah, current.ayah, AyahLinks.extract(content));
      tafsirContent.value = '';
      tafsirTags.value = '';
      await renderTafsirsList();
      await refreshProgress();
      UI.toast('تفسیر با موفقیت ثبت شد');
    }
    updateLinkButton();
  });

  // ============================================================
  // اجرای اولیه
  // ============================================================

  await renderCurrentAyah();
})();