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
  marks: new Set(store.get("marks", [])),
  lastAyah: Number(store.get("lastAyah", 1)) || 1,
  progress: 0,
  query: "",
  active: 1,
  sessionReads: 0,
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

/* ---------- کارت آیه ---------- */
function ayahCard(item) {
  const isMarked = surahState.marks.has(item.ayah);
  const card = el("article", {
    class: "ayah",
    id: `ayah-${item.ayah}`,
    dataset: { ayah: item.ayah },
  });

  card.append(
    el("div", { class: "ayah__num", "aria-hidden": "true" }, fa(item.ayah)),
    el(
      "div",
      { class: "ayah__content" },
      el("p", { class: "ayah__ar", lang: "ar", dir: "rtl" }, item.ar),
      el("p", { class: "ayah__fa", lang: "fa" }, item.fa),
      el(
        "div",
        { class: "ayah__tools" },
        el(
          "button",
          {
            class: "toolbtn",
            type: "button",
            "aria-label": `رونوشت آیهٔ ${fa(item.ayah)}`,
            onclick: async () => {
              const ok = await copyText(`﴿${item.ar}﴾\n${item.fa}\n(واقعه، آیهٔ ${fa(item.ayah)})`);
              toast(ok ? "آیه رونوشت شد." : "رونوشت نشد.", ok ? "ok" : "warn");
            },
          },
          icon("copy"),
          el("span", {}, "رونوشت")
        ),
        el(
          "button",
          {
            class: `toolbtn markbtn${isMarked ? " is-on" : ""}`,
            type: "button",
            "aria-pressed": String(isMarked),
            onclick: (event) => toggleMark(item.ayah, event.currentTarget),
          },
          icon("heart"),
          el("span", {}, isMarked ? "نشان‌شده" : "نشان")
        ),
        el(
          "button",
          {
            class: "toolbtn",
            type: "button",
            onclick: () => surahState.hooks.onTafsir?.(item.ayah),
          },
          icon("scroll"),
          el("span", {}, "تفسیر این آیه")
        )
      )
    )
  );

  return card;
}

function toggleMark(ayah, button) {
  const marks = surahState.marks;
  if (marks.has(ayah)) {
    marks.delete(ayah);
    button.classList.remove("is-on");
    button.setAttribute("aria-pressed", "false");
    button.querySelector("span").textContent = "نشان";
    toast("نشان برداشته شد.");
  } else {
    marks.add(ayah);
    button.classList.add("is-on");
    button.setAttribute("aria-pressed", "true");
    button.querySelector("span").textContent = "نشان‌شده";
    toast(`آیهٔ ${fa(ayah)} نشان شد.`, "ok");
  }
  store.set("marks", [...marks]);
}

export function renderAyahs(host) {
  host.innerHTML = "";
  const fragment = document.createDocumentFragment();
  surahState.nodes.clear();
  for (const item of surahState.ayahs) {
    const card = ayahCard(item);
    surahState.nodes.set(item.ayah, card);
    fragment.append(card);
  }
  host.append(fragment);
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
    const card = surahState.nodes.get(item.ayah);
    if (!card) continue;
    const match =
      !hasQuery ||
      normalizeAr(item.ar).includes(needleAr) ||
      normalizeFa(item.fa).includes(needleFa) ||
      String(item.ayah) === query.trim();
    card.hidden = !match;
    card.classList.toggle("is-hit", hasQuery && match);
    if (match) hits += 1;

    const arNode = card.querySelector(".ayah__ar");
    const faNode = card.querySelector(".ayah__fa");
    if (arNode) arNode.innerHTML = hasQuery ? highlight(item.ar, query, true) : escapeHtml(item.ar);
    if (faNode) faNode.innerHTML = hasQuery ? highlight(item.fa, query, false) : escapeHtml(item.fa);
  }

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
  const card = surahState.nodes.get(Number(ayah));
  if (!card) return;
  card.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto", block: "start" });
  card.classList.add("is-active");
  setTimeout(() => card.classList.remove("is-active"), 2200);
  setActive(Number(ayah));
}

function setActive(ayah) {
  if (surahState.active === ayah) return;
  surahState.nodes.get(surahState.active)?.classList.remove("is-active");
  surahState.active = ayah;
  surahState.lastAyah = ayah;
  store.set("lastAyah", ayah);
  surahState.hooks.onProgress?.(surahState.progress, ayah);
}

export function updateProgress() {
  const cards = [...surahState.nodes.values()];
  if (!cards.length) return;
  const viewportMid = window.innerHeight * 0.36;
  let current = cards[0];
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.top <= viewportMid) current = card;
    else break;
  }
  const ayah = Number(current.dataset.ayah);
  const progress = Math.round((ayah / SITE.ayahCount) * 100);
  surahState.progress = progress;
  setActive(ayah);
  surahState.hooks.onProgress?.(progress, ayah);
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

export function attachSurahScroll() {
  const onScroll = () => {
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
    if (completion) {
      const nearEnd = progress >= 96;
      if (nearEnd) completion.hidden = false;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", debounce(onScroll, 250));
  onScroll();
}
