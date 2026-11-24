# گزارش NEO-PI-R — شناسهٔ ۸۷

دادهٔ خام دو برگهٔ آزمون نئو (فرم بلند) به‌همراه یک مطالعهٔ جامع شخصیت، در دو زبان.

Static site — no build step, no dependencies. Just HTML, CSS and vanilla JavaScript.

## Pages

| File | What it is |
|---|---|
| `index.html` | Raw data of both sheets: meta, five domain scales, thirty facets, validity block, the printed «نظریه» key, the T-score profile chart, and a Download / CSV / Copy toolbar. **This is the entry page (Persian, RTL).** |
| `analysis-fa.html` | The full study in Persian (RTL) — the default study. |
| `analysis.html` | The full study in English (LTR). Identical content, unchanged. |

`styles.css` holds the shared styles (including the `.prose-fa` RTL block). `data.js` holds the transcribed scores; `app.js` renders the tables, the SVG chart and the exporters.

## Deploy on GitHub Pages

1. Create a repository and upload the **contents** of the zip (not the zip itself) to the root of the default branch.
2. Repository → **Settings** → **Pages** → *Build and deployment* → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → **Save**.
3. Wait a minute; the site appears at `https://<user>.github.io/<repo>/` and opens on the Persian raw-data page.

No secrets, no server, no database. Everything runs in the browser.

## Notes on the data

- Domain scores are the sum of their six facets; five of five reconcile (A differs by 1 due to rounding on the printed sheet).
- The sheet carries two interpretation keys that disagree for A and C. The study treats raw facet scores as ground truth and the printed labels as ordinal only.
- Sheet 2 prints no numbers, only a T-score grid, so profile values were read off the chart and are approximate (±3).
