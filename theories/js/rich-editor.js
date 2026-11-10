import { icon } from "./icons.js";
import { escapeHtml, sanitizeHtml, wordCount, readingTime } from "./utils.js";

export class RichEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.value = options.initialHtml || "";
    this.onChange = options.onChange || (() => {});
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="rich-editor">
        <div class="rich-editor__toolbar" role="toolbar" aria-label="ابزارهای ویرایش متن">
          <select class="rich-editor__select" data-block-select aria-label="سطح عنوان">
            <option value="p">متن</option>
            <option value="h1">عنوان ۱</option>
            <option value="h2">عنوان ۲</option>
            <option value="h3">عنوان ۳</option>
            <option value="h4">عنوان ۴</option>
            <option value="blockquote">نقل‌قول</option>
            <option value="pre">کد</option>
          </select>
          <span class="rich-editor__sep"></span>
          <button class="rich-editor__tool" type="button" data-cmd="bold" data-tooltip="درشت">${icon("bold", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="italic" data-tooltip="کج">${icon("italic", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="underline" data-tooltip="زیرخط">${icon("underline", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="strikeThrough" data-tooltip="خط‌خورده">${icon("strike", 16)}</button>
          <span class="rich-editor__sep"></span>
          <button class="rich-editor__tool" type="button" data-cmd="insertUnorderedList" data-tooltip="فهرست">${icon("list", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="insertOrderedList" data-tooltip="فهرست شماره‌دار">${icon("list-ordered", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="blockquote" data-tooltip="نقل‌قول">${icon("quote", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="code" data-tooltip="قطعه کد">${icon("type", 16)}</button>
          <span class="rich-editor__sep"></span>
          <button class="rich-editor__tool" type="button" data-cmd="link" data-tooltip="پیوند">${icon("link2", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="image" data-tooltip="تصویر">${icon("image", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="hr" data-tooltip="جداکننده">${icon("minus", 16)}</button>
          <span class="rich-editor__sep"></span>
          <button class="rich-editor__tool" type="button" data-cmd="undo" data-tooltip="بازگشت">${icon("undo", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="redo" data-tooltip="جلو رفتن">${icon("redo", 16)}</button>
          <button class="rich-editor__tool" type="button" data-cmd="removeFormat" data-tooltip="حذف قالب">${icon("x", 16)}</button>
        </div>
        <div class="rich-editor__area prose" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="${escapeHtml(this.options.placeholder || "داستان نظریه‌ات را بنویس…")}"></div>
        <div class="rich-editor__footer">
          <div class="rich-editor__stats">
            <span data-word-count>۰ واژه</span>
            <span data-reading-time>۱ دقیقه</span>
          </div>
          <span class="rich-editor__saved" data-save-status>${icon("check", 12)} آماده</span>
        </div>
      </div>
    `;

    this.area = this.container.querySelector(".rich-editor__area");
    this.area.innerHTML = this.value;
    this.bind();
    this.updateStats();
  }

  bind() {
    this.container.querySelectorAll("[data-cmd]").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => this.exec(button.dataset.cmd));
    });

    this.container.querySelector("[data-block-select]")?.addEventListener("change", (event) => {
      this.area.focus();
      document.execCommand("formatBlock", false, event.target.value);
      this.emit();
    });

    this.area.addEventListener("input", () => this.emit());
    this.area.addEventListener("paste", (event) => this.handlePaste(event));
    this.area.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        document.execCommand("insertText", false, "    ");
      }
    });
  }

  handlePaste(event) {
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain");
    if (html) {
      event.preventDefault();
      document.execCommand("insertHTML", false, sanitizeHtml(html));
      this.emit();
    } else if (text) {
      event.preventDefault();
      document.execCommand("insertText", false, text);
      this.emit();
    }
  }

  exec(command) {
    this.area.focus();
    if (command === "link") {
      const url = window.prompt("نشانی پیوند را وارد کنید:", "https://");
      if (url) document.execCommand("createLink", false, url);
    } else if (command === "image") {
      const url = window.prompt("نشانی تصویر را وارد کنید:", "https://");
      if (url) document.execCommand("insertImage", false, url);
    } else if (command === "hr") {
      document.execCommand("insertHorizontalRule", false);
    } else if (command === "blockquote") {
      document.execCommand("formatBlock", false, "blockquote");
    } else if (command === "code") {
      document.execCommand("formatBlock", false, "pre");
    } else {
      document.execCommand(command, false);
    }
    this.emit();
  }

  emit() {
    this.value = sanitizeHtml(this.area.innerHTML);
    this.updateStats();
    this.onChange(this.value);
  }

  updateStats() {
    const words = wordCount(this.area.innerHTML);
    const minutes = readingTime(this.area.innerHTML);
    const wordNode = this.container.querySelector("[data-word-count]");
    const timeNode = this.container.querySelector("[data-reading-time]");
    if (wordNode) wordNode.textContent = `${new Intl.NumberFormat("fa-IR").format(words)} واژه`;
    if (timeNode) timeNode.textContent = `${new Intl.NumberFormat("fa-IR").format(minutes)} دقیقه`;
  }

  setSaveStatus(status, label) {
    const node = this.container.querySelector("[data-save-status]");
    if (!node) return;
    node.className = `rich-editor__saved is-${status}`;
    node.innerHTML = `${icon(status === "saved" ? "check-circle" : status === "error" ? "alert" : "cloud", 12)} ${escapeHtml(label)}`;
  }

  getHTML() {
    return sanitizeHtml(this.area.innerHTML);
  }

  setHTML(html = "") {
    this.value = sanitizeHtml(html);
    this.area.innerHTML = this.value;
    this.updateStats();
  }

  isEmpty() {
    return !this.area.textContent.trim() && !this.area.querySelector("img, iframe, hr");
  }
}
