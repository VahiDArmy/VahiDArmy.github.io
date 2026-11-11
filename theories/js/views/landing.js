import { listTheories, getPlatformStats, getPopularTags } from "../api.js";
import { icon } from "../icons.js";
import { QUOTES } from "../config.js";
import { escapeHtml, formatNumber, compactNumber } from "../utils.js";
import { theoryCard, sectionHeading, emptyState } from "../components.js";

const features = [
  { icon: "pen-tool", title: "نوشتن با ویرایشگر غنی", text: "متن، عنوان، نقل‌قول، تصویر و ساختار؛ همه در یک تجربهٔ روان." },
  { icon: "shapes", title: "اشیای نظریه", text: "هر نظریه می‌تواند اشیا، مفاهیم، منابع و تصاویر خودش را داشته باشد." },
  { icon: "spline", title: "خط تصویری", text: "خطوط فکر را رسم کن؛ چیزی که در قالب متن نمی‌گنجد." },
  { icon: "calendar", title: "تاریخ شمسی", text: "زمان انتشار و ویرایش بر پایهٔ تقویم شمسی و خوانا." },
  { icon: "tag", title: "برچسب و کاوش", text: "موضوع‌ها را برچسب بزن و نظریه‌ها را از دریچهٔ علاقه‌ات پیدا کن." },
  { icon: "lock", title: "حریم خصوصی", text: "پیش‌نویس، منتشرشده یا خصوصی؛ کنترل کامل با توست." },
];

const steps = [
  { title: "نظریه را بساز", text: "یک عنوان، یک جملهٔ کوتاه و ساختار اولیه؛ سپس آزادانه بنویس." },
  { title: "اشیاء و خطوط را پیوند بزن", text: "مفاهیم و تصاویر را اضافه کن و خط تصویری را رسم کن." },
  { title: "منتشر کن یا خصوصی نگه دار", text: "انتشار عمومی، پیش‌نویس یا خصوصی؛ هر زمان که بخواهی." },
];

function heroVisual() {
  return `
    <div class="hero__visual" aria-hidden="true">
      <div class="hero__glow"></div>
      <div class="hero-orbit">
        <span class="hero-orbit__node hero-orbit__node--one">${icon("shapes", 18)}</span>
        <span class="hero-orbit__node hero-orbit__node--two">${icon("image", 18)}</span>
        <span class="hero-orbit__node hero-orbit__node--three">${icon("quote", 18)}</span>
        <span class="hero-orbit__node hero-orbit__node--four">${icon("spline", 18)}</span>
        <div class="hero-orbit__core"><span class="hero-orbit__star"></span></div>
      </div>
      <div class="hero-float hero-float--a">
        <span class="hero-float__icon">${icon("pen-tool", 14)}</span>
        <span><strong>ویرایشگر غنی</strong><br>متن، تصویر، نقل‌قول</span>
      </div>
      <div class="hero-float hero-float--b">
        <span class="hero-float__icon">${icon("calendar", 14)}</span>
        <span><strong>تقویم شمسی</strong><br>زمان‌بندی خوانا</span>
      </div>
    </div>
  `;
}

export async function renderLanding() {
  let latest = [];
  let popular = [];
  let stats = { theories: 0, objects: 0, authors: 0 };
  let tags = [];
  let failed = false;

  try {
    const [latestRes, popularRes, statsRes, tagsRes] = await Promise.all([
      listTheories({ limit: 6 }),
      listTheories({ limit: 3, sort: "popular" }),
      getPlatformStats(),
      getPopularTags(12),
    ]);
    latest = latestRes.items;
    popular = popularRes.items;
    stats = statsRes;
    tags = tagsRes;
  } catch (error) {
    failed = true;
    console.error(error);
  }

  const latestHtml = latest.length
    ? latest.map((theory) => theoryCard(theory)).join("")
    : emptyState({
        iconName: "feather",
        title: "هنوز نظریه‌ای منتشر نشده",
        text: "اولین نظریه را بساز و این فضا را شروع کن.",
        actions: `<a class="btn btn--primary" href="#/new">${icon("plus", 16)} نظریهٔ تازه</a>`,
      });

  const popularHtml = popular.length
    ? popular.map((theory) => theoryCard(theory, { variant: "compact", showMenu: false })).join("")
    : "";

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return {
    layout: "public",
    title: "خانه",
    html: `
      <div class="page-enter">
        <section class="hero">
          <div class="container">
            <div class="hero__inner">
              <div class="hero__copy">
                <span class="hero__eyebrow"><span class="dot">${icon("sparkles", 12)}</span> فضایی برای نظریه‌هایی که هنوز کامل نیستند</span>
                <h1 class="hero__title">
                  <span class="line">ایده را</span>
                  <span class="line accent">به شکل</span>
                  <span class="line"><span class="underlined">نظریه</span> درآور.</span>
                </h1>
                <p class="hero__lead">
                  نظریه جایی است برای ثبت، پرورش و روایت ایده‌ها.
                  <strong>متن بنویس، شیء بساز، خط بکش</strong> و نظریه‌ات را با جهان به اشتراک بگذار.
                </p>
                <div class="hero__actions">
                  <a class="btn btn--primary btn--lg" href="#/new">${icon("plus", 18)} شروع نوشتن</a>
                  <a class="btn btn--outline btn--lg" href="#/explore">${icon("compass", 18)} کاوش نظریه‌ها</a>
                </div>
                <div class="hero__meta">
                  <span class="hero__meta-item">${icon("check-circle", 15)} ثبت با تقویم شمسی</span>
                  <span class="hero__meta-divider"></span>
                  <span class="hero__meta-item">${icon("shapes", 15)} اشیا و خطوط تصویری</span>
                  <span class="hero__meta-divider"></span>
                  <span class="hero__meta-item">${icon("lock", 15)} کنترل حریم خصوصی</span>
                </div>
              </div>
              ${heroVisual()}
            </div>
          </div>
        </section>

        <section class="section section--tight">
          <div class="container">
            <div class="stats-strip">
              <div class="stat-cell"><div class="stat-cell__value">${compactNumber(stats.theories)}</div><div class="stat-cell__label">نظریهٔ منتشرشده</div></div>
              <div class="stat-cell"><div class="stat-cell__value">${compactNumber(stats.objects)}</div><div class="stat-cell__label">شیء و تصویر</div></div>
              <div class="stat-cell"><div class="stat-cell__value">${compactNumber(stats.authors)}</div><div class="stat-cell__label">نویسنده</div></div>
              <div class="stat-cell"><div class="stat-cell__value">∞</div><div class="stat-cell__label">راه برای دیدن</div></div>
            </div>
          </div>
        </section>

        ${failed ? `<div class="container"><div class="alert alert--warning">${icon("alert", 16)}<span>بخشی از داده‌ها دریافت نشد. صفحه را دوباره بارگذاری کنید.</span></div></div>` : ""}

        <section class="section">
          <div class="container">
            ${sectionHeading({
              title: "تازه‌ترین نظریه‌ها",
              subtitle: "ایده‌هایی که همین حالا در حال شکل‌گرفتن‌اند.",
              link: "#/explore",
              linkText: "همهٔ نظریه‌ها",
            })}
            <div class="theory-grid stagger">
              ${latest.length ? latestHtml : `<div style="grid-column:1/-1">${latestHtml}</div>`}
            </div>
          </div>
        </section>

        ${popular.length
          ? `<section class="section section--tight">
              <div class="container">
                ${sectionHeading({ title: "پرخواننده‌ها", subtitle: "نظریه‌هایی که بیشتر دیده شده‌اند.", link: "#/explore?sort=popular", linkText: "کاوش محبوب‌ها" })}
                <div class="theory-grid">${popularHtml}</div>
              </div>
            </section>`
          : ""}

        <section class="section">
          <div class="container">
            ${sectionHeading({ title: "برای نظریه‌ات چه داری؟", subtitle: "ابزارهایی که فکر را از ذهن به صفحه می‌آورند." })}
            <div class="feature-grid">
              ${features
                .map(
                  (feature) => `
                    <article class="feature">
                      <span class="feature__icon">${icon(feature.icon, 22)}</span>
                      <h3 class="feature__title">${escapeHtml(feature.title)}</h3>
                      <p class="feature__text">${escapeHtml(feature.text)}</p>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="section section--tight">
          <div class="container">
            ${sectionHeading({ title: "از ایده تا نظریه، در سه قدم", subtitle: "ساده شروع کن؛ هر چیزی را بعداً می‌توانی کامل کنی." })}
            <div class="step-list">
              ${steps
                .map(
                  (step, index) => `
                    <article class="step">
                      <span class="step__index">${new Intl.NumberFormat("fa-IR").format(index + 1)}</span>
                      <h3 class="step__title">${escapeHtml(step.title)}</h3>
                      <p class="step__text">${escapeHtml(step.text)}</p>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>

        ${tags.length
          ? `<section class="section section--tight">
              <div class="container">
                ${sectionHeading({ title: "از موضوع‌ها شروع کن", subtitle: "برچسب‌هایی که بیشترین نظریه را دارند." })}
                <div class="tag-cloud">
                  ${tags
                    .map(
                      (item) =>
                        `<a class="chip" href="#/explore?tag=${encodeURIComponent(item.tag)}">${icon("tag", 12)} ${escapeHtml(item.tag)} <span style="opacity:.55">${formatNumber(item.count)}</span></a>`
                    )
                    .join("")}
                </div>
              </div>
            </section>`
          : ""}

        <section class="section">
          <div class="container">
            <div class="cta-band">
              <div class="cta-band__inner">
                <div>
                  <h2 class="cta-band__title">نظریه‌ات را جدی بگیر.</h2>
                  <p class="cta-band__text">ثبت‌نام کن، اولین نظریه را بساز و ببین ایده‌ات وقتی شکل می‌گیرد چه می‌شود.</p>
                </div>
                <div class="hero__actions" style="margin:0">
                  <a class="btn btn--primary btn--lg" href="#/login?mode=register">${icon("rocket", 18)} ساخت حساب</a>
                  <a class="btn btn--outline btn--lg" href="#/explore">${icon("book-open", 18)} دیدن نمونه‌ها</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section section--tight">
          <div class="container container--narrow">
            <div class="auth-quote" style="text-align:center">
              <div class="auth-quote__mark" style="margin-inline:auto">”</div>
              <p class="auth-quote__text" style="font-size:1.15rem">${escapeHtml(quote.text)}</p>
              <div class="auth-quote__author" style="justify-content:center"><span class="notice-dot"></span>${escapeHtml(quote.author)}</div>
            </div>
          </div>
        </section>
      </div>
    `,
  };
}
