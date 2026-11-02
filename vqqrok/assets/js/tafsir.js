/**
 * tafsir.js — موتور تفسیر
 * فایل‌های JSON خام (۴۹۹/۵۰۰/۵۰۱ یا هر فایل با ساختار {content_id, text}) را
 * می‌خواند، بلوک‌بندی می‌کند و به صفحه‌های قابل خواندن با صفحه‌بندی می‌شکند.
 */
import { SITE } from "./config.js";
import { escapeHtml, fa } from "./core.js";

/* ---------- الگوها ---------- */
const RE_FENCE = /^```\s*([a-zA-Z]*)\s*$/;
const RE_SPAN = /<span[^>]*id=["']surah-(\d+)-ayah-(\d+)["'][^>]*>\s*<\/span>/i;
const RE_H4 = /^####\s+(.+)$/;
const RE_H3 = /^###\s+(.+)$/;
const RE_H2 = /^##\s+(.+)$/;
const RE_H1 = /^#\s+(.+)$/;
const RE_BULLET = /^[-•*]\s+(.+)$/;
const TRIM_MARKS = /[\u200b-\u200f\u202a-\u202e\ufeff\s]+$/;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toLatinDigits(input = "") {
  return String(input).replace(/[٠-٩۰-۹]/g, (d) => {
    const ar = AR_DIGITS.indexOf(d);
    if (ar > -1) return String(ar);
    return String(FA_DIGITS.indexOf(d));
  });
}

function cleanHeading(text = "") {
  return text.replace(TRIM_MARKS, "").trim();
}

function cleanArabic(text = "") {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s*[\(\[]\s*[٠-٩۰-۹0-9]+\s*[\)\]]\s*$/, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** شمارهٔ آیه را از انتهای یک خط ترجمه جدا می‌کند */
function splitTranslationLine(line) {
  const clean = line.replace(TRIM_MARKS, "").trim();
  const match = clean.match(/[\(\[]\s*([٠-٩۰-۹0-9]+)\s*[\)\]]\s*[.۔]?\s*$/);
  if (!match) return { n: null, text: clean };
  return { n: Number(toLatinDigits(match[1])), text: clean.slice(0, match.index).trim() };
}

/* ---------- بلوک‌سازی ---------- */
export function toBlocks(rawText = "") {
  const lines = String(rawText).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let pendingAyah = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").replace(/[ \t]+/g, " ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "p", text });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (/^\*{3,}$/.test(trimmed)) continue;

    const spanMatch = trimmed.match(RE_SPAN);
    if (spanMatch) {
      flushParagraph();
      pendingAyah = Number(spanMatch[2]);
      continue;
    }

    const fence = trimmed.match(RE_FENCE);
    if (fence) {
      flushParagraph();
      const lang = (fence[1] || "").toLowerCase();
      const body = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      const content = body.join("\n").trim();
      if (!content) continue;
      if (lang === "arabic") {
        const ayah = pendingAyah ?? (blocks.filter((b) => b.type === "arabic").length + 1);
        blocks.push({ type: "arabic", ayah, text: cleanArabic(content) });
        pendingAyah = null;
      } else if (lang === "farsi") {
        const rows = content
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map(splitTranslationLine);
        if (rows.length) blocks.push({ type: "farsi", rows });
      } else {
        blocks.push({ type: "p", text: content.replace(/\n+/g, " ") });
      }
      continue;
    }

    let m;
    if ((m = trimmed.match(RE_H4))) {
      flushParagraph();
      blocks.push({ type: "h4", text: cleanHeading(m[1]) });
      continue;
    }
    if ((m = trimmed.match(RE_H3))) {
      flushParagraph();
      blocks.push({ type: "h3", text: cleanHeading(m[1]) });
      continue;
    }
    if ((m = trimmed.match(RE_H2))) {
      flushParagraph();
      blocks.push({ type: "h2", text: cleanHeading(m[1]) });
      continue;
    }
    if ((m = trimmed.match(RE_H1))) {
      flushParagraph();
      blocks.push({ type: "h2", text: cleanHeading(m[1]) });
      continue;
    }
    if ((m = trimmed.match(RE_BULLET))) {
      flushParagraph();
      blocks.push({ type: "li", text: cleanHeading(m[1]) });
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

/** بلوک‌های هم‌جنس را در یک واحد نمایشی ادغام می‌کند */
function mergeRuns(blocks) {
  const out = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.type === "arabic" && last?.type === "arabic-grid") {
      last.rows.push({ ayah: block.ayah, text: block.text });
      continue;
    }
    if (block.type === "farsi" && last?.type === "trans-list") {
      last.rows.push(...block.rows);
      continue;
    }
    if (block.type === "li" && last?.type === "list") {
      last.items.push(block.text);
      continue;
    }
    if (block.type === "arabic") {
      out.push({ type: "arabic-grid", rows: [{ ayah: block.ayah, text: block.text }] });
      continue;
    }
    if (block.type === "farsi") {
      out.push({ type: "trans-list", rows: [...block.rows] });
      continue;
    }
    if (block.type === "li") {
      out.push({ type: "list", items: [block.text] });
      continue;
    }
    out.push({ ...block });
  }
  return out;
}

const HEADINGS = new Set(["h2", "h3", "h4"]);

function blockWeight(block) {
  if (block.type === "arabic-grid") return block.rows.reduce((sum, r) => sum + r.text.length, 0) + block.rows.length * 40;
  if (block.type === "trans-list") return block.rows.reduce((sum, r) => sum + r.text.length, 0) + block.rows.length * 12;
  if (block.type === "list") return block.items.join(" ").length;
  return (block.text || "").length;
}

/* ---------- صفحه‌بندی ---------- */
/**
 * صفحه‌بندی منطقی بر اساس ساختار تفسیر المیزان:
 * - هر فایل JSON یک بخش (مثلاً آیات ۱–۱۰)
 * - صفحات در مرز عنوان‌های ### و #### شکسته می‌شوند
 * - عنوان‌های کوتاه با متن بعدشان در یک صفحه می‌مانند
 * - صفحهٔ خالی ساخته نمی‌شود
 */
function paginate(blocks, docMeta) {
  const pages = [];
  let current = [];
  let weight = 0;
  let section = "";
  let docTitle = docMeta.title || "";
  let docIndex = docMeta.index ?? 0;

  const softMax = SITE.pageMax || 3200;
  const softTarget = SITE.pageTarget || 1800;

  const pushPage = () => {
    if (!current.length) return;
    // عنوان تنها در انتهای صفحه نماند
    const trailing = [];
    while (current.length > 1 && HEADINGS.has(current[current.length - 1].type)) {
      trailing.unshift(current.pop());
    }
    // صفحهٔ بدون محتوای واقعی را دور بریز
    const hasBody = current.some((b) => !HEADINGS.has(b.type));
    if (hasBody || current.length > 1) {
      pages.push(buildPage(current, { section, docTitle, docIndex }));
    }
    current = trailing;
    weight = current.reduce((sum, block) => sum + blockWeight(block), 0);
  };

  for (const block of blocks) {
    // هر h2 = شروع بخش جدید
    if (block.type === "h2") {
      pushPage();
      docTitle = block.text;
      section = "";
      current = [block];
      weight = blockWeight(block);
      continue;
    }

    // هر h3 (بیان آیات / بحث روایتی / ترجمه) = صفحهٔ جدید
    if (block.type === "h3") {
      pushPage();
      section = block.text;
      current = [block];
      weight = blockWeight(block);
      continue;
    }

    // h4: اگر صفحه پر است، صفحهٔ جدید
    if (block.type === "h4") {
      if (weight >= softTarget && current.some((b) => !HEADINGS.has(b.type))) {
        pushPage();
      }
      current.push(block);
      weight += blockWeight(block);
      if (block.text) section = block.text;
      continue;
    }

    // بلوک‌های عربی/ترجمه: سبک نگه دار؛ با بیان ادغام نشوند اگر خیلی بزرگ‌اند
    const size = blockWeight(block);
    if (
      current.length &&
      weight + size > softMax &&
      !HEADINGS.has(block.type) &&
      current.some((b) => !HEADINGS.has(b.type))
    ) {
      pushPage();
    }
    current.push(block);
    weight += size;
  }
  pushPage();
  return pages.map((page, index) => ({ ...page, id: `p${index + 1}`, index }));
}

function buildPage(blocks, meta) {
  const ayahNumbers = [];
  for (const block of blocks) {
    if (block.type === "arabic-grid") {
      for (const row of block.rows) ayahNumbers.push(row.ayah);
    }
  }
  // شماره آیه از عنوان‌های h4 هم استخراج شود (مثل ﴿نَحْنُ خَلَقْنَاكُمْ...﴾)
  const heading = blocks.find((b) => b.type === "h4" || b.type === "h3" || b.type === "h2");
  const sectionTitle = meta.section || heading?.text || meta.docTitle || "تفسیر";
  return {
    blocks,
    section: sectionTitle,
    docTitle: meta.docTitle || "",
    docIndex: meta.docIndex ?? 0,
    title: sectionTitle,
    heading: heading?.text || sectionTitle,
    ayahs: ayahNumbers,
    from: ayahNumbers.length ? Math.min(...ayahNumbers) : null,
    to: ayahNumbers.length ? Math.max(...ayahNumbers) : null,
  };
}

/* ---------- رندر ---------- */
function inline(text = "") {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/﴿([^﴾]{1,400})﴾/g, '<span class="quranquote">﴿$1﴾</span>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return html;
}

export function blocksToHtml(blocks) {
  const parts = [];
  for (const block of blocks) {
    switch (block.type) {
      case "h2":
        parts.push(`<h3 class="reader__doctitle">${inline(block.text)}</h3>`);
        break;
      case "h3":
        parts.push(`<h3>${inline(block.text)}</h3>`);
        break;
      case "h4":
        parts.push(`<h4>${inline(block.text)}</h4>`);
        break;
      case "arabic-grid":
        parts.push(
          `<div class="ayahgrid" aria-label="متن آیه">${block.rows
            .map(
              (row) =>
                `<p class="ayahgrid__ar" lang="ar" dir="rtl" data-ayah="${row.ayah}">` +
                `${escapeHtml(row.text)}` +
                `<span class="ayahgrid__n" aria-hidden="true"> ﴿${fa(row.ayah)}﴾</span></p>`
            )
            .join("")}</div>`
        );
        break;
      case "trans-list":
        // ترجمهٔ آیات داخل تفسیر نمایش داده نمی‌شود (متن تفسیر کافی است)
        break;
      case "list":
        parts.push(`<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
        break;
      default:
        parts.push(`<p>${inline(block.text)}</p>`);
    }
  }
  return parts.join("\n");
}

export function pageHtml(page) {
  return blocksToHtml(page.blocks);
}

/* ---------- تحلیل سندها ---------- */
export function parseTafsirDocs(docs) {
  const sorted = [...docs]
    .filter((doc) => doc && typeof doc.text === "string")
    .sort((a, b) => Number(a.content_id ?? 0) - Number(b.content_id ?? 0));

  const pages = [];
  const sections = [];

  sorted.forEach((doc, docIndex) => {
    // ترجمهٔ آیات داخل تفسیر را از صفحه‌بندی حذف کن
    const blocks = mergeRuns(toBlocks(doc.text)).filter((b) => b.type !== "trans-list");
    const firstTitle = blocks.find((b) => b.type === "h2")?.text || `بخش ${docIndex + 1}`;
    const docPages = paginate(blocks, { title: firstTitle, index: docIndex });

    docPages.forEach((page) => {
      const hasBody = page.blocks.some((b) => !HEADINGS.has(b.type));
      if (!hasBody) return;
      page.docIndex = docIndex;
      page.docTitle = firstTitle;
      pages.push(page);
    });
  });

  // صفحات خیلی کوتاه را با صفحهٔ قبلی ادغام کن
  const merged = [];
  for (const page of pages) {
    const bodyLen = page.blocks
      .filter((b) => !HEADINGS.has(b.type))
      .reduce((sum, b) => sum + blockWeight(b), 0);
    if (merged.length && bodyLen < 1000 && page.docIndex === merged[merged.length - 1].docIndex) {
      const prev = merged[merged.length - 1];
      prev.blocks = [...prev.blocks, ...page.blocks];
      prev.ayahs = [...new Set([...(prev.ayahs || []), ...(page.ayahs || [])])];
      if (page.from != null) prev.from = prev.from == null ? page.from : Math.min(prev.from, page.from);
      if (page.to != null) prev.to = prev.to == null ? page.to : Math.max(prev.to, page.to);
      continue;
    }
    merged.push(page);
  }
  pages.length = 0;
  pages.push(...merged);

  pages.forEach((page, index) => {
    page.id = `p${index + 1}`;
    page.index = index;
    page.pageInDoc = index;
    page.html = pageHtml(page);
  });

  let lastDoc = null;
  pages.forEach((page) => {
    if (page.docTitle !== lastDoc) {
      sections.push({ kind: "doc", title: page.docTitle, page: page.index, docIndex: page.docIndex });
      lastDoc = page.docTitle;
    }
    for (const block of page.blocks) {
      if (block.type === "h3") {
        sections.push({ kind: "section", title: block.text, page: page.index, docIndex: page.docIndex });
      }
    }
  });

  const ayahMap = new Map();
  pages.forEach((page, index) => {
    for (const ayah of page.ayahs) if (!ayahMap.has(ayah)) ayahMap.set(ayah, index);
  });

  return {
    pages,
    sections,
    names: sorted.map((doc, index) => ({
      index,
      contentId: doc.content_id ?? null,
      title: pages.find((p) => p.docIndex === index)?.docTitle || `بخش ${index + 1}`,
    })),
    count: pages.length,
    ayahMap,
  };
}

/* ---------- بارگذاری ---------- */
async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * فایل‌های تفسیر را از data/tafsir می‌خواند.
 * @returns {Promise<{ok:boolean, reason?:string, docs:Array, missing:string[], source:string}>}
 */
export async function loadTafsirFiles() {
  if (location.protocol === "file:") {
    return { ok: false, reason: "file-protocol", docs: [], missing: [], source: "none" };
  }

  const base = SITE.tafsir.dir;
  let names = SITE.tafsir.defaults;
  try {
    const manifest = await fetchJson(SITE.tafsir.manifest);
    if (Array.isArray(manifest) && manifest.length) {
      names = manifest.map((item) => (typeof item === "string" ? item : item?.file)).filter(Boolean);
    } else if (Array.isArray(manifest?.files) && manifest.files.length) {
      names = manifest.files;
    }
  } catch {
    /* مانیفست اختیاری است */
  }

  if (names.length === 1 && names[0].endsWith(".json") && names[0] === "tafsir.json") {
    try {
      const bundle = await fetchJson(base + names[0]);
      const docs = Array.isArray(bundle) ? bundle : bundle?.docs || [];
      if (docs.length) return { ok: true, docs, missing: [], source: "static" };
    } catch {
      /* می‌رویم سراغ فایل‌های تکی */
    }
    names = SITE.tafsir.defaults;
  }

  const docs = [];
  const missing = [];
  await Promise.all(
    names.map(async (name) => {
      try {
        const data = await fetchJson(base + name);
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) if (item?.text) docs.push(item);
      } catch {
        missing.push(name);
      }
    })
  );

  if (!docs.length) return { ok: false, reason: "missing", docs: [], missing, source: "none" };
  return { ok: true, docs, missing, source: "static" };
}

/** خواندن فایل‌های انتخابی کاربر (پیش‌نمایش محلی) */
export async function readLocalFiles(fileList) {
  const docs = [];
  const failed = [];
  for (const file of fileList) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        if (item && typeof item.text === "string") docs.push(item);
        else if (item && typeof item === "string") docs.push({ text: item });
      }
    } catch {
      failed.push(file.name);
    }
  }
  return { docs, failed };
}
