/**
 * Minimal unified diff for text files (no external deps).
 * Returns a short, human-readable patch string.
 */

export function unifiedDiff(path, before, after, { context = 2, maxLines = 80 } = {}) {
  const a = String(before ?? '').split('\n');
  const b = String(after ?? '').split('\n');

  // LCS-based line diff (fine for typical source files)
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = []; // {type: 'eq'|'del'|'add', line}
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'eq', line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', line: a[i++] });
    } else {
      ops.push({ type: 'add', line: b[j++] });
    }
  }
  while (i < n) ops.push({ type: 'del', line: a[i++] });
  while (j < m) ops.push({ type: 'add', line: b[j++] });

  // Collapse to hunks with limited context
  const changedIdx = [];
  ops.forEach((op, idx) => {
    if (op.type !== 'eq') changedIdx.push(idx);
  });
  if (!changedIdx.length) {
    return `--- a/${path}\n+++ b/${path}\n(no textual changes)`;
  }

  const include = new Set();
  for (const idx of changedIdx) {
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) {
      include.add(k);
    }
  }

  const lines = [`--- a/${path}`, `+++ b/${path}`];
  let shown = 0;
  let gap = false;
  for (let idx = 0; idx < ops.length; idx++) {
    if (!include.has(idx)) {
      gap = true;
      continue;
    }
    if (gap) {
      lines.push('@@ … @@');
      gap = false;
    }
    const op = ops[idx];
    const prefix = op.type === 'eq' ? ' ' : op.type === 'del' ? '-' : '+';
    lines.push(prefix + op.line);
    shown++;
    if (shown >= maxLines) {
      lines.push('… (diff truncated)');
      break;
    }
  }
  return lines.join('\n');
}

/** One-line summary for activity log */
export function diffStats(before, after) {
  const a = String(before ?? '').split('\n');
  const b = String(after ?? '').split('\n');
  let add = 0;
  let del = 0;
  // rough: length delta + unique lines
  const setA = new Set(a);
  const setB = new Set(b);
  for (const line of setB) if (!setA.has(line)) add++;
  for (const line of setA) if (!setB.has(line)) del++;
  return { add, del, beforeLines: a.length, afterLines: b.length };
}
