/* ============================================================================
   FILE UPLOADER COMPONENT
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const ENV = window.ENV || {};
  const Helpers = window.Helpers;

  const ICON_BY_TYPE = {
    image: "ri-image-line",
    pdf: "ri-file-pdf-2-line",
    doc: "ri-file-word-2-line",
    excel: "ri-file-excel-2-line",
    zip: "ri-file-zip-2-line",
    default: "ri-file-3-line",
  };

  function iconClass(file) {
    const mime = file.type || "";
    if (mime.startsWith("image/")) return "file-item__icon--image " + ICON_BY_TYPE.image;
    if (mime.includes("pdf")) return "file-item__icon--pdf " + ICON_BY_TYPE.pdf;
    if (mime.includes("word") || mime.includes("document")) return "file-item__icon--doc " + ICON_BY_TYPE.doc;
    if (mime.includes("sheet") || mime.includes("excel")) return "file-item__icon--excel " + ICON_BY_TYPE.excel;
    if (mime.includes("zip") || mime.includes("compressed")) return "file-item__icon--zip " + ICON_BY_TYPE.zip;
    return ICON_BY_TYPE.default;
  }

  const FileUploader = {
    create(container, options = {}) {
      if (!container) return null;
      Dom.empty(container);

      const {
        multiple = true,
        accept = (ENV.UPLOAD_ALLOWED_TYPES || []).join(","),
        maxSizeMB = ENV.UPLOAD_MAX_SIZE_MB || 8,
        onChange = null,
        onUpload = null,
        autoUpload = false,
        preview = true,
        initialFiles = [],
        label = "فایل‌ها را اینجا رها کنید یا کلیک کنید",
        sublabel = `حداکثر ${maxSizeMB} مگابایت`,
      } = options;

      const files = [];

      const wrap = Dom.el("div", { class: "uploader" });
      const drop = Dom.el("label", { class: "uploader__drop" });
      drop.innerHTML = `
        <i class="ri-cloud-upload-line uploader__drop-icon"></i>
        <span class="uploader__drop-title">${label}</span>
        <span class="uploader__drop-text">${sublabel}</span>
      `;

      const input = Dom.el("input", {
        class: "uploader__input",
        type: "file",
        accept,
        multiple: multiple ? "" : null,
      });
      drop.appendChild(input);
      wrap.appendChild(drop);

      const list = Dom.el("div", { class: "uploader__list" });
      wrap.appendChild(list);

      function renderList() {
        Dom.empty(list);
        files.forEach((item) => {
          const el = Dom.el("div", { class: "file-item" });
          const icon = Dom.el("div", { class: `file-item__icon ${iconClass(item.file)}` }, [
            Dom.el("i", { class: iconClass(item.file).split(" ").pop() }),
          ]);

          let previewEl = icon;
          if (preview && item.file.type.startsWith("image/")) {
            const img = Dom.el("img", { class: "file-item__preview", alt: item.file.name });
            img.src = URL.createObjectURL(item.file);
            previewEl = img;
          }
          el.appendChild(previewEl);

          const body = Dom.el("div", { class: "file-item__body" });
          body.appendChild(Dom.el("div", { class: "file-item__name" }, item.file.name));
          body.appendChild(
            Dom.el("div", { class: "file-item__meta" },
              `${window.Formatters.bytes(item.file.size)} · ${item.file.type || "—"}`
            )
          );
          if (item.progress != null && item.progress < 100) {
            const prog = Dom.el("div", { class: "file-item__progress" }, [
              Dom.el("span", { style: `width:${item.progress}%` }),
            ]);
            body.appendChild(prog);
          }
          el.appendChild(body);

          const actions = Dom.el("div", { class: "file-item__actions" });
          if (item.error) {
            actions.appendChild(Dom.el("span", { class: "badge badge--danger" }, item.error));
          }
          const remove = Dom.el("button", { class: "icon-btn", type: "button", title: "حذف" }, [
            Dom.el("i", { class: "ri-delete-bin-line" }),
          ]);
          remove.addEventListener("click", () => {
            const idx = files.indexOf(item);
            if (idx >= 0) files.splice(idx, 1);
            renderList();
            if (onChange) onChange(files);
          });
          actions.appendChild(remove);
          el.appendChild(actions);

          list.appendChild(el);
        });
      }

      function addFiles(fileList) {
        Array.from(fileList).forEach((f) => {
          if (!window.Validators.fileSize(f, maxSizeMB)) {
            window.Toast?.warning(`حجم فایل «${f.name}» بیش از حد مجاز است`);
            return;
          }
          if (accept && !window.Validators.fileType(f, (ENV.UPLOAD_ALLOWED_TYPES || []))) {
            window.Toast?.warning(`نوع فایل «${f.name}» پشتیبانی نمی‌شود`);
            return;
          }
          files.push({ file: f, progress: 0 });
        });
        renderList();
        if (onChange) onChange(files);
        if (autoUpload && onUpload) {
          uploadAll();
        }
      }

      async function uploadAll() {
        if (!onUpload) return;
        for (const item of files) {
          if (item.uploaded) continue;
          item.progress = 5;
          renderList();
          try {
            await onUpload(item.file, (p) => {
              item.progress = p;
              renderList();
            });
            item.progress = 100;
            item.uploaded = true;
            renderList();
          } catch (e) {
            item.error = "خطا";
            renderList();
          }
        }
      }

      input.addEventListener("change", () => {
        if (input.files?.length) addFiles(input.files);
        input.value = "";
      });

      ["dragenter", "dragover"].forEach((evt) => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          Dom.addClass(drop, "is-dragover");
        });
      });

      ["dragleave", "drop"].forEach((evt) => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          Dom.removeClass(drop, "is-dragover");
        });
      });

      drop.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt?.files?.length) addFiles(dt.files);
      });

      // Add initial files
      (initialFiles || []).forEach((f) => files.push({ file: f, progress: 100, uploaded: true }));

      renderList();
      container.appendChild(wrap);

      return {
        el: wrap,
        files,
        addFiles,
        upload: uploadAll,
        clear() {
          files.length = 0;
          renderList();
          if (onChange) onChange(files);
        },
        getFiles() {
          return files.map((f) => f.file);
        },
      };
    },
  };

  window.FileUploader = FileUploader;
})(window);