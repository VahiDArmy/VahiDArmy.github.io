/* ============================================================================
   PRODUCTS PAGE
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Formatters = window.Formatters;
  const Persian = window.Persian;
  const Toast = window.Toast;
  const Modal = window.Modal;
  const DataTable = window.DataTable;
  const Pagination = window.Pagination;
  const ProductsService = window.ProductsService;
  const CategoriesService = window.CategoriesService;

  const state = {
    page: 1,
    pageSize: 20,
    search: "",
    category: "",
    status: "",
    sortBy: "created_at",
    sortDir: "desc",
    rows: [],
    total: 0,
    selected: [],
  };

  const ProductsPage = {
    async mount() {
      this.renderLayout();
      await this.load();
    },

    renderLayout() {
      const panel = Dom.id("products-panel");
      if (!panel) return;
      Dom.empty(panel);

      // Toolbar
      const toolbar = Dom.el("div", { class: "table-toolbar" });

      const search = Dom.el("div", { class: "table-toolbar__search" });
      search.innerHTML = `<i class="ri-search-line"></i>`;
      const searchInput = Dom.el("input", {
        type: "search",
        placeholder: "جستجوی نام، SKU یا توضیحات…",
        value: state.search,
      });
      searchInput.addEventListener("input", Dom.debounce(() => {
        state.search = searchInput.value;
        state.page = 1;
        this.load();
      }, 300));
      search.appendChild(searchInput);
      toolbar.appendChild(search);

      const filters = Dom.el("div", { class: "table-toolbar__filters" });
      const statusSelect = Dom.el("select", { class: "select select--sm" });
      [
        { v: "", l: "همه وضعیت‌ها" },
        { v: "active", l: "فعال" },
        { v: "inactive", l: "غیرفعال" },
        { v: "discontinued", l: "متوقف‌شده" },
      ].forEach((o) => {
        const opt = Dom.el("option", { value: o.v }, o.l);
        if (o.v === state.status) opt.selected = true;
        statusSelect.appendChild(opt);
      });
      statusSelect.addEventListener("change", () => {
        state.status = statusSelect.value;
        state.page = 1;
        this.load();
      });
      filters.appendChild(statusSelect);
      toolbar.appendChild(filters);

      toolbar.appendChild(Dom.el("div", { class: "table-toolbar__spacer" }));

      const actions = Dom.el("div", { class: "table-toolbar__actions" });
      const refreshBtn = Dom.el("button", { class: "btn btn--ghost btn--sm", type: "button" }, [
        Dom.el("i", { class: "ri-refresh-line" }),
        Dom.el("span", null, "بروزرسانی"),
      ]);
      refreshBtn.addEventListener("click", () => this.load());
      actions.appendChild(refreshBtn);
      toolbar.appendChild(actions);

      panel.appendChild(toolbar);

      // Table container
      const tableContainer = Dom.el("div", { id: "products-table" });
      panel.appendChild(tableContainer);

      // Pagination
      const pagination = Dom.el("div", { id: "products-pagination", class: "pagination" });
      panel.appendChild(pagination);
    },

    async load() {
      const tableContainer = Dom.id("products-table");
      const pagination = Dom.id("products-pagination");
      if (!tableContainer) return;

      DataTable.render(tableContainer, { loading: true });

      try {
        const res = await ProductsService.list({
          page: state.page,
          pageSize: state.pageSize,
          search: state.search,
          category: state.category,
          status: state.status,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
        });

        state.rows = res.data;
        state.total = res.count;

        DataTable.render(tableContainer, {
          columns: this.columns(),
          rows: state.rows,
          sortBy: state.sortBy,
          sortDir: state.sortDir,
          onSort: (key, dir) => {
            state.sortBy = key;
            state.sortDir = dir;
            this.load();
          },
          onRowClick: (row) => this.openForm(row),
          rowActions: (row) => [
            { icon: "ri-edit-2-line", title: "ویرایش", onClick: () => this.openForm(row) },
            { icon: "ri-delete-bin-line", title: "حذف", danger: true, onClick: () => this.deleteRow(row) },
          ],
          contextMenu: (row) => [
            { label: "ویرایش", icon: "ri-edit-2-line", onClick: () => this.openForm(row) },
            { label: "کپی SKU", icon: "ri-file-copy-line", onClick: () => {
              Dom.copy(row.sku);
              Toast.success("SKU کپی شد");
            }},
            { type: "divider" },
            { label: "حذف", icon: "ri-delete-bin-line", danger: true, onClick: () => this.deleteRow(row) },
          ],
          onSelectionChange: (ids) => { state.selected = ids; },
          emptyState: { icon: "ri-archive-2-line", title: "محصولی یافت نشد", text: "عبارت جستجو را تغییر دهید یا محصول جدید اضافه کنید." },
        });

        Pagination.render(pagination, {
          page: state.page,
          pageSize: state.pageSize,
          total: state.total,
          onChange: (p, s) => {
            state.page = p;
            state.pageSize = s;
            this.load();
          },
        });
      } catch (err) {
        console.error("[products]", err);
        Toast.error(err.message || "خطا در بارگذاری محصولات");
        DataTable.render(tableContainer, {
          columns: [], rows: [],
          emptyState: { icon: "ri-error-warning-line", title: "خطا", text: err.message || "" },
        });
      }
    },

    columns() {
      return [
        {
          key: "name", label: "محصول", sortable: true,
          render: (row) => {
            const wrap = Dom.el("div", { class: "cell-product" });
            const thumb = Dom.el("div", { class: "cell-product__thumb", style: "display:grid;place-items:center" }, [
              Dom.el("i", { class: "ri-archive-2-line", style: "color:var(--text-quaternary)" }),
            ]);
            wrap.appendChild(thumb);
            const info = Dom.el("div", { class: "cell-product__info" });
            info.appendChild(Dom.el("div", { class: "cell-product__title" }, row.name));
            info.appendChild(Dom.el("div", { class: "cell-product__sku" }, row.sku));
            wrap.appendChild(info);
            return wrap;
          },
        },
        { key: "category", label: "دسته‌بندی", sortable: true },
        {
          key: "price", label: "قیمت", sortable: true, align: "end",
          render: (row) => `<span class="cell-money">${Formatters.money(row.price)}</span>`,
        },
        {
          key: "stock", label: "موجودی", sortable: true, align: "center",
          render: (row) => {
            const low = row.stock <= (row.min_stock || 0);
            const cls = low ? "badge--warning" : (row.stock === 0 ? "badge--danger" : "badge--success");
            return `<span class="badge ${cls}">${Persian.toPersianDigits(row.stock)}</span>`;
          },
        },
        {
          key: "status", label: "وضعیت", sortable: true, align: "center",
          render: (row) => {
            const map = { active: "success", inactive: "neutral", discontinued: "danger" };
            return `<span class="badge badge--${map[row.status] || "neutral"}">${Formatters.productStatusLabel(row.status)}</span>`;
          },
        },
      ];
    },

    openForm(product = null) {
      const isEdit = !!product;
      const form = Dom.el("form", { class: "form-grid" });

      const fields = [
        { name: "name", label: "نام محصول", value: product?.name || "", required: true },
        { name: "sku", label: "SKU", value: product?.sku || "", required: true, dir: "ltr" },
        { name: "category", label: "دسته‌بندی", value: product?.category || "" },
        { name: "price", label: "قیمت فروش (تومان)", value: product?.price || 0, type: "number" },
        { name: "cost", label: "قیمت خرید (تومان)", value: product?.cost || 0, type: "number" },
        { name: "stock", label: "موجودی", value: product?.stock || 0, type: "number" },
        { name: "min_stock", label: "حداقل موجودی", value: product?.min_stock || 0, type: "number" },
        {
          name: "status", label: "وضعیت",
          value: product?.status || "active",
          type: "select",
          options: [
            { v: "active", l: "فعال" },
            { v: "inactive", l: "غیرفعال" },
            { v: "discontinued", l: "متوقف‌شده" },
          ],
        },
        { name: "description", label: "توضیحات", value: product?.description || "", full: true, type: "textarea" },
      ];

      const inputs = {};
      fields.forEach((f) => {
        const wrap = Dom.el("div", { class: `field ${f.full ? "field--full" : ""}`.trim() });
        const label = Dom.el("label", { class: "field__label" }, f.label);
        if (f.required) label.appendChild(Dom.el("span", { class: "required" }, "*"));
        wrap.appendChild(label);

        let input;
        if (f.type === "textarea") {
          input = Dom.el("textarea", { class: "input", rows: 3 });
          input.value = f.value;
        } else if (f.type === "select") {
          input = Dom.el("select", { class: "input" });
          f.options.forEach((o) => {
            const opt = Dom.el("option", { value: o.v }, o.l);
            if (o.v === f.value) opt.selected = true;
            input.appendChild(opt);
          });
        } else {
          input = Dom.el("input", { class: "input", type: f.type || "text", value: f.value });
          if (f.dir) input.style.direction = f.dir;
        }
        input.name = f.name;
        wrap.appendChild(input);
        inputs[f.name] = input;
        form.appendChild(wrap);
      });

      const instance = Modal.open({
        title: isEdit ? "ویرایش محصول" : "محصول جدید",
        icon: isEdit ? "ri-edit-2-line" : "ri-add-line",
        content: form,
        size: "lg",
        showFooter: false,
      });

      // Custom footer
      const footer = Dom.el("div", { class: "form-actions", style: "padding:16px 24px;border-top:1px solid var(--border-subtle);width:100%" });
      const cancel = Dom.el("button", { class: "btn btn--ghost", type: "button" }, "انصراف");
      cancel.addEventListener("click", () => Modal.close(instance));
      const save = Dom.el("button", { class: "btn btn--primary", type: "button" }, [
        Dom.el("i", { class: "ri-save-3-line" }),
        Dom.el("span", null, "ذخیره"),
      ]);
      save.addEventListener("click", async () => {
        const payload = {};
        Object.entries(inputs).forEach(([k, el]) => {
          payload[k] = el.type === "number" ? Number(el.value) || 0 : el.value;
        });
        if (!payload.name || !payload.sku) {
          Toast.warning("نام و SKU اجباری هستند");
          return;
        }
        save.classList.add("is-loading");
        try {
          if (isEdit) await ProductsService.update(product.id, payload);
          else await ProductsService.create(payload);
          Toast.success(isEdit ? "محصول بروزرسانی شد" : "محصول ایجاد شد");
          Modal.close(instance);
          this.load();
        } catch (err) {
          Toast.error(err.message || "خطا در ذخیره");
        } finally {
          save.classList.remove("is-loading");
        }
      });
      footer.appendChild(cancel);
      footer.appendChild(save);
      instance.panel.appendChild(footer);
    },

    async deleteRow(row) {
      const ok = await Modal.confirm({
        title: "حذف محصول",
        message: `آیا از حذف «${row.name}» اطمینان دارید؟ این عمل بازگشت‌پذیر نیست.`,
        confirmLabel: "حذف",
        tone: "danger",
        icon: "ri-delete-bin-line",
      });
      if (!ok) return;
      try {
        await ProductsService.remove(row.id);
        Toast.success("محصول حذف شد");
        this.load();
      } catch (err) {
        Toast.error(err.message || "خطا در حذف");
      }
    },
  };

  window.ProductsPage = ProductsPage;
})(window);