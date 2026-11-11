import { listTheories, getPopularTags } from "../api.js";
import { icon } from "../icons.js";
import { PAGE_SIZE, SORT_OPTIONS } from "../config.js";
import { escapeHtml, formatNumber, buildQuery } from "../utils.js";
import { theoryCard, emptyState, pageHead } from "../components.js";

function pagination(page, totalPages, query) {
  if (totalPages <= 1) return "";
  const pages = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, page + 2);
  if (from > 1) pages.push(1);
  if (from > 2) pages.push("...");
  for (let i = from; i <= to; i += 1) pages.push(i);
  if (to < totalPages - 1) pages.push("...");
  if (to < totalPages) pages.push(totalPages);

  return `
    <nav class="pagination" aria-label="صفحه‌بندی">
      <a class="pagination__btn" href="#/explore${buildQuery({ ...query, page: page - 1 })}" ${page <= 1 ? 'aria-disabled="true" tabindex="-1" style="opacity:.35;pointer-events:none"' : ""}>${icon("chevron-right", 14)}</a>
      ${pages
        .map((item) =>
          item === "..."
            ? `<span class="pagination__btn" style="border:0;background:none">…</span>`
            : `<a class="pagination__btn ${item === page ? "is-active" : ""}" href="#/explore${buildQuery({ ...query, page: item })}">${formatNumber(item)}</a>`
        )
        .join("")}
      <a class="pagination__btn" href="#/explore${buildQuery({ ...query, page: page + 1 })}" ${page >= totalPages ? 'aria-disabled="true" tabindex="-1" style="opacity:.35;pointer-events:none"' : ""}>${icon("chevron-left", 14)}</a>
    </nav>
  `;
}

export async function renderExplore(ctx) {
  const search = String(ctx.query.search || "").trim();
  const tag = String(ctx.query.tag || "").trim();
  const sort = SORT_OPTIONS.some((item) => item.value === ctx.query.sort) ? ctx.query.sort : "newest";
  const view = ctx.query.view === "list" ? "list" : "grid";
  const page = Math.max(1, Number(ctx.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let items = [];
  let count = 0;
  let tags = [];
  let errorMessage = "";

  try {
    const [result, tagResult] = await Promise.all([
      listTheories({ search, tag, sort, limit: PAGE_SIZE, offset }),
      getPopularTags(22),
    ]);
    items = result.items;
    count = result.count;
    tags = tagResult;
  } catch (error) {
    errorMessage = error.message || "دریافت نظریه‌ها انجام نشد.";
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeFilters = [];
  if (search) activeFilters.push({ label: `جست‌وجو: ${search}`, href: `#/explore${buildQuery({ tag, sort, view })}` });
  if (tag) activeFilters.push({ label: `برچسب: ${tag}`, href: `#/explore${buildQuery({ search, sort, view })}` });

  const toolbar = `
    <form class="explore-toolbar" data-explore-search>
      <div class="explore-toolbar__left">
        <div class="search-input" style="min-width:min(24rem,70vw)">
          ${icon("search", 17)}
          <input class="input" type="search" name="search" value="${escapeHtml(search)}" placeholder="جست‌وجو در عنوان، خلاصه و متن…" aria-label="جست‌وجوی نظریه">
          ${search ? `<button class="icon-btn icon-btn--sm" type="button" data-clear-search style="position:absolute;inset-inline-end:.55rem">${icon("x", 14)}</button>` : `<span class="search-input__kbd"><kbd>⌘</kbd><kbd>K</kbd></span>`}
        </div>
        <button class="btn btn--primary" type="submit">${icon("search", 15)} جست‌وجو</button>
      </div>
      <div class="explore-toolbar__right">
        <select class="select sort-select" data-sort aria-label="ترتیب نمایش">
          ${SORT_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === sort ? "selected" : ""}>${option.label}</option>`).join("")}
        </select>
        <div class="tabs" role="group" aria-label="نمایش">
          <a class="tab ${view === "grid" ? "is-active" : ""}" href="#/explore${buildQuery({ search, tag, sort, view: "grid" })}">${icon("grid", 14)} شبکه</a>
          <a class="tab ${view === "list" ? "is-active" : ""}" href="#/explore${buildQuery({ search, tag, sort, view: "list" })}">${icon("list", 14)} فهرست</a>
        </div>
      </div>
      <input type="hidden" name="tag" value="${escapeHtml(tag)}">
      <input type="hidden" name="sort" value="${escapeHtml(sort)}">
      <input type="hidden" name="view" value="${escapeHtml(view)}">
    </form>
  `;

  const filterRow = `
    <div class="filter-row">
      <span class="filter-row__label">${icon("tag", 13)} موضوع‌ها:</span>
      <a class="chip ${!tag ? "is-active" : ""}" href="#/explore${buildQuery({ search, sort, view })}">همه</a>
      ${tags
        .map(
          (item) =>
            `<a class="chip ${item.tag === tag ? "is-active" : ""}" href="#/explore${buildQuery({ search, tag: item.tag, sort, view })}">${escapeHtml(item.tag)} <span style="opacity:.55">${formatNumber(item.count)}</span></a>`
        )
        .join("")}
    </div>
  `;

  const activeHtml = activeFilters.length
    ? `<div class="active-filters">${activeFilters
        .map(
          (filter) =>
            `<a class="chip chip--rose" href="${filter.href}">${escapeHtml(filter.label)} ${icon("x", 11)}</a>`
        )
        .join("")}<a class="chip" href="#/explore">پاک‌کردن همه</a></div>`
    : "";

  const resultsHead = `
    <div class="explore-results-head">
      <span><strong>${formatNumber(count)}</strong> نظریه پیدا شد${search ? ` برای «${escapeHtml(search)}»` : ""}</span>
      <span>${icon("layers", 13)} صفحهٔ ${formatNumber(page)} از ${formatNumber(totalPages)}</span>
    </div>
  `;

  const gridClass = view === "list" ? "theory-grid theory-grid--list" : "theory-grid";

  const content = items.length
    ? items.map((theory) => theoryCard(theory)).join("")
    : emptyState({
        iconName: "search",
        title: "نتیجه‌ای پیدا نشد",
        text: search || tag ? "فیلترها را تغییر دهید یا عبارت دیگری را جست‌وجو کنید." : "هنوز نظریه‌ای منتشر نشده است.",
        actions: `<a class="btn btn--primary" href="#/new">${icon("plus", 16)} ساخت نظریه</a><a class="btn btn--outline" href="#/explore">${icon("refresh", 16)} بازنشانی</a>`,
      });

  return {
    layout: "public",
    title: "کاوش نظریه‌ها",
    html: `
      <div class="container page page-enter">
        ${pageHead({
          eyebrow: "کاوش",
          title: "نظریه‌ها را از دریچهٔ خودت ببین.",
          subtitle: "جست‌وجو کن، موضوع را انتخاب کن و به ایده‌هایی برس که هنوز در حال شکل‌گرفتن‌اند.",
        })}
        ${toolbar}
        ${filterRow}
        ${activeHtml}
        ${errorMessage ? `<div class="alert alert--danger" style="margin-bottom:1rem">${icon("alert", 16)}<span>${escapeHtml(errorMessage)}</span></div>` : ""}
        ${resultsHead}
        <div class="${gridClass} stagger">${content}</div>
        ${pagination(page, totalPages, { search, tag, sort, view })}
      </div>
    `,
    mount(root) {
      const form = root.querySelector("[data-explore-search]");
      const clear = root.querySelector("[data-clear-search]");
      const sortSelect = root.querySelector("[data-sort]");

      const go = (overrides = {}) => {
        const data = Object.fromEntries(new FormData(form).entries());
        const next = {
          search: data.search?.trim() || "",
          tag: data.tag || "",
          sort: data.sort || "newest",
          view: data.view || "grid",
          page: 1,
          ...overrides,
        };
        location.hash = `#/explore${buildQuery(next)}`;
      };

      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        go();
      });

      clear?.addEventListener("click", () => {
        const input = form?.querySelector('input[name="search"]');
        if (input) input.value = "";
        go({ search: "" });
      });

      sortSelect?.addEventListener("change", () => {
        go({ sort: sortSelect.value });
      });
    },
  };
}
