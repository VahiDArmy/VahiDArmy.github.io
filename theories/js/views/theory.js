import {
  getTheoryBySlug,
  listObjects,
  getLikeState,
  getBookmarkState,
  toggleLike,
  toggleBookmark,
  incrementTheoryViews,
  listTheories,
  deleteTheory,
} from "../api.js";
import { navigate } from "../router.js";
import { getState } from "../store.js";
import { icon } from "../icons.js";
import { OBJECT_KINDS } from "../config.js";
import {
  escapeHtml,
  safeImageUrl,
  readingTime,
  formatNumber,
  compactNumber,
  relativeFa,
  copyToClipboard,
} from "../utils.js";
import { formatShamsi, formatShamsiDateTime } from "../date.js";
import {
  avatar,
  badge,
  objectCard,
  objectKindLabel,
  normalizeLinePicture,
  linePictureSvg,
  emptyState,
  authorBox,
  theoryMeta,
  missingValue,
} from "../components.js";
import { toast, confirmDialog } from "../ui.js";

function buildTableOfContents(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const headings = Array.from(doc.querySelectorAll("h2, h3"));
  return headings
    .map((heading, index) => {
      const id = `section-${index + 1}`;
      const text = (heading.textContent || "").trim();
      if (!text) return null;
      return { id, level: heading.tagName === "H2" ? 2 : 3, text, index };
    })
    .filter(Boolean);
}

function injectHeadingIds(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const headings = Array.from(doc.querySelectorAll("h2, h3"));
  headings.forEach((heading, index) => {
    heading.id = `section-${index + 1}`;
  });
  return doc.body.innerHTML;
}

function renderToc(toc) {
  if (!toc.length) {
    return `<div class="aside-card">
      <div class="aside-card__title">${icon("list", 16)} فهرست</div>
      <span class="missing-value">${icon("minus", 10)} فهرستی برای این نظریه ثبت نشده است</span>
    </div>`;
  }
  return `
    <div class="aside-card">
      <div class="aside-card__title">${icon("list", 16)} فهرست</div>
      <nav class="toc" data-toc>
        ${toc
          .map(
            (item) =>
              `<a class="toc__link ${item.level === 3 ? "toc__link--h3" : ""}" href="#${item.id}" data-toc-link="${item.id}">${escapeHtml(item.text)}</a>`
          )
          .join("")}
      </nav>
    </div>
  `;
}

function renderObjects(objects, { isOwner } = {}) {
  if (!objects.length) {
    return emptyState({
      iconName: "shapes",
      title: "شیئی برای این نظریه ثبت نشده است",
      text: isOwner
        ? "می‌توانی اشیا، تصاویر یا منابع مرتبط را اضافه کنی تا نظریه کامل‌تر شود."
        : "این نظریه هنوز شیئی در کنار خود ندارد.",
      actions: isOwner
        ? `<a class="btn btn--primary btn--sm" href="#/edit/${encodeURIComponent("__slug__")}">${icon("plus", 14)} افزودن شیء</a>`
        : "",
      compact: true,
    });
  }
  return `<div class="object-grid stagger">${objects.map((object) => objectCard(object)).join("")}</div>`;
}

function renderLinePicture(data, { isOwner } = {}) {
  const normalized = normalizeLinePicture(data);
  if (!normalized.lines.length) {
    return `
      <div class="line-picture">
        <div class="line-picture__head">
          <div class="line-picture__title">${icon("spline", 16)} خط تصویری</div>
          ${isOwner ? `<a class="btn btn--outline btn--sm" href="#/edit">${icon("pen-tool", 13)} ویرایش</a>` : ""}
        </div>
        <div class="line-picture__canvas-wrap">
          <div class="line-picture__empty">
            ${icon("spline", 28)}
            <p style="margin-top:.6rem">خط تصویری برای این نظریه رسم نشده است.</p>
            ${isOwner ? `<p style="margin-top:.35rem;font-size:.62rem;opacity:.7">می‌توانی از ویرایشگر، خطوط را رسم کنی.</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="line-picture">
      <div class="line-picture__head">
        <div class="line-picture__title">${icon("spline", 16)} خط تصویری</div>
        <span class="chip">${formatNumber(normalized.lines.length)} خط</span>
      </div>
      <div class="line-picture__canvas-wrap">
        <div class="line-picture__canvas" style="background:transparent">${linePictureSvg(normalized, { className: "line-picture__svg", height: "100%" })}</div>
      </div>
    </div>
  `;
}

function relatedCard(theory) {
  const url = `#/theory/${encodeURIComponent(theory.slug || theory.id)}`;
  return `
    <a class="theory-card theory-card--compact" href="${url}">
      <div class="theory-card__cover">
        ${safeImageUrl(theory.cover_image_url)
          ? `<img src="${escapeHtml(theory.cover_image_url)}" alt="${escapeHtml(theory.title)}" loading="lazy">`
          : `<span class="theory-card__cover-placeholder">${icon("image", 26)}</span>`}
      </div>
      <div class="theory-card__body">
        <h4 class="theory-card__title">${escapeHtml(theory.title)}</h4>
        <div class="theory-card__meta" style="margin-top:.4rem">
          <span>${icon("calendar", 11)} ${escapeHtml(formatShamsi(theory.published_at || theory.created_at, "short"))}</span>
        </div>
      </div>
    </a>
  `;
}

export async function renderTheory(ctx) {
  const slug = ctx.params.slug;
  const state = getState();
  const theory = await getTheoryBySlug(slug).catch((error) => {
    console.error(error);
    return null;
  });

  if (!theory) {
    return {
      layout: "public",
      title: "نظریه پیدا نشد",
      html: `
        <div class="notfound">
          <div>
            <div class="notfound__code">۴۰۴</div>
            <h1 class="notfound__title">این نظریه پیدا نشد</h1>
            <p class="notfound__text">ممکن است حذف شده باشد یا هنوز منتشر نشده باشد.</p>
            <div class="notfound__actions">
              <a class="btn btn--primary" href="#/explore">${icon("compass", 16)} کاوش نظریه‌ها</a>
              <a class="btn btn--outline" href="#/">بازگشت به خانه</a>
            </div>
          </div>
        </div>
      `,
    };
  }

  const isOwner = Boolean(state.user && theory.user_id === state.user.id);
  if (theory.status !== "published" && !isOwner) {
    return {
      layout: "public",
      title: "دسترسی محدود",
      html: `
        <div class="notfound">
          <div>
            <div class="notfound__code">${icon("lock", 120)}</div>
            <h1 class="notfound__title">این نظریه خصوصی است</h1>
            <p class="notfound__text">نویسنده این نظریه را منتشر نکرده است.</p>
            <div class="notfound__actions">
              <a class="btn btn--primary" href="#/explore">${icon("compass", 16)} کاوش نظریه‌ها</a>
              <a class="btn btn--outline" href="#/">بازگشت به خانه</a>
            </div>
          </div>
        </div>
      `,
    };
  }

  const [objects, likeState, bookmarkState, relatedResult] = await Promise.all([
    listObjects(theory.id),
    getLikeState(theory.id, state.user?.id),
    getBookmarkState(theory.id, state.user?.id),
    listTheories({
      tag: (theory.tags || [])[0] || "",
      limit: 3,
      sort: "newest",
    }).catch(() => ({ items: [], count: 0 })),
  ]);

  if (theory.status === "published" && !isOwner) {
    incrementTheoryViews(theory.id).catch(() => {});
  }

  const related = (relatedResult.items || []).filter((item) => item.id !== theory.id).slice(0, 3);
  const minutes = readingTime(theory.content);
  const contentWithIds = injectHeadingIds(theory.content || "");
  const toc = buildTableOfContents(theory.content);
  const author = theory.author || {};

  const likeButton = `
    <button class="action-pill ${likeState.liked ? "is-active" : ""}" type="button" data-like ${state.user ? "" : "data-need-auth"}>
      ${icon("heart", 15)} <span data-like-label>${likeState.liked ? "پسندیده‌ای" : "پسندیدن"}</span>
    </button>
  `;

  const bookmarkButton = `
    <button class="action-pill ${bookmarkState.bookmarked ? "is-active" : ""}" type="button" data-bookmark ${state.user ? "" : "data-need-auth"}>
      ${icon("bookmark", 15)} <span data-bookmark-label>${bookmarkState.bookmarked ? "نشان‌شده" : "نشان‌کردن"}</span>
    </button>
  `;

  const ownerMenu = isOwner
    ? `
      <div class="dropdown">
        <button class="icon-btn" type="button" data-dropdown-toggle aria-expanded="false" aria-label="مدیریت">${icon("more-vertical", 18)}</button>
        <div class="dropdown__menu dropdown__menu--end">
          <a class="dropdown__item" href="#/edit/${encodeURIComponent(theory.slug || theory.id)}">${icon("edit", 15)} ویرایش نظریه</a>
          <a class="dropdown__item" href="#/dashboard">${icon("dashboard", 15)} داشبورد</a>
          <button class="dropdown__item is-danger" type="button" data-delete-theory>${icon("trash", 15)} حذف نظریه</button>
        </div>
      </div>
    `
    : "";

  const coverHtml = safeImageUrl(theory.cover_image_url)
    ? `<figure class="theory-cover"><img src="${escapeHtml(theory.cover_image_url)}" alt="${escapeHtml(theory.title)}" loading="lazy"></figure>`
    : `<div class="theory-cover theory-cover--empty">
        <div class="empty__icon">${icon("image", 26)}</div>
        <p class="empty__text" style="margin-top:.4rem">تصویری برای این نظریه بارگذاری نشده است.</p>
      </div>`;

  return {
    layout: "public",
    title: theory.title,
    html: `
      <div class="reading-progress" aria-hidden="true"><div class="reading-progress__bar" data-reading-progress></div></div>
      <article class="theory-page page-enter">
        <header class="theory-hero">
          <div class="container container--narrow theory-hero__inner">
            <div class="theory-kicker">
              ${badge(theory.status)}
              <span class="sep"></span>
              <span>${icon("calendar", 12)} ${escapeHtml(formatShamsi(theory.published_at || theory.created_at))}</span>
              <span class="sep"></span>
              <span>${icon("clock", 12)} ${formatNumber(minutes)} دقیقه مطالعه</span>
              <span class="sep"></span>
              <span>${icon("eye", 12)} ${compactNumber(theory.views || 0)} بازدید</span>
            </div>
            <h1 class="theory-title">${escapeHtml(theory.title)}</h1>
            ${theory.excerpt ? `<p class="theory-excerpt">${escapeHtml(theory.excerpt)}</p>` : `<p class="theory-excerpt missing-value">${icon("minus", 11)} خلاصه‌ای برای این نظریه نوشته نشده است</p>`}
            <div class="theory-byline">
              <a class="theory-byline__author" href="#/profile/${encodeURIComponent(author.username || "")}">
                ${avatar(author, "sm")}
                <span>
                  <span class="theory-byline__name">${escapeHtml(author.full_name || author.username || "نویسنده")}</span>
                  <span class="theory-byline__meta">${escapeHtml(formatShamsiDateTime(theory.created_at))}</span>
                </span>
              </a>
              ${isOwner ? `<span class="theory-byline__divider"></span><span class="theory-byline__meta">${icon("shield", 12)} شما نویسندهٔ این نظریه هستید</span>` : ""}
            </div>
          </div>
          <div class="container" style="max-width:64rem">${coverHtml}</div>
          <div class="container" style="max-width:64rem">
            <div class="theory-action-bar">
              <div class="theory-action-bar__group">
                ${likeButton}
                ${bookmarkButton}
                <button class="action-pill" type="button" data-copy="${escapeHtml(location.origin + location.pathname + location.search + '#/theory/' + encodeURIComponent(theory.slug || theory.id))}">${icon("link", 15)} کپی پیوند</button>
                <button class="action-pill" type="button" data-share>${icon("share", 15)} اشتراک</button>
              </div>
              <div class="theory-action-bar__group">
                ${isOwner ? `<a class="action-pill" href="#/edit/${encodeURIComponent(theory.slug || theory.id)}">${icon("edit", 15)} ویرایش</a>` : ""}
                ${ownerMenu}
              </div>
            </div>
          </div>
        </header>

        <div class="container detail-layout" style="max-width:76rem">
          <div>
            <div class="theory-content">
              <div class="theory-content__divider"><span></span></div>
              ${theory.content
                ? `<div class="prose theory-body" data-theory-body>${contentWithIds}</div>`
                : emptyState({
                    iconName: "file-text",
                    title: "متن نظریه خالی است",
                    text: "این نظریه هنوز متن کاملی ندارد.",
                    compact: true,
                  })}

              <footer class="theory-footer">
                ${(theory.tags || []).length
                  ? `<div class="theory-footer__tags">${(theory.tags || []).map((tag) => `<a class="chip" href="#/explore?tag=${encodeURIComponent(tag)}">${icon("tag", 12)} ${escapeHtml(tag)}</a>`).join("")}</div>`
                  : `<div class="theory-footer__tags"><span class="missing-value">${icon("tag", 11)} برچسبی برای این نظریه ثبت نشده است</span></div>`}
                <div class="theory-footer__actions">
                  <div class="stat-inline">
                    <span>${icon("eye", 12)} ${compactNumber(theory.views || 0)} بازدید</span>
                    <span>${icon("heart", 12)} پسندیده‌ها</span>
                    <span>${icon("clock", 12)} ${formatNumber(minutes)} دقیقه</span>
                  </div>
                  ${authorBox(author)}
                </div>
              </footer>
            </div>

            <section class="container objects-section">
              <div class="objects-section__head">
                <h2 class="objects-section__title">${icon("shapes", 18)} اشیای نظریه <span class="objects-section__count">${formatNumber(objects.length)}</span></h2>
                ${isOwner
                  ? `<a class="btn btn--outline btn--sm" href="#/edit/${encodeURIComponent(theory.slug || theory.id)}">${icon("plus", 14)} مدیریت اشیا</a>`
                  : ""}
              </div>
              ${renderObjects(objects, { isOwner })}
            </section>

            <section class="container objects-section">
              <div class="objects-section__head">
                <h2 class="objects-section__title">${icon("spline", 18)} خط تصویری</h2>
              </div>
              ${renderLinePicture(theory.line_picture, { isOwner })}
            </section>

            ${related.length
              ? `<section class="container related-section">
                  <div class="section-heading">
                    <div class="section-heading__copy">
                      <h2 class="section-heading__title">نظریه‌های مرتبط</h2>
                      <p class="section-heading__sub">از همین موضوع یا نزدیک به آن.</p>
                    </div>
                    <a class="section-heading__link" href="#/explore?tag=${encodeURIComponent((theory.tags || [])[0] || "")}">کاوش بیشتر ${icon("arrow-left", 14)}</a>
                  </div>
                  <div class="theory-grid">${related.map(relatedCard).join("")}</div>
                </section>`
              : ""}
          </div>

          <aside class="detail-aside">
            ${renderToc(toc)}
            <div class="aside-card">
              <div class="aside-card__title">${icon("calendar", 16)} زمان‌ها</div>
              <div class="meta-list">
                <div class="meta-item"><span class="meta-item__label">ساخت</span><span class="meta-item__value">${escapeHtml(formatShamsiDateTime(theory.created_at))}</span></div>
                <div class="meta-item"><span class="meta-item__label">آخرین ویرایش</span><span class="meta-item__value">${escapeHtml(formatShamsiDateTime(theory.updated_at || theory.created_at))}</span></div>
                ${theory.published_at ? `<div class="meta-item"><span class="meta-item__label">انتشار</span><span class="meta-item__value">${escapeHtml(formatShamsiDateTime(theory.published_at))}</span></div>` : ""}
              </div>
            </div>
            <div class="aside-card">
              <div class="aside-card__title">${icon("layers", 16)} آمار</div>
              <div class="meta-list">
                <div class="meta-item"><span class="meta-item__label">بازدید</span><span class="meta-item__value">${formatNumber(theory.views || 0)}</span></div>
                <div class="meta-item"><span class="meta-item__label">اشیاء</span><span class="meta-item__value">${formatNumber(objects.length)}</span></div>
                <div class="meta-item"><span class="meta-item__label">خطوط تصویری</span><span class="meta-item__value">${formatNumber(normalizeLinePicture(theory.line_picture).lines.length)}</span></div>
                <div class="meta-item"><span class="meta-item__label">مدت مطالعه</span><span class="meta-item__value">${formatNumber(minutes)} دقیقه</span></div>
              </div>
            </div>
            <div class="aside-card">
              <div class="aside-card__title">${icon("sparkles", 16)} پیشنهاد</div>
              <p style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.75">این نظریه را ذخیره کن یا با یک پیوند برای دیگری بفرست.</p>
              <div style="display:flex;gap:.35rem;margin-top:.6rem;flex-wrap:wrap">
                ${bookmarkButton}
                <button class="action-pill" type="button" data-copy="${escapeHtml(location.origin + location.pathname + '#/theory/' + encodeURIComponent(theory.slug || theory.id))}">${icon("link", 15)} پیوند</button>
              </div>
            </div>
          </aside>
        </div>
      </article>
    `,
    mount(root) {
      const likeBtn = root.querySelector("[data-like]");
      const bookmarkBtn = root.querySelector("[data-bookmark]");
      const progressBar = root.querySelector("[data-reading-progress]");

      const needAuth = () => {
        toast({
          type: "warning",
          title: "برای این کار وارد شوید",
          message: "این عمل به حساب نیاز دارد.",
        });
        navigate(`/login?next=${encodeURIComponent(`/theory/${theory.slug || theory.id}`)}`);
      };

      likeBtn?.addEventListener("click", async () => {
        if (!state.user) return needAuth();
        try {
          const result = await toggleLike(theory.id, state.user.id);
          likeBtn.classList.toggle("is-active", result.liked);
          const label = likeBtn.querySelector("[data-like-label]");
          if (label) label.textContent = result.liked ? "پسندیده‌ای" : "پسندیدن";
        } catch (error) {
          toast({ type: "error", title: "نشد", message: error.message });
        }
      });

      bookmarkBtn?.addEventListener("click", async () => {
        if (!state.user) return needAuth();
        try {
          const result = await toggleBookmark(theory.id, state.user.id);
          bookmarkBtn.classList.toggle("is-active", result.bookmarked);
          const label = bookmarkBtn.querySelector("[data-bookmark-label]");
          if (label) label.textContent = result.bookmarked ? "نشان‌شده" : "نشان‌کردن";
          toast({ type: result.bookmarked ? "success" : "info", title: result.bookmarked ? "نشان شد" : "از نشان‌ها برداشته شد", duration: 1800 });
        } catch (error) {
          toast({ type: "error", title: "نشد", message: error.message });
        }
      });

      root.querySelector("[data-share]")?.addEventListener("click", async () => {
        const shareData = {
          title: theory.title,
          text: theory.excerpt || "",
          url: `${location.origin}${location.pathname}#/theory/${encodeURIComponent(theory.slug || theory.id)}`,
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch {
            // ignore
          }
        } else {
          const ok = await copyToClipboard(shareData.url);
          toast({ type: ok ? "success" : "error", title: ok ? "پیوند کپی شد" : "کپی نشد", duration: 1800 });
        }
      });

      root.querySelector("[data-delete-theory]")?.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "حذف نظریه؟",
          description: "این عمل برگشت‌پذیر نیست. همهٔ اشیا و خطوط تصویری مرتبط هم حذف می‌شوند.",
          confirmText: "حذف کن",
          danger: true,
          iconName: "trash",
        });
        if (!ok) return;
        try {
          await deleteTheory(theory.id);
          toast({ type: "success", title: "نظریه حذف شد" });
          navigate("/dashboard", { replace: true });
        } catch (error) {
          toast({ type: "error", title: "حذف انجام نشد", message: error.message });
        }
      });

      const updateProgress = () => {
        const body = root.querySelector("[data-theory-body]");
        if (!body || !progressBar) return;
        const rect = body.getBoundingClientRect();
        const total = rect.height - window.innerHeight + 200;
        const scrolled = -rect.top + 120;
        const ratio = Math.max(0, Math.min(1, scrolled / Math.max(1, total)));
        progressBar.style.width = `${ratio * 100}%`;
      };
      window.addEventListener("scroll", updateProgress, { passive: true });
      updateProgress();

      const tocLinks = Array.from(root.querySelectorAll("[data-toc-link]"));
      if (tocLinks.length) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                tocLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.tocLink === entry.target.id));
              }
            });
          },
          { rootMargin: "-20% 0px -65% 0px" }
        );
        tocLinks.forEach((link) => {
          const target = root.querySelector(`#${CSS.escape(link.dataset.tocLink)}`);
          if (target) observer.observe(target);
        });
        tocLinks.forEach((link) => {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            const target = root.querySelector(`#${CSS.escape(link.dataset.tocLink)}`);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
      }
    },
  };
}
