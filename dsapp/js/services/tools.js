// js/services/tools.js
import { AGENT_LIMITS } from '../config.js';
import { normalizePath, dirname } from './fs.js';
import { upsertRoadmapItem, addMemory, listMemory } from './db.js';
import { createCheckpoint } from './checkpoints.js';

export function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List files and directories under a path. Use recursively for a full listing.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path, empty for root.' },
            recursive: { type: 'boolean', description: 'List all descendants.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a text file. Returns its full content.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Create or overwrite a text file. Parent directories are created. The result is verified by reading the file back.',
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
        name: 'delete_file',
        description: 'Delete a file or directory recursively. Creates a checkpoint first.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'move_file',
        description: 'Move or rename a file.',
        parameters: {
          type: 'object',
          properties: { from: { type: 'string' }, to: { type: 'string' } },
          required: ['from', 'to'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search file contents for a string or regular expression.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            path: { type: 'string' },
            regex: { type: 'boolean' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_project_structure',
        description: 'Return the full file tree with sizes.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_roadmap',
        description: 'Create or update roadmap items. Provide an array of items. Include id to update an existing item.',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  phase: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'failed'] },
                  order_index: { type: 'number' },
                },
                required: ['title'],
              },
            },
          },
          required: ['items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_memory',
        description: 'Store an important project fact, decision, constraint, or architecture note.',
        parameters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['summary', 'decision', 'constraint', 'architecture', 'note', 'task_log'] },
            content: { type: 'string' },
            importance: { type: 'number', minimum: 1, maximum: 5 },
          },
          required: ['content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_memory',
        description: 'Read project memory. Optionally filter by substring.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_checkpoint',
        description: 'Create a named checkpoint of the current project files before risky changes.',
        parameters: {
          type: 'object',
          properties: { label: { type: 'string' } },
          required: ['label'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_user',
        description: 'Ask the user a question and pause execution. Use only when genuinely blocked.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
  ];
}

function ok(data) { return { ok: true, ...data }; }
function fail(error) { return { ok: false, error: String(error?.message || error) }; }

export async function executeTool(name, args, ctx) {
  const { project, fs, task, onEvent } = ctx;
  const a = args || {};
  try {
    switch (name) {
      case 'list_files': {
        const path = normalizePath(a.path || '');
        if (a.recursive) {
          const tree = await fs.tree();
          const filtered = tree.filter((f) => !path || f.path === path || f.path.startsWith(path + '/'));
          return ok({ path, files: filtered.slice(0, 500) });
        }
        const entries = await fs.list(path);
        return ok({ path, entries });
      }
      case 'read_file': {
        const path = normalizePath(a.path);
        const content = await fs.read(path);
        const truncated = content.length > AGENT_LIMITS.maxFileReadChars;
        return ok({ path, content: truncated ? content.slice(0, AGENT_LIMITS.maxFileReadChars) : content, truncated, size: content.length });
      }
      case 'write_file': {
        const path = normalizePath(a.path);
        if (!path) return fail('Invalid path');
        const existed = await fs.exists(path);
        if (existed) await createCheckpoint(fs, project.id, `Before writing ${path}`, [path]).catch(() => {});
        const writeResult = await fs.write(path, String(a.content ?? ''));
        // Verify by reading back.
        const readBack = await fs.read(path);
        const expected = String(a.content ?? '');
        const verified = readBack === expected;
        if (!verified) {
          return fail(`Verification failed for ${path}: wrote ${expected.length} chars, read back ${readBack.length}`);
        }
        onEvent?.({ type: 'file_changed', path });
        return ok({ path, bytes: writeResult.bytes, existed, verified: true });
      }
      case 'delete_file': {
        const path = normalizePath(a.path);
        if (!path) return fail('Invalid path');
        const existed = await fs.exists(path);
        if (!existed) return ok({ path, deleted: false, note: 'Path did not exist' });
        await createCheckpoint(fs, project.id, `Before deleting ${path}`, null).catch(() => {});
        await fs.delete(path);
        const stillExists = await fs.exists(path);
        if (stillExists) return fail(`Deletion verification failed for ${path}`);
        onEvent?.({ type: 'file_changed', path });
        return ok({ path, deleted: true, verified: true });
      }
      case 'move_file': {
        const from = normalizePath(a.from);
        const to = normalizePath(a.to);
        if (!from || !to) return fail('Invalid paths');
        if (!(await fs.exists(from))) return fail(`Source not found: ${from}`);
        const content = await fs.read(from);
        await fs.write(to, content);
        await fs.delete(from);
        const toOk = await fs.exists(to);
        const fromGone = !(await fs.exists(from));
        if (!toOk || !fromGone) return fail('Move verification failed');
        onEvent?.({ type: 'file_changed', path: to });
        return ok({ from, to, verified: true });
      }
      case 'search_files': {
        const results = await fs.search(a.query, { path: a.path || '', regex: !!a.regex });
        return ok({ query: a.query, results: results.slice(0, 200) });
      }
      case 'get_project_structure': {
        const tree = await fs.tree();
        return ok({ files: tree.slice(0, 1000), total: tree.length });
      }
      case 'update_roadmap': {
        const items = Array.isArray(a.items) ? a.items : [];
        if (!items.length) return fail('No items provided');
        const saved = [];
        for (const item of items) {
          if (!item.title) continue;
          const row = await upsertRoadmapItem(project.id, item);
          saved.push(row);
        }
        return ok({ updated: saved.length, items: saved });
      }
      case 'add_memory': {
        const row = await addMemory(project.id, {
          kind: a.kind || 'note',
          content: a.content,
          importance: Math.max(1, Math.min(5, Number(a.importance) || 1)),
        });
        return ok({ id: row.id });
      }
      case 'read_memory': {
        const all = await listMemory(project.id, 300);
        const q = (a.query || '').toLowerCase();
        const filtered = q ? all.filter((m) => m.content.toLowerCase().includes(q)) : all;
        return ok({ memory: filtered.slice(0, 100) });
      }
      case 'create_checkpoint': {
        const cp = await createCheckpoint(fs, project.id, a.label || 'Checkpoint');
        return ok({ id: cp.id, label: cp.label, files: Object.keys(cp.files).length });
      }
      case 'ask_user': {
        return ok({ awaiting_user: true, question: a.question || 'The agent needs your input.' });
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return fail(err);
  }
}
