import { icon } from "../icons.js";

export function renderNotFound() {
  return {
    layout: "public",
    title: "صفحه پیدا نشد",
    html: `
      <div class="notfound page-enter">
        <div>
          <div class="notfound__code">۴۰۴</div>
          <h1 class="notfound__title">این مسیر به جایی نمی‌رسد</h1>
          <p class="notfound__text">آدرس ممکن است اشتباه باشد یا صفحه حذف شده باشد.</p>
          <div class="notfound__actions">
            <a class="btn btn--primary" href="#/">${icon("home", 16)} خانه</a>
            <a class="btn btn--outline" href="#/explore">${icon("compass", 16)} کاوش نظریه‌ها</a>
          </div>
        </div>
      </div>
    `,
  };
}
