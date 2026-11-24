/* Render the transcribed report and provide copy / download. */
(function () {
  "use strict";

  const R = REPORT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------------------------------------------------------- tables */
  function renderMeta() {
    $("metaGrid").innerHTML = R.meta
      .map((m) => `<div><span>${esc(m.k)}</span>${esc(m.v)}</div>`)
      .join("");
  }

  function renderDomains() {
    const rows = R.domains
      .map(
        (d) => `<tr>
          <td class="code">${d.code}</td>
          <td>${esc(d.name)} <span style="color:var(--muted);font-size:12px">${esc(d.en)}</span></td>
          <td class="num">${d.score}</td>
          <td>${esc(d.label)}</td>
          <td class="num" style="color:var(--muted)">${Math.round((d.score / 192) * 100)}%</td>
        </tr>`
      )
      .join("");
    $("domainTable").innerHTML =
      `<thead><tr><th class="num">کد</th><th>مقیاس</th><th class="num">نمره</th><th>تفسیر</th><th class="num">از سقف</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderFacets() {
    const order = ["N", "E", "O", "A", "C"];
    const titles = {
      N: ["روان‌رنجوری", "Neuroticism"],
      E: ["برون‌گرایی", "Extraversion"],
      O: ["انعطاف‌پذیری", "Openness"],
      A: ["دلپذیری", "Agreeableness"],
      C: ["با وجدان بودن", "Conscientiousness"]
    };
    $("facetBlocks").innerHTML = order
      .map((dom) => {
        const d = R.domains.find((x) => x.code === dom);
        const rows = R.facets
          .filter((f) => f.dom === dom)
          .map(
            (f) => `<tr>
              <td class="code">${f.code}</td>
              <td>${esc(f.name)} <span style="color:var(--muted);font-size:12px">${esc(f.en)}</span></td>
              <td class="num">${f.score}</td>
              <td>${esc(f.label)}</td>
              <td class="num" style="color:var(--muted)">${Math.round((f.score / 32) * 100)}%</td>
            </tr>`
          )
          .join("");
        return `<div class="card facet-block">
          <div class="dom-head"><strong>${dom} — ${esc(titles[dom][0])}</strong><em>${esc(titles[dom][1])} · ${d.score}</em></div>
          <table><thead><tr><th class="num">کد</th><th>خرده‌مقیاس</th><th class="num">نمره</th><th>تفسیر</th><th class="num">از سقف</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
      })
      .join("");
  }

  function renderValidity() {
    $("extraTable").innerHTML =
      `<thead><tr><th>سوال</th><th>پاسخ</th><th>تفسیر</th></tr></thead><tbody>` +
      R.validity.extra.map((r) => `<tr><td>${esc(r.q)}</td><td>${esc(r.a)}</td><td>${esc(r.i)}</td></tr>`).join("") +
      `</tbody>`;
    $("countTable").innerHTML =
      `<thead><tr><th>پاسخ</th><th class="num">تعداد</th><th>تفسیر</th></tr></thead><tbody>` +
      R.validity.counts.map((r) => `<tr><td>${esc(r.a)}</td><td class="num">${r.n}</td><td>${esc(r.i)}</td></tr>`).join("") +
      `</tbody>`;
    $("randomTable").innerHTML =
      `<thead><tr><th>پاسخ</th><th>تفسیر</th></tr></thead><tbody>` +
      R.validity.random.map((r) => `<tr><td>${esc(r.a)}</td><td>${esc(r.i)}</td></tr>`).join("") +
      `</tbody>`;
  }

  function renderTheory() {
    $("theoryTable").innerHTML =
      `<thead><tr><th class="num">کد</th><th>مقیاس</th><th class="num">نمره</th><th>تفسیر</th></tr></thead><tbody>` +
      R.theory.map((r) => `<tr><td class="code">${r.code}</td><td>${esc(r.name)}</td><td class="num">${r.score}</td><td>${esc(r.label)}</td></tr>`).join("") +
      `</tbody>`;
  }

  function renderProfileTable() {
    const byDom = {};
    R.profile.forEach((p) => {
      const dom = p.code.length > 1 ? p.code[0] : p.code;
      (byDom[dom] = byDom[dom] || []).push(p);
    });
    let rows = "";
    ["N", "E", "O", "A", "C"].forEach((dom) => {
      rows += byDom[dom].map((p) => {
        const f = R.facets.find((x) => x.code === p.code);
        const name = f ? f.name : R.domains.find((d) => d.code === p.code).name;
        const band = p.value >= 70 ? "بالا" : p.value <= 30 ? "پایین" : "متوسط";
        return `<tr><td class="code">${p.code}</td><td>${esc(name)}</td><td class="num">${p.value}</td><td>${band}</td></tr>`;
      }).join("");
    });
    $("profileTable").innerHTML =
      `<thead><tr><th class="num">کد</th><th>مقیاس</th><th class="num">T</th><th>نوار</th></tr></thead><tbody>${rows}</tbody>`;
  }

  /* ----------------------------------------------------------------- chart */
  function renderChart() {
    const svg = $("chart");
    const NS = "http://www.w3.org/2000/svg";
    const W = 1080, H = 460, L = 54, Rm = 84, T = 30, B = 92;
    const plotW = W - L - Rm, plotH = H - T - B;
    const GAP = 26;

    const cols = [];
    R.domains.forEach((d) => cols.push({ code: d.code, value: R.profile.find((p) => p.code === d.code).value, kind: "d" }));
    ["N", "E", "O", "A", "C"].forEach((dom) => {
      R.facets.filter((f) => f.dom === dom).forEach((f) =>
        cols.push({ code: f.code, value: R.profile.find((p) => p.code === f.code).value, kind: "f" })
      );
    });

    const step = (plotW - GAP * 5) / (cols.length - 1);
    let gapAfter = 4; // index after which a gap is inserted
    const xs = [];
    let gi = 0;
    cols.forEach((c, i) => {
      if (i > 0 && i === gapAfter + 1) gi += 1;
      xs.push(L + i * step + gi * GAP);
      if (i === 4 || (i > 4 && (i - 5) % 6 === 5)) gapAfter = i;
    });

    const y = (v) => T + ((100 - v) / 80) * plotH;
    let s = "";

    // horizontal grid
    for (let v = 20; v <= 100; v += 2) {
      const major = v % 10 === 0;
      s += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - Rm}" y2="${y(v).toFixed(1)}"
        stroke="${major ? "#c9ccd2" : "#eceef1"}" stroke-width="${major ? 1 : 0.7}"
        stroke-dasharray="${major ? "0" : "2 4"}" />`;
      if (major) {
        s += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="#8a8f98">${v}</text>`;
      }
    }
    // band captions
    const bands = [["خیلی بالا", 95], ["بالا", 80], ["متوسط", 60], ["پایین", 40], ["خیلی پایین", 25]];
    bands.forEach(([t, v]) => {
      s += `<text x="${W - Rm + 10}" y="${y(v) + 4}" text-anchor="start" font-size="9.5" fill="#b3b7bf" direction="rtl">${t}</text>`;
    });

    // group separators
    const seps = [L - GAP / 2];
    cols.forEach((c, i) => {
      const next = cols[i + 1];
      if (next && (c.kind === "d" || c.code.slice(1) === "6")) seps.push((xs[i] + xs[i + 1]) / 2);
    });
    seps.forEach((x) => {
      s += `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${T + plotH}" stroke="#bfc3ca" stroke-width="1" />`;
    });

    // axis frame
    s += `<rect x="${L}" y="${T}" width="${plotW}" height="${plotH}" fill="none" stroke="#9aa0a8" stroke-width="1" />`;

    // line + points
    const pts = cols.map((c, i) => `${xs[i].toFixed(1)},${y(c.value).toFixed(1)}`).join(" ");
    s += `<polyline points="${pts}" fill="none" stroke="#1b1d21" stroke-width="1.6" stroke-linejoin="round" />`;
    cols.forEach((c, i) => {
      s += `<circle cx="${xs[i].toFixed(1)}" cy="${y(c.value).toFixed(1)}" r="2.2" fill="#1b1d21" />`;
      s += `<text transform="translate(${xs[i].toFixed(1)},${T + plotH + 16}) rotate(-55)"
        text-anchor="end" font-size="${c.kind === "d" ? 12 : 10.5}"
        font-weight="${c.kind === "d" ? 600 : 400}" fill="#3f434a">${c.code}</text>`;
    });
    svg.innerHTML = s;
  }

  /* ------------------------------------------------------------- exporters */
  function textExport() {
    const out = [];
    out.push("NEO-PI-R — گزارش آزمون نئو (فرم بلند)");
    out.push("---- مشخصات ----");
    R.meta.forEach((m) => out.push(`${m.k}\t${m.v}`));
    out.push("");
    out.push("---- مقیاس‌های اصلی (نمره خام) ----");
    out.push("کد\tمقیاس\tنمره\tتفسیر");
    R.domains.forEach((d) => out.push(`${d.code}\t${d.name} (${d.en})\t${d.score}\t${d.label}`));
    out.push("");
    ["N", "E", "O", "A", "C"].forEach((dom) => {
      out.push(`---- خرده‌مقیاس‌های ${dom} ----`);
      out.push("کد\tخرده‌مقیاس\tنمره\tتفسیر");
      R.facets.filter((f) => f.dom === dom).forEach((f) => out.push(`${f.code}\t${f.name} (${f.en})\t${f.score}\t${f.label}`));
      out.push("");
    });
    out.push("---- سوالات اضافه ----");
    out.push("سوال\tپاسخ\tتفسیر");
    R.validity.extra.forEach((r) => out.push(`${r.q}\t${r.a}\t${r.i}`));
    out.push("");
    out.push("---- تعداد پاسخ‌ها ----");
    out.push("پاسخ\tتعداد\tتفسیر");
    R.validity.counts.forEach((r) => out.push(`${r.a}\t${r.n}\t${r.i}`));
    out.push("");
    out.push("---- پاسخ‌های تصادفی ----");
    out.push("پاسخ\tتفسیر");
    R.validity.random.forEach((r) => out.push(`${r.a}\t${r.i}`));
    out.push("");
    out.push("---- جدول نظریه ----");
    out.push("کد\tمقیاس\tنمره\tتفسیر");
    R.theory.forEach((r) => out.push(`${r.code}\t${r.name}\t${r.score}\t${r.label}`));
    out.push("");
    out.push("---- نیم‌رخ (نمره T، خوانده‌شده از نمودار) ----");
    R.profile.forEach((p) => out.push(`${p.code}\t${p.value}`));
    out.push("");
    out.push("---- یادداشت‌ها ----");
    R.notes.forEach((n) => out.push("- " + n));
    return out.join("\n");
  }

  function csvExport() {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["section", "code", "name", "en", "score", "interpretation"].map(q)];
    R.meta.forEach((m) => rows.push(["meta", "", m.k, "", m.v, ""].map(q)));
    R.domains.forEach((d) => rows.push(["domain", d.code, d.name, d.en, d.score, d.label].map(q)));
    R.facets.forEach((f) => rows.push(["facet", f.code, f.name, f.en, f.score, f.label].map(q)));
    R.validity.extra.forEach((r) => rows.push(["validity_extra", r.q, r.a, "", "", r.i].map(q)));
    R.validity.counts.forEach((r) => rows.push(["validity_count", "", r.a, "", r.n, r.i].map(q)));
    R.validity.random.forEach((r) => rows.push(["validity_random", "", r.a, "", "", r.i].map(q)));
    R.theory.forEach((r) => rows.push(["theory", r.code, r.name, "", r.score, r.label].map(q)));
    R.profile.forEach((p) => rows.push(["profile_t", p.code, "", "", p.value, ""].map(q)));
    return "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function copyAll() {
    const text = textExport();
    const done = () => toast("کپی شد — copied");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("کپی نشد — copy failed"); }
      ta.remove();
    }
  }

  /* ------------------------------------------------------------------ init */
  renderMeta();
  renderDomains();
  renderFacets();
  renderValidity();
  renderTheory();
  renderProfileTable();
  renderChart();

  $("notesList").innerHTML = R.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  $("copyBtn").addEventListener("click", copyAll);
  $("csvBtn").addEventListener("click", () => {
    download("neo-pi-r-87.csv", csvExport(), "text/csv;charset=utf-8");
    toast("CSV دانلود شد");
  });
  $("dlBtn").addEventListener("click", () => {
    download(
      "neo-pi-r-87.json",
      JSON.stringify({ generatedAt: new Date().toISOString(), source: "NEO-PI-R scan, transcribed", report: R }, null, 2),
      "application/json;charset=utf-8"
    );
    toast("JSON دانلود شد");
  });
})();
