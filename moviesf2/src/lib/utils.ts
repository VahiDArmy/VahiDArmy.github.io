/** Small, dependency-free helpers shared by every layer. */

export function uid(prefix = ''): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObj && 'randomUUID' in cryptoObj) {
    return (prefix ? prefix + '_' : '') + cryptoObj.randomUUID();
  }
  return (
    (prefix ? prefix + '_' : '') +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"“”‘’]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,،|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinList(items: string[]): string {
  return Array.from(new Set(items.map((i) => i.trim()).filter(Boolean))).join(', ');
}

export function bytes(input: string): number {
  return new TextEncoder().encode(input).length;
}

/** Stable, synchronous 32-bit fingerprint (FNV-1a) for request identity. */
export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 12);
}

export function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

export function sum(items: number[]): number {
  return items.reduce((total, value) => total + value, 0);
}

export function average(items: number[]): number {
  const valid = items.filter((value) => Number.isFinite(value));
  return valid.length ? sum(valid) / valid.length : 0;
}

export function median(items: number[]): number {
  if (!items.length) return 0;
  const sorted = [...items].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let value = start; value <= end; value += 1) out.push(value);
  return out;
}

export function titleCase(input: string): string {
  return input.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function truncate(input: string, length = 120): string {
  if (input.length <= length) return input;
  return input.slice(0, Math.max(0, length - 1)).trimEnd() + '…';
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function hashHue(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 360;
  }
  return hash;
}

export function download(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
