// Validate file paths and content before adding to the pack.

import { isValidPath } from './parser.js';

const RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

const FORBIDDEN_CHARS = /[<>:"|?*\u0000-\u001f]/;

export function validatePath(path) {
  const errors = [];
  const warnings = [];

  if (!path || typeof path !== 'string') {
    return { ok: false, errors: ['Path is required'], warnings: [] };
  }
  const trimmed = path.trim();
  if (trimmed !== path) {
    warnings.push('Leading or trailing whitespace');
  }
  if (trimmed.length === 0) {
    errors.push('Path is empty');
  }
  if (trimmed.length > 512) {
    errors.push('Path exceeds 512 characters');
  }
  if (trimmed.includes('\0')) {
    errors.push('Path contains null byte');
  }
  if (/^[a-zA-Z]:/.test(trimmed)) {
    errors.push('Absolute Windows drive paths are not allowed');
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    errors.push('Absolute paths are not allowed');
  }
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) {
    errors.push('Path must point to a file, not a directory');
  }
  const segments = trimmed.split(/[\\/]+/);
  if (segments.some((s) => s === '..')) {
    errors.push('Parent directory segments (..) are not allowed');
  }
  if (segments.some((s) => s === '')) {
    errors.push('Empty path segment');
  }
  if (FORBIDDEN_CHARS.test(trimmed)) {
    errors.push('Path contains forbidden characters');
  }
  const base = segments[segments.length - 1] || '';
  const baseNoExt = base.split('.')[0].toLowerCase();
  if (RESERVED_NAMES.has(baseNoExt)) {
    warnings.push('"' + base + '" is a reserved filename on Windows');
  }
  if (!isValidPath(trimmed) && !errors.length) {
    errors.push('Path failed structural validation');
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateContent(content) {
  const errors = [];
  const warnings = [];

  if (typeof content !== 'string') {
    return { ok: false, errors: ['Content must be a string'], warnings: [] };
  }
  if (content.length === 0) {
    warnings.push('File is empty');
  }
  if (content.length > 5 * 1024 * 1024) {
    warnings.push('Content exceeds 5 MB — will be slow to render');
  }
  if (content.includes('\0')) {
    warnings.push('Content contains null bytes — may be binary');
  }
  if (/\{\[\[FILE:/.test(content) && !content.startsWith('{[[FILE:')) {
    warnings.push('Content appears to contain FILE markers');
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validatePair(path, content) {
  const p = validatePath(path);
  const c = validateContent(content);
  return {
    ok: p.ok && c.ok,
    pathOk: p.ok,
    contentOk: c.ok,
    errors: [...p.errors, ...c.errors],
    warnings: [...p.warnings, ...c.warnings],
  };
}
