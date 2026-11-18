// ---------------------------------------------------------------------------
// Project lifecycle helpers shared by the list and the workspace.
// ---------------------------------------------------------------------------

import { repo } from './repo.js';
import { ProjectFS } from './vault.js';
import { defaultOverview } from '../agent/prompt.js';
import { extOf } from './util.js';

export async function openProject(projectId) {
  const project = await repo.getProject(projectId);
  if (!project) return null;
  const fs = new ProjectFS(projectId);
  await fs.init();
  return { project, fs };
}

export async function detectStack(files, readText) {
  const names = new Set(files.map((file) => file.path));
  const tags = new Set();

  if (names.has('package.json')) {
    try {
      const pkg = JSON.parse(await readText('package.json'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) tags.add('Next.js');
      if (deps.react) tags.add('React');
      if (deps.vue) tags.add('Vue');
      if (deps.svelte || deps['@sveltejs/kit']) tags.add('Svelte');
      if (deps.angular || deps['@angular/core']) tags.add('Angular');
      if (deps.astro) tags.add('Astro');
      if (deps.express) tags.add('Express');
      if (deps.fastify) tags.add('Fastify');
      if (deps.typescript) tags.add('TypeScript');
      if (deps.vite) tags.add('Vite');
      if (deps.webpack) tags.add('Webpack');
      if (deps.tailwindcss) tags.add('Tailwind');
      if (deps['@supabase/supabase-js']) tags.add('Supabase');
      if (deps.jest || deps.vitest || deps.mocha) tags.add('Tests');
      if (!tags.size) tags.add('Node.js');
    } catch { tags.add('Node.js'); }
  }
  if (names.has('pyproject.toml') || names.has('requirements.txt') || names.has('setup.py')) tags.add('Python');
  if (names.has('Cargo.toml')) tags.add('Rust');
  if (names.has('go.mod')) tags.add('Go');
  if (names.has('composer.json')) tags.add('PHP');
  if (names.has('Gemfile')) tags.add('Ruby');
  if (names.has('Dockerfile')) tags.add('Docker');
  if ([...names].some((name) => name.endsWith('.html')) && !tags.size) tags.add('HTML');

  const counts = new Map();
  for (const file of files) {
    const ext = extOf(file.path);
    if (!ext) continue;
    counts.set(ext, (counts.get(ext) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])
    .filter(([ext]) => ['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'php', 'java', 'swift', 'kt', 'c', 'cpp', 'cs', 'css', 'html', 'vue', 'svelte'].includes(ext))
    .slice(0, 1)
    .map(([ext]) => ({ js: 'JavaScript', jsx: 'React', ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', php: 'PHP', java: 'Java', swift: 'Swift', kt: 'Kotlin', c: 'C', cpp: 'C++', cs: 'C#', css: 'CSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte' }[ext]));

  if (!tags.size && top.length) tags.add(top[0]);
  return [...tags].slice(0, 4).join(' · ');
}

/** Refresh the cloud-side index and derived memory. Failures are non-fatal. */
export async function indexProject(project, fs) {
  const files = await fs.list();
  const bytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  let stack = project.stack || '';
  try {
    stack = await detectStack(files, async (path) => (await fs.read(path)).content);
  } catch { /* keep previous stack */ }

  try {
    await repo.updateProject(project.id, {
      file_count: files.length,
      byte_count: bytes,
      stack,
      storage_mode: fs.linkState === 'linked' ? 'directory' : 'vault',
      last_opened_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('project stats not saved', err);
  }

  try {
    await repo.saveFileIndex(project.id, files);
  } catch (err) {
    console.warn('file index not saved', err);
  }

  try {
    const memory = await repo.getMemory(project.id);
    if (!memory.overview?.content?.trim()) {
      const derived = defaultOverview({ files, stack });
      await repo.setMemory(project.id, 'overview', derived.overview, 'derived');
      if (!memory.architecture?.content?.trim()) {
        await repo.setMemory(project.id, 'architecture', derived.architecture, 'derived');
      }
    }
  } catch (err) {
    console.warn('derived memory not saved', err);
  }

  return { files, stack, bytes };
}

export async function exportProjectZip(projectId) {
  const { buildZipBlob } = await import('./zip.js');
  const fs = new ProjectFS(projectId);
  await fs.init();
  const files = await fs.list();
  const entries = [];
  for (const file of files) {
    try {
      const record = await fs.read(file.path);
      entries.push({ path: record.path, content: record.content, binary: record.binary });
    } catch { /* skip unreadable */ }
  }
  const slug = (files.length ? projectId : projectId).slice(0, 8);
  const blob = await buildZipBlob(entries, { folder: `project-${slug}` });
  return { blob, count: entries.length };
}
