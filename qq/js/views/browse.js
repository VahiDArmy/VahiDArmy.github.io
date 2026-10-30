window.Views = window.Views || {};
window.Views.Browse = async function ({ container, params }) {
  let surah = +(params.surah || 1);
  let ayah = +(params.ayah || 1);

  container.innerHTML = `
    <div class="view view-browse">
      <section class="section">
        <div class="section__label">مرور آیات</div>
        <div class="select-row" style="margin-bottom:16px">
          <div class="select-wrap"><select id="browseSurah"></select></div>
          <div class="select-wrap"><select id="browseAyah"></select></div>
        </div>
        <div id="browseAyahFrame" class="card" style="padding:20px; min-height:120px;">
          <div class="skeleton" style="height:80px"></div>
        </div>
        <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
          <button class="btn" id="browsePrev">آیه قبلی ‹</button>
          <button class="btn btn--primary" id="browseToWork">کار روی این آیه</button>
          <button class="btn" id="browseNext">› آیه بعدی</button>
        </div>
        <div id="browseTafsirs" style="margin-top:24px;"></div>
      </section>
    </div>
  `;

  let index = [];
  try {
    index = await QuranData.getIndex();
  } catch (e) {
    container.querySelector('#browseAyahFrame').innerHTML = '<p style="color:var(--danger)">دادهٔ قرآن در دسترس نیست</p>';
    return;
  }

  async function render() {
    UI.populateSurahSelect(document.getElementById('browseSurah'), index, surah);
    const s = index.find(x => x.number === surah);
    UI.populateAyahSelect(document.getElementById('browseAyah'), s?.ayah_count || 7, ayah);

    const frame = document.getElementById('browseAyahFrame');
    frame.innerHTML = '<div class="skeleton" style="height:80px"></div>';
    try {
      const a = await QuranData.getAyah(surah, ayah);
      frame.innerHTML = `
        <div class="ayah-ar" style="font-family:'Amiri Quran',serif; font-size:1.4rem; line-height:2.2; text-align:center;">${a.t || a.text || ''}</div>
        <div style="margin-top:12px; color:var(--text-dim); text-align:center;">${a.tr || a.translation || ''}</div>
      `;
    } catch (e) {
      frame.innerHTML = '<p style="color:var(--text-faint); text-align:center;">آیه در دادهٔ محلی موجود نیست (فقط نمونهٔ سوره ۱ و ۲)</p>';
    }

    // Tafsirs for this ayah
    const list = document.getElementById('browseTafsirs');
    try {
      const tafsirs = await Store.getTafsirsForAyah(surah, ayah);
      if (!tafsirs.length) {
        list.innerHTML = '<p style="color:var(--text-faint); text-align:center;">تفسیری ثبت نشده</p>';
      } else {
        list.innerHTML = '<div class="section__label">تفسیرهای این آیه</div>' + tafsirs.map(t => `
          <div class="card" style="margin-bottom:10px; white-space:pre-wrap;">${UI.escapeHtml(t.content)}</div>
        `).join('');
      }
    } catch (e) {
      list.innerHTML = '';
    }
  }

  document.getElementById('browseSurah').addEventListener('change', e => { surah = +e.target.value; ayah = 1; render(); });
  document.getElementById('browseAyah').addEventListener('change', e => { ayah = +e.target.value; render(); });
  document.getElementById('browsePrev').addEventListener('click', () => {
    if (ayah > 1) ayah--; else if (surah > 1) { surah--; ayah = index.find(x => x.number === surah)?.ayah_count || 1; }
    render();
  });
  document.getElementById('browseNext').addEventListener('click', () => {
    const max = index.find(x => x.number === surah)?.ayah_count || 1;
    if (ayah < max) ayah++; else if (surah < 114) { surah++; ayah = 1; }
    render();
  });
  document.getElementById('browseToWork').addEventListener('click', () => {
    Router.navigate(`/?surah=${surah}&ayah=${ayah}`);
  });

  await render();
};
