// ---------------------------------------------------------------------------
// Prompt construction.
//
// The model is a replaceable worker: everything it needs to behave is stated
// explicitly here, and the project's real files remain the source of truth.
// ---------------------------------------------------------------------------

import { buildToolDocs } from './tools.js';
import { truncate } from '../core/util.js';
import { MEMORY_SECTIONS } from '../config.js';

const PROTOCOL_JSON = `## Response format
Reply with exactly one JSON object and nothing else:

{"thought": "one short sentence of reasoning", "tool": "tool_name", "args": { ... }}

Rules for the format:
- No markdown fences, no prose before or after the JSON.
- "tool" must be one of the tools listed above.
- "args" must be a JSON object with the arguments that tool needs.
- Emit exactly one tool call per reply.`;

function memoryBlock(memory) {
  const parts = [];
  for (const section of MEMORY_SECTIONS) {
    const content = memory?.[section.key]?.content?.trim();
    if (content) parts.push(`### ${section.label}\n${truncate(content, 1600)}`);
    }
  return parts.join('\n\n');
}

function planBlock(tasks) {
  if (!tasks?.length) return '';
  const order = { doing: 0, todo: 1, blocked: 2, done: 3 };
  const sorted = [...tasks].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const lines = sorted.slice(0, 24).map((task) => {
    const mark = task.status === 'done' ? 'x' : task.status === 'doing' ? '>' : task.status === 'blocked' ? '!' : ' ';
    return `- [${mark}] ${task.title}${task.phase ? ` (${task.phase})` : ''}${task.blocked_reason ? ` — blocked: ${task.blocked_reason}` : ''}`;
  });
  return lines.join('\n');
}

function fileIndexBlock(files, limit = 320) {
  if (!files?.length) return 'The project is empty — no files yet.';
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const shown = sorted.slice(0, limit).map((file) => `${file.path} (${file.size} B)`);
  const rest = sorted.length - shown.length;
  return `${shown.join('\n')}${rest > 0 ? `\n… and ${rest} more files not shown. Use list_dir or search to find them.` : ''}`;
}

/**
 * @param {object} input
 * @param {object} input.project
 * @param {object} input.memory     map of section -> {content}
 * @param {Array}  input.tasks
 * @param {Array}  input.files
 * @param {boolean} input.nativeTools  the chosen model accepts a tools array
 * @param {string} input.today
 */
export function buildSystemPrompt({ project, memory, tasks, files, nativeTools = false, today = '' }) {
  const sections = [];

  sections.push(`You are the coding agent inside Forgebook, a workspace where a human directs software projects in natural language.

You act on a real project through tools. The project files are the only source of truth; anything you remember about them may be out of date until you read them.`);

  sections.push(`## How to work
- Read a file before you change it. Use read_file unless you already read it during this task.
- Make the smallest change that satisfies the request, and match the conventions already in the project.
- Check the result of every tool call. If it returns ok:false, read the error and fix the cause instead of repeating the same call.
- Never claim something was done unless a tool result shows it. Never invent file contents or test output.
- Do not stop with an explanation when the human asked for a change. Do the work, then report.
- Call finish when the request is satisfied, with an honest summary of what actually changed.
- Call ask_user only when a decision is genuinely the human's to make.`);

  const projectLines = [
    `name: ${project?.name || 'Untitled'}`,
    project?.description ? `description: ${truncate(project.description, 600)}` : '',
    project?.stack ? `detected stack: ${project.stack}` : '',
    `files: ${files?.length || 0}`,
    today ? `today: ${today}` : '',
  ].filter(Boolean);
  sections.push(`## Project\n${projectLines.join('\n')}`);

  const memoryText = memoryBlock(memory);
  if (memoryText) {
    sections.push(`## Project memory (may be stale — verify against files)\n${memoryText}`);
  }

  const planText = planBlock(tasks);
  if (planText) {
    sections.push(`## Roadmap\n${planText}\nMark tasks done with update_plan when they are genuinely finished.`);
  }

  sections.push(`## Files\n${fileIndexBlock(files)}`);

  if (!nativeTools) {
    sections.push(`## Tools\n${buildToolDocs()}`);
    sections.push(PROTOCOL_JSON);
  } else {
    sections.push(`## Tools
Use the provided function-calling interface. Call exactly one tool at a time, then wait for its result before choosing the next step. When the request is satisfied, call finish with an honest summary.`);
  }

  sections.push(`## Style
Keep thoughts short. Prefer the smallest edit over a rewrite. If you need a long file, write it once rather than appending in pieces.`);

  return sections.join('\n\n');
}

/** Compact recap of prior work, for resuming after an interruption. */
export function buildRecoveryNote({ run, steps = [], files = [] }) {
  const lines = [
    '## Recovery note',
    'An earlier attempt at this instruction was interrupted. The project may be in a half-finished state.',
    `- it ran ${run?.step_count || steps.length || 0} step(s) with model ${run?.model || 'unknown'}`,
    '- Do not assume anything it did stuck. Inspect the files first (list_dir, then read_file on anything relevant).',
    '- Finish only the missing parts. Do not redo work that is already present and correct.',
  ];
  const actions = steps
    .filter((step) => step.type === 'tool' && step.ok)
    .slice(-10)
    .map((step) => `${step.name}(${JSON.stringify(step.input || {}).slice(0, 120)})`);
  if (actions.length) lines.push(`Last tool calls it reported success on:\n${actions.map((a) => `- ${a}`).join('\n')}`);
  const nowFiles = files.slice(0, 40).map((f) => f.path);
  if (nowFiles.length) lines.push(`Files present now:\n${nowFiles.map((p) => `- ${p}`).join('\n')}`);
  return lines.join('\n');
}

/** Short instruction used to bootstrap a plan for a brand-new project. */
export function planInstruction(description) {
  return `Plan this project before writing code.

Project brief from the human:
${description}

Steps:
1. Inspect the current files (list_dir) so you know what already exists.
2. Break the brief into a clear roadmap of 5-12 concrete tasks with update_plan, grouped into phases. Each task should be something that can be completed and verified.
3. Write the overview and architecture you intend into update_memory (it is a plan, so say what will be built).
4. Call finish with a one-paragraph summary of the plan. Do not write application code yet.`;
}

export function analyzeInstruction() {
  return `Study this project and bring its memory up to date.

1. Explore the structure with list_dir, then read the most important files (entry points, configuration, main modules). Do not read every file.
2. Replace the "overview", "architecture" and "conventions" memory sections with a concise, accurate description: what the project is, how it is organised, what runs where, and the conventions a new contributor must follow.
3. Add any real problems you notice to the "issues" section.
4. If there is no roadmap yet, add 3-8 sensible next tasks with update_plan.
5. Call finish with a short summary of what the project is.`;
}

export function defaultOverview({ files, stack }) {
  const paths = files.map((f) => f.path);
  const dirs = new Set();
  for (const path of paths) {
    const parts = path.split('/');
    if (parts.length > 1) dirs.add(parts[0]);
  }
  const overview = [
    `A ${stack || 'software'} project with ${files.length} file(s).`,
    dirs.size ? `Top-level folders: ${[...dirs].slice(0, 12).join(', ')}.` : '',
    '',
    'This description was generated from the file tree when the project was imported. Ask the agent to analyse the project for a deeper overview.',
  ].filter(Boolean).join('\n');

  const architecture = [
    '### Structure',
    [...paths].slice(0, 60).map((p) => `- \`${p}\``).join('\n'),
  ].join('\n');

  return { overview, architecture };
}
