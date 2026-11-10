import { listTheories, getProfilesByIds } from "../api.js";
import { supabase } from "../supabase.js";
import { getState } from "../store.js";
import { icon } from "../icons.js";
import {
  escapeHtml,
  formatNumber,
  compactNumber,
} from "../utils.js";
import { formatShamsi } from "../date.js";
import {
  avatar,
  theoryCard,
  emptyState,
} from "../components.js";
import { navigate } from "../router.js";

async function findProfileByUsername(username) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function renderProfile(ctx) {
  const username = ctx.params.username || "";
  const state = getState();

  let profile = null;
  if (username) {
    profile = await findProfileByUsername(username).catch(() => null);
  } else if (state.user) {
    profile = state.profile;
  }

  if (!profile) {
    if (!state.user) {
      navigate("/login", { replace: true });
      return { html: "", skip: true };
    }
    return {
      layout: "app",
      title: "پروفایل پیدا نشد",
      html: `<div class="container page">${emptyState({
        iconName: "user",
        title: "پروفایلی با این نام پیدا نشد",
        text: "نام کاربری را بررسی کن یا از داشبورد خودت شروع کن.",
        actions: `<a class="btn btn--primary" href="#/explore">کاوش نظریه‌ها</a>`,
      })}</div>`,
    };
  }

  const isSelf = state.user?.id === profile.id;
  const theoriesRes = await listTheories({
    authorId: profile.id,
    status: isSelf ? "all" : "published",
    limit: 9,
    sort: "newest",
  }).catch(() => ({ items: [], count: 0 }));

  const items = theoriesRes.items || [];
  const totalViews = items.reduce((sum, theory) => sum + Number(theory.views || 0), 0);

  return {
    layout: "app",
    title: `${profile.full_name || profile.username}`,
    html: `
      <div class="container page page-enter">
        <div class="profile-hero">
          <div class="profile-hero__inner">
            <div class="avatar-ring">${avatar(profile, "xl")}</div>
            <div class="profile-hero__copy">
              <h1 class="profile-hero__name">${escapeHtml(profile.full_name || profile.username)}</h1>
              <div class="profile-hero__username">@${escapeHtml(profile.username || "")} • عضو از ${escapeHtml(formatShamsi(profile.created_at, "month"))}</div>
              <p class="profile-hero__bio">${escapeHtml(profile.bio || "این نویسنده هنوز دربارهٔ خودش چیزی ننوشته است.")}</p>
              <div class="profile-hero__actions">
                ${isSelf ? `<a class="btn btn--primary btn--sm" href="#/settings">${icon("edit", 14)} ویرایش پروفایل</a>` : ""}
                ${isSelf ? `<a class="btn btn--outline btn--sm" href="#/new">${icon("plus", 14)} نظریهٔ تازه</a>` : ""}
                ${!isSelf && profile.username ? `<button class="btn btn--outline btn--sm" type="button" data-copy="${escapeHtml(location.origin + location.pathname + '#/profile/' + encodeURIComponent(profile.username))}">${icon("link", 14)} کپی پیوند</button>` : ""}
              </div>
              <div class="profile-stats">
                <div class="profile-stat"><div class="profile-stat__value">${formatNumber(theoriesRes.count || items.length)}</div><div class="profile-stat__label">نظریه</div></div>
                <div class="profile-stat"><div class="profile-stat__value">${compactNumber(totalViews)}</div><div class="profile-stat__label">بازدید</div></div>
                <div class="profile-stat"><div class="profile-stat__value">${formatNumber(items.filter((item) => item.status === "published").length)}</div><div class="profile-stat__label">منتشرشده</div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="section" style="padding-block:2.5rem 0">
          <div class="section-heading">
            <div class="section-heading__copy">
              <h2 class="section-heading__title">نظریه‌های ${escapeHtml(profile.full_name || profile.username || "")}</h2>
              <p class="section-heading__sub">${isSelf ? "شامل پیش‌نویس‌های تو." : "نظریه‌های منتشرشدهٔ این نویسنده."}</p>
            </div>
          </div>
          <div class="theory-grid stagger">
            ${items.length
              ? items.map((theory) => theoryCard(theory, { showAuthor: false })).join("")
              : emptyState({
                  iconName: "feather",
                  title: "هنوز نظریه‌ای منتشر نشده",
                  text: isSelf ? "اولین نظریه را بساز." : "این نویسنده هنوز چیزی منتشر نکرده است.",
                  actions: isSelf ? `<a class="btn btn--primary" href="#/new">${icon("plus", 15)} ساخت نظریه</a>` : "",
                })}
          </div>
        </div>
      </div>
    `,
  };
}
