/**
 * Tool definitions the agent can call.
 * Every tool returns a structured result that is verified by the app,
 * never trusted solely from the model.
 *
 * Some tools need project context (memory/roadmap). The app injects
 * a ProjectContext via setProjectContext before each agent run.
 */
import * as fs from '../files/fs-adapter.js';
import { FILE_POLICY } from '../files/fs-adapter.js';
import { updateProject } from '../projects/store.js';
import { unifiedDiff, diffStats } from '../utils/diff.js';

/** @type {{ projectId: string, project: object, onProjectPatch?: (p: object) => void } | null} */
let ctx = null;

export function setProjectContext(next) {
  ctx = next;
}

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories at a path (default: project root).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path. Empty or omit for root.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text content of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a text file. Use for new files or full rewrites.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace a specific substring in a file. Prefer this over full rewrite when changing a small section.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string', description: 'Exact text to find' },
          new_string: { type: 'string', description: 'Replacement text' },
          replace_all: { type: 'boolean', description: 'Replace every occurrence (default false)' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_path',
      description: 'Delete a file or an empty directory. The app will ask the user to confirm before deleting. Do not use for routine edits.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          confirm: { type: 'boolean', description: 'Set true only after the user clearly requested deletion' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: 'Create a directory (and parents if needed).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search file contents for a substring. Returns matching paths and short snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          max_results: { type: 'integer', description: 'Default 20' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_tree',
      description: 'Return a textual summary of the project directory structure.',
      parameters: {
        type: 'object',
        properties: {
          max_depth: { type: 'integer', description: 'Default 4' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description:
        'Update the persistent project memory (purpose, architecture, constraints, known issues, next steps). ' +
        'Merge fields you provide; omit fields you do not want to change. Actual source files remain the source of truth.',
      parameters: {
        type: 'object',
        properties: {
          purpose: { type: 'string' },
          architecture: { type: 'string' },
          constraints: { type: 'array', items: { type: 'string' } },
          known_issues: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_roadmap',
      description:
        'Replace or set the project roadmap. Pass phases with tasks. ' +
        'Each task status should be one of: pending, in_progress, done, blocked, failed.',
      parameters: {
        type: 'object',
        properties: {
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      status: { type: 'string' },
                    },
                    required: ['title'],
                  },
                },
              },
              required: ['title'],
            },
          },
        },
        required: ['phases'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_files',
      description:
        'Apply multiple file writes/edits in one batch. Prefer this when changing several files for one feature. ' +
        'Each item is either {path, content} for full write or {path, old_string, new_string, replace_all?} for edit. ' +
        'Returns per-file success/failure so partial batches are visible.',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                old_string: { type: 'string' },
                new_string: { type: 'string' },
                replace_all: { type: 'boolean' },
              },
              required: ['path'],
            },
          },
        },
        required: ['files'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_memory',
      description: 'Read the current project memory and roadmap summary.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

/**
 * Execute a tool call and return a verified result object.
 * @returns {{ ok: boolean, result?: any, error?: string }}
 */

function confirmWriteIfNeeded(path, summary) {
  // Prefer project context flag; fall back to config
  let need = false;
  try {
    if (ctx?.confirmWrites) need = true;
  } catch { /* ignore */ }
  if (!need) {
    try {
      const raw = localStorage.getItem('devspace_config');
      if (raw) need = Boolean(JSON.parse(raw).confirmWrites);
    } catch { /* ignore */ }
  }
  if (!need) return true;
  const msg = `Apply write to "${path}"?\n\n${summary || ''}`.slice(0, 500);
  return typeof window !== 'undefined' ? window.confirm(msg) : false;
}

export async function executeTool(name, args = {}) {
  try {
    switch (name) {
      case 'list_files': {
        const entries = fs.listDir(args.path || '');
        return { ok: true, result: entries };
      }
      case 'read_file': {
        const content = await fs.readFile(args.path);
        if (content == null) return { ok: false, error: `File not found: ${args.path}` };
        if (content.length > FILE_POLICY.maxReadChars) {
          return {
            ok: true,
            result: content.slice(0, FILE_POLICY.maxReadChars) +
              `\n\n…[truncated: file longer than ${FILE_POLICY.maxReadChars} chars]`,
          };
        }
        return { ok: true, result: content };
      }
      case 'write_file': {
        const before = (await fs.readFile(args.path)) ?? '';
        const preview = String(args.content ?? '').slice(0, 200).replace(/\n/g, ' ');
        if (!confirmWriteIfNeeded(args.path, preview)) {
          return { ok: false, error: 'Write cancelled by user' };
        }
        await fs.writeFile(args.path, args.content);
        const written = await fs.readFile(args.path);
        if (written !== String(args.content ?? '')) {
          return { ok: false, error: 'Write verification failed — content mismatch' };
        }
        const diff = unifiedDiff(args.path, before, written);
        const stats = diffStats(before, written);
        return {
          ok: true,
          result: {
            path: args.path,
            bytes: written.length,
            created: before === '',
            stats,
            diff,
          },
        };
      }
      case 'edit_file': {
        const current = await fs.readFile(args.path);
        if (current == null) return { ok: false, error: `File not found: ${args.path}` };
        const oldStr = args.old_string;
        if (!current.includes(oldStr)) {
          return { ok: false, error: 'old_string not found in file' };
        }
        let next;
        if (args.replace_all) {
          next = current.split(oldStr).join(args.new_string);
        } else {
          next = current.replace(oldStr, args.new_string);
        }
        const preview = `Replace ${Math.min(80, oldStr.length)} chars…`;
        if (!confirmWriteIfNeeded(args.path, preview)) {
          return { ok: false, error: 'Edit cancelled by user' };
        }
        await fs.writeFile(args.path, next);
        const diff = unifiedDiff(args.path, current, next);
        const stats = diffStats(current, next);
        return { ok: true, result: { path: args.path, changed: true, stats, diff } };
      }
      case 'delete_path': {
        // Soft safeguard: refuse deleting broad roots
        const p = String(args.path || '').replace(/^\/+|\/+$/g, '');
        if (!p || p === '.' || p === '..') {
          return { ok: false, error: 'Refusing to delete project root or invalid path' };
        }
        // Explicit user confirmation for destructive ops (browser UI)
        const confirmed = args.confirm === true || args.confirmed === true;
        if (!confirmed) {
          const ok = typeof window !== 'undefined'
            ? window.confirm(`Delete "${p}"? This cannot be undone from inside DevSpace.`)
            : false;
          if (!ok) {
            return { ok: false, error: 'Delete cancelled by user (or confirm:true not provided)' };
          }
        }
        await fs.deletePath(p);
        return { ok: true, result: { deleted: p } };
      }
      case 'mkdir': {
        await fs.mkdir(args.path);
        return { ok: true, result: { created: args.path } };
      }
      case 'search_files': {
        const q = (args.query || '').toLowerCase();
        const max = args.max_results || 20;
        const hits = [];
        for (const path of fs.listAllFiles()) {
          if (hits.length >= max) break;
          const content = await fs.readFile(path);
          if (!content) continue;
          if (content.length > FILE_POLICY.maxSearchFileChars) continue;
          const idx = content.toLowerCase().indexOf(q);
          if (idx === -1) continue;
          const start = Math.max(0, idx - 40);
          const snippet = content.slice(start, start + 120).replace(/\n/g, ' ');
          hits.push({ path, snippet });
        }
        return { ok: true, result: hits };
      }
      case 'get_project_tree': {
        return { ok: true, result: fs.getTreeSummary(args.max_depth || 4) };
      }
      case 'apply_files': {
        const items = Array.isArray(args.files) ? args.files : [];
        if (!items.length) return { ok: false, error: 'files array is empty' };
        if (items.length > 30) return { ok: false, error: 'Batch limited to 30 files' };

        // One confirm for the whole batch when confirmWrites is on
        const paths = items.map((f) => f.path).filter(Boolean);
        if (!confirmWriteIfNeeded(paths.join(', '), `${items.length} file(s) in batch`)) {
          return { ok: false, error: 'Batch cancelled by user' };
        }

        const applied = [];
        const failed = [];
        for (const item of items) {
          const path = item.path;
          if (!path) {
            failed.push({ path: '?', error: 'missing path' });
            continue;
          }
          try {
            if (item.content != null && item.old_string == null) {
              const before = (await fs.readFile(path)) ?? '';
              await fs.writeFile(path, item.content);
              const written = await fs.readFile(path);
              if (written !== String(item.content)) {
                failed.push({ path, error: 'write verification failed' });
                continue;
              }
              const diff = unifiedDiff(path, before, written);
              const stats = diffStats(before, written);
              applied.push({ path, op: 'write', stats, diff: diff.slice(0, 2000) });
            } else if (item.old_string != null) {
              const current = await fs.readFile(path);
              if (current == null) {
                failed.push({ path, error: 'file not found' });
                continue;
              }
              if (!current.includes(item.old_string)) {
                failed.push({ path, error: 'old_string not found' });
                continue;
              }
              const next = item.replace_all
                ? current.split(item.old_string).join(item.new_string ?? '')
                : current.replace(item.old_string, item.new_string ?? '');
              await fs.writeFile(path, next);
              const diff = unifiedDiff(path, current, next);
              const stats = diffStats(current, next);
              applied.push({ path, op: 'edit', stats, diff: diff.slice(0, 2000) });
            } else {
              failed.push({ path, error: 'need content or old_string/new_string' });
            }
          } catch (e) {
            failed.push({ path, error: e.message || String(e) });
          }
        }

        const ok = applied.length > 0;
        return {
          ok,
          error: !ok ? (failed[0]?.error || 'batch failed') : undefined,
          result: {
            applied_count: applied.length,
            failed_count: failed.length,
            applied,
            failed,
            partial: failed.length > 0 && applied.length > 0,
          },
        };
      }
      case 'get_memory': {
        if (!ctx?.project) return { ok: false, error: 'No project context' };
        return {
          ok: true,
          result: {
            memory: ctx.project.memory || {},
            roadmap: ctx.project.roadmap || { phases: [] },
          },
        };
      }
      case 'update_memory': {
        if (!ctx?.projectId) return { ok: false, error: 'No project context' };
        const prev = ctx.project.memory || {};
        const next = { ...prev };
        for (const key of ['purpose', 'architecture', 'notes']) {
          if (args[key] != null) next[key] = String(args[key]);
        }
        for (const key of ['constraints', 'known_issues', 'next_steps']) {
          if (Array.isArray(args[key])) next[key] = args[key].map(String);
        }
        const updated = await updateProject(ctx.projectId, { memory: next });
        ctx.project = updated;
        ctx.onProjectPatch?.(updated);
        return { ok: true, result: { memory: next } };
      }
      case 'update_roadmap': {
        if (!ctx?.projectId) return { ok: false, error: 'No project context' };
        const phases = (args.phases || []).map((ph) => ({
          title: String(ph.title || 'Phase'),
          tasks: (ph.tasks || []).map((t) => ({
            title: String(t.title || ''),
            status: normalizeStatus(t.status),
          })),
        }));
        const roadmap = { phases };
        const updated = await updateProject(ctx.projectId, { roadmap });
        ctx.project = updated;
        ctx.onProjectPatch?.(updated);
        return { ok: true, result: { roadmap } };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function normalizeStatus(s) {
  const v = String(s || 'pending').toLowerCase().replace(/\s+/g, '_');
  const allowed = new Set(['pending', 'in_progress', 'done', 'blocked', 'failed']);
  return allowed.has(v) ? v : 'pending';
}
