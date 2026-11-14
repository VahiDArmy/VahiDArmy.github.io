/**
 * معراج · i18n
 *
 * The UI is written in English; Persian is layered on top by a small runtime
 * translator instead of rewriting every template:
 *   · exact strings and `{n}` patterns are looked up in ./fa.js
 *   · sentences with inline <code>/<strong>/<em> are matched as a whole element
 *   · text nodes and placeholder/title/aria-label/alt attributes are translated
 *     as they are rendered (MutationObserver), and restored when switching back
 * Anything not in the dictionary (model names, raw provider errors, chat text)
 * is left exactly as it is.
 *
 * Persian is the default. The choice lives in local settings (instant, works
 * before sign-in) and in `meraj_profiles.preferences.language` (follows the
 * account across devices).
 */
import { FA_TEXT, FA_HTML } from './fa.js';

export const LANGUAGES = [
  { id: 'fa', name: 'فارسی', english: 'Persian', dir: 'rtl', tag: 'fa-IR', dateTag: 'fa-IR-u-nu-latn' },
  { id: 'en', name: 'English', english: 'English', dir: 'ltr', tag: 'en-US', dateTag: 'en-US' },
];
export const DEFAULT_LANGUAGE = 'fa';

const SETTINGS_KEY = 'meraj.v1.settings';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const INLINE = new Set(['CODE', 'STRONG', 'EM', 'B', 'KBD', 'I']);
/** Containers whose text is user / model content and must never be translated. */
const SKIP = 'script,style,pre,code,textarea,[data-no-i18n],.msg__body,.msg__user-wrap,.verbatim,.prompt-card__body,.md,.markdown';
const SKIP_ATTR = 'pre,[data-no-i18n],.msg__body,.msg__user-wrap,.verbatim,.prompt-card__body,.md,.markdown';

let locale = DEFAULT_LANGUAGE;
let observer = null;
let started = false;

/* ─────────────────────────── dictionary compile ─────────────────────────── */

function compile(dict) {
  const exact = new Map();
  const patterns = [];
  for (const [key, value] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(key)) {
      exact.set(key, value);
      continue;
    }
    const order = [];
    const source = key
      .split(/(\s*\{\d+\}\s*)/)
      .map((part) => {
        const match = /^\s*\{(\d+)\}\s*$/.exec(part);
        if (match) {
          order.push(match[1]);
          return '\\s*([\\s\\S]*?)\\s*';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    patterns.push({ regex: new RegExp(`^${source}$`), order, value, weight: key.replace(/\{\d+\}/g, '').length });
  }
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, patterns };
}

const TEXT = compile(FA_TEXT);
const HTML = compile(FA_HTML);

const cache = new Map();

function lookup(table, raw) {
  const cacheKey = (table === HTML ? 'h:' : 't:') + raw;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const result = lookupUncached(table, raw);
  if (cache.size > 6000) cache.clear();
  cache.set(cacheKey, result);
  return result;
}

function lookupUncached(table, raw) {
  const exact = table.exact.get(raw);
  if (exact !== undefined) return exact;
  for (const pattern of table.patterns) {
    const match = pattern.regex.exec(raw);
    if (!match) continue;
    return pattern.value.replace(/\{(\d+)\}/g, (_, n) => {
      const index = pattern.order.indexOf(n);
      if (index === -1) return '';
      const captured = match[index + 1];
      return TEXT.exact.get(captured.trim()) ?? captured; // e.g. "Today", "provider-chosen reply"
    });
  }
  return null;
}

/** Translate a plain string (document title, toasts built outside the DOM…). */
export function t(text) {
  if (locale !== 'fa' || typeof text !== 'string' || !text) return text;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const hit = lookup(TEXT, trimmed);
  return hit ? text.replace(trimmed, hit) : text;
}

function translateRaw(text) {
  const lead = /^\s*/.exec(text)[0];
  const trail = /\s*$/.exec(text)[0];
  const core = text.slice(lead.length, text.length - trail.length).replace(/\s+/g, ' ');
  if (!core || !/[A-Za-z]{2,}/.test(core)) return null;
  const hit = lookup(TEXT, core);
  return hit ? lead + hit + trail : null;
}

/* ───────────────────────────── DOM translation ───────────────────────────── */

const textState = new WeakMap(); // Text node → { orig, last }
const attrState = new WeakMap(); // Element → Map(attr → { orig, last })
const htmlState = new WeakMap(); // Element → { orig, last }

function skipped(node) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  if (!element) return true;
  return !!element.closest(`${SKIP},[data-i18n-html]`);
}

function translateText(node) {
  let state = textState.get(node);
  if (!state) {
    state = { orig: node.data, last: node.data };
    textState.set(node, state);
  } else if (node.data !== state.last) {
    state.orig = node.data; // the app wrote new text; treat it as the new source
    state.last = node.data;
  }
  if (skipped(node)) return;
  const next = locale === 'fa' ? translateRaw(state.orig) ?? state.orig : state.orig;
  if (node.data !== next) node.data = next;
  state.last = node.data;
}

function translateAttr(element, attr) {
  if (!element.hasAttribute(attr) || element.closest(SKIP_ATTR)) return;
  let map = attrState.get(element);
  if (!map) attrState.set(element, (map = new Map()));
  const value = element.getAttribute(attr);
  let state = map.get(attr);
  if (!state) {
    state = { orig: value, last: value };
    map.set(attr, state);
  } else if (value !== state.last) {
    state.orig = value;
    state.last = value;
  }
  const next = locale === 'fa' ? translateRaw(state.orig) ?? state.orig : state.orig;
  if (value !== next) element.setAttribute(attr, next);
  state.last = next;
}

const isSvg = (node) => node.nodeType === 1 && node.tagName.toLowerCase() === 'svg';

function simpleInlineParent(element) {
  if (element.hasAttribute('data-i18n-html') || element.closest(SKIP)) return false;
  let inline = 0;
  let seenContent = false;
  for (const child of element.childNodes) {
    if (isSvg(child)) {
      if (seenContent) return false; // only leading icons are supported
      continue;
    }
    if (child.nodeType === 3) {
      if (child.data.trim()) seenContent = true;
      continue;
    }
    seenContent = true;
    if (child.nodeType !== 1 || !INLINE.has(child.tagName) || child.attributes.length) return false;
    if ([...child.childNodes].some((grand) => grand.nodeType !== 3)) return false;
    inline += 1;
  }
  return inline > 0;
}

function translateInlineHtml(element) {
  if (!simpleInlineParent(element)) return;
  const icons = [...element.childNodes].filter(isSvg);
  const probe = element.cloneNode(true);
  probe.querySelectorAll(':scope > svg').forEach((node) => node.remove());
  const html = probe.innerHTML.replace(/\s+/g, ' ').trim();
  const hit = lookup(HTML, html);
  if (!hit) return;
  htmlState.set(element, { orig: element.innerHTML });
  element.setAttribute('data-i18n-html', '');
  element.innerHTML = hit;
  icons.reverse().forEach((node) => element.prepend(node));
}

function restoreInlineHtml(element) {
  const state = htmlState.get(element);
  if (state) element.innerHTML = state.orig;
  element.removeAttribute('data-i18n-html');
  htmlState.delete(element);
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateText(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;

  if (root.nodeType === 1 && locale === 'fa' && !root.hasAttribute('data-i18n-html')) {
    // element-level sentences first, so their text nodes are not split up
    if (root.querySelector('code,strong,em,b,kbd,i') || INLINE.has(root.tagName)) {
      const parents = new Set();
      if (simpleInlineParent(root)) parents.add(root);
      root.querySelectorAll('code,strong,em,b,kbd,i').forEach((node) => node.parentElement && parents.add(node.parentElement));
      parents.forEach(translateInlineHtml);
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  texts.forEach(translateText);

  if (root.nodeType === 1) translateAttrs(root);
  if (root.querySelectorAll) {
    root.querySelectorAll(ATTRS.map((attr) => `[${attr}]`).join(',')).forEach(translateAttrs);
  }
}

function translateAttrs(element) {
  for (const attr of ATTRS) translateAttr(element, attr);
}

function retranslateAll() {
  document.querySelectorAll('[data-i18n-html]').forEach(restoreInlineHtml);
  translateTree(document.body);
  translateTree(document.head?.querySelector('title') || null);
}

/* ───────────────────────────── observer ───────────────────────────── */

function handleMutations(records) {
  observer.disconnect();
  try {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1 || node.nodeType === 3) translateTree(node);
        });
      } else if (record.type === 'characterData') {
        if (record.target.nodeType === 3) translateText(record.target);
      } else if (record.type === 'attributes') {
        translateAttr(record.target, record.attributeName);
      }
    }
  } finally {
    observe();
  }
}

function observe() {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

/* ───────────────────────────── public API ───────────────────────────── */

export function normalizeLanguage(value) {
  return LANGUAGES.some((language) => language.id === value) ? value : DEFAULT_LANGUAGE;
}

export function languageInfo(id = locale) {
  return LANGUAGES.find((language) => language.id === id) || LANGUAGES[0];
}

export function getLocale() {
  return locale;
}

export function isRtl() {
  return languageInfo().dir === 'rtl';
}

/** BCP-47 tag for Intl formatting. Persian dates use the Jalali calendar with Latin digits. */
export function dateLocale() {
  return languageInfo().dateTag;
}

/** The language stored on this device, or the default. Safe before anything else loads. */
export function storedLanguage() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return normalizeLanguage(settings?.language);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function applyDocument() {
  const info = languageInfo();
  const root = document.documentElement;
  root.lang = info.id;
  root.dir = info.dir;
  root.dataset.lang = info.id;
}

/** Switch language live (no reload). Persisting is the caller's job. */
export function setLocale(next) {
  const id = normalizeLanguage(next);
  const changed = id !== locale;
  locale = id;
  applyDocument();
  if (started) {
    observer.disconnect();
    try {
      retranslateAll();
    } finally {
      observe();
    }
  }
  if (changed) window.dispatchEvent(new CustomEvent('meraj:language', { detail: { language: id, dir: languageInfo().dir } }));
  return id;
}

export function initI18n(language = storedLanguage()) {
  locale = normalizeLanguage(language);
  applyDocument();
  if (started) return locale;
  started = true;
  observer = new MutationObserver(handleMutations);
  retranslateAll();
  observe();
  return locale;
}
