/* Dev check: syntax + import/export graph. Not shipped to the browser.
   Usage: node tools/check.mjs                                            */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'tools' || name === 'node_modules') continue;
      walk(p);
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) files.push(p);
  }
})(root);

let errors = 0;
const tmp = mkdtempSync(join(tmpdir(), 'fmc-'));

/* 1. syntax */
for (const f of files) {
  const copy = join(tmp, f.replace(root, '').replace(/[\\/]/g, '_') + '.mjs');
  writeFileSync(copy, readFileSync(f));
  try {
    execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });
  } catch (e) {
    errors++;
    console.log(`SYNTAX  ${f.replace(root + '/', '')}\n${e.stderr?.toString().split('\n').slice(0, 5).join('\n')}`);
  }
}

/* 2. import graph */
const exportsOf = new Map();
const importsOf = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((part) => {
      const bits = part.trim().split(/\s+as\s+/);
      if (bits.length) names.add((bits[1] || bits[0]).trim());
    });
  }
  exportsOf.set(f, names);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(f), spec);
    importsOf.push({
      file: f,
      spec,
      target,
      names: m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean),
    });
  }
}
for (const imp of importsOf) {
  const ex = exportsOf.get(imp.target);
  if (!ex) {
    errors++;
    console.log(`MISSING FILE  ${imp.file.replace(root + '/', '')} → ${imp.spec}`);
    continue;
  }
  for (const n of imp.names) {
    if (!ex.has(n)) {
      errors++;
      console.log(`MISSING EXPORT  ${imp.file.replace(root + '/', '')} imports "${n}" from ${imp.spec}`);
    }
  }
}

/* 3. asset references from index.html */
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)) {
  try { statSync(join(root, m[1])); } catch {
    console.log(`MISSING ASSET  index.html → ${m[1]}`);
    errors++;
  }
}

console.log(errors ? `\n${errors} problem(s)` : `\nOK — ${files.length} modules, ${importsOf.length} import statements, 0 problems`);
process.exit(errors ? 1 : 0);
