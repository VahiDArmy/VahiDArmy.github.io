(async function () {
  const graphWrap = document.getElementById('graphWrap');
  const svg = d3.select('#graphSvg');
  const linksListEl = document.getElementById('linksList');

  // ---- عناصر مودال ----
  const ayahModal = document.getElementById('ayahModal');
  const closeAyahModalBtn = document.getElementById('closeAyahModalBtn');
  const closeAyahModalBtn2 = document.getElementById('closeAyahModalBtn2');
  const ayahModalLink = document.getElementById('ayahModalLink');
  const ayahModalTitle = document.getElementById('ayahModalTitle');
  const ayahModalArabic = document.getElementById('ayahModalArabic');
  const ayahModalTranslation = document.getElementById('ayahModalTranslation');

  // ---- توابع کنترل مودال ----
  function openAyahModal(surah, ayah, arabic, translation, surahName) {
    ayahModalTitle.textContent = `سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(ayah)}`;
    ayahModalArabic.textContent = arabic;
    ayahModalTranslation.textContent = translation;
    ayahModalLink.href = `browse.html?surah=${surah}&ayah=${ayah}`;
    ayahModal.classList.add('is-open');
  }

  function closeAyahModal() {
    ayahModal.classList.remove('is-open');
  }

  // رویدادهای بستن
  closeAyahModalBtn.addEventListener('click', closeAyahModal);
  closeAyahModalBtn2.addEventListener('click', closeAyahModal);
  ayahModal.addEventListener('click', (e) => {
    if (e.target === ayahModal) closeAyahModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ayahModal.classList.contains('is-open')) closeAyahModal();
  });

  // ---- بارگذاری داده ----
  const index = await QuranData.getIndex();
  const nameOf = (n) => (index.find((s) => s.number === n) || {}).name_fa || n;
  const shortLabel = (surah, ayah) => `${UI.toPersianDigits(surah)}:${UI.toPersianDigits(ayah)}`;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const rawLinks = await Store.getAllLinks();

  if (!rawLinks.length) {
    graphWrap.insertAdjacentHTML(
      'beforeend',
      `<div class="empty-state-graph">هنوز هیچ ارجاعی بین آیات ثبت نشده.<br>از فرم افزودن تفسیر، دکمهٔ «لینک به آیهٔ دیگر» را امتحان کنید.</div>`
    );
    linksListEl.innerHTML = '';
    return;
  }

  // --- ساخت گره‌ها و یال‌ها ---
  const nodeMap = new Map();
  function nodeKey(s, a) {
    return `${s}:${a}`;
  }
  function ensureNode(s, a) {
    const key = nodeKey(s, a);
    if (!nodeMap.has(key)) nodeMap.set(key, { id: key, surah: s, ayah: a });
    return nodeMap.get(key);
  }
  const edges = rawLinks.map((l) => {
    ensureNode(l.from_surah, l.from_ayah);
    ensureNode(l.to_surah, l.to_ayah);
    return { source: nodeKey(l.from_surah, l.from_ayah), target: nodeKey(l.to_surah, l.to_ayah), excerpt: l.excerpt };
  });
  const nodes = Array.from(nodeMap.values());

  // --- رسم گراف با d3-force ---
  const rect = graphWrap.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  const g = svg.append('g');

  svg.call(
    d3.zoom().scaleExtent([0.4, 3]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    })
  );

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id((d) => d.id).distance(70).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-140))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(20));

  const edgeSel = g
    .selectAll('.graph-edge')
    .data(edges)
    .enter()
    .append('line')
    .attr('class', 'graph-edge')
    .attr('marker-end', 'url(#arrow)');

  const violetColor = getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#8B7CF6';

  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 16)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', violetColor)
    .attr('fill-opacity', 0.6);

  const nodeSel = g
    .selectAll('.graph-node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'graph-node')
    .call(
      d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    )
    .on('click', async (event, d) => {
      // به‌جای هدایت مستقیم، مودال باز می‌شود
      try {
        const surahData = await QuranData.getSurah(d.surah);
        const ayahObj = surahData.ayahs.find((a) => a.v === d.ayah);
        if (ayahObj) {
          openAyahModal(
            d.surah,
            d.ayah,
            ayahObj.ar,
            ayahObj.fa,
            nameOf(d.surah)
          );
        } else {
          UI.toast('آیه یافت نشد');
        }
      } catch (err) {
        UI.toast('خطا در بارگذاری آیه');
        console.error(err);
      }
    });

  nodeSel.append('circle').attr('r', 9);
  nodeSel
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', -13)
    .text((d) => shortLabel(d.surah, d.ayah));
  nodeSel.append('title').text((d) => `سورهٔ ${nameOf(d.surah)}، آیهٔ ${UI.toPersianDigits(d.ayah)}`);

  simulation.on('tick', () => {
    edgeSel
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // --- فهرست متنی (برای دسترسی‌پذیری و موبایل) ---
  linksListEl.innerHTML = rawLinks
    .map((l) => {
      const excerptHtml = l.excerpt
        ? `<span style="color:var(--text-dim);"> — «${escapeHtml(l.excerpt)}»</span>`
        : '';
      return `
      <div class="tafsir-card" style="padding:12px 16px;">
        <a href="browse.html?surah=${l.from_surah}&ayah=${l.from_ayah}" class="ayah-link">سورهٔ ${nameOf(l.from_surah)}، آیهٔ ${UI.toPersianDigits(l.from_ayah)}</a>
        <span style="color:var(--text-faint);"> ⟵ ارجاع به ⟶ </span>
        <a href="browse.html?surah=${l.to_surah}&ayah=${l.to_ayah}" class="ayah-link">سورهٔ ${nameOf(l.to_surah)}، آیهٔ ${UI.toPersianDigits(l.to_ayah)}</a>
        ${excerptHtml}
      </div>`;
    })
    .join('');
})();