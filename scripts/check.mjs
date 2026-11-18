// ---------------------------------------------------------------------------
// Dependency-free checks for the parts that can run outside a browser:
// response parsing, path safety, prompt building and every tool against a
// fake in-memory project. Run: node scripts/check.mjs
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict';
import { parseModelTurn, normalizeToolName, parseJsonLoose, looksLikeWorkClaim } from '../js/agent/parse.js';
import { normalizePath, contentHash, decodeBytes, approxTokens } from '../js/core/util.js';
import { buildSystemPrompt, buildRecoveryNote, planInstruction } from '../js/agent/prompt.js';
import { executeTool, toolSchemas, toolByName, isMutatingName } from '../js/agent/tools.js';

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, error: err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// fake project
// ---------------------------------------------------------------------------

class MemFS {
  constructor(files = {}) {
    this.map = new Map();
    for (const [path, content] of Object.entries(files)) {
      this.map.set(path, { path, content, binary: false, size: content.length, hash: contentHash(content) });
    }
  }
  async list() {
    return [...this.map.values()].map((file) => ({ path: file.path, size: file.size, hash: file.hash, binary: file.binary }));
  }
  async read(path) {
    const file = this.map.get(normalizePath(path));
    if (!file) {
      const err = new Error(`File not found: ${path}`);
      err.code = 'ENOENT';
      throw err;
    }
    return { ...file };
  }
  async readText(path) { return this.read(path); }
  async exists(path) { return this.map.has(normalizePath(path)); }
  async peek(path) {
    const file = this.map.get(normalizePath(path));
    assert.ok(file, `expected ${path} to exist`);
    return { ...file };
  }
  async write(path, content) {
    const p = normalizePath(path);
    const record = { path: p, content, binary: false, size: content.length, hash: contentHash(content) };
    this.map.set(p, record);
    return { path: p, size: content.length, hash: record.hash, target: 'vault', verified: true };
  }
  async remove(path) {
    const p = normalizePath(path);
    return { path: p, removed: this.map.delete(p) };
  }
  async move(from, to) {
    const a = normalizePath(from);
    const b = normalizePath(to);
    const record = this.map.get(a);
    this.map.delete(a);
    this.map.set(b, { ...record, path: b });
    return { from: a, to: b, written: { verified: true }, removed: true };
  }
  async search(query, { regex = false } = {}) {
    const out = [];
    for (const file of this.map.values()) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const hit = regex ? new RegExp(query, 'i').test(lines[i]) : lines[i].includes(query);
        if (hit) out.push({ path: file.path, line: i + 1, text: lines[i] });
      }
    }
    return out;
  }
}

function makeCtx(files) {
  const fs = new MemFS(files);
  const journalOps = [];
  const ctx = {
    fs,
    projectId: 'p1',
    journal: {
      entries: new Map(),
      bytes: 0,
      async before(path) { journalOps.push(path); },
    },
    applyPlanOps: async (ops) => ({ applied: ops.length, tasks: 2 }),
    applyMemory: async (section, content) => ({ ok: true, section, characters: content.length }),
  };
  return { ctx, fs, journalOps };
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

console.log('\nparse');

await check('native tool call is normalized', () => {
  const turn = parseModelTurn({
    content: '',
    toolCalls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.js"}' } }],
  });
  assert.equal(turn.calls.length, 1);
  assert.equal(turn.calls[0].name, 'read_file');
  assert.equal(turn.calls[0].args.path, 'a.js');
  assert.equal(turn.calls[0].native, true);
});

await check('JSON protocol reply is parsed', () => {
  const turn = parseModelTurn({
    content: '{"thought":"look first","tool":"list_dir","args":{"path":"src"}}',
  });
  assert.equal(turn.calls.length, 1);
  assert.equal(turn.calls[0].name, 'list_dir');
  assert.equal(turn.calls[0].args.path, 'src');
  assert.equal(turn.thought, 'look first');
});

await check('fenced JSON with alias tool name is parsed', () => {
  const turn = parseModelTurn({
    content: 'Here you go:\n```json\n{"action":"write","parameters":{"path":"b.txt","content":"hi"}}\n```',
  });
  assert.equal(turn.calls[0].name, 'write_file');
  assert.equal(turn.calls[0].args.content, 'hi');
});

await check('arguments sent as a JSON string are parsed', () => {
  const turn = parseModelTurn({
    content: '{"tool":"read_file","arguments":"{\\"path\\":\\"x.md\\"}"}',
  });
  assert.equal(turn.calls[0].args.path, 'x.md');
});

await check('XML-ish tool tag is parsed', () => {
  const turn = parseModelTurn({ content: '<tool name="finish">{"status":"completed","summary":"done"}</tool>' });
  assert.equal(turn.calls[0].name, 'finish');
  assert.equal(turn.calls[0].args.summary, 'done');
});

await check('prose without tools yields no calls', () => {
  const turn = parseModelTurn({ content: 'I think we should add a router first.' });
  assert.equal(turn.calls.length, 0);
  assert.match(turn.text, /router/);
});

await check('trailing commas and comments are repaired', () => {
  const parsed = parseJsonLoose('{"path":"a.js", /* note */ "content":"x",}');
  assert.equal(parsed.path, 'a.js');
  assert.equal(parsed.content, 'x');
});

await check('tool aliases map to canonical names', () => {
  assert.equal(normalizeToolName('create_file'), 'write_file');
  assert.equal(normalizeToolName('functions.read_file'), 'read_file');
  assert.equal(normalizeToolName('complete'), 'finish');
});

await check('work claims are detected in prose', () => {
  assert.equal(looksLikeWorkClaim('I have updated the login form and fixed the bug.'), true);
  assert.equal(looksLikeWorkClaim('The project is a static site with three pages.'), false);
});

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

console.log('\nutil');

await check('paths cannot escape the project root', () => {
  assert.equal(normalizePath('/src/../a.js'.replace('/src/../', '')), 'a.js');
  assert.equal(normalizePath('./src//app.js'), 'src/app.js');
  assert.throws(() => normalizePath('../secrets.txt'), /leave the project root/);
  assert.throws(() => normalizePath('src/../../x'), /leave the project root/);
});

await check('content hash changes with content', () => {
  assert.equal(contentHash('abc'), contentHash('abc'));
  assert.notEqual(contentHash('abc'), contentHash('abd'));
});

await check('text and binary detection', () => {
  assert.deepEqual(decodeBytes(new TextEncoder().encode('hello')), { text: 'hello', binary: false });
  const bin = decodeBytes(new Uint8Array([0, 1, 2, 3, 0]));
  assert.equal(bin.binary, true);
  assert.equal(typeof bin.text, 'string');
});

await check('token estimate is in a sane range', () => {
  const tokens = approxTokens('a'.repeat(400));
  assert.ok(tokens > 80 && tokens < 200, `got ${tokens}`);
});

// ---------------------------------------------------------------------------
// prompt
// ---------------------------------------------------------------------------

console.log('\nprompt');

await check('system prompt carries project, files and protocol', () => {
  const prompt = buildSystemPrompt({
    project: { name: 'Demo', description: 'A demo app', stack: 'Vanilla JS' },
    memory: { overview: { content: 'It is a demo.' } },
    tasks: [{ title: 'Build it', status: 'doing', phase: 'Phase 1' }],
    files: [{ path: 'index.html', size: 120 }],
    nativeTools: false,
  });
  assert.match(prompt, /Demo/);
  assert.match(prompt, /index\.html/);
  assert.match(prompt, /"tool": "tool_name"/);
  assert.match(prompt, /Build it/);
});

await check('native-tool prompt omits the JSON protocol', () => {
  const prompt = buildSystemPrompt({ project: { name: 'X' }, files: [], nativeTools: true });
  assert.doesNotMatch(prompt, /"tool": "tool_name"/);
});

await check('empty project is stated plainly', () => {
  const prompt = buildSystemPrompt({ project: { name: 'X' }, files: [], nativeTools: false });
  assert.match(prompt, /empty/);
});

await check('recovery note warns against assuming state', () => {
  const note = buildRecoveryNote({
    run: { step_count: 7, model: 'm/one' },
    steps: [{ type: 'tool', name: 'write_file', ok: true, input: { path: 'a.js' } }],
    files: [{ path: 'a.js' }],
  });
  assert.match(note, /interrupted/i);
  assert.match(note, /Do not assume/);
  assert.match(note, /write_file/);
});

await check('plan instruction asks for a roadmap, not code', () => {
  const text = planInstruction('A recipe site');
  assert.match(text, /roadmap/i);
  assert.match(text, /Do not write application code yet/);
});

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

console.log('\ntools');

await check('schemas are well formed', () => {
  const schemas = toolSchemas();
  assert.ok(schemas.length >= 10);
  for (const schema of schemas) {
    assert.equal(schema.type, 'function');
    assert.equal(typeof schema.function.name, 'string');
    assert.equal(schema.function.parameters.type, 'object');
  }
  assert.equal(isMutatingName('write_file'), true);
  assert.equal(isMutatingName('read_file'), false);
  assert.ok(toolByName('finish'));
});

await check('write_file creates a verified file', async () => {
  const { ctx, fs } = makeCtx({});
  const result = await executeTool({ name: 'write_file', args: { path: 'src/new.js', content: 'export const a = 1;\n' } }, ctx);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.verified, true);
  assert.equal((await fs.peek('src/new.js')).content, 'export const a = 1;\n');
});

await check('write_file journals the previous version first', async () => {
  const { ctx, journalOps } = makeCtx({ 'a.txt': 'old' });
  await executeTool({ name: 'write_file', args: { path: 'a.txt', content: 'new' } }, ctx);
  assert.deepEqual(journalOps, ['a.txt']);
});

await check('read_file honours line ranges', async () => {
  const { ctx } = makeCtx({ 'a.txt': 'one\ntwo\nthree\nfour' });
  const result = await executeTool({ name: 'read_file', args: { path: 'a.txt', start_line: 2, end_line: 3 } }, ctx);
  assert.equal(result.result.content, 'two\nthree');
  assert.equal(result.result.total_lines, 4);
});

await check('read_file reports a missing file without throwing', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'read_file', args: { path: 'nope.txt' } }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);
});

await check('replace_in_file refuses an ambiguous match', async () => {
  const { ctx } = makeCtx({ 'a.txt': 'x = 1;\nx = 1;' });
  const result = await executeTool({ name: 'replace_in_file', args: { path: 'a.txt', find: 'x = 1;', replace: 'x = 2;' } }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /appears 2 times/);
});

await check('replace_in_file applies a unique edit', async () => {
  const { ctx, fs } = makeCtx({ 'a.txt': 'hello world' });
  const result = await executeTool({ name: 'replace_in_file', args: { path: 'a.txt', find: 'world', replace: 'there' } }, ctx);
  assert.equal(result.ok, true, result.error);
  assert.equal((await fs.peek('a.txt')).content, 'hello there');
});

await check('replace_in_file with all=true replaces every occurrence', async () => {
  const { ctx, fs } = makeCtx({ 'a.txt': 'a a a' });
  const result = await executeTool({ name: 'replace_in_file', args: { path: 'a.txt', find: 'a', replace: 'b', all: true } }, ctx);
  assert.equal(result.ok, true);
  assert.equal((await fs.peek('a.txt')).content, 'b b b');
});

await check('delete_file refuses a folder with children', async () => {
  const { ctx } = makeCtx({ 'src/a.js': '1', 'src/b.js': '2' });
  const result = await executeTool({ name: 'delete_file', args: { path: 'src' } }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /folder/);
});

await check('delete_file removes a real file', async () => {
  const { ctx, fs } = makeCtx({ 'a.txt': 'x' });
  const result = await executeTool({ name: 'delete_file', args: { path: 'a.txt' } }, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.result.deleted, true);
  assert.equal(await fs.exists('a.txt'), false);
});

await check('move_file renames and verifies', async () => {
  const { ctx, fs } = makeCtx({ 'a.txt': 'x' });
  const result = await executeTool({ name: 'move_file', args: { from: 'a.txt', to: 'dir/b.txt' } }, ctx);
  assert.equal(result.ok, true, result.error);
  assert.equal(await fs.exists('dir/b.txt'), true);
  assert.equal(await fs.exists('a.txt'), false);
});

await check('move_file refuses to overwrite', async () => {
  const { ctx } = makeCtx({ 'a.txt': 'x', 'b.txt': 'y' });
  const result = await executeTool({ name: 'move_file', args: { from: 'a.txt', to: 'b.txt' } }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /already exists/);
});

await check('list_dir separates folders from files', async () => {
  const { ctx } = makeCtx({ 'index.html': 'x', 'src/app.js': 'y', 'src/lib/z.js': 'z' });
  const result = await executeTool({ name: 'list_dir', args: { path: '' } }, ctx);
  const names = result.result.entries.map((entry) => entry.name);
  assert.deepEqual(names, ['src/', 'index.html']);
});

await check('search returns line numbers', async () => {
  const { ctx } = makeCtx({ 'a.js': 'const a = 1;\nconst b = 2;' });
  const result = await executeTool({ name: 'search', args: { query: 'const b' } }, ctx);
  assert.equal(result.result.matches.length, 1);
  assert.equal(result.result.matches[0].line, 2);
});

await check('unknown tool returns the available list', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'teleport', args: {} }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown tool/);
  assert.match(result.error, /read_file/);
});

await check('missing required argument is reported clearly', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'read_file', args: {} }, ctx);
  assert.equal(result.ok, false);
  assert.match(result.error, /Missing required argument "path"/);
});

await check('finish surfaces as a finished outcome', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'finish', args: { status: 'completed', summary: 'done it' } }, ctx);
  assert.equal(result.finished, true);
  assert.equal(result.result.status, 'completed');
  assert.equal(result.result.summary, 'done it');
});

await check('ask_user surfaces as blocked with options', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'ask_user', args: { question: 'Which colour?', options: ['red', 'blue'] } }, ctx);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.result.options, ['red', 'blue']);
});

await check('update_plan forwards operations', async () => {
  const { ctx } = makeCtx({});
  const result = await executeTool({ name: 'update_plan', args: { ops: [{ op: 'add', title: 'Ship it' }] } }, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.result.applied, 1);
});

await check('write_file stringifies structured content for JSON files', async () => {
  const { ctx, fs } = makeCtx({});
  await executeTool({ name: 'write_file', args: { path: 'package.json', content: { name: 'x' } } }, ctx);
  const content = (await fs.peek('package.json')).content;
  assert.equal(JSON.parse(content).name, 'x');
});

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`\n${failure.name}\n`, failure.error);
  process.exit(1);
}
