import {
  createTheory,
  updateTheory,
  getTheoryBySlug,
  getTheoryById,
  listObjects,
  createObject,
  updateObject,
  deleteObject,
  uploadImage,
} from "../api.js";
import { navigate } from "../router.js";
import { getState } from "../store.js";
import { icon } from "../icons.js";
import { THEORY_STATUSES, OBJECT_KINDS, LINE_COLORS } from "../config.js";
import {
  escapeHtml,
  safeImageUrl,
  slugify,
  normalizeTags,
  debounce,
  isImageFile,
} from "../utils.js";
import { formatShamsiDateTime } from "../date.js";
import {
  avatar,
  objectRow,
  normalizeLinePicture,
  emptyState,
} from "../components.js";
import { RichEditor } from "../rich-editor.js";
import { LineEditor } from "../line-editor.js";
import { toast, confirmDialog, setButtonLoading } from "../ui.js";

function statusOption(status, current) {
  const meta = THEORY_STATUSES[status];
  return `<option value="${status}" ${current === status ? "selected" : ""}>${meta.label}</option>`;
}

function objectForm(object = null) {
  return `
    <div class="object-form" data-object-form>
      <div class="field">
        <label class="field__label">نوع شیء</label>
        <select class="select" name="kind">
          ${OBJECT_KINDS.map((item) => `<option value="${item.value}" ${object?.kind === item.value ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label class="field__label">عنوان</label>
        <input class="input" name="title" value="${escapeHtml(object?.title || "")}" placeholder="عنوان شیء">
      </div>
      <div class="field">
        <label class="field__label">توضیح</label>
        <textarea class="textarea" name="description" rows="2" placeholder="توضیح کوتاه">${escapeHtml(object?.description || "")}</textarea>
      </div>
      <div class="field">
        <label class="field__label">نشانی تصویر <span class="optional">(اختیاری)</span></label>
        <input class="input" name="image_url" value="${escapeHtml(object?.image_url || "")}" placeholder="https://…">
      </div>
      <div class="field">
        <label class="field__label">پیوند مرتبط <span class="optional">(اختیاری)</span></label>
        <input class="input" name="link_url" value="${escapeHtml(object?.link_url || "")}" placeholder="https://…">
      </div>
      <input type="hidden" name="object_id" value="${escapeHtml(object?.id || "")}">
      <div class="flex gap-2" style="justify-content:flex-end">
        <button class="btn btn--ghost btn--sm" type="button" data-object-cancel>انصراف</button>
        <button class="btn btn--primary btn--sm" type="button" data-object-save>${object ? "ذخیره" : "افزودن"}</button>
      </div>
    </div>
  `;
}

export async function renderEditor(ctx) {
  const state = getState();
  if (!state.user) {
    navigate(`/login?next=${encodeURIComponent(ctx.path)}`, { replace: true });
    return { html: "", skip: true };
  }

  const isEdit = ctx.path.startsWith("/edit/");
  const key = ctx.params.slug;

  let existing = null;
  if (isEdit) {
    existing = await getTheoryBySlug(key).catch(() => null);
    if (!existing) existing = await getTheoryById(key).catch(() => null);
    if (!existing) {
      return {
        layout: "app",
        title: "نظریه پیدا نشد",
        html: `<div class="container page">${emptyState({
          iconName: "alert",
          title: "نظریه پیدا نشد",
          text: "این نظریه وجود ندارد یا دسترسی نداری.",
          actions: `<a class="btn btn--primary" href="#/dashboard">بازگشت به داشبورد</a>`,
        })}</div>`,
      };
    }
    if (existing.user_id !== state.user.id) {
      return {
        layout: "app",
        title: "دسترسی نداری",
        html: `<div class="container page">${emptyState({
          iconName: "lock",
          title: "این نظریه مال تو نیست",
          text: "فقط نویسنده می‌تواند ویرایش کند.",
          actions: `<a class="btn btn--primary" href="#/dashboard">داشبورد</a>`,
        })}</div>`,
      };
    }
  }

  const objects = existing ? await listObjects(existing.id) : [];
  let currentObjects = objects;
  let draft = {
    id: existing?.id || null,
    title: existing?.title || "",
    excerpt: existing?.excerpt || "",
    content: existing?.content || "",
    status: existing?.status || "draft",
    cover_image_url: existing?.cover_image_url || "",
    tags: normalizeTags(existing?.tags || []),
    line_picture: normalizeLinePicture(existing?.line_picture),
  };

  const isPublished = existing?.status === "published";

  return {
    layout: "app",
    title: isEdit ? "ویرایش نظریه" : "نظریهٔ تازه",
    html: `
      <div class="container page editor-page page-enter">
        <div class="editor-topbar">
          <div class="editor-topbar__status">
            <span>${icon("feather", 15)} ${isEdit ? "ویرایش نظریه" : "نظریهٔ تازه"}</span>
            ${existing ? `<span class="chip">${escapeHtml(formatShamsiDateTime(existing.updated_at || existing.created_at))}</span>` : ""}
            <span class="chip" data-save-indicator>پیش‌نویس محلی</span>
          </div>
          <div class="editor-topbar__actions">
            <a class="btn btn--ghost btn--sm" href="${existing ? `#/theory/${encodeURIComponent(existing.slug || existing.id)}` : "#/dashboard"}">${icon("arrow-right", 14)} انصراف</a>
            <button class="btn btn--secondary btn--sm" type="button" data-save>${icon("save", 14)} ذخیرهٔ پیش‌نویس</button>
            <button class="btn btn--primary btn--sm" type="button" data-publish>${icon("send", 14)} ${isPublished ? "به‌روزرسانی" : "انتشار"}</button>
          </div>
        </div>

        <div class="editor-layout">
          <div class="editor-main">
            <div class="editor-title-field">
              <input class="editor-title-input" type="text" placeholder="عنوان نظریه…" value="${escapeHtml(draft.title)}" maxlength="160" data-title>
              <textarea class="editor-excerpt-input" placeholder="یک جملهٔ کوتاه دربارهٔ این نظریه…" data-excerpt maxlength="500" rows="2">${escapeHtml(draft.excerpt)}</textarea>
            </div>
            <div class="editor-cover-wrap">
              <div class="image-picker ${draft.cover_image_url ? "has-image" : ""}" data-image-picker>
                ${draft.cover_image_url ? `<img class="image-picker__preview" src="${escapeHtml(draft.cover_image_url)}" alt="کاور نظریه">` : ""}
                <div class="image-picker__inner">
                  <span class="image-picker__icon">${icon("image", 22)}</span>
                  <p class="image-picker__title">تصویر کاور نظریه</p>
                  <p class="image-picker__hint">فایل تصویری حداکثر ۸ مگابایت</p>
                </div>
                <input type="file" accept="image/*" data-image-input aria-label="انتخاب تصویر کاور">
                ${draft.cover_image_url ? `<button class="icon-btn icon-btn--sm image-picker__remove" type="button" data-image-remove>${icon("x", 14)}</button>` : ""}
              </div>
            </div>
            <div data-rich-editor></div>
          </div>

          <aside class="editor-side">
            <div class="side-card">
              <div class="side-card__head">
                <div class="side-card__title">${icon("settings", 15)} تنظیمات انتشار</div>
              </div>
              <div class="side-card__body">
                <div class="field">
                  <label class="field__label">وضعیت</label>
                  <select class="select" data-status>
                    ${statusOption("draft", draft.status)}
                    ${statusOption("published", draft.status)}
                    ${statusOption("private", draft.status)}
                  </select>
                </div>
                <div class="field">
                  <label class="field__label">برچسب‌ها <span class="optional">(با کاما جدا کن)</span></label>
                  <div class="tag-input" data-tag-input>
                    <input type="text" placeholder="مثلاً: فلسفه، ذهن، زبان" data-tag-field>
                    ${draft.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}<button class="chip__remove" type="button" data-tag-remove="${escapeHtml(tag)}" aria-label="حذف">${icon("x", 8)}</button></span>`).join("")}
                  </div>
                </div>
                <div class="editor-status-row">
                  <span class="editor-status-row__label">پس از ذخیره:</span>
                  <button class="btn btn--soft btn--sm" type="button" data-open-preview>${icon("eye", 13)} پیش‌نمایش</button>
                </div>
              </div>
            </div>

            <div class="side-card">
              <div class="side-card__head">
                <div class="side-card__title">${icon("shapes", 15)} اشیا <span class="objects-section__count" data-objects-count>${currentObjects.length}</span></div>
                <button class="icon-btn icon-btn--sm" type="button" data-object-add aria-label="افزودن شیء">${icon("plus", 14)}</button>
              </div>
              <div class="editor-objects" data-objects-list>
                ${currentObjects.length
                  ? currentObjects.map((object) => objectRow(object, { editable: true })).join("")
                  : `<div class="object-manager__empty">هنوز شیئی ثبت نشده است. با دکمهٔ + شروع کن.</div>`}
              </div>
              <div data-object-form-wrapper></div>
            </div>

            <div class="side-card">
              <div class="side-card__head">
                <div class="side-card__title">${icon("spline", 15)} خط تصویری</div>
              </div>
              <div data-line-editor></div>
            </div>

            <div class="side-card">
              <div class="side-card__head">
                <div class="side-card__title">${icon("info", 15)} راهنما</div>
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-muted);line-height:1.8">
                می‌توانی این نظریه را بدون کامل‌بودن ذخیره کنی. هر شیء و خط بعداً قابل ویرایش است.
              </p>
            </div>
          </aside>
        </div>
      </div>
    `,
    mount(root) {
      const titleInput = root.querySelector("[data-title]");
      const excerptInput = root.querySelector("[data-excerpt]");
      const statusSelect = root.querySelector("[data-status]");
      const tagField = root.querySelector("[data-tag-field]");
      const tagInputWrap = root.querySelector("[data-tag-input]");
      const imagePicker = root.querySelector("[data-image-picker]");
      const imageInput = root.querySelector("[data-image-input]");
      const imageRemove = root.querySelector("[data-image-remove]");
      const objectsList = root.querySelector("[data-objects-list]");
      const objectsCount = root.querySelector("[data-objects-count]");
      const objectFormWrapper = root.querySelector("[data-object-form-wrapper]");
      const saveIndicator = root.querySelector("[data-save-indicator]");

      const editor = new RichEditor(root.querySelector("[data-rich-editor]"), {
        initialHtml: draft.content,
        placeholder: "از یک ایدهٔ کوچک شروع کن…",
        onChange: debounce((html) => {
          draft.content = html;
          markDirty();
        }, 250),
      });

      const lineEditor = new LineEditor(root.querySelector("[data-line-editor]"), {
        initialData: draft.line_picture,
        onChange: (data) => {
          draft.line_picture = data;
          markDirty();
        },
      });

      let dirty = false;
      const markDirty = () => {
        dirty = true;
        if (saveIndicator) {
          saveIndicator.className = "chip chip--accent";
          saveIndicator.textContent = "تغییرات ذخیره نشده";
        }
      };
      const markSaved = (label = "ذخیره شده") => {
        dirty = false;
        if (saveIndicator) {
          saveIndicator.className = "chip";
          saveIndicator.textContent = label;
        }
      };

      titleInput?.addEventListener("input", markDirty);
      excerptInput?.addEventListener("input", markDirty);
      statusSelect?.addEventListener("change", markDirty);

      tagField?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === "," || event.key === "،") {
          event.preventDefault();
          const value = tagField.value.trim();
          if (!value) return;
          if (!draft.tags.includes(value)) {
            draft.tags.push(value);
            tagField.insertAdjacentHTML("beforebegin", `<span class="chip">${escapeHtml(value)}<button class="chip__remove" type="button" data-tag-remove="${escapeHtml(value)}" aria-label="حذف">${icon("x", 8)}</button></span>`);
            markDirty();
          }
          tagField.value = "";
        }
      });

      tagInputWrap?.addEventListener("click", (event) => {
        const remove = event.target.closest("[data-tag-remove]");
        if (!remove) return;
        const tag = remove.dataset.tagRemove;
        draft.tags = draft.tags.filter((item) => item !== tag);
        remove.closest(".chip")?.remove();
        markDirty();
      });

      imageInput?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!isImageFile(file)) return toast({ type: "error", title: "فایل نامعتبر", message: "فقط تصویر مجاز است." });
        try {
          toast({ type: "info", title: "بارگذاری…", duration: 2000 });
          const url = await uploadImage(file, state.user.id, "covers");
          draft.cover_image_url = url;
          imagePicker.classList.add("has-image");
          imagePicker.querySelector(".image-picker__preview")?.remove();
          imagePicker.insertAdjacentHTML("afterbegin", `<img class="image-picker__preview" src="${escapeHtml(url)}" alt="کاور">`);
          markDirty();
          toast({ type: "success", title: "بارگذاری شد" });
        } catch (error) {
          toast({ type: "error", title: "بارگذاری انجام نشد", message: error.message });
        }
      });

      imageRemove?.addEventListener("click", (event) => {
        event.stopPropagation();
        draft.cover_image_url = "";
        imagePicker.classList.remove("has-image");
        imagePicker.querySelector(".image-picker__preview")?.remove();
        markDirty();
      });

      const save = async ({ publish = false } = {}) => {
        const title = titleInput.value.trim();
        if (!title) {
          toast({ type: "error", title: "عنوان لازم است" });
          titleInput.focus();
          return;
        }
        const payload = {
          title,
          excerpt: excerptInput.value.trim(),
          content: editor.getHTML(),
          status: publish ? "published" : statusSelect.value,
          cover_image_url: draft.cover_image_url,
          tags: draft.tags,
          line_picture: lineEditor.getData(),
          user_id: state.user.id,
        };
        const saveBtn = root.querySelector("[data-save]");
        const publishBtn = root.querySelector("[data-publish]");
        try {
          setButtonLoading(publish ? publishBtn : saveBtn, true);
          if (draft.id) {
            const result = await updateTheory(draft.id, payload);
            draft.id = result.id;
            markSaved("ذخیره شد");
            toast({ type: "success", title: publish ? "منتشر شد" : "ذخیره شد" });
            if (publish) navigate(`/theory/${encodeURIComponent(result.slug || result.id)}`, { replace: true });
          } else {
            const result = await createTheory(payload);
            draft.id = result.id;
            markSaved("ساخته شد");
            toast({ type: "success", title: publish ? "منتشر شد" : "پیش‌نویس ذخیره شد" });
            if (publish) {
              navigate(`/theory/${encodeURIComponent(result.slug || result.id)}`, { replace: true });
            } else if (!isEdit) {
              navigate(`/edit/${encodeURIComponent(result.slug || result.id)}`, { replace: true });
            }
          }
        } catch (error) {
          toast({ type: "error", title: "ذخیره انجام نشد", message: error.message });
        } finally {
          setButtonLoading(publish ? publishBtn : saveBtn, false);
        }
      };

      root.querySelector("[data-save]")?.addEventListener("click", () => save({ publish: false }));
      root.querySelector("[data-publish]")?.addEventListener("click", () => save({ publish: true }));

      root.querySelector("[data-open-preview]")?.addEventListener("click", () => {
        if (draft.id) navigate(`/theory/${encodeURIComponent(existing?.slug || draft.id)}`);
        else toast({ type: "warning", title: "ابتدا ذخیره کن", message: "برای پیش‌نمایش ابتدا نظریه را ذخیره کن." });
      });

      const refreshObjects = (list) => {
        currentObjects = list;
        objectsCount.textContent = list.length;
        if (!list.length) {
          objectsList.innerHTML = `<div class="object-manager__empty">هنوز شیئی ثبت نشده است.</div>`;
        } else {
          objectsList.innerHTML = list.map((object) => objectRow(object, { editable: true })).join("");
        }
      };

      root.querySelector("[data-object-add]")?.addEventListener("click", () => {
        if (!draft.id) {
          toast({ type: "warning", title: "ابتدا ذخیره کن", message: "برای افزودن شیء باید نظریه ذخیره شود." });
          return;
        }
        objectFormWrapper.innerHTML = objectForm();
        bindObjectForm(null);
      });

      const bindObjectForm = (existing) => {
        const form = objectFormWrapper.querySelector("[data-object-form]");
        if (!form) return;
        form.querySelector("[data-object-cancel]")?.addEventListener("click", () => {
          objectFormWrapper.innerHTML = "";
        });
        form.querySelector("[data-object-save]")?.addEventListener("click", async () => {
          const data = Object.fromEntries(new FormData(form).entries());
          if (!data.title?.trim()) return toast({ type: "error", title: "عنوان شیء لازم است" });
          try {
            const payload = {
              theory_id: draft.id,
              user_id: state.user.id,
              kind: data.kind,
              title: data.title.trim(),
              description: data.description.trim(),
              image_url: data.image_url.trim(),
              link_url: data.link_url.trim(),
              position: currentObjects.length,
            };
            const saved = existing ? await updateObject(existing.id, payload) : await createObject(payload);
            if (existing) {
              currentObjects = currentObjects.map((item) => (item.id === saved.id ? saved : item));
            } else {
              currentObjects = [...currentObjects, saved];
            }
            refreshObjects(currentObjects);
            objectFormWrapper.innerHTML = "";
            toast({ type: "success", title: existing ? "ویرایش شد" : "افزوده شد" });
          } catch (error) {
            toast({ type: "error", title: "ثبت نشد", message: error.message });
          }
        });
      };

      objectsList?.addEventListener("click", async (event) => {
        const editBtn = event.target.closest("[data-object-edit]");
        const deleteBtn = event.target.closest("[data-object-delete]");
        if (editBtn) {
          const object = currentObjects.find((item) => item.id === editBtn.dataset.objectEdit);
          if (!object) return;
          objectFormWrapper.innerHTML = objectForm(object);
          bindObjectForm(object);
        }
        if (deleteBtn) {
          const id = deleteBtn.dataset.objectDelete;
          const ok = await confirmDialog({
            title: "حذف شیء؟",
            description: "این شیء از نظریه حذف می‌شود.",
            confirmText: "حذف",
            danger: true,
          });
          if (!ok) return;
          try {
            await deleteObject(id);
            refreshObjects(currentObjects.filter((item) => item.id !== id));
            toast({ type: "success", title: "حذف شد" });
          } catch (error) {
            toast({ type: "error", title: "حذف نشد", message: error.message });
          }
        }
      });

      window.addEventListener("beforeunload", (event) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      });
    },
  };
}
