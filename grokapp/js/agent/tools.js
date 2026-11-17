/**
 * Tool definitions the agent can call.
 * Every tool returns a structured result that is verified by the app,
 * never trusted solely from the model.
 *
 * Some tools need project context (memory/roadmap). The app injects
 * a ProjectContext via setProjectContext before each agent run.
 */
import * as fs from '../files/fs-adapter.js';
import { updateProject } from '../projects/store.js';

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
      description: 'Delete a file or an empty directory. Prefer confirming intent with the user for important files.',
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
        if (content.length > 80_000) {
          return {
            ok: true,
            result: content.slice(0, 80_000) + '\n\n…[truncated: file longer than 80k chars]',
          };
        }
        return { ok: true, result: content };
      }
      case 'write_file': {
        await fs.writeFile(args.path, args.content);
        const written = await fs.readFile(args.path);
        if (written !== String(args.content ?? '')) {
          return { ok: false, error: 'Write verification failed — content mismatch' };
        }
        return { ok: true, result: { path: args.path, bytes: written.length } };
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
        await fs.writeFile(args.path, next);
        return { ok: true, result: { path: args.path, changed: true } };
      }
      case 'delete_path': {
        // Soft safeguard: refuse deleting broad roots
        const p = String(args.path || '').replace(/^\/+|\/+$/g, '');
        if (!p || p === '.' || p === '..') {
          return { ok: false, error: 'Refusing to delete project root or invalid path' };
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
