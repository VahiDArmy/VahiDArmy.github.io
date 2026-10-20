/**
 * CSV helpers — export dynamic tables to CSV with UTF-8 BOM (so Excel shows
 * Persian characters correctly).
 */

function escapeCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number|null>>} rows
 */
export function rowsToCsv(headers, rows, { delimiter = ',' } = {}) {
  const lines = [];
  lines.push(headers.map(escapeCell).join(delimiter));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(delimiter));
  }
  return lines.join('\r\n');
}

/** Convert an object array to CSV using a header list. */
export function objectsToCsv(headers, keyOrder, objects) {
  return rowsToCsv(
    headers,
    objects.map((obj) => keyOrder.map((k) => obj[k]))
  );
}

/** Trigger a download in the browser. */
export function downloadCsv(filename, csv) {
  const withBom = '\uFEFF' + csv;
  const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

export const csv = { rowsToCsv, objectsToCsv, download: downloadCsv };
export default csv;