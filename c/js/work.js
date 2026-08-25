// =============================================================
// صفحهٔ کار — یک «آیهٔ در حال کار» واحد که هم می‌شود بهش تفسیر جدید
// اضافه کرد، هم تفسیرهای قبلی‌اش را دید/ویرایش/حذف کرد، هم با دکمهٔ
// بعدی/قبلی جابه‌جا شد. پیش‌فرض: آخرین آیه‌ای که رویش تفسیر ثبت شده.
// =============================================================
(async function () {
  const stickyFrame = document.getElementById('workAyahFrame');
  const selectRow = { surah: document.getElementById('formSurahSelect'), ayah: document.getElementById('formAyahSelect') };
  const prevBtn = document.getElementById('workPrevBtn');
  const nextBtn = document.getElementById('workNextBtn');
  const tafsirsListEl = document.getElementById('workTafsirsList');
  const tafsirForm = document.getElementById('tafsirForm');
  const tafsirContent = document.getElementById('tafsirContent');
  const editBanner = document.getElementById('editBanner');
  const submitBtn = document.getElementById('submitBtn');

  let editingId = null;
  let current = { surah: 1, ayah: 1 };

  ayahSkeleton(stickyFrame);
  const index = await QuranData.getIndex();
  UI.populateSurahSelect(selectRow.surah, index, 1);

  // --- تعیین آیهٔ شروع: از URL، وگرنه نشانک خواندن (جایی که آخرین بار متوقف شدید) ---
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    current = { surah: Number(params.get('surah')), ayah: Number(params.get('ayah')) };
  } else {
    const meta = await Store.getSiteMeta();
    current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
  }

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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function exitEditMode() {
    editingId = null;
    editBanner.hidden = true;
    tafsirContent.value = '';
    submitBtn.textContent = 'ثبت تفسیر';
  }

  function enterEditMode(t) {
    editingId = t.id;
    editBanner.hidden = false;
    tafsirContent.value = t.content;
    submitBtn.textContent = 'به‌روزرسانی تفسیر';
    tafsirContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tafsirContent.focus();
  }

  async function renderCurrentAyah() {
    ayahSkeleton(stickyFrame);
    exitEditMode();

    const surahData = await QuranData.getSurah(current.surah);
    const ayahData = surahData.ayahs.find((a) => a.v === current.ayah) || surahData.ayahs[0];
    current.ayah = ayahData.v;

    selectRow.surah.value = current.surah;
    UI.populateAyahSelect(selectRow.ayah, surahData.ayah_count, current.ayah);

    renderAyahFrame(stickyFrame, ayahData, surahData);

    prevBtn.disabled = current.surah === 1 && current.ayah === 1;
    nextBtn.disabled = current.surah === 114 && current.ayah === surahData.ayah_count;

    // اگر جلوتر از نشانک خواندن هستیم، نشانک را همراه خودمان جلو می‌بریم
    await Store.advanceBookmarkIfAhead(current.surah, current.ayah);
    await refreshProgress();

    await renderTafsirsList();
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
          <p class="tafsir-card__body${needsClamp ? ' is-clamped' : ''}" data-body="${t.id}">${escapeHtml(t.content)}</p>
          ${needsClamp ? `<button class="tafsir-card__more" data-toggle="${t.id}">نمایش کامل</button>` : ''}
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

  editBanner.querySelector('[data-cancel-edit]').addEventListener('click', exitEditMode);

  await renderCurrentAyah();

  document.getElementById('endRoundBtn').addEventListener('click', async () => {
    const p = await Store.getProgress();
    const ok = confirm(
      `دور ${UI.toPersianDigits(p.round)} با پیشرفت ${UI.toPersianDigits(Math.round(p.percent))}٪ خواندن (${UI.toPersianDigits(p.tafsirCount)} تفسیر نوشته‌شده) بسته می‌شود و دور ${UI.toPersianDigits(p.round + 1)} از آیهٔ اول شروع می‌شود. ادامه می‌دهید؟`
    );
    if (!ok) return;
    const newRound = await Store.endRound();
    UI.toast(`دور ${UI.toPersianDigits(newRound)} آغاز شد ✦`);
    current = { surah: 1, ayah: 1 };
    await renderCurrentAyah();
  });

  // --- جابه‌جایی با دراپ‌داون ---
  selectRow.surah.addEventListener('change', async () => {
    current = { surah: Number(selectRow.surah.value), ayah: 1 };
    await renderCurrentAyah();
  });
  selectRow.ayah.addEventListener('change', async () => {
    current.ayah = Number(selectRow.ayah.value);
    await renderCurrentAyah();
  });

  // --- بعدی/قبلی (با عبور از مرز سوره) ---
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

  // --- ثبت / به‌روزرسانی تفسیر ---
  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;

    if (editingId) {
      await Store.updateTafsir(editingId, content);
      UI.toast('تفسیر به‌روزرسانی شد');
      exitEditMode();
      await renderTafsirsList();
    } else {
      await Store.addTafsir({ surah: current.surah, ayah: current.ayah, content });
      tafsirContent.value = '';
      await renderTafsirsList();
      await refreshProgress();
      UI.toast('تفسیر با موفقیت ثبت شد');
    }
  });
})();
