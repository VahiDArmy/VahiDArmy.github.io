/**
 * surah.js — نمایش سوره، جست‌وجو، نشان‌ها و پیشرفت مطالعه
 */
import { SITE } from "./config.js";
import { $, $$, el, icon, fa, escapeHtml, debounce, store, copyText, toast, prefersReducedMotion } from "./core.js";

const BISMILLAH_WORDS = ["بسم", "الله", "الرحمن", "الرحيم"];
const AR_MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g;

/** «بسم الله الرحمن الرحیم» را از ابتدای آیهٔ یکم جدا می‌کند (بی‌توجه به اعراب) */
function stripBismillah(text = "") {
  const words = String(text).trim().split(/\s+/);
  if (words.length <= BISMILLAH_WORDS.length) return String(text).trim();
  const bare = words.map((word) => word.replace(AR_MARKS, ""));
  const isBismillah = BISMILLAH_WORDS.every((expected, index) => bare[index] === expected);
  return isBismillah ? words.slice(BISMILLAH_WORDS.length).join(" ").trim() : String(text).trim();
}

export const surahState = {
  ayahs: [],
  nodes: new Map(),
  faNodes: new Map(),
  marks: new Set(store.get("marks", [])),
  selected: null,
  lastAyah: Number(store.get("lastAyah", 1)) || 1,
  progress: 0,
  query: "",
  active: 1,
  sessionReads: 0,
  showTranslation: store.get("showTranslation", false) === true,
  partnerAyah: null,
  partnerMeta: null,
  hooks: {},
};

/** نرمال‌سازی متن عربی برای جست‌وجو */
function normalizeAr(text = "") {
  return String(text)
    .replace(AR_MARKS, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ی")
    .replace(/[ةه]/g, "ه")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFa(text = "") {
  return String(text)
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadSurah() {
  try {
    const response = await fetch("data/surah56.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data?.ayahs) ? data.ayahs : [];
    if (!list.length) throw new Error("ساختار فایل سوره درست نیست");
    surahState.ayahs = list.map((item) => ({
      ayah: Number(item.v ?? item.ayah),
      ar: stripBismillah(item.ar),
      fa: String(item.fa ?? ""),
      normAr: normalizeAr(stripBismillah(item.ar)),
      normFa: normalizeFa(String(item.fa ?? "")),
    }));
    return { ok: true, meta: { nameFa: data.name_fa, nameAr: data.name_ar, revelation: data.revelation, count: list.length } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ---------- صفحهٔ پیوستهٔ سوره ---------- */
function ayahNode(item) {
  const marked = surahState.marks.has(item.ayah);
  const node = el(
    "span",
    {
      class: `ayah${marked ? " is-marked" : ""}`,
      id: `ayah-${item.ayah}`,
      dataset: { ayah: item.ayah },
      tabindex: "0",
      role: "button",
      "aria-label": `آیهٔ ${fa(item.ayah)}`,
    },
    el("span", { class: "ayah__text" }, (item.ar || "").trim()),
    el("span", { class: "ayah__num", "aria-hidden": "true" }, `﴿${fa(item.ayah)}﴾`)
  );
  node.addEventListener("click", () => selectAyah(item.ayah));
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectAyah(item.ayah);
  });
  return node;
}

function translationNode(item) {
  const marked = surahState.marks.has(item.ayah);
  const node = el(
    "span",
    {
      class: `ayah__fa${marked ? " is-marked" : ""}`,
      id: `fa-${item.ayah}`,
      dataset: { ayah: item.ayah },
    },
    el("span", { class: "ayah__fnum", "aria-hidden": "true" }, `﴿${fa(item.ayah)}﴾`),
    el("span", { class: "ayah__ftext" }, item.fa)
  );
  node.addEventListener("click", () => selectAyah(item.ayah));
  return node;
}

export function setShowTranslation(on) {
  surahState.showTranslation = Boolean(on);
  store.set("showTranslation", surahState.showTranslation);
  const track = $("#mushafFa");
  if (track) track.hidden = !surahState.showTranslation;
  const btn = $("#toggleTranslation");
  if (btn) {
    btn.classList.toggle("is-on", surahState.showTranslation);
    btn.setAttribute("aria-pressed", String(surahState.showTranslation));
  }
  if (surahState.partnerAyah != null) {
    setPartnerAyah(surahState.partnerAyah, surahState.partnerMeta);
  }
}

function setDockAyahVisible(visible) {
  for (const selector of ["#dockAyahLabel", "#dockSep", "#dockCopy", "#dockMark", "#dockTafsir"]) {
    const node = $(selector);
    if (node) node.hidden = !visible;
  }
  const dock = $("#dock");
  if (dock) dock.classList.toggle("is-visible", visible || window.scrollY > 420);
}

function syncDock(ayah) {
  const label = $("#dockAyahLabel");
  const num = label?.querySelector("[data-dock-num]");
  if (num) num.textContent = fa(ayah);
  const mark = $("#dockMark");
  if (mark) {
    const on = surahState.marks.has(ayah);
    mark.classList.toggle("is-on", on);
    mark.setAttribute("aria-pressed", String(on));
  }
  setDockAyahVisible(true);
}

export function selectAyah(ayah, { scroll = false, smooth = true, toggle = true } = {}) {
  const num = Number(ayah);
  const node = surahState.nodes.get(num);
  if (!node) return;
  const reading = document.body.classList.contains("is-reading");
  // در مود خواندن: لمس آیه فقط موقعیت ردیابی را اصلاح می‌کند — بدون هایلایت خودم
  if (reading) {
    clearSelection({ keepDock: true });
    setTrackedAyah(num);
    surahState.hooks.onCorrect?.(num);
    return;
  }
  if (toggle && surahState.selected === num) {
    clearSelection();
    return;
  }
  clearSelection({ keepDock: true });
  surahState.selected = num;
  node.classList.add("is-active");
  surahState.faNodes.get(num)?.classList.add("is-active");
  if (scroll) {
    node.scrollIntoView({
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      block: "start",
    });
  }
  surahState.lastAyah = num;
  store.set("lastAyah", num);
  syncDock(num);
}

export function clearSelection({ keepDock = false } = {}) {
  const previous = surahState.selected;
  if (previous != null) {
    surahState.nodes.get(previous)?.classList.remove("is-active");
    surahState.faNodes.get(previous)?.classList.remove("is-active");
    surahState.selected = null;
  }
  if (!keepDock) setDockAyahVisible(false);
}

export function toggleMarkAyah(ayah) {
  const num = Number(ayah);
  const marks = surahState.marks;
  const on = !marks.has(num);
  if (on) marks.add(num);
  else marks.delete(num);
  store.set("marks", [...marks]);
  surahState.nodes.get(num)?.classList.toggle("is-marked", on);
  surahState.faNodes.get(num)?.classList.toggle("is-marked", on);
  if (surahState.selected === num) syncDock(num);
  toast(on ? `آیهٔ ${fa(num)} نشان شد.` : "نشان برداشته شد.", on ? "ok" : undefined);
  return on;
}

export function initAyahTools() {
  $("#dockCopy")?.addEventListener("click", async () => {
    const item = surahState.ayahs.find((entry) => entry.ayah === surahState.selected);
    if (!item) return;
    const ok = await copyText(`﴿${item.ar}﴾\n${item.fa}\n(واقعه، آیهٔ ${fa(item.ayah)})`);
    toast(ok ? "آیه رونوشت شد." : "رونوشت نشد.", ok ? "ok" : "warn");
  });

  $("#dockMark")?.addEventListener("click", () => {
    if (surahState.selected != null) toggleMarkAyah(surahState.selected);
  });

  $("#dockTafsir")?.addEventListener("click", () => {
    if (surahState.selected != null) surahState.hooks.onTafsir?.(surahState.selected);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.querySelector(".modal[open]")) return;
    clearSelection();
  });
}

export function renderAyahs(host) {
  host.innerHTML = "";
  surahState.nodes.clear();
  surahState.faNodes.clear();

  const panel = el("section", { class: "mushaf", id: "mushaf" });
  const arTrack = el("div", { class: "mushaf__ar", lang: "ar", dir: "rtl" });
  const faTrack = el("div", {
    class: "mushaf__fa",
    id: "mushafFa",
    lang: "fa",
    dir: "rtl",
    hidden: !surahState.showTranslation,
  });
  const arFragment = document.createDocumentFragment();
  const faFragment = document.createDocumentFragment();

  for (const item of surahState.ayahs) {
    const ar = ayahNode(item);
    const faNode = translationNode(item);
    surahState.nodes.set(item.ayah, ar);
    surahState.faNodes.set(item.ayah, faNode);
    arFragment.append(ar);
    faFragment.append(faNode, document.createTextNode(" "));
  }

  arTrack.append(arFragment);
  faTrack.append(faFragment);
  panel.append(
    arTrack,
    faTrack,
    el("p", { class: "mushaf__hint" }, "روی هر آیه بزن تا در نوار پایین، رونوشت و نشان و تفسیر همان آیه را داشته باشی.")
  );
  host.append(panel);

  const btn = $("#toggleTranslation");
  if (btn) {
    btn.classList.toggle("is-on", surahState.showTranslation);
    btn.setAttribute("aria-pressed", String(surahState.showTranslation));
  }
}

/* ---------- جست‌وجو ---------- */
function highlight(text, query, useArabic) {
  const source = useArabic ? normalizeAr(text) : normalizeFa(text);
  const needle = useArabic ? normalizeAr(query) : normalizeFa(query);
  if (!needle) return escapeHtml(text);
  if (!source.includes(needle)) return escapeHtml(text);
  // هایلایت ساده و محافظه‌کارانه: فقط تطابق مستقیم روی متن اصلی
  const escaped = escapeHtml(text);
  const safeNeedle = escapeHtml(query.trim());
  if (!safeNeedle) return escaped;
  try {
    const pattern = new RegExp(safeNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    return escaped.replace(pattern, (match) => `<mark>${match}</mark>`);
  } catch {
    return escaped;
  }
}

export const applySearch = debounce((query) => {
  const host = $("#ayahs");
  const counter = $("#searchCount");
  if (!host) return;
  surahState.query = query;
  const needleAr = normalizeAr(query);
  const needleFa = normalizeFa(query);
  const hasQuery = needleAr.length > 0;
  let hits = 0;

  for (const item of surahState.ayahs) {
    const ar = surahState.nodes.get(item.ayah);
    const fa = surahState.faNodes.get(item.ayah);
    if (!ar) continue;
    const match =
      !hasQuery ||
      normalizeAr(item.ar).includes(needleAr) ||
      normalizeFa(item.fa).includes(needleFa) ||
      String(item.ayah) === query.trim();
    ar.hidden = !match;
    if (fa) fa.hidden = !match;
    ar.classList.toggle("is-hit", hasQuery && match);
    if (match) hits += 1;

    const arText = ar.querySelector(".ayah__text");
    const faText = fa?.querySelector(".ayah__ftext");
    if (arText) arText.innerHTML = hasQuery ? highlight(item.ar, query, true) : escapeHtml(item.ar);
    if (faText) faText.innerHTML = hasQuery ? highlight(item.fa, query, false) : escapeHtml(item.fa);
  }

  if (surahState.selected != null && surahState.nodes.get(surahState.selected)?.hidden) clearSelection();

  if (counter) {
    counter.hidden = !hasQuery;
    counter.textContent = `${fa(hits)} آیه`;
  }

  const existing = host.querySelector(".emptyresult");
  if (existing) existing.remove();
  if (hasQuery && hits === 0) {
    host.append(
      el(
        "div",
        { class: "emptyresult" },
        icon("search"),
        el("b", {}, "چیزی پیدا نشد"),
        el("span", {}, "عبارت دیگری را امتحان کن؛ می‌توانی شمارهٔ آیه را هم بنویسی.")
      )
    );
  }
}, 200);

/* ---------- پیمایش و پیشرفت ---------- */
export function focusAyah(ayah, { smooth = true } = {}) {
  selectAyah(Number(ayah), { scroll: true, smooth, toggle: false });
  setTrackedAyah(Number(ayah));
}

/** فقط شمارنده/پیشرفت — بدون اسکرول و بدون کلاس هایلایت روی آیهٔ خودم */
export function setTrackedAyah(ayah) {
  const num = Number(ayah);
  if (!Number.isFinite(num) || num < 1) return;
  if (surahState.active === num) {
    surahState.lastAyah = num;
    store.set("lastAyah", num);
    return;
  }
  surahState.active = num;
  surahState.lastAyah = num;
  store.set("lastAyah", num);
  surahState.progress = Math.round((num / SITE.ayahCount) * 100);
  surahState.hooks.onProgress?.(surahState.progress, num);
}

export function updateProgress() {
  if (!surahState.nodes.size) return;
  // در مود خواندن: شمارنده فقط با تایمر (جلو) یا لمس آیه عوض می‌شود.
  // اسکرول هرگز نباید شمارنده را عقب ببرد یا جابه‌جا کند.
  if (document.body.classList.contains("is-reading")) {
    const ayah = surahState.active || surahState.lastAyah || 1;
    surahState.progress = Math.round((ayah / SITE.ayahCount) * 100);
    return;
  }
  // خارج از مود خواندن: آیهٔ زیر مرکز صفحه
  const y = window.innerHeight * 0.38;
  const x = window.innerWidth * 0.5;
  let node = null;
  const hit = document.elementFromPoint(x, y);
  if (hit) node = hit.closest?.(".ayah");
  if (!node || node.hidden) {
    const mid = y;
    for (const card of surahState.nodes.values()) {
      if (card.hidden) continue;
      const rect = card.getBoundingClientRect();
      if (rect.top <= mid) node = card;
    }
  }
  if (!node) node = surahState.nodes.get(1) || [...surahState.nodes.values()][0];
  const ayah = Number(node?.dataset?.ayah);
  if (!Number.isFinite(ayah) || ayah < 1) return;
  surahState.progress = Math.round((ayah / SITE.ayahCount) * 100);
  setTrackedAyah(ayah);
}

export function updateHero(meta) {
  const startLabel = $("[data-start-label]");
  if (startLabel) {
    const last = surahState.lastAyah;
    startLabel.textContent = last > 1 ? `ادامه از آیهٔ ${fa(last)}` : "شروع تلاوت";
  }
  const heroText = $("#heroProgressText");
  if (heroText) heroText.textContent = `${fa(surahState.progress)}٪`;
  const heroBar = $("#heroProgressBar");
  if (heroBar) heroBar.style.inlineSize = `${surahState.progress}%`;
  const name = $(".hero__title");
  if (name && meta?.nameFa) name.textContent = `سورهٔ ${meta.nameFa}`;
}

export function setSessionReads(count) {
  surahState.sessionReads = count;
  const node = $("#sessionMakrs");
  if (node) node.textContent = fa(count);
}

export function renderError(host, error) {
  host.innerHTML = "";
  host.append(
    el(
      "div",
      { class: "emptyresult" },
      icon("book"),
      el("b", {}, "متن سوره بارگذاری نشد"),
      el("span", {}, `فایل data/surah56.json باید کنار index.html باشد. (${error})`)
    )
  );
}




export function setPartnerAyah(ayah, meta = null) {
  const prev = surahState.partnerAyah;
  if (prev != null) {
    surahState.nodes.get(prev)?.classList.remove("is-partner");
    surahState.faNodes.get(prev)?.classList.remove("is-partner");
  }
  if (ayah == null || ayah === false) {
    surahState.partnerAyah = null;
    surahState.partnerMeta = null;
    return;
  }
  const num = Number(ayah);
  if (!Number.isFinite(num) || num < 1) {
    surahState.partnerAyah = null;
    surahState.partnerMeta = null;
    return;
  }
  surahState.partnerAyah = num;
  surahState.partnerMeta = meta;
  surahState.nodes.get(num)?.classList.add("is-partner");
  surahState.faNodes.get(num)?.classList.add("is-partner");
}

export function attachSurahScroll() {
  let ticking = false;
  const run = () => {
    ticking = false;
    updateProgress();
    const progress = surahState.progress;
    const surahVisible = !$("#view-surah")?.hidden;
    const bar = $("#topProgress");
    if (bar && surahVisible) bar.style.inlineSize = `${progress}%`;
    const heroBar = $("#heroProgressBar");
    if (heroBar) heroBar.style.inlineSize = `${progress}%`;
    const heroText = $("#heroProgressText");
    if (heroText) heroText.textContent = `${fa(progress)}٪`;
    const dock = $("#dock");
    if (dock) dock.classList.toggle("is-visible", window.scrollY > 420);
    const completion = $("#completion");
    if (completion && progress >= 96) completion.hidden = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(run);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", debounce(onScroll, 250));
  run();
}
