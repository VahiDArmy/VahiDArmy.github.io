// ---------------------------------------------------------------------------
// Turning model output into tool calls.
//
// Models on OpenRouter are wildly inconsistent: some emit native tool_calls,
// some emit fenced JSON, some wrap the JSON in prose, use `action` instead of
// `tool`, or send arguments as a JSON string. Everything downstream expects one
// normalized shape, so all of that tolerance lives here — and nowhere else.
// ---------------------------------------------------------------------------

const TOOL_ALIASES = {
  read: 'read_file', readfile: 'read_file', open_file: 'read_file', view_file: 'read_file',
  cat: 'read_file', get_file: 'read_file', show_file: 'read_file',
  write: 'write_file', writefile: 'write_file', create_file: 'write_file', save_file: 'write_file',
  create: 'write_file', add_file: 'write_file', new_file: 'write_file',
  edit_file: 'replace_in_file', replace: 'replace_in_file', str_replace: 'replace_in_file',
  edit: 'replace_in_file', patch_file: 'replace_in_file', modify_file: 'replace_in_file',
  delete: 'delete_file', deletefile: 'delete_file', remove_file: 'delete_file', rm: 'delete_file',
  move: 'move_file', rename_file: 'move_file', rename: 'move_file', movefile: 'move_file',
  list: 'list_dir', ls: 'list_dir', list_files: 'list_dir', list_directory: 'list_dir',
  tree: 'list_dir', glob: 'list_dir', dir: 'list_dir', read_dir: 'list_dir',
  grep: 'search', search_files: 'search', find: 'search', search_code: 'search', search_file: 'search',
  plan: 'update_plan', update_roadmap: 'update_plan', roadmap: 'update_plan',
  update_tasks: 'update_plan', add_task: 'update_plan', set_task: 'update_plan',
  memory: 'update_memory', remember: 'update_memory', save_memory: 'update_memory',
  write_memory: 'update_memory', update_project_memory: 'update_memory',
  ask: 'ask_user', ask_human: 'ask_user', question: 'ask_user', request_input: 'ask_user',
  done: 'finish', complete: 'finish', final: 'finish', task_complete: 'finish',
  end: 'finish', finish_task: 'finish', stop: 'finish',
};

export function normalizeToolName(raw) {
  if (typeof raw !== 'string') return '';
  let name = raw.trim().toLowerCase();
  name = name.replace(/^functions?[./]/, '').replace(/[\s-]+/g, '_');
  if (TOOL_ALIASES[name]) return TOOL_ALIASES[name];
  return name;
}

/** Best-effort JSON.parse with the usual small-model breakage repaired. */
export function parseJsonLoose(input) {
  if (typeof input !== 'string') return input;
  const text = input.trim();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { /* repair below */ }

  let repaired = text
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/```\s*$/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  try { return JSON.parse(repaired); } catch { /* keep going */ }

  // Strip // and /* */ comments that some models add inside JSON.
  repaired = repaired
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  try { return JSON.parse(repaired); } catch { /* keep going */ }

  // Single-quoted keys/strings, only when there are no double quotes at all.
  if (!repaired.includes('"')) {
    try {
      return JSON.parse(repaired.replace(/'/g, '"'));
    } catch { /* give up */ }
  }
  return undefined;
}

function scanJsonCandidates(text) {
  const candidates = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue; }
    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return candidates;
}

function unwrapArgs(args) {
  if (args === undefined || args === null) return {};
  if (typeof args === 'string') {
    const parsed = parseJsonLoose(args);
    if (parsed && typeof parsed === 'object') return parsed;
    return { value: args };
  }
  if (typeof args !== 'object') return { value: args };
  if (Array.isArray(args)) return { ops: args };
  // some models nest: {"args":{"arguments":{...}}}
  if (args.arguments && typeof args.arguments === 'object' && Object.keys(args).length === 1) {
    return args.arguments;
  }
  return args;
}

function interpret(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    const out = [];
    for (const item of obj) {
      const parsed = interpret(item);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed) out.push(parsed);
    }
    return out;
  }
  if (typeof obj !== 'object') return null;

  if (Array.isArray(obj.tool_calls)) {
    const out = [];
    for (const call of obj.tool_calls) {
      const parsed = interpret(call);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed) out.push(parsed);
    }
    return out.length ? out : null;
  }

  const fn = obj.function && typeof obj.function === 'object' ? obj.function : null;
  const rawName = obj.tool ?? obj.tool_name ?? obj.name ?? obj.action ?? obj.function_name
    ?? fn?.name ?? (typeof obj.function === 'string' ? obj.function : null);
  if (typeof rawName !== 'string' || !rawName.trim()) return null;

  const name = normalizeToolName(rawName);
  const args = unwrapArgs(
    obj.args ?? obj.arguments ?? obj.parameters ?? obj.input ?? obj.params
    ?? fn?.arguments ?? obj.action_input ?? obj.tool_input,
  );
  const thought = obj.thought || obj.reasoning || obj.thinking || obj.note || '';
  return { name, args, thought: typeof thought === 'string' ? thought : '' };
}

const TOOL_TAG_RE = /<tool(?:_call)?\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/tool(?:_call)?>/gi;
const FN_TAG_RE = /<function=([\w.-]+)\s*>([\s\S]*?)<\/function>/gi;

/**
 * Normalize one model reply.
 * @returns {{calls: Array<{name:string,args:object,thought:string,id?:string}>, thought: string, text: string, native: boolean}}
 */
export function parseModelTurn({ content = '', toolCalls = null } = {}) {
  const calls = [];
  let thought = '';
  const text = typeof content === 'string' ? content : '';

  // 1. Native tool calls (OpenAI/OpenRouter format).
  if (Array.isArray(toolCalls) && toolCalls.length) {
    for (const call of toolCalls) {
      const name = normalizeToolName(call?.function?.name || call?.name);
      if (!name) continue;
      const args = unwrapArgs(call?.function?.arguments ?? call?.arguments ?? {});
      calls.push({ name, args, thought: '', id: call?.id || '', native: true });
    }
    if (calls.length) return { calls, thought: text.trim(), text: text.trim(), native: true };
  }

  // 2. XML-ish tool tags.
  for (const match of text.matchAll(TOOL_TAG_RE)) {
    const name = normalizeToolName(match[1]);
    if (!name) continue;
    calls.push({ name, args: unwrapArgs(match[2]), thought: '', native: false });
  }
  for (const match of text.matchAll(FN_TAG_RE)) {
    const name = normalizeToolName(match[1]);
    if (!name) continue;
    calls.push({ name, args: unwrapArgs(match[2]), thought: '', native: false });
  }
  if (calls.length) return { calls, thought: '', text: text.trim(), native: false };

  // 3. JSON objects, fenced or inline.
  const fenced = [...text.matchAll(/```(?:json|javascript|js)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fenced, ...scanJsonCandidates(text)];

  for (const candidate of candidates) {
    const parsed = parseJsonLoose(candidate);
    if (!parsed) continue;
    const interpreted = interpret(parsed);
    if (!interpreted) continue;
    const list = Array.isArray(interpreted) ? interpreted : [interpreted];
    for (const call of list) {
      calls.push({ ...call, id: '', native: false });
    }
    if (calls.length) {
      // Prose before the JSON is the model "thinking"; keep it for the log.
      const before = text.slice(0, text.indexOf(candidate)).trim();
      thought = calls.find((c) => c.thought)?.thought || before.slice(0, 600);
      break;
    }
  }

  return {
    calls,
    thought,
    text: text.trim(),
    native: false,
  };
}

/** True when prose claims work that the log does not show. */
export function looksLikeWorkClaim(text) {
  if (!text) return false;
  const claim = /\b(i (?:have |'ve )?(?:created|added|updated|changed|fixed|implemented|wrote|modified|deleted|removed|built|refactored|completed)|the (?:file|files|change|changes|feature|fix) (?:is|are|has been|have been) (?:now )?(?:created|added|updated|done|complete|implemented)|successfully (?:created|updated|added|implemented|fixed))/i;
  return claim.test(text);
}

/** Pull a short human-readable summary out of whatever the model produced. */
export function summarizeTurn(text, limit = 400) {
  if (!text) return '';
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{[^{}]*"tool"[^{}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}
