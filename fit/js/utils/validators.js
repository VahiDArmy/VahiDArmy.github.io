/* ==========================================================================
   Utils — Validators
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  const NUMBER_RE = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

  /**
   * Validate that a value parses to a finite number.
   */
  function isNumber(v) {
    if (typeof v === 'number') return isFinite(v);
    if (typeof v !== 'string') return false;
    const s = v.trim().replace(/,/g, '');
    if (s === '') return false;
    return NUMBER_RE.test(s);
  }

  /**
   * Validate that a value is a non-empty string after trim.
   */
  function isNonEmpty(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  /**
   * Validate a number is within an inclusive range.
   */
  function inRange(v, min, max) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return false;
    if (typeof min === 'number' && n < min) return false;
    if (typeof max === 'number' && n > max) return false;
    return true;
  }

  /**
   * Validate that a value is a positive number (> 0).
   */
  function isPositive(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) && n > 0;
  }

  /**
   * Validate that a value is a non-negative number (>= 0).
   */
  function isNonNegative(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) && n >= 0;
  }

  /**
   * Validate that a value is an integer.
   */
  function isInteger(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) && Math.floor(n) === n;
  }

  /**
   * Validate that a value is an integer within range.
   */
  function isIntegerInRange(v, min, max) {
    return isInteger(v) && inRange(v, min, max);
  }

  /**
   * Validate data column for fitting — ensures enough numeric values and
   * returns { valid, xs, ys, skipped, issues[] }.
   *
   * @param {Array} rows
   * @param {string} xColId
   * @param {string} yColId
   * @param {number} minPoints
   */
  function extractFitData(rows, xColId, yColId, minPoints) {
    const issues = [];
    const xs = [];
    const ys = [];
    let skipped = 0;

    if (!xColId || !yColId) {
      issues.push('ستون‌های x و y باید انتخاب شوند.');
      return { valid: false, xs, ys, skipped, issues };
    }

    const tableColumns = App.State.getColumns();
    const xIdx = tableColumns.findIndex((c) => c.id === xColId);
    const yIdx = tableColumns.findIndex((c) => c.id === yColId);

    if (xIdx < 0) issues.push('ستون x یافت نشد.');
    if (yIdx < 0) issues.push('ستون y یافت نشد.');
    if (xIdx === yIdx) issues.push('ستون x و y نباید یکسان باشند.');
    if (issues.length) return { valid: false, xs, ys, skipped, issues };

    for (const row of rows) {
      const xRaw = row.cells[xIdx];
      const yRaw = row.cells[yIdx];
      const xNum = App.Format.parseNumber(xRaw);
      const yNum = App.Format.parseNumber(yRaw);
      if (isFinite(xNum) && isFinite(yNum)) {
        xs.push(xNum);
        ys.push(yNum);
      } else if (String(xRaw).trim() !== '' || String(yRaw).trim() !== '') {
        skipped++;
      }
    }

    const minPts = minPoints || 2;
    if (xs.length < minPts) {
      issues.push(`حداقل ${minPts} نقطهٔ داده لازم است. (موجود: ${xs.length})`);
    }
    if (skipped > 0) {
      issues.push(`${skipped} سطر به‌دلیل مقادیر نامعتبر نادیده گرفته شد.`);
    }

    return {
      valid: issues.length === 0 || xs.length >= minPts,
      xs,
      ys,
      skipped,
      issues
    };
  }

  /**
   * Validate a fit parameter value against its definition.
   */
  function validateFitParam(paramDef, value) {
    if (!paramDef) return { valid: true, value };
    if (paramDef.type === 'int') {
      const num = parseFloat(value);
      if (!isIntegerInRange(num, paramDef.min, paramDef.max)) {
        return {
          valid: false,
          message: `«${paramDef.label}» باید عدد صحیح بین ${paramDef.min} تا ${paramDef.max} باشد.`
        };
      }
      return { valid: true, value: Math.round(num) };
    }
    const num = parseFloat(value);
    if (!isFinite(num)) {
      return { valid: false, message: `«${paramDef.label}» باید عدد باشد.` };
    }
    return { valid: true, value: num };
  }

  /**
   * Check whether all values of a column are > 0.
   */
  function allPositive(values) {
    for (let i = 0; i < values.length; i++) {
      if (!(values[i] > 0)) return false;
    }
    return true;
  }

  /**
   * Check whether all x-values are > 0 (for log-based fits).
   */
  function allPositiveX(xs) {
    return allPositive(xs);
  }

  App.Validators = {
    isNumber,
    isNonEmpty,
    inRange,
    isPositive,
    isNonNegative,
    isInteger,
    isIntegerInRange,
    extractFitData,
    validateFitParam,
    allPositive,
    allPositiveX
  };
})(window);