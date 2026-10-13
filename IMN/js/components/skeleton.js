/**
 * Skeleton loaders.
 *
 *   el.innerHTML = skeleton.kpiGrid(4);
 *   el.innerHTML = skeleton.table(6, 4);
 *   el.innerHTML = skeleton.chart();
 */

export const skeleton = {
  text(width = "100%", height = 12) {
    return `<div class="sk sk-text" style="width:${width};height:${height}px"></div>`;
  },
  title() { return '<div class="sk sk-title"></div>'; },
  heading() { return '<div class="sk sk-heading"></div>'; },
  avatar(size = 40) {
    return `<div class="sk sk-avatar" style="width:${size}px;height:${size}px"></div>`;
  },
  block(height = 60) {
    return `<div class="sk sk-block" style="height:${height}px"></div>`;
  },
  thumb() { return '<div class="sk sk-thumb"></div>'; },

  kpi() {
    return `
      <div class="sk-kpi">
        <div class="sk sk-text sk-text--w40"></div>
        <div class="sk sk-text sk-text--xl sk-text--w60"></div>
        <div class="sk sk-text sk-text--w25"></div>
      </div>
    `;
  },
  kpiGrid(count = 4) {
    return `<div class="grid grid-kpi">${Array.from({ length: count }, () => this.kpi()).join("")}</div>`;
  },

  card() {
    return `
      <div class="sk-card">
        <div class="sk sk-title"></div>
        ${this.text("100%")}
        ${this.text("80%")}
        ${this.text("60%")}
      </div>
    `;
  },
  cardGrid(count = 3) {
    return `<div class="grid grid-3">${Array.from({ length: count }, () => this.card()).join("")}</div>`;
  },

  table(rows = 5, cols = 4) {
    const cell = '<div class="sk sk-text"></div>';
    const colsHtml = Array.from({ length: cols }, () => `<div class="sk-table__cell">${cell}</div>`).join("");
    return `
      <div class="sk-table">
        ${Array.from({ length: rows }, () => `
          <div class="sk-table__row">
            ${Array.from({ length: cols }, () => `<div class="sk-table__cell">${cell}</div>`).join("")}
          </div>
        `).join("")}
      </div>
    `;
  },

  chart(height = 200) {
    return `<div class="sk sk-chart" style="height:${height}px"></div>`;
  },

  list(rows = 4) {
    return `
      <div class="flex flex-col gap-2">
        ${Array.from({ length: rows }, () => `
          <div class="sk-row">
            <div class="sk sk-avatar"></div>
            <div class="sk-row__body">
              <div class="sk sk-text sk-text--w60"></div>
              <div class="sk sk-text sk-text--sm sk-text--w40"></div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  },
};