import { icon } from "./icons.js";
import { LINE_COLORS } from "./config.js";
import { normalizeLinePicture } from "./components.js";
import { uid } from "./utils.js";

function pathFromPoints(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export class LineEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.onChange = options.onChange || (() => {});
    this.color = LINE_COLORS[0];
    this.width = 4;
    this.lines = [];
    this.history = [];
    this.current = null;
    this.drawing = false;
    this.setData(options.initialData);
    this.render();
  }

  setData(data) {
    const normalized = normalizeLinePicture(data);
    this.lines = normalized.lines.map((line) => ({ ...line, id: uid("line") }));
  }

  getData() {
    return {
      version: 1,
      lines: this.lines.map((line) => ({
        color: line.color,
        width: line.width,
        points: line.points,
      })),
    };
  }

  render() {
    this.container.innerHTML = `
      <div class="line-editor">
        <div class="line-editor__tools">
          ${LINE_COLORS.map(
            (color) =>
              `<button class="color-swatch ${color === this.color ? "is-active" : ""}" type="button" style="background:${color}" data-color="${color}" aria-label="رنگ خط"></button>`
          ).join("")}
          <span class="rich-editor__sep"></span>
          <label class="kbd-row" style="gap:.35rem">
            <span>ضخامت</span>
            <input type="range" min="1" max="12" value="${this.width}" data-width style="width:5rem">
          </label>
          <span class="rich-editor__sep"></span>
          <button class="icon-btn icon-btn--sm" type="button" data-line-undo aria-label="بازگشت">${icon("undo", 15)}</button>
          <button class="icon-btn icon-btn--sm" type="button" data-line-clear aria-label="پاک‌کردن همه">${icon("trash", 15)}</button>
        </div>
        <div class="line-editor__canvas-wrap">
          <svg class="line-editor__canvas" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" aria-label="بوم خط تصویری">
            <g data-line-layer></g>
            <g data-draft-layer></g>
          </svg>
        </div>
        <div class="line-editor__hint">با کشیدن نشانگر روی بوم، خط بسازید. هر خط می‌تواند رنگ و ضخامت خودش را داشته باشد.</div>
      </div>
    `;
    this.svg = this.container.querySelector(".line-editor__canvas");
    this.layer = this.container.querySelector("[data-line-layer]");
    this.draftLayer = this.container.querySelector("[data-draft-layer]");
    this.bind();
    this.renderLines();
  }

  bind() {
    this.container.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        this.color = button.dataset.color;
        this.container.querySelectorAll("[data-color]").forEach((node) => node.classList.remove("is-active"));
        button.classList.add("is-active");
      });
    });

    this.container.querySelector("[data-width]")?.addEventListener("input", (event) => {
      this.width = Number(event.target.value);
    });

    this.container.querySelector("[data-line-undo]")?.addEventListener("click", () => this.undo());
    this.container.querySelector("[data-line-clear]")?.addEventListener("click", () => this.clear());

    this.svg.addEventListener("pointerdown", (event) => this.start(event));
    this.svg.addEventListener("pointermove", (event) => this.move(event));
    this.svg.addEventListener("pointerup", (event) => this.end(event));
    this.svg.addEventListener("pointercancel", (event) => this.end(event));
    this.svg.addEventListener("pointerleave", (event) => {
      if (this.drawing) this.end(event);
    });
  }

  pointFromEvent(event) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 1000 * 10) / 10,
      y: Math.round(((event.clientY - rect.top) / rect.height) * 600 * 10) / 10,
    };
  }

  start(event) {
    event.preventDefault();
    this.pushHistory();
    this.drawing = true;
    this.current = {
      id: uid("line"),
      color: this.color,
      width: this.width,
      points: [this.pointFromEvent(event)],
    };
    this.svg.setPointerCapture?.(event.pointerId);
    this.renderDraft();
  }

  move(event) {
    if (!this.drawing || !this.current) return;
    event.preventDefault();
    const point = this.pointFromEvent(event);
    const last = this.current.points[this.current.points.length - 1];
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (distance < 3) return;
    this.current.points.push(point);
    this.renderDraft();
  }

  end(event) {
    if (!this.drawing || !this.current) return;
    if (event?.pointerId !== undefined) this.svg.releasePointerCapture?.(event.pointerId);
    this.drawing = false;
    if (this.current.points.length) {
      this.lines.push(this.current);
      this.current = null;
      this.renderLines();
      this.emit();
    }
    this.draftLayer.innerHTML = "";
  }

  pushHistory() {
    this.history.push(this.lines.map((line) => ({ ...line, points: line.points.map((p) => ({ ...p })) })));
    if (this.history.length > 40) this.history.shift();
  }

  undo() {
    if (!this.history.length) return;
    this.lines = this.history.pop();
    this.renderLines();
    this.emit();
  }

  clear() {
    if (!this.lines.length) return;
    this.pushHistory();
    this.lines = [];
    this.renderLines();
    this.emit();
  }

  renderLines() {
    this.layer.innerHTML = this.lines
      .map(
        (line) =>
          `<path d="${pathFromPoints(line.points)}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join("");
  }

  renderDraft() {
    if (!this.current) return;
    this.draftLayer.innerHTML = `<path d="${pathFromPoints(this.current.points)}" fill="none" stroke="${this.current.color}" stroke-width="${this.current.width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.72"/>`;
  }

  emit() {
    this.onChange(this.getData());
  }
}
