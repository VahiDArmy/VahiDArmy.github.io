import {
  listTheories,
  getUserTheoryStats,
  getProfile,
} from "../api.js";
import { navigate } from "../router.js";
import { getState } from "../store.js";
import { icon } from "../icons.js";
import {
  escapeHtml,
  formatNumber,
  compactNumber,
  relativeFa,
} from "../utils.js";
import { formatShamsi } from "../date.js";
import {
  avatar,
  theoryCard,
  emptyState,
  statCard,
  badge,
} from "../components.js";

export async function renderDashboard() {
  const state = getState();
  if (!state.user) {
    navigate("/login?next=/dashboard", { replace: true });
    return { html: "", skip: true };
  }

  const profile = state.profile || (await getProfile(state.user.id));
  const [myTheories, stats, publishedRes] = await Promise.all([
    listTheories({ authorId: state.user.id, status: "all", limit: 6, sort: "newest" }).catch(() => ({ items: [], count: 0 })),
    getUserTheoryStats(state.user.id).catch(() => ({ total: 0, published: 0, drafts: 0, views: 0, objects: 0 })),
    listTheories({ authorId: state.user.id, status: "published", limit: 4, sort: "popular" }).catch(() => ({ items: [], count: 0 })),
  ]);

  const recent = myTheories.items || [];
  const displayName = profile?.full_name || state.user.email?.split("@")[0] || "دوست من";

  return {
    layout: "app",
    title: "داشبورد",
    html: `
      <div class="container page dashboard-page page-enter">
        <div class="dash-greeting">
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            ${avatar(profile || { full_name: displayName }, "xl")}
            <div style="flex:1;min-width:12rem">
              <h1 class="dash-greeting__title">سلام، ${escapeHtml(displayName)}</h1>
              <p class="dash-greeting__sub">${formatNumber(stats.total)} نظریه، ${formatNumber(stats.published)} منتشرشده و ${formatNumber(stats.drafts)} پیش‌نویس.</p>
            </div>
          </div>
          <div class="dash-greeting__actions">
            <a class="btn btn--primary" href="#/new">${icon("plus", 16)} نظریهٔ تازه</a>
            <a class="btn btn--secondary" href="#/explore">${icon("compass", 16)} کاوش</a>
            <a class="btn btn--outline" href="#/settings">${icon("settings", 16)} تنظیمات</a>
          </div>
        </div>

        <div class="stat-grid">
          ${statCard({ iconName: "file-text", label: "همهٔ نظریه‌ها", value: formatNumber(stats.total), tone: "primary" })}
          ${statCard({ iconName: "send", label: "منتشرشده", value: formatNumber(stats.published), tone: "emerald" })}
          ${statCard({ iconName: "eye", label: "بازدید کل", value: compactNumber(stats.views), tone: "accent" })}
          ${statCard({ iconName: "shapes", label: "اشیاء ثبت‌شده", value: formatNumber(stats.objects), tone: "amber" })}
        </div>

        <div class="dash-grid">
          <div class="dash-panel">
            <div class="dash-panel__head">
              <div class="dash-panel__title">${icon("clock", 15)} آخرین نظریه‌ها</div>
              <a class="section-heading__link" href="#/explore?author=${encodeURIComponent(state.user.id)}">${icon("arrow-left", 14)} همه</a>
            </div>
            <div class="dash-panel__body">
              ${recent.length
                ? `<div class="theory-grid stagger">${recent.slice(0, 4).map((theory) => theoryCard(theory, { showAuthor: false })).join("")}</div>`
                : emptyState({
                    iconName: "feather",
                    title: "هنوز نظریه‌ای نساخته‌ای",
                    text: "شروع کن؛ اولین نظریه‌ات می‌تواند همین حالا ساخته شود.",
                    actions: `<a class="btn btn--primary" href="#/new">${icon("plus", 15)} ساخت نظریه</a>`,
                    compact: true,
                  })}
            </div>
          </div>

          <div class="dash-panel">
            <div class="dash-panel__head">
              <div class="dash-panel__title">${icon("activity", 15)} فعالیت</div>
            </div>
            <div class="dash-panel__body">
              <div class="dash-list">
                ${recent.slice(0, 5).map((theory) => `
                  <a class="dash-list__item" href="#/${theory.status === "published" ? "theory" : "edit"}/${encodeURIComponent(theory.slug || theory.id)}">
                    <span class="dash-list__icon">${icon(theory.status === "published" ? "book-open" : "edit", 15)}</span>
                    <span class="dash-list__copy">
                      <span class="dash-list__title">${escapeHtml(theory.title)}</span>
                      <span class="dash-list__meta">${badge(theory.status)} • ${escapeHtml(relativeFa(theory.updated_at || theory.created_at))}</span>
                    </span>
                    <span class="dash-list__action">${icon("chevron-left", 14)}</span>
                  </a>
                `).join("") || `<div class="empty empty--compact"><p class="empty__text">فعالیتی ثبت نشده است.</p></div>`}
              </div>
            </div>
          </div>
        </div>

        ${(publishedRes.items || []).length
          ? `<div class="dash-panel" style="margin-top:1.25rem">
              <div class="dash-panel__head">
                <div class="dash-panel__title">${icon("trending", 15)} محبوب‌ترین نظریه‌های تو</div>
              </div>
              <div class="dash-panel__body" style="display:grid;gap:.35rem">
                ${publishedRes.items
                  .map(
                    (theory) => `
                      <a class="dash-list__item" href="#/theory/${encodeURIComponent(theory.slug || theory.id)}">
                        <span class="dash-list__icon">${icon("book-open", 15)}</span>
                        <span class="dash-list__copy">
                          <span class="dash-list__title">${escapeHtml(theory.title)}</span>
                          <span class="dash-list__meta">${compactNumber(theory.views || 0)} بازدید • ${escapeHtml(formatShamsi(theory.published_at || theory.created_at, "short"))}</span>
                        </span>
                        <span class="dash-list__action">${icon("chevron-left", 14)}</span>
                      </a>
                    `
                  )
                  .join("")}
              </div>
            </div>`
          : ""}
      </div>
    `,
  };
}
