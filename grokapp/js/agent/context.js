/**
 * Smart context packing.
 * Selects relevant file snippets for the current user message so we do not
 * dump the entire project into every model request.
 */
import * as fs from '../files/fs-adapter.js';

const STOP = new Set([
  'a','an','the','and','or','to','of','in','on','for','with','is','it','this','that',
  'be','as','at','by','from','are','was','were','will','can','could','should','would',
  'i','me','my','we','you','your','please','just','make','add','fix','create','update',
  'change','the','a','file','files','code','project','function','class','help',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Score files by path + content keyword hits.
 * Returns top snippets for the system prompt.
 */
export async function packRelevantContext(userMessage, { maxFiles = 6, maxCharsPerFile = 2500 } = {}) {
  const tokens = tokenize(userMessage);
  if (!tokens.length) {
    return { summary: '', files: [] };
  }

  const all = fs.listAllFiles();
  if (!all.length) {
    return { summary: '(no files in workspace)', files: [] };
  }

  const scored = [];
  for (const path of all) {
    let score = 0;
    const lowerPath = path.toLowerCase();
    for (const t of tokens) {
      if (lowerPath.includes(t)) score += 5;
    }
    // Lightweight content scan
    let content = null;
    try {
      content = await fs.readFile(path);
    } catch {
      continue;
    }
    if (!content) continue;
    const lower = content.toLowerCase();
    for (const t of tokens) {
      // count limited occurrences
      let idx = 0;
      let hits = 0;
      while (hits < 8) {
        const found = lower.indexOf(t, idx);
        if (found === -1) break;
        hits += 1;
        idx = found + t.length;
      }
      score += hits;
    }
    if (score > 0) scored.push({ path, score, content });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxFiles);

  const files = top.map(({ path, content, score }) => {
    let snippet = content;
    if (snippet.length > maxCharsPerFile) {
      // Prefer a window around the first keyword hit
      const lower = snippet.toLowerCase();
      let best = 0;
      for (const t of tokens) {
        const i = lower.indexOf(t);
        if (i >= 0) {
          best = i;
          break;
        }
      }
      const start = Math.max(0, best - Math.floor(maxCharsPerFile / 3));
      snippet = (start > 0 ? '…\n' : '') + snippet.slice(start, start + maxCharsPerFile) + '\n…';
    }
    return { path, score, snippet };
  });

  const summary = files.length
    ? files.map((f) => `### ${f.path}\n${f.snippet}`).join('\n\n')
    : '';

  return { summary, files, tokens };
}
