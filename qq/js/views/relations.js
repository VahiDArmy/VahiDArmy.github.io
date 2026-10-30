window.Views = window.Views || {};
window.Views.Relations = async function ({ container }) {
  container.innerHTML = `
    <div class="view view-relations">
      <section class="section">
        <div class="section__label">رابطه‌های آیه‌ها</div>
        <div id="graphWrap">
          <svg id="graphSvg"></svg>
        </div>
        <div id="linksList" style="margin-top:20px;"></div>
      </section>
    </div>
  `;

  const graphWrap = document.getElementById('graphWrap');
  const svgEl = document.getElementById('graphSvg');
  const linksListEl = document.getElementById('linksList');

  let index = [];
  try {
    index = await QuranData.getIndex();
  } catch (e) {}
  const nameOf = (n) => (index.find((s) => s.number === n) || {}).name_fa || n;
  const shortLabel = (surah, ayah) =>
    `${UI.toPersianDigits(surah)}:${UI.toPersianDigits(ayah)}`;

  let rawLinks = [];
  try {
    rawLinks = await Store.getAllLinks();
  } catch (e) {
    linksListEl.innerHTML = '<p style="color:var(--danger)">خطا در بارگذاری رابطه‌ها</p>';
    return;
  }

  if (!rawLinks.length) {
    graphWrap.insertAdjacentHTML(
      'beforeend',
      `<div class="empty-state-graph">هنوز هیچ ارجاعی بین آیات ثبت نشده.<br>از فرم افزودن تفسیر، دکمهٔ «لینک به آیهٔ دیگر» را امتحان کنید.</div>`
    );
    linksListEl.innerHTML = '';
    return;
  }

  // List
  linksListEl.innerHTML =
    '<div class="section__label">فهرست لینک‌ها</div>' +
    rawLinks
      .map(
        (l) => `
    <div class="card" style="margin-bottom:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <a href="#/browse/${l.from_surah}/${l.from_ayah}" class="ayah-link">سورهٔ ${nameOf(l.from_surah)}، آیهٔ ${UI.toPersianDigits(l.from_ayah)}</a>
      <span style="color:var(--text-faint)">→</span>
      <a href="#/browse/${l.to_surah}/${l.to_ayah}" class="ayah-link">سورهٔ ${nameOf(l.to_surah)}، آیهٔ ${UI.toPersianDigits(l.to_ayah)}</a>
      ${l.excerpt ? `<span style="font-size:0.85rem; color:var(--text-dim);">«${UI.escapeHtml(l.excerpt)}»</span>` : ''}
    </div>
  `
      )
      .join('');

  // Graph (D3)
  if (typeof d3 === 'undefined') {
    graphWrap.insertAdjacentHTML(
      'beforeend',
      '<div class="empty-state-graph">کتابخانهٔ نمودار بارگذاری نشد.</div>'
    );
    return;
  }

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
    return {
      source: nodeKey(l.from_surah, l.from_ayah),
      target: nodeKey(l.to_surah, l.to_ayah),
      excerpt: l.excerpt,
    };
  });
  const nodes = Array.from(nodeMap.values());

  const violetColor =
    getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() ||
    '#e58aa8';

  const svg = d3.select('#graphSvg');
  svg.selectAll('*').remove();

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

  const g = svg.append('g');
  const zoom = d3.zoom().scaleExtent([0.4, 3]).on('zoom', (event) => {
    g.attr('transform', event.transform);
  });
  svg.call(zoom);

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(edges)
        .id((d) => d.id)
        .distance(70)
        .strength(0.5)
    )
    .force('charge', d3.forceManyBody().strength(-140))
    .force(
      'center',
      d3.forceCenter(graphWrap.clientWidth / 2, graphWrap.clientHeight / 2)
    )
    .force('collide', d3.forceCollide(20));

  const edgeSel = g
    .selectAll('.graph-edge')
    .data(edges)
    .join('line')
    .attr('class', 'graph-edge');

  const nodeSel = g
    .selectAll('.graph-node')
    .data(nodes)
    .join('g')
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
    .on('click', (event, d) => {
      Router.navigate(`/browse/${d.surah}/${d.ayah}`);
    });

  nodeSel.append('circle').attr('r', 14);
  nodeSel.append('text').text((d) => shortLabel(d.surah, d.ayah));

  simulation.on('tick', () => {
    edgeSel
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  function resize() {
    const w = graphWrap.clientWidth;
    const h = graphWrap.clientHeight;
    svg.attr('viewBox', `0 0 ${w} ${h}`);
    simulation.force('center', d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.3).restart();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
};
