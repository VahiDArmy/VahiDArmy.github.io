// Parse paste text into FILE/END blocks.
//
// Format:
//   {[[FILE: path/to/file.ext]]}
//   content
//   {[[END: path/to/file.ext]]}

const FILE_RE = /^\{\[\[FILE:\s?(.+)\]\]\}$/;
const END_RE = /^\{\[\[END:\s?(.+)\]\]\}$/;

export function splitLines(text) {
  const lines = [];
  const len = text.length;
  let start = 0;
  while (start < len) {
    const nl = text.indexOf('\n', start);
    const end = nl === -1 ? len : nl;
    lines.push({ start, end, next: nl === -1 ? len : nl + 1 });
    if (nl === -1) break;
    start = end + 1;
  }
  return lines;
}

function markerPath(text, line, re) {
  let raw = text.slice(line.start, line.end);
  if (raw.charCodeAt(raw.length - 1) === 13) raw = raw.slice(0, -1);
  const match = re.exec(raw);
  return match ? match[1] : null;
}

export function parseBlocks(text) {
  const lines = splitLines(text);
  const blocks = [];
  let outsideChars = 0;
  let i = 0;
  while (i < lines.length) {
    const filePath = markerPath(text, lines[i], FILE_RE);
    if (filePath === null) {
      outsideChars += lines[i].next - lines[i].start;
      i++;
      continue;
    }
    const contentStart = lines[i].next;
    let endIndex = -1;
    let endPath = null;
    for (let j = i + 1; j < lines.length; j++) {
      const found = markerPath(text, lines[j], END_RE);
      if (found !== null) {
        endIndex = j;
        endPath = found;
        break;
      }
    }
    if (endIndex === -1) {
      blocks.push({
        path: filePath,
        content: text.slice(contentStart),
        truncated: true,
        corrupt: false,
        corruptName: null,
      });
      i = lines.length;
    } else {
      const content = text.slice(contentStart, lines[endIndex].start);
      const corrupt = endPath !== filePath;
      blocks.push({
        path: filePath,
        content,
        truncated: false,
        corrupt,
        corruptName: corrupt ? endPath : null,
      });
      i = endIndex + 1;
    }
  }
  return { blocks, outsideChars };
}

export function isValidPath(path) {
  if (!path || typeof path !== 'string') return false;
  if (path.length > 512) return false;
  if (path.includes('\0')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (path.startsWith('/')) return false;
  if (path.split(/[\\/]+/).some((seg) => seg === '..')) return false;
  return true;
}

export function countMarkers(text) {
  const fileCount = (text.match(/\{\[\[FILE:/g) || []).length;
  const endCount = (text.match(/\{\[\[END:/g) || []).length;
  return { fileCount, endCount };
}
