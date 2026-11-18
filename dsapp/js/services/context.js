// js/services/context.js
import { AGENT_LIMITS } from '../config.js';
import { escapeHtml } from '../lib/markdown.js';

export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

export function truncate(text, maxChars) {
  const s = String(text || '');
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + `\n… [truncated ${s.length - maxChars} chars]`;
}

export function buildSystemPrompt(project) {
  return `You are DevSpace, an autonomous software development agent operating inside a browser-based workspace.

PROJECT: ${project.name}
DESCRIPTION: ${project.description || '(none provided)'}

CORE RULES
1. The actual project files are the source of truth. Project memory is only a hint; always verify by reading files before editing.
2. You modify the project exclusively through the provided tools. Never claim a change was made unless the tool result confirms it.
3. After every write or delete, the tool returns a verification result. If verification fails, fix the problem before moving on.
4. Prefer small, verifiable steps over one giant rewrite.
5. Before deleting or overwriting important files, create a checkpoint with the create_checkpoint tool.
6. Keep the roadmap and project memory current using update_roadmap and add_memory.
7. If you are blocked or need a decision only the user can make, use the ask_user tool and stop.
8. When you are done, finish with a concise summary of what changed and any remaining work.
9. Do not invent file contents. Read first.
10. Work in the user's language.

TOOL PROTOCOL
- Prefer native tool calls when available.
- If native tool calling is unavailable, respond with exactly one JSON object per turn, no markdown fences:
  {"type":"tool","tool":"<name>","args":{...}}
  or
  {"type":"final","content":"..."}
`;
}

export function buildContext({
  project, task, recentMessages, memory, roadmap, fileIndex, relevantFiles,
}) {
  const parts = [];

  parts.push(`## TASK\n${task}`);

  if (roadmap.length) {
    const lines = roadmap.slice(0, 60).map((r) =>
      `- [${r.status}] ${r.phase} / ${r.title}${r.description ? ` — ${r.description}` : ''}`
    );
    parts.push(`## ROADMAP\n${lines.join('\n')}`);
  }

  if (memory.length) {
    const lines = memory.slice(0, 25).map((m) => `- (${m.kind}, importance ${m.importance}) ${truncate(m.content, 600)}`);
    parts.push(`## PROJECT MEMORY\n${lines.join('\n')}`);
  }

  if (fileIndex.length) {
    parts.push(`## FILE INDEX (${fileIndex.length} files)\n${fileIndex.slice(0, 300).map((f) => f.path).join('\n')}`);
  }

  if (relevantFiles.length) {
    const blocks = relevantFiles.map((f) => `### ${f.path}\n\`\`\`\n${truncate(f.content, AGENT_LIMITS.maxFileReadChars)}\n\`\`\``);
    parts.push(`## RELEVANT FILE CONTENTS\n${blocks.join('\n\n')}`);
  }

  if (recentMessages.length) {
    const lines = recentMessages.map((m) => `${m.role.toUpperCase()}: ${truncate(m.content, 1200)}`);
    parts.push(`## RECENT CONVERSATION\n${lines.join('\n')}`);
  }

  return parts.join('\n\n');
}

export function selectRelevantFiles({ task, messages, tree, limit = 6 }) {
  const text = [task, ...messages.slice(-6).map((m) => m.content)].join(' ').toLowerCase();
  const scored = tree
    .filter((f) => !f.binary)
    .map((f) => {
      const name = f.path.toLowerCase();
      let score = 0;
      if (text.includes(name)) score += 50;
      for (const seg of name.split('/')) {
        if (seg.length > 2 && text.includes(seg)) score += 8;
      }
      if (/\.(js|ts|jsx|tsx|html|css|json|md|py|go|rs|java|sql)$/i.test(name)) score += 5;
      return { ...f, score };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

export function buildInitialAgentMessages({ project, task, contextBlock, toolsAvailable }) {
  const system = buildSystemPrompt(project) +
    (toolsAvailable ? '' : '\n\nIMPORTANT: Native tool calling is unavailable for this model. You MUST use the JSON protocol described above.');
  return [
    { role: 'system', content: system },
    { role: 'user', content: contextBlock },
  ];
}
