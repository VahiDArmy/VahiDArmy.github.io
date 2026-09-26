/**
 * data-parser.js
 * Fail-safe numeric extraction. The design goal: whatever the user
 * pastes or uploads, pull out every usable number rather than
 * rejecting the input. Handles Persian/Arabic-Indic digits, mixed
 * delimiters, JSON of any shape, CSV/TSV with header rows and
 * multiple columns, and (when the optional SheetJS library is
 * available) .xlsx / .xls workbooks.
 *
 * Exposed on window.DataParser.
 */
(function (global) {
  'use strict';

  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function normalizeDigits(str) {
    let out = '';
    for (const ch of str) {
      const pi = PERSIAN_DIGITS.indexOf(ch);
      const ai = ARABIC_DIGITS.indexOf(ch);
      if (pi !== -1) out += String(pi);
      else if (ai !== -1) out += String(ai);
      else if (ch === '٫' || ch === '،') out += '.'; // Persian/Arabic decimal & comma variants
      else out += ch;
    }
    return out;
  }

  // Pulls every number-looking token out of a chunk of free text.
  // Accepts optional sign, decimal point, and scientific notation.
  const NUMBER_RE = /[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;

  function numbersFromText(text) {
    if (!text) return [];
    const normalized = normalizeDigits(String(text));
    const matches = normalized.match(NUMBER_RE);
    if (!matches) return [];
    return matches
      .map(Number)
      .filter(v => Number.isFinite(v));
  }

  // Recursively collects every numeric leaf out of an arbitrary
  // parsed-JSON value (numbers, and strings that parse cleanly as numbers).
  function numbersFromJsonValue(value, out) {
    if (value === null || value === undefined) return;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) out.push(value);
      return;
    }
    if (typeof value === 'string') {
      const n = Number(normalizeDigits(value.trim()));
      if (value.trim() !== '' && Number.isFinite(n)) out.push(n);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(v => numbersFromJsonValue(v, out));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(v => numbersFromJsonValue(v, out));
    }
  }

  function mode(arr) {
    const counts = new Map();
    let best = arr[0], bestCount = 0;
    arr.forEach(v => {
      const c = (counts.get(v) || 0) + 1;
      counts.set(v, c);
      if (c > bestCount) { bestCount = c; best = v; }
    });
    return best;
  }

  // Detects a CSV/TSV-like table and, when found, returns the single
  // most-numeric column (skipping obvious header rows and downweighting
  // plain 1..n index columns) instead of flattening every cell. Returns
  // null when the text doesn't look reliably tabular, so callers can
  // fall back to a generic scan.
  function extractTabularColumn(text) {
    const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return null;

    const delimiters = [',', '\t', ';', '|'];
    let best = null;
    for (const delim of delimiters) {
      const rows = lines.map(l => l.split(delim));
      const counts = rows.map(r => r.length);
      const modeCount = mode(counts);
      if (modeCount < 2) continue;
      const consistent = rows.filter(r => r.length === modeCount);
      if (consistent.length < lines.length * 0.6) continue;
      if (!best || modeCount > best.modeCount) best = { modeCount, rows: consistent };
    }
    if (!best) return null;

    const table = best.rows.map(r => r.map(c => normalizeDigits(c.trim())));
    const NUM_ONLY_RE = /^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/;
    const colStats = [];
    for (let c = 0; c < best.modeCount; c++) {
      const vals = [];
      let dataRows = 0;
      table.forEach(row => {
        const cell = row[c];
        if (cell === undefined || cell === '') return;
        dataRows++;
        if (NUM_ONLY_RE.test(cell)) vals.push(Number(cell));
      });
      const ratio = dataRows ? vals.length / dataRows : 0;
      colStats.push({ vals, ratio });
    }

    let winner = null;
    colStats.forEach(cs => {
      if (cs.ratio < 0.6 || cs.vals.length === 0) return;
      const isIndexLike = cs.vals.length > 2 && cs.vals.every((v, i) => i === 0 || v === cs.vals[i - 1] + 1);
      const score = cs.ratio * 1000 + cs.vals.length - (isIndexLike ? 500 : 0);
      if (!winner || score > winner.score) winner = { score, vals: cs.vals };
    });
    return winner ? winner.vals : null;
  }

  // Main entry point for pasted text or plain-text file contents.
  // Order of attempts: JSON (structured) -> tabular CSV/TSV (pick the
  // best data column) -> generic "grab every number-looking token".
  // Each stage only yields to the next when it can't confidently parse.
  function extractFromString(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];

    if (trimmed[0] === '{' || trimmed[0] === '[') {
      try {
        const parsed = JSON.parse(normalizeDigits(trimmed));
        const out = [];
        numbersFromJsonValue(parsed, out);
        if (out.length) return out;
      } catch (e) {
        // not valid JSON — fall through
      }
    }

    const tabular = extractTabularColumn(trimmed);
    if (tabular && tabular.length) return tabular;

    return numbersFromText(trimmed);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('خطا در خواندن فایل'));
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('خطا در خواندن فایل'));
      reader.readAsArrayBuffer(file);
    });
  }

  function extractFromWorkbookViaSheetJS(arrayBuffer) {
    const XLSX = global.XLSX;
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const out = [];
    wb.SheetNames.forEach(name => {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      rows.forEach(row => numbersFromJsonValue(row, out));
    });
    return out;
  }

  // Top-level: extract numbers from a File object of (almost) any kind.
  async function extractFromFile(file) {
    const name = (file.name || '').toLowerCase();
    const isSpreadsheet = /\.(xlsx|xls)$/.test(name);

    if (isSpreadsheet) {
      if (typeof global.XLSX === 'undefined') {
        throw new Error('پشتیبانی از فایل اکسل بارگذاری نشد؛ فایل را به‌صورت CSV یا متنی ذخیره کنید.');
      }
      const buf = await readFileAsArrayBuffer(file);
      return extractFromWorkbookViaSheetJS(buf);
    }

    const text = await readFileAsText(file);
    return extractFromString(text);
  }

  global.DataParser = {
    normalizeDigits,
    numbersFromText,
    extractFromString,
    extractFromFile
  };
})(window);
