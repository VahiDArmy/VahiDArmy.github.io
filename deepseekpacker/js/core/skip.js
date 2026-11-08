// Directory and file skip lists for ZIP → text conversion.

export const SKIP_DIR_SEGMENTS = [
  '.git', '.svn', '.hg', 'node_modules', '__pycache__', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', '.tox', '.venv', 'venv', 'env',
  '.idea', '.vscode', '.fleet', '.history', '.cache', '.parcel-cache',
  'dist', 'build', 'out', 'output', 'coverage', '.next', '.nuxt',
  '.svelte-kit', '.astro', 'vendor', 'target', 'bin', 'obj',
  '.gradle', '.dart_tool', '.pub-cache', 'Pods', '.terraform',
  '.serverless', '.aws-sam', 'bower_components', 'jspm_packages',
  '.yarn', '.pnpm-store', '.turbo', '.nx', 'tmp', 'temp', '.tmp',
  '__snapshots__', 'fixtures', 'test-results', 'playwright-report',
  '.nyc_output', '.scannerwork', '.parcel-cache', '.eslintcache',
];

export const SKIP_FILE_NAMES = [
  '.ds_store', 'thumbs.db', 'desktop.ini',
  '.gitignore', '.gitattributes', '.gitkeep', '.gitmodules',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json',
  'cargo.lock', 'poetry.lock', 'pipfile.lock', 'composer.lock',
  'gemfile.lock', 'go.sum', 'mix.lock', 'pubspec.lock',
  '.env', '.env.local', '.env.development', '.env.production',
  '.env.test', '.env.staging', '.envrc',
  '.editorconfig', '.prettierrc', '.prettierignore', '.eslintcache',
  '.eslintignore', '.stylelintrc', '.npmignore', '.npmrc', '.yarnrc',
  'license', 'licence', 'copyright', 'authors', 'contributors',
];

export const SKIP_FILE_PATTERNS = [
  /\.swp$/i,
  /\.swo$/i,
  /\.swx$/i,
  /\.tmp$/i,
  /\.bak$/i,
  /\.orig$/i,
  /~$/,
  /^\.#/,
  /^#.*#$/,
  /\.log$/i,
  /\.pid$/i,
  /\.DS_Store$/,
  /\.class$/i,
  /\.jar$/i,
  /\.war$/i,
  /\.ear$/i,
  /\.o$/i,
  /\.obj$/i,
  /\.so$/i,
  /\.dylib$/i,
  /\.dll$/i,
  /\.exe$/i,
  /\.pyc$/i,
  /\.pyo$/i,
  /\.pyd$/i,
  /\.map$/i,
  /\.min\.js$/i,
  /\.min\.css$/i,
];

export function shouldSkipPath(path) {
  if (!path) return true;
  if (path.endsWith('/')) return true;
  const lower = path.toLowerCase().replace(/\\/g, '/');
  const segments = lower.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    if (SKIP_DIR_SEGMENTS.includes(segments[i])) return true;
  }
  const base = segments[segments.length - 1];
  if (SKIP_FILE_NAMES.includes(base)) return true;
  for (const re of SKIP_FILE_PATTERNS) {
    if (re.test(base)) return true;
  }
  return false;
}

export function skipReason(path) {
  if (!path) return 'empty path';
  if (path.endsWith('/')) return 'directory';
  const lower = path.toLowerCase().replace(/\\/g, '/');
  const segments = lower.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    if (SKIP_DIR_SEGMENTS.includes(segments[i])) return 'noise dir: ' + segments[i];
  }
  const base = segments[segments.length - 1];
  if (SKIP_FILE_NAMES.includes(base)) return 'noise file: ' + base;
  for (const re of SKIP_FILE_PATTERNS) {
    if (re.test(base)) return 'pattern: ' + re.source;
  }
  return null;
}
