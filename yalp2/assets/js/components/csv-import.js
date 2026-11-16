/* ============================================================
   CSV import — bulk-add purchases from a CSV file
   ============================================================ */
import { el, toEnDigits, normalizeFa } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { notify } from './toast.js';
import { sb, Tables } from '../supabase.js';
import { store } from '../state.js';
import { listShops, listProducts, listPlatforms, refreshPurchases } from '../api.js';

const EXPECTED_HEADER = [
  'تاریخ', 'فروشگاه', 'دسته فروشگاه', 'محصول', 'دسته محصول',
  'واحد', 'پلتفرم', 'امتیاز', 'قیمت', 'تعداد', 'یادداشت',
];

export function openCsvImportModal() {
  return new Promise((resolve) => {
    let parsed = null;
    let fileName = '';
    let importing = false;

    const dropZone = el('div', {
      class: 'csv-drop',
      tabindex: '0',
      role: 'button',
    }, [
      el('div', { class: 'csv-drop__icon', html: icon('arrowDown', 28) }),
      el('div', { class: 'csv-drop__title', text: 'فایل CSV را اینجا رها کن' }),
      el('div', { class: 'csv-drop__desc',
        text: 'یا کلیک کن و از سیستمت انتخاب کن' }),
    ]);

    const fileInput = el('input', {
      type: 'file', accept: '.csv,text/csv', hidden: 'hidden',
    });

    const preview = el('div', { class: 'csv-preview' });

    const downloadTemplate = el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm',
      html: `${icon('external', 14)}<span>دانلود نمونهٔ فایل</span>`,
      onclick: () => downloadCsvTemplate(),
    });

    const body = el('div', { class: 'csv-import-body' }, [
      el('p', {
        style: { fontSize: 'var(--fs-sm)', color: 'var(--text-3)', lineHeight: '1.7', margin: 0 },
        text: 'فایل CSV با ستون‌های: تاریخ، فروشگاه، دسته فروشگاه، محصول، دسته محصول، واحد، پلتفرم، امتیاز، قیمت، تعداد، یادداشت.',
      }),
      downloadTemplate,
      dropZone,
      fileInput,
      preview,
    ]);

    const importBtn = el('button', {
      type: 'button', class: 'btn btn--primary btn--lg',
      html: `${icon('check', 16)}<span>شروع Import</span>`,
      disabled: 'disabled',
    });
    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--lg', text: 'بستن',
    });

    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };

    const { close } = mountModal({
      title: 'ورود خریدها از CSV',
      subtitle: 'افزودن انبوه خرید از فایل',
      size: 'lg',
      body,
      footer: [cancelBtn, importBtn],
      onClose: () => finish(false),
    });

    cancelBtn.addEventListener('click', () => { if (!importing) { finish(false); close(); } });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) handleFile(f);
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('is-drag'); });
    });
    dropZone.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    });

    async function handleFile(file) {
      if (file.size > 4 * 1024 * 1024) {
        notify.error('فایل بزرگ‌تر از ۴ مگابایت است');
        return;
      }
      fileName = file.name;
      try {
        const text = await file.text();
        const rows = parseCsv(text);
        if (!rows.length) throw new Error('فایل خالی است');
        const header = rows[0].map((c) => c.trim());
        const missing = EXPECTED_HEADER.filter((h) => !header.includes(h));
        if (missing.length && header.length < 7) {
          throw new Error(`ستون‌های ناقص: ${missing.slice(0, 3).join(', ')}`);
        }
        const idx = {};
        for (const h of EXPECTED_HEADER) idx[h] = header.indexOf(h);

        const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''));
        const records = dataRows.map((r) => ({
          date: pick(r, idx['تاریخ']),
          shop: pick(r, idx['فروشگاه']),
          shopCategory: pick(r, idx['دسته فروشگاه']),
          product: pick(r, idx['محصول']),
          productCategory: pick(r, idx['دسته محصول']),
          unit: pick(r, idx['واحد']),
          platform: pick(r, idx['پلتفرم']),
          rating: normalizeRating(pick(r, idx['امتیاز'])),
          price: parseNumber(pick(r, idx['قیمت'])),
          quantity: parseNumber(pick(r, idx['تعداد'])) || 1,
          note: pick(r, idx['یادداشت']),
        })).filter((r) => r.shop && r.product);

        if (!records.length) throw new Error('هیچ ردیف معتبری پیدا نشد');

        parsed = records;
        renderPreview();
        importBtn.disabled = false;
        dropZone.classList.add('is-loaded');
      } catch (err) {
        parsed = null;
        preview.innerHTML = '';
        preview.appendChild(el('div', { class: 'csv-error' }, [
          el('span', { html: icon('xCircle', 16) }),
          el('span', { text: String(err?.message || err) }),
        ]));
        importBtn.disabled = true;
        dropZone.classList.remove('is-loaded');
      }
    }

    function renderPreview() {
      preview.innerHTML = '';
      const validRatings = parsed.map((r) => r.rating).filter(Boolean);
      const shopsCount = new Set(parsed.map((r) => normalizeFa(r.shop))).size;
      const productsCount = new Set(parsed.map((r) => normalizeFa(r.product))).size;
      const platformsCount = new Set(parsed.map((r) => normalizeFa(r.platform)).filter(Boolean)).size;

      preview.appendChild(el('div', { class: 'csv-preview__file' }, [
        el('span', { class: 'csv-preview__file-icon', html: icon('checkCircle', 18) }),
        el('span', { class: 'csv-preview__file-name', text: fileName }),
      ]));
      preview.appendChild(el('div', { class: 'csv-preview__stats' }, [
        statBox('ردیف', parsed.length),
        statBox('فروشگاه', shopsCount),
        statBox('محصول', productsCount),
        statBox('پلتفرم', platformsCount),
      ]));
      preview.appendChild(el('div', { class: 'csv-preview__table' }, [
        el('table', { class: 'report-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'تاریخ' }),
              el('th', { text: 'فروشگاه' }),
              el('th', { text: 'محصول' }),
              el('th', { text: 'پلتفرم' }),
              el('th', { text: 'امتیاز' }),
              el('th', { text: 'قیمت' }),
            ]),
          ]),
          el('tbody', {}, parsed.slice(0, 15).map((r) => el('tr', {}, [
            el('td', { text: r.date || '—' }),
            el('td', { text: r.shop || '—' }),
            el('td', { text: r.product || '—' }),
            el('td', { text: r.platform || '—' }),
            el('td', { text: ratingLabel(r.rating) }),
            el('td', { text: r.price != null ? String(r.price) : '—' }),
          ]))),
        ]),
      ]));
      if (parsed.length > 15) {
        preview.appendChild(el('div', { class: 'csv-preview__more',
          text: `و ${parsed.length - 15} ردیف دیگر…` }));
      }
      if (validRatings.length && validRatings.length < parsed.length) {
        preview.appendChild(el('div', { class: 'csv-warn' }, [
          el('span', { html: icon('alert', 14) }),
          el('span', { text: `${parsed.length - validRatings.length} ردیف امتیاز نامعتبر دارد و «خوب» در نظر گرفته می‌شود` }),
        ]));
      }
    }

    importBtn.addEventListener('click', async () => {
      if (!parsed || importing) return;
      importing = true;
      importBtn.classList.add('is-loading');
      importBtn.disabled = true;
      cancelBtn.disabled = true;
      try {
        const result = await runImport(parsed);
        await refreshPurchases();
        const [shops, products, platforms] = await Promise.all([
          listShops(), listProducts(), listPlatforms(),
        ]);
        store.shops.set(shops);
        store.products.set(products);
        store.platforms.set(platforms);
        notify.success(`${result.purchases} خرید وارد شد · ${result.shops} فروشگاه، ${result.products} محصول جدید`);
        finish(true);
        close();
      } catch (err) {
        notify.error(err?.message || 'Import ناموفق بود');
        importing = false;
        importBtn.classList.remove('is-loading');
        importBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    });
  });
}

/* ---------- parse ---------- */

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else field += ch;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function pick(row, idx) {
  if (idx < 0 || idx == null) return '';
  return String(row[idx] ?? '').trim();
}

function parseNumber(v) {
  if (!v) return null;
  const n = Number(toEnDigits(String(v).replace(/[^\d.\-۰-۹٠-٩]/g, '')));
  return Number.isFinite(n) ? n : null;
}

function normalizeRating(v) {
  const n = normalizeFa(v || '');
  if (!n) return 'good';
  if (n === 'خوب' || n === 'good' || n === '✓') return 'good';
  if (n === 'بد' || n === 'bad' || n === '~') return 'bad';
  if (n === 'افتضاح' || n === 'shit' || n === '✕' || n === 'بدردنخور') return 'shit';
  return null;
}

function ratingLabel(r) {
  return r === 'good' ? 'خوب' : r === 'bad' ? 'بد' : r === 'shit' ? 'افتضاح' : '—';
}

function statBox(label, value) {
  return el('div', { class: 'csv-preview__stat' }, [
    el('div', { class: 'csv-preview__stat-value',
      text: String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) }),
    el('div', { class: 'csv-preview__stat-label', text: label }),
  ]);
}

/* ---------- import runner ---------- */

async function runImport(records) {
  // Build unique sets
  const shopMap = new Map();
  const productMap = new Map();
  const platformMap = new Map();

  for (const r of records) {
    const sk = normalizeFa(r.shop);
    if (sk && !shopMap.has(sk)) shopMap.set(sk, { name: r.shop, category: r.shopCategory || '' });
    const pk = normalizeFa(r.product);
    if (pk && !productMap.has(pk)) productMap.set(pk, {
      name: r.product, category: r.productCategory || '', unit: r.unit || '',
    });
    const plk = normalizeFa(r.platform);
    if (plk && !platformMap.has(plk)) platformMap.set(plk, { name: r.platform });
  }

  // Fetch existing to avoid duplicates
  const [existingShops, existingProducts, existingPlatforms] = await Promise.all([
    listShops(), listProducts(), listPlatforms(),
  ]);

  const shopIds = new Map();
  const productIds = new Map();
  const platformIds = new Map();

  for (const s of existingShops) shopIds.set(normalizeFa(s.name), s.id);
  for (const p of existingProducts) productIds.set(normalizeFa(p.name), p.id);
  for (const p of existingPlatforms) platformIds.set(normalizeFa(p.name), p.id);

  let createdShops = 0, createdProducts = 0, createdPlatforms = 0;

  // Create missing shops
  const shopsToCreate = [...shopMap.entries()].filter(([k]) => !shopIds.has(k));
  if (shopsToCreate.length) {
    const payloads = shopsToCreate.map(([, v]) => ({
      name: v.name.slice(0, 100),
      category: v.category.slice(0, 60),
      note: '',
    }));
    const { data, error } = await sb.from(Tables.shops).insert(payloads).select();
    if (error) throw new Error('فروشگاه‌ها: ' + error.message);
    for (const s of data || []) {
      shopIds.set(normalizeFa(s.name), s.id);
      createdShops++;
    }
  }

  // Create missing products
  const productsToCreate = [...productMap.entries()].filter(([k]) => !productIds.has(k));
  if (productsToCreate.length) {
    const payloads = productsToCreate.map(([, v]) => ({
      name: v.name.slice(0, 120),
      category: v.category.slice(0, 60),
      unit: v.unit.slice(0, 30),
      note: '',
    }));
    const { data, error } = await sb.from(Tables.products).insert(payloads).select();
    if (error) throw new Error('محصولات: ' + error.message);
    for (const p of data || []) {
      productIds.set(normalizeFa(p.name), p.id);
      createdProducts++;
    }
  }

  // Create missing platforms
  const platformsToCreate = [...platformMap.entries()].filter(([k]) => !platformIds.has(k));
  if (platformsToCreate.length) {
    const palette = ['#ef4056', '#ff5722', '#22c55e', '#8b5cf6', '#f59e0b', '#22d3ee', '#ec4899'];
    const payloads = platformsToCreate.map(([, v], i) => ({
      name: v.name.slice(0, 60),
      color: palette[i % palette.length],
      icon: '',
      note: '',
    }));
    const { data, error } = await sb.from(Tables.platforms).insert(payloads).select();
    if (error) throw new Error('پلتفرم‌ها: ' + error.message);
    for (const p of data || []) {
      platformIds.set(normalizeFa(p.name), p.id);
      createdPlatforms++;
    }
  }

  // Build purchase rows
  const purchaseRows = [];
  for (const r of records) {
    const shopId = shopIds.get(normalizeFa(r.shop));
    const productId = productIds.get(normalizeFa(r.product));
    const platformId = r.platform ? platformIds.get(normalizeFa(r.platform)) || null : null;
    if (!shopId || !productId) continue;
    purchaseRows.push({
      shop_id: shopId,
      product_id: productId,
      platform_id: platformId,
      rating: ['good', 'bad', 'shit'].includes(r.rating) ? r.rating : 'good',
      price: r.price,
      quantity: r.quantity || 1,
      purchased_at: normalizeDate(r.date),
      note: String(r.note || '').slice(0, 2000),
    });
  }

  // Chunk insert
  const chunk = 100;
  for (let i = 0; i < purchaseRows.length; i += chunk) {
    const { error } = await sb.from(Tables.purchases).insert(purchaseRows.slice(i, i + chunk));
    if (error) throw new Error('خریدها: ' + error.message);
  }

  return {
    shops: createdShops,
    products: createdProducts,
    platforms: createdPlatforms,
    purchases: purchaseRows.length,
  };
}

function normalizeDate(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = toEnDigits(String(v)).trim();
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  const parts = s.split(/[\/\-.]/);
  if (parts.length === 3) {
    let [a, b, c] = parts.map(Number);
    if (a < 100) a += 1400;
    if (a > 1900) {
      const d = new Date(a, b - 1, c);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } else {
      const d = new Date(a + 621, b - 1, c);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function downloadCsvTemplate() {
  const header = EXPECTED_HEADER.join(',');
  const sample = [
    '2024-11-20',
    'ساندویچی علی',
    'فست‌فود',
    'ساندویچ مرغ',
    'غذا',
    'عدد',
    'اسنپ‌فود',
    'خوب',
    '125000',
    '1',
    'خیلی تازه بود',
  ].map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',');
  const csv = '\uFEFF' + header + '\r\n' + sample;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'supermarket-yar-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
