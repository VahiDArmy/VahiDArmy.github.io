/**
 * تست‌های واحد برای پارسر تفسیر و تاریخ شمسی
 * اجرا: npm test
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { toBlocks, parseTafsirDocs } from "../assets/js/tafsir.js";
import { shamsi, fa, parseFa } from "../assets/js/core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(path.join(here, "fixtures/tafsir-sample.json"), "utf8"));

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

/* ---------- بلوک‌سازی ---------- */
test("بلوک‌ها: عنوان‌ها، آیه‌ها و ترجمه‌ها شناسایی می‌شوند", () => {
  const blocks = toBlocks(fixture.text);
  const types = blocks.map((b) => b.type);
  assert.equal(blocks.filter((b) => b.type === "arabic").length, 3, "سه آیه");
  assert.equal(blocks.filter((b) => b.type === "farsi").length, 1, "یک بلوک ترجمه");
  assert.ok(blocks.some((b) => b.type === "h2"), "عنوان سند");
  assert.ok(blocks.some((b) => b.type === "h3"), "عنوان بخش");
  assert.ok(types.includes("h4"), "زیرعنوان");
});

test("آیه‌ها: شماره از span و حذف شمارهٔ داخل پرانتز", () => {
  const blocks = toBlocks(fixture.text);
  const arabic = blocks.filter((b) => b.type === "arabic");
  assert.deepEqual(arabic.map((b) => b.ayah), [1, 2, 3]);
  assert.ok(!/\(١\)/.test(arabic[0].text), "شمارهٔ عربی از متن حذف شود");
});

test("ترجمه: شمارهٔ هر خط جدا می‌شود", () => {
  const blocks = toBlocks(fixture.text);
  const trans = blocks.find((b) => b.type === "farsi");
  assert.deepEqual(trans.rows.map((r) => r.n), [1, 2, 3]);
  assert.ok(trans.rows[0].text.startsWith("این خطِ آزمایشی"));
  assert.ok(!trans.rows[0].text.endsWith("(1)."));
});

test("بلوک‌های فهرستی", () => {
  const blocks = toBlocks(fixture.text);
  assert.equal(blocks.filter((b) => b.type === "li").length, 2);
});

/* ---------- صفحه‌بندی ---------- */
const parsed = parseTafsirDocs([fixture]);

test("صفحه‌بندی: سند کوتاه در یک صفحه می‌ماند", () => {
  assert.equal(parsed.pages.length, 1, `صفحه‌ها: ${parsed.pages.length}`);
});

test("صفحه‌بندی: سند بلند به چند صفحه می‌شکند", () => {
  const paragraph =
    "متنِ آزمایشی برای پر کردن حجم صفحه. این جمله چند بار تکرار می‌شود تا مرز صفحه‌ها آزموده شود. " +
    "متنِ آزمایشی برای پر کردن حجم صفحه. این جمله چند بار تکرار می‌شود تا مرز صفحه‌ها آزموده شود.";
  const head = [
    "## [سوره واقعه (56): آيات 4 تا 6]",
    "",
    '<span id="surah-56-ayah-4"></span>',
    "```arabic",
    "متنِ آزمایشیِ آیهٔ چهارم (٤)",
    "```",
    "",
    "### بيان آيات",
    "",
  ].join("\n");
  const longDoc = {
    content_id: 2,
    text: head + Array.from({ length: 40 }, () => paragraph).join("\n\n"),
  };
  const out = parseTafsirDocs([longDoc]);
  assert.ok(out.pages.length >= 4, `صفحه‌ها: ${out.pages.length}`);
  assert.equal(out.ayahMap.get(4), 0, "آیهٔ چهارم در صفحهٔ اول");
  assert.ok(out.pages.every((page) => page.html.includes("متنِ آزمایشی")));
});

test("صفحه‌بندی: هر صفحه متن و شناسه دارد", () => {
  for (const page of parsed.pages) {
    assert.ok(page.html && page.html.trim().length > 0, `صفحهٔ ${page.id} خالی است`);
    assert.ok(typeof page.index === "number");
    assert.equal(typeof page.html, "string");
  }
  assert.deepEqual(
    parsed.pages.map((p) => p.index),
    parsed.pages.map((_, i) => i)
  );
});

test("صفحه‌بندی: هیچ صفحه‌ای با عنوان تنها تمام نمی‌شود", () => {
  for (const page of parsed.pages.slice(0, -1)) {
    const last = page.blocks[page.blocks.length - 1];
    assert.ok(!["h2", "h3", "h4"].includes(last.type), `صفحهٔ ${page.id} با عنوان تمام شده`);
  }
});

test("صفحه‌بندی: حجم صفحه‌ها از سقف بیشتر نمی‌شود", () => {
  const weight = (page) =>
    page.blocks.reduce((sum, b) => {
      if (b.type === "arabic-grid") return sum + b.rows.reduce((s, r) => s + r.text.length, 0);
      if (b.type === "trans-list") return sum + b.rows.reduce((s, r) => s + r.text.length, 0);
      if (b.type === "list") return sum + b.items.join(" ").length;
      return sum + (b.text || "").length;
    }, 0);
  for (const page of parsed.pages) {
    assert.ok(weight(page) <= 4000, `صفحهٔ ${page.id} زیادی بزرگ است: ${weight(page)}`);
  }
});

test("نقشهٔ آیه‌ها به صفحه", () => {
  assert.equal(parsed.ayahMap.get(1), 0);
  assert.ok(parsed.ayahMap.has(2));
  assert.ok(parsed.ayahMap.has(3));
});

test("فهرست: ورودی سند و بخش‌ها ساخته می‌شود", () => {
  assert.ok(parsed.sections.length >= 2, `ورودی‌ها: ${parsed.sections.length}`);
  assert.ok(parsed.sections.some((s) => s.kind === "doc"));
  assert.ok(parsed.sections.some((s) => s.kind === "section"));
  for (const section of parsed.sections) {
    assert.ok(Number.isInteger(section.page) && section.page >= 0 && section.page < parsed.pages.length);
  }
});

test("رندر: مارک‌داون‌های امن", () => {
  const doc = { content_id: 1, text: "### خطر\n\n<script>alert(1)</script> و **پررنگ** و ﴿آیه﴾" };
  const out = parseTafsirDocs([doc]);
  const html = out.pages.map((p) => p.html).join("");
  assert.ok(!html.includes("<script>"), "تگ اسکریپت باید فرار کند");
  assert.ok(html.includes("<strong>پررنگ</strong>"), "پررنگ");
  assert.ok(html.includes('class="quranquote"'), "آیه‌های قرآنی");
});

test("چند سند، ترتیب بر اساس content_id", () => {
  const a = { content_id: 2, text: "### دوم\n\nمتن دوم" };
  const b = { content_id: 1, text: "### اول\n\nمتن اول" };
  const out = parseTafsirDocs([a, b]);
  assert.ok(out.pages[0].html.includes("متن اول"));
});

/* ---------- تاریخ شمسی ---------- */
test("شمسی: سال ۱۴۰۵ و ارقام فارسی", () => {
  const stamp = shamsi("2026-11-02T12:00:00Z");
  assert.ok(stamp.day.includes("۱۴۰۵"), `دریافت: ${stamp.day}`);
  assert.ok(!/[0-9]/.test(stamp.day), "نباید رقم لاتین داشته باشد");
  assert.ok(stamp.time.includes(":"), "ساعت");
  assert.ok(stamp.weekday.length > 2, "نام روز");
  assert.match(stamp.dayKey, /^\d{4}-\d{2}-\d{2}$/, `کلید روز: ${stamp.dayKey}`);
  assert.equal(stamp.dayKey.slice(0, 4), "1405");
});

test("شمسی: ورودی نامعتبر کرش نمی‌کند", () => {
  const stamp = shamsi("not-a-date");
  assert.equal(stamp.day, "—");
  assert.equal(stamp.date, null);
});

test("اعداد: تبدیل دوطرفه", () => {
  assert.equal(fa(1234), "۱۲۳۴");
  assert.equal(parseFa("۱۲۳"), "123");
  assert.equal(parseFa("۵۶"), "56");
});

/* ---------- گزارش ---------- */
let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`  ✓ ${result.name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${result.name}\n    ${result.error?.message || result.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} تست موفق`);
if (failed > 0) process.exitCode = 1;
