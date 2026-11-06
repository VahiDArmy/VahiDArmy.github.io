/**
 * app.js — راه‌انداز و کنترلر رابط
 */
import {
  $,
  $$,
  el,
  icon,
  fa,
  shamsi,
  relativeFromNow,
  toast,
  store,
  applyTheme,
  applyFont,
  stepFont,
  FONT_STEPS,
  clamp,
  parseFa,
  debounce,
  prefersReducedMotion,
} from "./core.js";
import { SITE } from "./config.js";
import {
  initAuth,
  onAuthChange,
  state as db,
  signIn,
  signUp,
  signOut,
  updateProfile,
  getCounters,
  getHistory,
  recordRead,
  currentUserName,
  refreshProfile,
  startPresence,
  stopPresence,
  publishReading,
} from "./db.js";
import {
  loadSurah,
  renderAyahs,
  renderError,
  applySearch,
  focusAyah,
  updateProgress,
  updateHero,
  attachSurahScroll,
  surahState,
  setSessionReads,
  initAyahTools,
  setShowTranslation,
  setPartnerAyah,
} from "./surah.js";
import { loadTafsirFiles, parseTafsirDocs, readLocalFiles, pageHtml } from "./tafsir.js";

/* ---------- وضعیت ---------- */
const tafsirState = {
  pages: [],
  sections: [],
  page: 0,
  source: "none",
  loaded: false,
  loading: false,
  pendingPage: null,
  pendingAyah: null,
};
const countersState = { rows: [], loaded: false };
const historyState = { rows: [], filter: "all", loaded: false };
let authMode = "signin";
let sessionReads = 0;

/* ---------- حضور هم‌خوان ---------- */
let partnerState = { online: false, ayah: null, name: null, slot: null };

function updatePartnerPill() {
  const pill = $("#partnerPill");
  const label = $("#partnerPillText");
  if (!pill) return;
  if (!partnerState.online || !partnerState.ayah) {
    pill.hidden = true;
    pill.classList.remove("is-on");
    setPartnerAyah(null);
    return;
  }
  pill.hidden = false;
  pill.classList.add("is-on");
  const name = partnerState.name || "همراه";
  if (label) label.textContent = `${name} · آیهٔ ${fa(partnerState.ayah)}`;
  setPartnerAyah(partnerState.ayah, partnerState);
}

function onPartnerPresence(info) {
  if (!info?.online) {
    partnerState = { online: false, ayah: null, name: null, slot: null };
    updatePartnerPill();
    return;
  }
  partnerState = {
    online: true,
    ayah: Number(info.ayah) || 1,
    name: info.name || "همراه",
    slot: info.slot ?? null,
  };
  updatePartnerPill();
}

async function syncPresence() {
  if (db.user && db.slot) {
    await startPresence(onPartnerPresence);
    if (surahState.lastAyah) publishReading(surahState.lastAyah);
  } else {
    await stopPresence();
    onPartnerPresence({ online: false });
  }
}



/* ---------- ابزار ---------- */
const isTyping = () => {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;
};

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

/* ---------- تم ---------- */
function initTheme() {
  const saved = store.get("theme", null);
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "rose");
  applyTheme(preferred);
  applyFont(store.get("font", "md"));

  $("#themeBtn")?.addEventListener("click", async () => {
    const next = document.documentElement.dataset.theme === "rose" ? "night" : "rose";
    applyTheme(next);
    toast(next === "rose" ? "پوستهٔ رُز روشن شد." : "پوستهٔ شبانه روشن شد.", "ok");
    if (db.user) await updateProfile({ theme: next });
  });

  const setFont = async (direction) => {
    const value = stepFont(direction);
    if (db.user) await updateProfile({ font_step: value });
  };
  $("#dockFontUp")?.addEventListener("click", () => setFont(1));
  $("#dockFontDown")?.addEventListener("click", () => setFont(-1));
  $$("[data-font-step]").forEach((btn) =>
    btn.addEventListener("click", () => setFont(Number(btn.dataset.fontStep)))
  );
  $("#fontValue").textContent = { sm: "کوچک", md: "متوسط", lg: "بزرگ", xl: "خیلی بزرگ" }[document.documentElement.dataset.font] || "متوسط";
}

/* ---------- پس‌زمینه ---------- */
function seedHearts() {
  const host = $("#hearts");
  if (!host || prefersReducedMotion()) return;
  const count = window.innerWidth < 700 ? 8 : 14;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement("span");
    heart.style.setProperty("--h-size", `${8 + Math.random() * 16}px`);
    heart.style.setProperty("--h-dur", `${18 + Math.random() * 22}s`);
    heart.style.setProperty("--h-delay", `${Math.random() * 18}s`);
    heart.style.setProperty("--h-x", `${Math.random() * 100}%`);
    heart.style.opacity = "0";
    fragment.append(heart);
  }
  host.append(fragment);
}

/* ---------- نما ---------- */
function setView(view, { push = true } = {}) {
  const isTafsir = view === "tafsir";
  $("#view-surah").hidden = isTafsir;
  $("#view-tafsir").hidden = !isTafsir;
  $("#tabswitch").dataset.active = isTafsir ? "tafsir" : "surah";
  $("#tab-surah").classList.toggle("is-active", !isTafsir);
  $("#tab-tafsir").classList.toggle("is-active", isTafsir);
  $("#tab-surah").setAttribute("aria-selected", String(!isTafsir));
  $("#tab-tafsir").setAttribute("aria-selected", String(isTafsir));
  $("#topProgress").style.inlineSize = isTafsir && tafsirState.pages.length
    ? `${Math.round(((tafsirState.page + 1) / tafsirState.pages.length) * 100)}%`
    : `${surahState.progress}%`;

  if (push && !location.hash.startsWith(`#${view}`)) {
    history.replaceState(null, "", isTafsir ? `#tafsir/p${tafsirState.page + 1}` : `#surah/${surahState.active}`);
  }
  if (isTafsir) ensureTafsir();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/* ---------- شمارنده‌ها ---------- */
async function refreshCounters() {
  const rows = await getCounters();
  countersState.rows = rows;
  countersState.loaded = true;
  for (const row of rows) {
    const chip = document.querySelector(`.counter[data-slot="${row.slot}"]`);
    if (!chip) continue;
    chip.querySelector("[data-num]").textContent = fa(row.total);
    chip.querySelector("[data-name]").textContent = currentUserName(row.slot);
    const orb = chip.querySelector(".counter__orb");
    orb?.classList.toggle("is-full", Number(row.total) > 0);
    chip.classList.toggle("is-me", db.slot === row.slot);
    chip.title = row.last_at
      ? `${currentUserName(row.slot)} · آخرین تلاوت ${shamsi(row.last_at).full}`
      : `${currentUserName(row.slot)} · هنوز تلاوتی ثبت نشده`;
  }
}

function bumpCounter(slot) {
  const chip = document.querySelector(`.counter[data-slot="${slot}"]`);
  if (!chip) return;
  chip.classList.remove("is-bump");
  void chip.offsetWidth;
  chip.classList.add("is-bump");
  const num = chip.querySelector("[data-num]");
  const current = Number(parseFa(num.textContent)) || 0;
  num.textContent = fa(current + 1);
  chip.querySelector(".counter__orb")?.classList.add("is-full");
  setTimeout(() => chip.classList.remove("is-bump"), 1000);
}

/* ---------- تاریخچه ---------- */
async function openHistory(filter = "all") {
  historyState.filter = filter;
  $$("#historyTabs [data-pslot]").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.pslot === filter));
  const list = $("#historyList");
  list.innerHTML = `<div class="history__empty">${icon("calendar").outerHTML}<span>در حال خواندن تاریخچه…</span></div>`;
  openDialog("historyModal");
  historyState.rows = await getHistory(120);
  historyState.loaded = true;
  renderHistory();
}

function renderHistory() {
  const list = $("#historyList");
  const rows = historyState.rows.filter((row) => historyState.filter === "all" || Number(row.slot) === Number(historyState.filter));
  if (!rows.length) {
    list.innerHTML = "";
    const empty = el(
      "div",
      { class: "history__empty" },
      icon("heart"),
      el("b", {}, "هنوز تلاوتی ثبت نشده"),
      el("span", {}, "بعد از خواندن کامل سوره، دکمهٔ «ثبت تلاوت کامل» را بزن.")
    );
    list.append(empty);
    return;
  }

  const groups = new Map();
  for (const row of rows) {
    const stamp = shamsi(row.read_at);
    if (!groups.has(stamp.dayKey)) groups.set(stamp.dayKey, { stamp, rows: [] });
    groups.get(stamp.dayKey).rows.push({ ...row, stamp });
  }

  list.innerHTML = "";
  for (const group of groups.values()) {
    const dayBox = el("div", { class: "history__day" });
    dayBox.append(
      el(
        "div",
        { class: "history__dayhead" },
        el("b", {}, `${group.stamp.weekday} ${group.stamp.day}`),
        el("span", {}, `${fa(group.rows.length)} تلاوت`)
      )
    );
    for (const row of group.rows) {
      dayBox.append(
        el(
          "div",
          { class: "history__row", dataset: { slot: row.slot } },
          el("span", { class: "history__dot", "aria-hidden": "true" }),
          el("span", { class: "history__who" }, currentUserName(Number(row.slot))),
          el("span", { class: "history__time" }, `${row.stamp.time} · ${relativeFromNow(row.read_at)}`)
        )
      );
    }
    list.append(dayBox);
  }
}

/* ---------- ورود ---------- */
function setAuthMode(mode) {
  authMode = mode;
  $$("#authTabs [data-authtab]").forEach((tab) => {
    const active = tab.dataset.authtab === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $("[data-submit-label]").textContent = mode === "signin" ? "ورود" : "ساخت حساب";
  $("#authPassword").setAttribute("autocomplete", mode === "signin" ? "current-password" : "new-password");
  $("#authFine").textContent =
    mode === "signin" ? "با ورود، شمارندهٔ تو مشخص می‌شود." : "با ساخت حساب، یکی از دو جایگاه این سایت مال تو می‌شود.";
  showAuthMessage("");
}

function showAuthMessage(message, kind = "error") {
  const box = $("#authMsg");
  if (!box) return;
  box.hidden = !message;
  box.textContent = message;
  box.classList.toggle("is-ok", kind === "ok");
}

function renderAuthState() {
  const signinBox = $("#authState");
  const formBox = $("#authForm");
  const tabs = $("#authTabs");
  const signedIn = Boolean(db.user);

  signinBox.hidden = !signedIn;
  formBox.hidden = signedIn;
  tabs.hidden = signedIn;

  const chip = $("#authBtn");
  const label = chip?.querySelector("[data-authlabel]");
  const avatar = chip?.querySelector("[data-avatar]");

  if (signedIn) {
    const name = db.profile?.display_name || db.user.email?.split("@")[0] || "من";
    if (label) label.textContent = name;
    if (avatar) avatar.textContent = name.trim().charAt(0);
    chip?.classList.add("is-in");
    $("#authTitle").textContent = "حساب من";
    $("#authStateName").textContent = name;
    $("#authStateEmail").textContent = db.user.email || "";
    $("#authStateAvatar").textContent = name.trim().charAt(0);
    $("#authStateSlot").textContent = db.slot ? `نفر ${db.slot === 1 ? "اول" : "دوم"}` : "بدون جایگاه";
    $("#profileName").value = db.profile?.display_name || "";
    const note = $("#authNote");
    if (!db.slot) {
      note.hidden = false;
      note.textContent = "هر دو جایگاه این سایت پر شده است؛ می‌توانی بخوانی، ولی برای ثبت تلاوت باید یکی از دو حساب اصلی باشی.";
    } else {
      note.hidden = true;
    }
  } else {
    if (label) label.textContent = "ورود";
    if (avatar) avatar.innerHTML = icon("user").outerHTML;
    chip?.classList.remove("is-in");
    $("#authTitle").textContent = "ورود به حساب";
    $("#authNote").hidden = true;
    if (db.needsSetup) {
      $("#authNote").hidden = false;
      $("#authNote").textContent =
        "جداول اختصاصی این سایت در Supabase ساخته نشده‌اند. فایل db/schema.sql را در SQL Editor اجرا کن.";
    }
  }

  const hint = $("#markReadHint");
  if (hint) {
    hint.textContent = signedIn
      ? `ثبت برای ${db.slot ? `نفر ${db.slot === 1 ? "اول" : "دوم"}` : "این حساب"}`
      : "برای ثبت، باید وارد شوی.";
  }
  $("#markReadBtn").disabled = !signedIn || !db.slot;
  refreshCounters();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (!email || !password) {
    showAuthMessage("ایمیل و گذرواژه را پر کن.");
    return;
  }
  const button = $("#authSubmit");
  button.disabled = true;
  showAuthMessage("");
  const result = authMode === "signin" ? await signIn(email, password) : await signUp(email, password);
  button.disabled = false;

  if (!result.ok) {
    showAuthMessage(result.error || "نشد؛ دوباره تلاش کن.");
    return;
  }
  $("#authForm").reset();
  if (result.message) {
    showAuthMessage(result.message, "ok");
    return;
  }
  if (result.signedIn === false) return;
  toast("خوش آمدی 🌸", "ok");
  closeDialog($("#authModal"));
}

/* ---------- تفسیر ---------- */
function setupTafsir(data) {
  tafsirState.pages = data.pages;
  tafsirState.sections = data.sections;
  tafsirState.loaded = true;
  $("#tafsirShell").hidden = false;
  $("#tafsirEmpty").hidden = true;
  renderToc();

  const start = tafsirState.pendingPage != null ? tafsirState.pendingPage : 0;
  tafsirState.pendingPage = null;
  renderTafsirPage(clamp(start, 0, data.pages.length - 1), { push: false });

  if (tafsirState.pendingAyah != null) {
    const ayah = tafsirState.pendingAyah;
    tafsirState.pendingAyah = null;
    jumpToAyahPage(ayah);
  }
}

function makeTocItem(section, { closeModal = false } = {}) {
  const isDoc = section.kind === "doc";
  return el(
    "button",
    {
      class: `toc__item${isDoc ? "" : " toc__item--sub"}`,
      type: "button",
      dataset: { page: section.page },
      onclick: () => {
        gotoPage(section.page);
        if (closeModal) closeDialog($("#tocModal"));
      },
    },
    el("span", {}, isDoc ? shortDocTitle(section.title) : section.title),
    el("small", {}, `ص ${fa(section.page + 1)}`)
  );
}

function renderToc() {
  const list = $("#tocList");
  const meta = $("#tocMeta");
  const modalList = $("#tocModalList");
  const modalMeta = $("#tocModalMeta");
  if (list) list.innerHTML = "";
  if (modalList) modalList.innerHTML = "";
  const label = `${fa(tafsirState.pages.length)} صفحه`;
  if (meta) meta.textContent = label;
  if (modalMeta) modalMeta.textContent = label;

  let lastDoc = null;
  for (const section of tafsirState.sections) {
    if (section.kind === "doc") {
      if (lastDoc === section.title) continue;
      lastDoc = section.title;
    }
    list?.append(makeTocItem(section));
    modalList?.append(makeTocItem(section, { closeModal: true }));
  }
}

function shortDocTitle(title) {
  const match = String(title).match(/آيات?\s*([٠-٩۰-۹0-9]+)\s*(?:تا|–|-)\s*([٠-٩۰-۹0-9]+)/);
  if (match) return `آیات ${fa(match[1])} تا ${fa(match[2])}`;
  return title;
}

function renderTafsirPage(index, { push = true } = {}) {
  if (!tafsirState.loaded) return;
  const page = tafsirState.pages[clamp(index, 0, tafsirState.pages.length - 1)];
  if (!page) return;
  tafsirState.page = page.index;

  const body = $("#tafsirBody");
  body.innerHTML = page.html;
  body.scrollTop = 0;

  $("#readerTitle").textContent = page.section || page.docTitle || "تفسیر";
  $("#readerCrumb").textContent = shortDocTitle(page.docTitle || "تفسیر المیزان");
  $("#readerRange").textContent = page.from ? `آیهٔ ${fa(page.from)}${page.to && page.to !== page.from ? ` تا ${fa(page.to)}` : ""}` : "بیان کلی";
  $("#readerPageInfo").textContent = `صفحهٔ ${fa(page.index + 1)} از ${fa(tafsirState.pages.length)}`;
  $("#readerBar").style.inlineSize = `${Math.round(((page.index + 1) / tafsirState.pages.length) * 100)}%`;
  $("#topProgress").style.inlineSize = `${Math.round(((page.index + 1) / tafsirState.pages.length) * 100)}%`;

  $$("#tocList .toc__item, #tocModalList .toc__item").forEach((item) =>
    item.classList.toggle("is-current", Number(item.dataset.page) === page.index)
  );
  $$("#tocList .toc__item.is-current")[0]?.scrollIntoView({ block: "nearest", inline: "nearest" });

  renderPager(page.index);
  if (push) history.replaceState(null, "", `#tafsir/p${page.index + 1}`);
  if (window.innerWidth < 1080) $("#readerTitle")?.scrollIntoView({ block: "nearest" });
}

function renderPager(index) {
  const pager = $("#tafsirPager");
  const total = tafsirState.pages.length;
  pager.innerHTML = "";

  const prevBtn = el(
    "button",
    {
      class: "pager__btn",
      type: "button",
      disabled: index <= 0,
      onclick: () => gotoPage(index - 1),
      "aria-label": "صفحهٔ قبل",
    },
    icon("chevron"),
    el("span", {}, "قبلی")
  );
  prevBtn.querySelector("svg").style.transform = "rotate(180deg)";

  const nextBtn = el(
    "button",
    {
      class: "pager__btn",
      type: "button",
      disabled: index >= total - 1,
      onclick: () => gotoPage(index + 1),
      "aria-label": "صفحهٔ بعد",
    },
    el("span", {}, "بعدی"),
    icon("chevron")
  );

  const pages = el("div", { class: "pager__pages" });
  const numbers = pageWindow(index, total);
  for (const item of numbers) {
    if (item === "…") {
      pages.append(el("span", { class: "pager__num pager__num--dots" }, "…"));
      continue;
    }
    pages.append(
      el(
        "button",
        {
          class: `pager__num${item === index ? " is-current" : ""}`,
          type: "button",
          "aria-current": item === index ? "page" : null,
          "aria-label": `صفحهٔ ${fa(item + 1)}`,
          onclick: () => gotoPage(item),
        },
        fa(item + 1)
      )
    );
  }

  const jump = el(
    "label",
    { class: "pager__jump" },
    el("span", {}, "برو به"),
    (() => {
      const input = el("input", {
        type: "text",
        inputmode: "numeric",
        value: fa(index + 1),
        "aria-label": "شمارهٔ صفحه",
        onkeydown: (event) => {
          if (event.key !== "Enter") return;
          const target = Number(parseFa(event.currentTarget.value)) - 1;
          if (Number.isFinite(target)) gotoPage(target);
        },
        onblur: (event) => {
          const target = Number(parseFa(event.currentTarget.value)) - 1;
          if (Number.isFinite(target)) gotoPage(target);
        },
      });
      return input;
    })()
  );

  pager.append(prevBtn, pages, jump, nextBtn);
}

function pageWindow(index, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const items = new Set([0, total - 1, index]);
  for (let offset = 1; offset <= 1; offset += 1) {
    items.add(index - offset);
    items.add(index + offset);
  }
  const sorted = [...items].filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((value, i) => {
    if (i > 0 && value - sorted[i - 1] > 1) out.push("…");
    out.push(value);
  });
  return out;
}

function gotoPage(index) {
  if (!tafsirState.loaded) return;
  const target = clamp(index, 0, tafsirState.pages.length - 1);
  renderTafsirPage(target);
  $("#view-tafsir").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

async function ensureTafsir() {
  if (tafsirState.loaded || tafsirState.loading) return;
  tafsirState.loading = true;
  $("#tafsirShell").hidden = true;
  $("#tafsirEmpty").hidden = true;
  const body = $("#tafsirBody");
  body.innerHTML = "<p>در حال خواندن فایل‌های تفسیر…</p>";
  $("#tafsirShell").hidden = false;

  const result = await loadTafsirFiles();
  tafsirState.loading = false;
  if (!result.ok) {
    $("#tafsirShell").hidden = true;
    $("#tafsirEmpty").hidden = false;
    const code = $(".setupcard__code");
    if (result.reason === "file-protocol") {
      $(".setupcard p").innerHTML =
        "مرورگر اجازهٔ خواندن فایل‌های محلی را نمی‌دهد. برای پیش‌نمایش، پوشه را با یک سرور ساده باز کن یا فایل‌ها را از همین صفحه انتخاب کن.";
    } else if (code) {
      code.querySelector("code").textContent = (result.missing?.length ? result.missing : SITE.tafsir.defaults)
        .map((name) => `data/tafsir/${name}`)
        .join("\n");
    }
    return;
  }

  setupTafsir(parseTafsirDocs(result.docs));
  if (result.missing?.length) {
    toast(`این فایل‌ها پیدا نشد: ${result.missing.join("، ")}`, "warn", 5000);
  }
}

async function handleLocalTafsir(files) {
  if (!files?.length) return;
  const hint = $("#tafsirLocalHint");
  const { docs, failed } = await readLocalFiles(files);
  if (!docs.length) {
    toast("هیچ فایل معتبری خوانده نشد.", "warn");
    return;
  }
  if (hint) hint.hidden = false;
  setupTafsir(parseTafsirDocs(docs));
  toast(`${fa(docs.length)} سند تفسیر خوانده شد (فقط در همین مرورگر).`, "ok", 4500);
  if (failed.length) toast(`نخوانده: ${failed.join("، ")}`, "warn", 5000);
}

function openTafsirForAyah(ayah) {
  tafsirState.pendingAyah = Number(ayah);
  setView("tafsir");
  if (tafsirState.loaded) {
    const target = tafsirState.pendingAyah;
    tafsirState.pendingAyah = null;
    jumpToAyahPage(target);
  }
}

function jumpToAyahPage(ayah) {
  if (!tafsirState.loaded) return;
  const pageIndex = findPageForAyah(Number(ayah));
  if (pageIndex == null) {
    toast("برای این آیه تفسیر جداگانه‌ای پیدا نشد.", "warn");
    return;
  }
  renderTafsirPage(pageIndex);
  highlightAyahInReader(Number(ayah));
}

function findPageForAyah(ayah) {
  const direct = tafsirState.pages.findIndex((page) => page.ayahs.includes(ayah));
  if (direct >= 0) return direct;
  const before = tafsirState.pages.findIndex((page) => page.to != null && page.to >= ayah);
  return before >= 0 ? before : null;
}

function highlightAyahInReader(ayah) {
  requestAnimationFrame(() => {
    const rows = $$("#tafsirBody .ayahgrid__row");
    const row = rows.find((item) => Number(parseFa(item.querySelector(".ayahgrid__n")?.textContent || "")) === ayah);
    row?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    if (row) {
      row.style.transition = "background .3s";
      row.style.background = "color-mix(in oklab, var(--accent) 12%, transparent)";
      row.style.borderRadius = "10px";
      setTimeout(() => {
        row.style.background = "transparent";
      }, 2400);
    }
  });
}

/* ---------- پرش به آیه ---------- */
function buildJumpGrid() {
  const grid = $("#jumpGrid");
  if (!grid || grid.childElementCount) return;
  for (let i = 1; i <= SITE.ayahCount; i += 1) {
    grid.append(
      el(
        "button",
        {
          type: "button",
          onclick: () => {
            closeDialog($("#jumpModal"));
            setView("surah");
            setTimeout(() => focusAyah(i), 160);
          },
        },
        fa(i)
      )
    );
  }
}

/* ---------- ثبت تلاوت ---------- */
async function handleMarkRead() {
  if (!db.user) {
    openDialog("authModal");
    showAuthMessage("برای ثبت تلاوت، اول وارد شو.");
    return;
  }
  if (!db.slot) {
    toast("برای این حساب جایگاهی باقی نمانده.", "warn");
    return;
  }
  const button = $("#markReadBtn");
  button.disabled = true;
  const result = await recordRead(SITE.ayahCount);
  button.disabled = false;
  if (!result.ok) {
    toast(result.error || "ثبت نشد.", "warn");
    return;
  }
  sessionReads += 1;
  setSessionReads(sessionReads);
  bumpCounter(result.slot);
  toast(`تلاوتت ثبت شد ❤ (${fa(result.total ?? "")} بار)`, "ok");
  historyState.loaded = false;
  if ($("#historyModal").open) openHistory(historyState.filter);
}

/* ---------- مسیر ---------- */
function parseHash() {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return;
  if (hash.startsWith("tafsir")) {
    const match = hash.match(/^tafsir(?:[/-]p?(\d+))?/);
    if (match?.[1]) tafsirState.pendingPage = Number(match[1]) - 1;
    setView("tafsir");
    if (match?.[1] && tafsirState.loaded) {
      tafsirState.pendingPage = null;
      renderTafsirPage(Number(match[1]) - 1, { push: false });
    }
    return;
  }
  if (hash.startsWith("surah")) {
    const match = hash.match(/^surah(?:[/-](\d+))?/);
    setView("surah");
    if (match?.[1]) setTimeout(() => focusAyah(Number(match[1])), 120);
    return;
  }
  if (hash.startsWith("history")) openHistory("all");
}

/* ---------- رویدادها ---------- */
function wireEvents() {
  $$("#tabswitch .tabswitch__btn").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#openTafsir")?.addEventListener("click", () => setView("tafsir"));
  $("#openHistory")?.addEventListener("click", () => openHistory("all"));
  $("#startReading")?.addEventListener("click", () => {
    setView("surah");
    setTimeout(() => focusAyah(surahState.lastAyah > 1 ? surahState.lastAyah : 1), 120);
  });

  const search = $("#ayahSearch");
  search?.addEventListener("input", (event) => applySearch(event.target.value));
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      search.value = "";
      applySearch("");
    }
  });

  $("#jumpBtn")?.addEventListener("click", () => {
    buildJumpGrid();
    openDialog("jumpModal");
  });

  $("#toggleTranslation")?.addEventListener("click", () => {
    setShowTranslation(!surahState.showTranslation);
  });

  $("#heroToggle")?.addEventListener("click", () => {
    const extra = $("#heroExtra");
    const btn = $("#heroToggle");
    if (!extra || !btn) return;
    const open = extra.hasAttribute("hidden");
    if (open) extra.removeAttribute("hidden");
    else extra.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", String(open));
    const more = btn.querySelector("[data-hero-more]");
    const less = btn.querySelector("[data-hero-less]");
    if (more) more.hidden = open;
    if (less) less.hidden = !open;
  });

  $("#openTocBtn")?.addEventListener("click", () => {
    if (!tafsirState.loaded) {
      toast("اول فایل‌های تفسیر را بارگذاری کن.", "warn");
      return;
    }
    openDialog("tocModal");
  });

  $("#markReadBtn")?.addEventListener("click", handleMarkRead);
  $("#tafsirFiles")?.addEventListener("change", (event) => handleLocalTafsir(event.target.files));

  $("#authBtn")?.addEventListener("click", () => openDialog("authModal"));
  $("#authTabs")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-authtab]");
    if (tab) setAuthMode(tab.dataset.authtab);
  });
  $("#authForm")?.addEventListener("submit", handleAuthSubmit);
  $("#signOutBtn")?.addEventListener("click", async () => {
    await signOut();
    closeDialog($("#authModal"));
    toast("از حساب خارج شدی.");
  });
  $("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#profileName").value.trim();
    if (!name) return;
    const result = await updateProfile({ display_name: name });
    if (result.ok) {
      toast("نام ذخیره شد.", "ok");
      renderAuthState();
      refreshCounters();
    } else {
      toast("ذخیره نشد: " + result.error, "warn");
    }
  });

  $$(".modal").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
  $$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeDialog(btn.closest(".modal")))
  );

  $$(".counter").forEach((chip) =>
    chip.addEventListener("click", () => {
      if (chip.classList.contains("is-bump")) return;
      openHistory(chip.dataset.slot);
    })
  );
  $("#historyTabs")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-pslot]");
    if (!tab) return;
    historyState.filter = tab.dataset.pslot;
    $$("#historyTabs [data-pslot]").forEach((item) => item.classList.toggle("is-active", item === tab));
    renderHistory();
  });

  $("#dockTop")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }));

  // دوبار زدن روی نام سایت → تاریخچه
  const brand = $("#brand");
  let lastTap = 0;
  let tapTimer = null;
  const openHistoryFromBrand = () => {
    openHistory("all");
    const seal = brand.querySelector(".brand__seal");
    seal?.animate?.(
      [{ transform: "scale(1)" }, { transform: "scale(1.25) rotate(-8deg)" }, { transform: "scale(1)" }],
      { duration: 520, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
  };
  brand?.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    const now = Date.now();
    if (now - lastTap < 380) {
      clearTimeout(tapTimer);
      lastTap = 0;
      openHistoryFromBrand();
    } else {
      lastTap = now;
      tapTimer = setTimeout(() => {
        lastTap = 0;
      }, 400);
    }
  });
  brand?.addEventListener("dblclick", openHistoryFromBrand);

  window.addEventListener("hashchange", parseHash);

  document.addEventListener("keydown", (event) => {
    if (isTyping()) return;
    if (event.key === "ArrowLeft") {
      if (!$("#view-tafsir").hidden) gotoPage(tafsirState.page + 1);
    } else if (event.key === "ArrowRight") {
      if (!$("#view-tafsir").hidden) gotoPage(tafsirState.page - 1);
    } else if (event.key.toLowerCase() === "s") {
      setView("surah");
    } else if (event.key.toLowerCase() === "t") {
      setView("tafsir");
    } else if (event.key === "Escape") {
      $$(".modal[open]").forEach((dialog) => closeDialog(dialog));
    }
  });

  onAuthChange(() => {
    renderAuthState();
    if (db.profile?.theme) applyTheme(db.profile.theme, { persist: true });
    if (db.profile?.font_step && FONT_STEPS.includes(db.profile.font_step)) applyFont(db.profile.font_step);
    syncPresence();
  });

  $("#partnerPill")?.addEventListener("click", () => {
    if (partnerState.ayah) {
      setView("surah");
      focusAyah(partnerState.ayah);
    }
  });
}

/* ---------- راه‌اندازی ---------- */
async function boot() {
  seedHearts();
  initTheme();

  const surah = await loadSurah();
  if (!surah.ok) {
    renderError($("#ayahs"), surah.error);
  } else {
    renderAyahs($("#ayahs"));
    surahState.hooks.onTafsir = openTafsirForAyah;
    surahState.hooks.onProgress = (_progress, ayah) => {
      updateHero({ nameFa: SITE.surahNameFa });
      if (ayah) publishReading(ayah);
    };
    updateHero(surah.meta);
    const heroProgress = Math.round(((surahState.lastAyah || 1) / SITE.ayahCount) * 100);
    surahState.progress = heroProgress;
    updateProgress();
    attachSurahScroll();
  }

  $("#completion").hidden = true;
  wireEvents();
  initAyahTools();
  buildJumpGrid();
  setSessionReads(0);

  await initAuth();
  renderAuthState();

  const lastTheme = store.get("theme", null);
  if (!lastTheme) applyTheme(document.documentElement.dataset.theme);

  parseHash();
  if (!location.hash) setView("surah", { push: false });

  // اگر حساب داریم و نام دارد، شمارنده‌ها را با نام واقعی نشان بده
  await refreshCounters();
  if (db.user && !db.profile) await refreshProfile();
  await syncPresence();

  const completionWatcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) $("#completion").hidden = false;
      }
    },
    { rootMargin: "0px 0px -20% 0px" }
  );
  completionWatcher.observe($("#completion"));

  document.documentElement.classList.add("is-ready");
}

boot().catch((error) => {
  console.error("[vaqia] boot failed", error);
  toast("بارگذاری سایت کامل نشد؛ کنسول را نگاه کن.", "warn", 6000);
});
