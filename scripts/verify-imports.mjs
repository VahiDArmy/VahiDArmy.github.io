// ---------------------------------------------------------------------------
// Verifies that every relative import resolves to a real file and that the
// names it asks for are actually exported. This catches the class of mistake
// that shows up as a blank page with one console error.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('js');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const exportsByFile = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const names = new Set();

  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default/.test(source)) names.add('default');
  exportsByFile.set(path.resolve(file), names);
}

const errors = [];
let importCount = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(process.cwd(), file);

  // Anchored to the start of a line so the word "import" in a comment
  // ("ZIP import / export") cannot be mistaken for a statement.
  for (const match of source.matchAll(/^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const clause = match[1].trim();
    const specifier = match[2];
    if (!specifier.startsWith('.')) {
      errors.push(`${relative}: bare import "${specifier}" (the browser cannot resolve it without a map)`);
      continue;
    }
    importCount += 1;
    const target = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(target)) {
      errors.push(`${relative}: module not found: ${specifier}`);
      continue;
    }
    const exported = exportsByFile.get(target);
    if (!exported) {
      errors.push(`${relative}: ${specifier} is not a JavaScript module`);
      continue;
    }

    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      for (const part of named[1].split(',')) {
        const raw = part.trim();
        if (!raw) continue;
        const name = raw.split(/\s+as\s+/)[0].trim();
        if (!exported.has(name)) {
          errors.push(`${relative}: imports "${name}" from ${specifier}, but it is not exported`);
        }
      }
    }

    const withoutNamed = clause.replace(/\{[^}]*\}/, '').replace(/^\s*,|,\s*$/g, '').trim();
    if (withoutNamed && !withoutNamed.startsWith('*') && !exported.has('default')) {
      errors.push(`${relative}: default import from ${specifier}, but it has no default export`);
    }
  }
}

// Dynamic imports used for code splitting.
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(process.cwd(), file)}: dynamic module not found: ${specifier}`);
    }
  }
}

console.log(`${files.length} modules, ${importCount} relative imports checked`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('all imports resolve and export the names they are asked for');
