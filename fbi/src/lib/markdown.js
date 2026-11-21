// Markdown rendering with per-block direction detection and code enhancement.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import markdownLang from 'highlight.js/lib/languages/markdown';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import yaml from 'highlight.js/lib/languages/yaml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import plaintext from 'highlight.js/lib/languages/plaintext';
import { icon } from './icons.js';
import { copyText } from './utils.js';

const LANGS = {
  javascript, js: javascript, jsx: javascript, mjs: javascript,
  typescript, ts: typescript, tsx: typescript,
  python, py: python,
  bash, sh: bash, shell: bash, zsh: bash,
  json, jsonc: json,
  css, scss: css,
  xml, html: xml, svg: xml, vue: xml,
  sql, postgres: sql, psql: sql,
  markdown: markdownLang, md: markdownLang,
  java, kotlin: java,
  cpp, 'c++': cpp, c: cpp, objc: cpp,
  csharp, cs: csharp, 'c#': csharp,
  go, golang: go,
  rust, rs: rust,
  php,
  ruby, rb: ruby,
  yaml, yml: yaml,
  dockerfile, docker: dockerfile,
  ini, toml: ini,
  diff, patch: diff,
  text: plaintext, txt: plaintext, plaintext,
};

for (const [name, def] of Object.entries(LANGS)) {
  if (!hljs.getLanguage(name)) {
    try {
      hljs.registerLanguage(name, def);
    } catch {
      /* ignore duplicate/unsupported */
    }
  }
}

marked.setOptions({ gfm: true, breaks: true });

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd, summary';

/**
 * Render markdown to sanitized HTML and tag every block with dir="auto", so
 * each paragraph picks its own direction (Persian RTL, English LTR, or mixed).
 */
export function renderMarkdown(markdown) {
  const source = String(markdown ?? '');
  if (!source) return '';
  let html;
  try {
    html = marked.parse(source);
  } catch {
    html = `<p>${source.replaceAll('<', '&lt;')}</p>`;
  }
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'dir'],
  });
  const tpl = document.createElement('div');
  tpl.innerHTML = clean;
  for (const el of tpl.querySelectorAll(BLOCK_SELECTOR)) {
    el.setAttribute('dir', 'auto');
  }
  for (const el of tpl.querySelectorAll('pre')) {
    el.setAttribute('dir', 'ltr');
  }
  for (const a of tpl.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  return tpl.innerHTML;
}

function languageOf(code) {
  const cls = code.className || '';
  const match = cls.match(/language-([\w+#-]+)/i);
  if (match) return match[1].toLowerCase();
  return '';
}

function ensureTableWraps(root) {
  for (const table of root.querySelectorAll('.md table, table')) {
    if (table.parentElement && table.parentElement.classList.contains('table-wrap')) continue;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    table.replaceWith(wrap);
    wrap.appendChild(table);
  }
}

function enhanceCodeBlock(pre) {
  if (pre.closest('.code-block')) return;
  const code = pre.querySelector('code') || pre;
  const lang = languageOf(code);
  const block = document.createElement('div');
  block.className = 'code-block';

  const head = document.createElement('div');
  head.className = 'code-head';
  const langLabel = document.createElement('span');
  langLabel.className = 'lang';
  langLabel.textContent = lang || 'code';
  head.appendChild(langLabel);

  const actions = document.createElement('div');
  actions.className = 'code-actions';

  const wrapBtn = document.createElement('button');
  wrapBtn.type = 'button';
  wrapBtn.title = 'Toggle line wrapping';
  wrapBtn.innerHTML = icon('expand');
  wrapBtn.addEventListener('click', () => {
    block.classList.toggle('wrap');
    wrapBtn.innerHTML = block.classList.contains('wrap') ? icon('compress') : icon('expand');
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.title = 'Copy code';
  copyBtn.innerHTML = icon('copy');
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(code.textContent || '');
    if (ok) {
      copyBtn.innerHTML = icon('check');
      copyBtn.style.color = '#86efac';
      setTimeout(() => {
        copyBtn.innerHTML = icon('copy');
        copyBtn.style.color = '';
      }, 1500);
    }
  });

  actions.append(wrapBtn, copyBtn);
  head.appendChild(actions);

  pre.parentNode.insertBefore(block, pre);
  block.append(head, pre);
  pre.removeAttribute('dir');

  try {
    if (lang && hljs.getLanguage(lang)) {
      code.innerHTML = hljs.highlight(code.textContent || '', { language: lang, ignoreIllegals: true }).value;
    } else if (!code.dataset.hljs) {
      const auto = hljs.highlightAuto(code.textContent || '');
      if (auto.language) code.innerHTML = auto.value;
    }
    code.classList.add('hljs');
  } catch {
    /* highlighting is cosmetic — never break the message */
  }
}

/** Post-process rendered HTML in place: code chrome, table scroll, highlights. */
export function enhanceMarkdown(root) {
  if (!root) return;
  ensureTableWraps(root);
  for (const pre of Array.from(root.querySelectorAll('pre'))) enhanceCodeBlock(pre);
}

/** Render + enhance in one go and return a fresh element. */
export function markdownElement(markdown, className = 'md') {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = renderMarkdown(markdown);
  enhanceMarkdown(div);
  return div;
}

export function renderMarkdownInto(el, markdown) {
  if (!el) return;
  el.innerHTML = renderMarkdown(markdown);
  enhanceMarkdown(el);
}

/** Streaming-safe plain text fallback keeps partial markdown readable. */
export function plainParagraphs(text) {
  const safe = String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return safe
    .split(/\n{2,}/)
    .map((p) => `<p dir="auto">${p.replaceAll('\n', '<br>')}</p>`)
    .join('');
}
