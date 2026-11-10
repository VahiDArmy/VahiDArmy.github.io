import { icon } from "./icons.js";
import { navigate } from "./router.js";
import { searchTheories } from "./api.js";
import { getState, setState, setTheme } from "./store.js";
import { escapeHtml, debounce } from "./utils.js";
import { toast } from "./ui.js";

let root = null;
let input = null;
let resultsEl = null;
let backdrop = null;
let items = [];
let selected = 0;
let searchToken = 0;

function baseActions() {
  const state = getState();
  const actions = [
    { id: "home", title: "خانه", subtitle: "صفحهٔ اصلی نظریه", icon: "home", group: "رفتن به", run: () => navigate("/") },
    { id: "explore", title: "کاوش", subtitle: "جست‌وجو در نظریه‌ها", icon: "compass", group: "رفتن به", run: () => navigate("/explore") },
    { id: "new", title: "نظریهٔ تازه", subtitle: "شروع نوشتن یک نظریه", icon: "plus", group: "ساختن", auth: true, run: () => navigate("/new") },
    { id: "dashboard", title: "داشبورد", subtitle: "آمار و نظریه‌های من", icon: "dashboard", group: "رفتن به", auth: true, run: () => navigate("/dashboard") },
    { id: "settings", title: "تنظیمات", subtitle: "حساب، ظاهر و امنیت", icon: "settings", group: "رفتن به", auth: true, run: () => navigate("/settings") },
    { id: "profile", title: "پروفایل من", subtitle: "نمایش عمومی نویسنده", icon: "user", group: "رفتن به", auth: true, run: () => navigate(`/profile/${state.profile?.username || ""}`) },
    {
      id: "theme",
      title: "تغییر ظاهر",
      subtitle: state.theme === "dark" ? "رفتن به حالت روشن" : "رفتن به حالت تاریک",
      icon: state.theme === "dark" ? "sun" : "moon",
      group: "تنظیمات",
      run: () => {
        const next = state.theme === "dark" ? "light" : "dark";
        setTheme(next);
        toast({ type: "info", title: "ظاهر تغییر کرد", message: next === "dark" ? "حالت تاریک فعال شد." : "حالت روشن فعال شد.", duration: 2200 });
      },
    },
    {
      id: "copy",
      title: "کپی نشانی صفحه",
      subtitle: "پیوند صفحهٔ فعلی",
      icon: "link",
      group: "ابزار",
      run: async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          toast({ type: "success", title: "کپی شد", duration: 1800 });
        } catch {
          toast({ type: "error", title: "کپی انجام نشد", duration: 1800 });
        }
      },
    },
  ];
  return actions.filter((action) => !action.auth || state.user);
}

function renderItems() {
  if (!resultsEl) return;
  if (!items.length) {
    resultsEl.innerHTML = `<div class="command__empty">نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کنید.</div>`;
    return;
  }
  let lastGroup = "";
  resultsEl.innerHTML = items
    .map((item, index) => {
      const group = item.group || "نتیجه‌ها";
      const groupLabel = group !== lastGroup ? `<div class="command__group-label">${escapeHtml(group)}</div>` : "";
      lastGroup = group;
      return `
        ${groupLabel}
        <button class="command__item ${index === selected ? "is-selected" : ""}" type="button" data-command-index="${index}">
          <span class="command__item-icon">${icon(item.icon || "circle", 15)}</span>
          <span class="command__item-copy">
            <span class="command__item-title">${escapeHtml(item.title)}</span>
            <span class="command__item-sub">${escapeHtml(item.subtitle || "")}</span>
          </span>
          <span class="command__item-hint">${index === selected ? "Enter" : ""}</span>
        </button>
      `;
    })
    .join("");
}

function runItem(index) {
  const item = items[index];
  if (!item) return;
  close();
  setTimeout(() => item.run(), 30);
}

function select(index) {
  if (!items.length) return;
  selected = (index + items.length) % items.length;
  renderItems();
  const active = resultsEl?.querySelector(`[data-command-index="${selected}"]`);
  active?.scrollIntoView({ block: "nearest" });
}

async function doSearch(term) {
  const token = ++searchToken;
  const actions = baseActions().filter((action) => {
    if (!term) return true;
    const haystack = `${action.title} ${action.subtitle}`.toLowerCase();
    return haystack.includes(term.toLowerCase());
  });

  let theories = [];
  if (term.trim().length >= 2) {
    theories = await searchTheories(term.trim(), 6);
    if (token !== searchToken) return;
  }

  const theoryItems = theories.map((theory) => ({
    id: `theory-${theory.id}`,
    title: theory.title,
    subtitle: theory.excerpt || "نظریه",
    icon: "book-open",
    group: "نظریه‌ها",
    run: () => navigate(`/theory/${encodeURIComponent(theory.slug || theory.id)}`),
  }));

  items = [...actions, ...theoryItems];
  selected = 0;
  renderItems();
}

function open() {
  if (backdrop) return;
  setState({ commandOpen: true });
  root = document.getElementById("command-root") || document.body;
  backdrop = document.createElement("div");
  backdrop.className = "command-backdrop";
  backdrop.innerHTML = `
    <div class="command" role="dialog" aria-modal="true" aria-label="فرمان‌ها">
      <div class="command__search">
        ${icon("search", 20)}
        <input class="command__input" type="text" placeholder="جست‌وجوی نظریه یا فرمان…" autocomplete="off" spellcheck="false">
        <span class="command__esc"><kbd>Esc</kbd></span>
      </div>
      <div class="command__results"></div>
      <div class="command__footer">
        <div class="command__footer-group"><kbd>↑</kbd><kbd>↓</kbd><span>جابه‌جایی</span><kbd>Enter</kbd><span>انتخاب</span></div>
        <div class="command__footer-group"><span>نظریه</span><kbd>⌘</kbd><kbd>K</kbd></div>
      </div>
    </div>
  `;
  root.append(backdrop);
  input = backdrop.querySelector(".command__input");
  resultsEl = backdrop.querySelector(".command__results");

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  input.addEventListener("input", debounce(() => doSearch(input.value.trim()), 180));

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      select(selected + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      select(selected - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runItem(selected);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  resultsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command-index]");
    if (!button) return;
    runItem(Number(button.dataset.commandIndex));
  });

  doSearch("");
  requestAnimationFrame(() => input?.focus());
  document.body.classList.add("command-open");
}

function close() {
  backdrop?.remove();
  backdrop = null;
  input = null;
  resultsEl = null;
  items = [];
  selected = 0;
  setState({ commandOpen: false });
  document.body.classList.remove("command-open");
}

export function initCommandPalette() {
  document.addEventListener("keydown", (event) => {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (isShortcut) {
      event.preventDefault();
      if (backdrop) close();
      else open();
    }
    if (event.key === "Escape" && backdrop) close();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-command-open]")) {
      event.preventDefault();
      open();
    }
  });
  return { open, close };
}
