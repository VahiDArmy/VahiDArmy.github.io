// ---------------------------------------------------------------------------
// Tools the agent can call. Each definition carries a JSON schema (used for
// native tool calling and for the prompt), a mutating flag (used for
// checkpointing and progress detection) and an implementation.
// ---------------------------------------------------------------------------

import { normalizePath, truncate, dirOf } from '../core/util.js';
import { LIMITS } from '../config.js';

const str = (description) => ({ type: 'string', description });
const obj = (properties, required = []) => ({ type: 'object', properties, required });

export const TOOLS = [
  {
    name: 'list_dir',
    description: 'List the direct children of a folder. Path "" or "." means the project root. Use this to explore unfamiliar projects.',
    mutating: false,
    parameters: obj({ path: str('Folder path relative to the project root. Omit for the root.') }),
    async run(args, ctx) {
      const scope = args.path ? normalizePath(args.path) : '';
      const files = await ctx.fs.list();
      const seen = new Set();
      const entries = [];
      const prefix = scope ? `${scope}/` : '';
      for (const file of files) {
        if (scope && file.path !== scope && !file.path.startsWith(prefix)) continue;
        const rest = scope ? file.path.slice(prefix.length) : file.path;
        if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash === -1) {
          entries.push({ name: rest, type: 'file', size: file.size });
        } else {
          const dir = rest.slice(0, slash);
          if (!seen.has(dir)) {
            seen.add(dir);
            entries.push({ name: `${dir}/`, type: 'dir' });
          }
        }
      }
      entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      return {
        path: scope || '.',
        entries: entries.slice(0, 500),
        shown: Math.min(entries.length, 500),
        total_entries: entries.length,
        project_files: files.length,
        truncated: entries.length > 500,
      };
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file. Returns the file with its total line count. Always read a file before editing it.',
    mutating: false,
    parameters: obj({
      path: str('File path relative to the project root.'),
      start_line: { type: 'integer', description: 'Optional 1-based first line.' },
      end_line: { type: 'integer', description: 'Optional last line, inclusive.' },
    }, ['path']),
    async run(args, ctx) {
      const path = normalizePath(args.path);
      const record = await ctx.fs.readText(path);
      const lines = record.content.split('\n');
      const start = Math.max(1, Number(args.start_line) || 1);
      const end = Math.min(lines.length, Number(args.end_line) || lines.length);
      if (start > lines.length) {
        return { path, total_lines: lines.length, content: '', note: `File has only ${lines.length} lines.` };
      }
      const slice = lines.slice(start - 1, end).join('\n');
      return {
        path,
        total_lines: lines.length,
        start_line: start,
        end_line: end,
        content: truncate(slice, LIMITS.maxFileReadBytes, '\n… [file truncated]'),
      };
    },
  },
  {
    name: 'write_file',
    description: 'Create a file, or replace it completely. Content must be the full file — never a fragment, never a diff.',
    mutating: true,
    parameters: obj({
      path: str('File path relative to the project root.'),
      content: str('The complete new contents of the file.'),
    }, ['path', 'content']),
    async run(args, ctx) {
      const path = normalizePath(args.path);
      if (!path) throw new Error('A file path is required.');
      let content = args.content;
      if (typeof content !== 'string') content = JSON.stringify(content, null, 2);
      if (!content.length) throw new Error('Content is empty. To create an empty file pass a single newline.');
      await ctx.journal.before(path);
      const result = await ctx.fs.write(path, content);
      if (!result.verified) {
        return {
          ok: false,
          path,
          error: 'The write could not be verified by reading the file back.',
          warning: result.warning,
        };
      }
      return {
        ok: true,
        path,
        bytes: result.size,
        target: result.target,
        verified: true,
        warning: result.warning || undefined,
      };
    },
  },
  {
    name: 'replace_in_file',
    description: 'Replace an exact substring inside a file. Use for small, surgical edits. `find` must match the file exactly, including indentation.',
    mutating: true,
    parameters: obj({
      path: str('File path relative to the project root.'),
      find: str('Exact text to replace.'),
      replace: str('Replacement text. Use an empty string to delete.'),
      all: { type: 'boolean', description: 'Replace every occurrence instead of requiring exactly one.' },
    }, ['path', 'find', 'replace']),
    async run(args, ctx) {
      const path = normalizePath(args.path);
      const find = String(args.find ?? '');
      const replace = String(args.replace ?? '');
      if (!find) throw new Error('`find` must not be empty. Use write_file to rewrite the whole file.');
      const record = await ctx.fs.readText(path);
      const haystack = record.content;
      const occurrences = haystack.split(find).length - 1;
      if (occurrences === 0) {
        return {
          ok: false,
          path,
          error: 'That text was not found in the file. Read the file again and copy the exact text, including whitespace.',
        };
      }
      if (occurrences > 1 && !args.all) {
        return {
          ok: false,
          path,
          error: `That text appears ${occurrences} times. Add more surrounding context or set "all": true.`,
        };
      }
      const next = args.all ? haystack.split(find).join(replace) : haystack.replace(find, replace);
      await ctx.journal.before(path);
      const result = await ctx.fs.write(path, next);
      return {
        ok: result.verified,
        path,
        replaced: occurrences,
        bytes: result.size,
        verified: result.verified,
        error: result.verified ? undefined : 'The edit could not be verified by reading the file back.',
      };
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a single file. Only use it when the task actually requires removing the file.',
    mutating: true,
    parameters: obj({ path: str('File path relative to the project root.') }, ['path']),
    async run(args, ctx) {
      const path = normalizePath(args.path);
      const files = await ctx.fs.list();
      const children = files.filter((f) => f.path.startsWith(`${path}/`));
      if (children.length) {
        throw new Error(`${path} is a folder containing ${children.length} file(s). Delete files individually.`);
      }
      if (!(await ctx.fs.exists(path))) return { ok: false, path, error: 'That file does not exist.' };
      await ctx.journal.before(path);
      const result = await ctx.fs.remove(path);
      const stillThere = await ctx.fs.exists(path);
      return {
        ok: !stillThere,
        path,
        deleted: !stillThere,
        error: stillThere ? 'The file still exists after deletion.' : undefined,
      };
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file. Creates parent folders as needed.',
    mutating: true,
    parameters: obj({
      from: str('Current path.'),
      to: str('New path.'),
    }, ['from', 'to']),
    async run(args, ctx) {
      const from = normalizePath(args.from);
      const to = normalizePath(args.to);
      if (from === to) throw new Error('`from` and `to` are the same path.');
      if (!(await ctx.fs.exists(from))) return { ok: false, error: `${from} does not exist.` };
      if (await ctx.fs.exists(to)) return { ok: false, error: `${to} already exists; choose another name.` };
      await ctx.journal.before(from);
      await ctx.journal.before(to);
      const result = await ctx.fs.move(from, to);
      const moved = await ctx.fs.exists(to);
      return {
        ok: moved && Boolean(result.written?.verified),
        from,
        to,
        moved,
        error: moved ? undefined : 'The file was not found at its new path afterwards.',
      };
    },
  },
  {
    name: 'search',
    description: 'Search file contents. Returns matching lines with file paths and line numbers.',
    mutating: false,
    parameters: obj({
      query: str('Text or regular expression to find.'),
      regex: { type: 'boolean', description: 'Treat query as a regular expression.' },
      path: str('Optional folder to limit the search to.'),
    }, ['query']),
    async run(args, ctx) {
      const query = String(args.query || '');
      if (!query) throw new Error('A search query is required.');
      const results = await ctx.fs.search(query, { regex: Boolean(args.regex), path: args.path || '' });
      return { query, matches: results, count: results.length, note: results.length ? undefined : 'No matches.' };
    },
  },
  {
    name: 'update_plan',
    description: 'Add or update roadmap tasks so progress is visible to the human. Use stable ids for updates.',
    mutating: false,
    parameters: obj({
      ops: {
        type: 'array',
        description: 'List of operations.',
        items: obj({
          op: { type: 'string', enum: ['add', 'update', 'done', 'block', 'remove'] },
          id: str('Task id, required for update/done/block/remove.'),
          title: str('Task title, required for add.'),
          detail: str('Optional details.'),
          phase: str('Optional phase/group name.'),
          status: { type: 'string', enum: ['todo', 'doing', 'done', 'blocked'] },
        }, ['op']),
      },
    }, ['ops']),
    async run(args, ctx) {
      if (!Array.isArray(args.ops) || !args.ops.length) throw new Error('`ops` must be a non-empty array.');
      return ctx.applyPlanOps(args.ops.slice(0, 40));
    },
  },
  {
    name: 'update_memory',
    description: 'Save durable knowledge about the project (overview, architecture, conventions, decisions, issues) so future sessions do not have to rediscover it.',
    mutating: false,
    parameters: obj({
      section: { type: 'string', enum: ['overview', 'architecture', 'conventions', 'decisions', 'issues'] },
      content: str('Markdown text. Keep it concrete and current.'),
      mode: { type: 'string', enum: ['replace', 'append'], description: 'Defaults to replace.' },
    }, ['section', 'content']),
    async run(args, ctx) {
      const section = String(args.section || '').trim();
      if (!section) throw new Error('A memory section is required.');
      return ctx.applyMemory(section, String(args.content ?? ''), args.mode === 'append' ? 'append' : 'replace');
    },
  },
  {
    name: 'ask_user',
    description: 'Stop and ask the human a question when a decision is genuinely theirs (scope, product behaviour, destructive change). Do not use it for anything you can decide yourself.',
    mutating: false,
    parameters: obj({
      question: str('A single, concrete question.'),
      options: { type: 'array', items: { type: 'string' }, description: 'Optional suggested answers.' },
    }, ['question']),
    async run(args) {
      const question = String(args.question || '').trim();
      if (!question) throw new Error('A question is required.');
      const options = Array.isArray(args.options) ? args.options.slice(0, 5).map(String) : [];
      return { blocked: true, question, options };
    },
  },
  {
    name: 'finish',
    description: 'End the task. Call this when the work is done (or when it cannot proceed), with an honest summary of what actually changed.',
    mutating: false,
    parameters: obj({
      status: { type: 'string', enum: ['completed', 'blocked'], description: 'completed when the request is satisfied.' },
      summary: str('What you actually changed, in 1-5 bullet points. Mention anything you could not do.'),
      next_steps: { type: 'array', items: { type: 'string' }, description: 'Optional follow-ups for later.' },
    }, ['status', 'summary']),
    async run(args) {
      return {
        finished: true,
        status: args.status === 'blocked' ? 'blocked' : 'completed',
        summary: String(args.summary || '').trim() || 'Task finished.',
        next_steps: Array.isArray(args.next_steps) ? args.next_steps.map(String).slice(0, 8) : [],
      };
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toolSchemas() {
  return TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function buildToolDocs() {
  const lines = [];
  for (const tool of TOOLS) {
    const props = tool.parameters.properties || {};
    const required = new Set(tool.parameters.required || []);
    const args = Object.entries(props)
      .map(([key, spec]) => {
        const kind = spec.enum ? spec.enum.join('|') : spec.type || 'any';
        return `${key}${required.has(key) ? '' : '?'}: ${kind}`;
      })
      .join(', ');
    lines.push(`- ${tool.name}(${args}) — ${tool.description}`);
  }
  return lines.join('\n');
}

function coerceArgs(tool, rawArgs) {
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? { ...rawArgs } : {};
  const props = tool.parameters.properties || {};
  const required = tool.parameters.required || [];

  // Models sometimes wrap everything in one key: {"args": {...}} handled in parse.
  for (const key of required) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      throw new Error(`Missing required argument "${key}" for ${tool.name}.`);
    }
  }
  if (props.path && typeof args.path === 'string') args.path = args.path.trim();
  if (props.path && args.path === '/') args.path = '';
  for (const key of ['find', 'query']) {
    if (props[key] && typeof args[key] !== 'string' && args[key] !== undefined) {
      args[key] = String(args[key]);
    }
  }
  if (props.replace && args.replace === undefined) args.replace = '';
  if (props.replace && typeof args.replace !== 'string') args.replace = String(args.replace);
  if (props.content && typeof args.content !== 'string') {
    args.content = JSON.stringify(args.content, null, 2);
  }
  if (props.all && typeof args.all === 'string') args.all = args.all === 'true';
  if (props.ops && !Array.isArray(args.ops)) {
    args.ops = args.ops && typeof args.ops === 'object' ? [args.ops] : [];
  }
  return args;
}

/**
 * @returns {Promise<{ok:boolean, result?:object, error?:string, finished?:boolean, blocked?:boolean}>}
 */
export async function executeTool(call, ctx) {
  const name = normalizeToolNameSafe(call.name);
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return {
      ok: false,
      error: `Unknown tool "${call.name}". Use one of: ${TOOLS.map((t) => t.name).join(', ')}.`,
    };
  }
  let args;
  try {
    args = coerceArgs(tool, call.args);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  try {
    const result = await tool.run(args, ctx) || {};
    if (result.ok === false && result.error) {
      return { ok: false, error: result.error, result, mutating: tool.mutating, args };
    }
    if (result.finished) return { ok: true, result, finished: true, args };
    if (result.blocked) return { ok: true, result, blocked: true, args };
    return { ok: true, result, mutating: tool.mutating, args };
  } catch (err) {
    return { ok: false, error: err.message || String(err), mutating: tool.mutating, args };
  }
}

function normalizeToolNameSafe(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/^functions?[./]/, '').replace(/[\s-]+/g, '_');
}

export function toolByName(name) {
  return TOOL_MAP.get(name) || null;
}

export function isMutatingName(name) {
  return Boolean(TOOL_MAP.get(name)?.mutating);
}

export { dirOf };
