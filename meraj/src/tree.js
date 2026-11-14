/** Messages form a tree. A conversation points at one active leaf. */

const ROOT = '__root__';

function timeOf(message) {
  const time = new Date(message?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortMessages(list) {
  return [...list].sort((a, b) => timeOf(a) - timeOf(b) || String(a.id).localeCompare(String(b.id)));
}

export function buildTree(messages = []) {
  const byId = new Map();
  const children = new Map();
  const roots = [];
  for (const message of messages) {
    byId.set(message.id, message);
    const parentKey = message.parent_id || ROOT;
    if (!children.has(parentKey)) children.set(parentKey, []);
    children.get(parentKey).push(message);
  }
  for (const [key, list] of children.entries()) {
    children.set(key, sortMessages(list));
    if (key === ROOT) roots.push(...sortMessages(list));
  }
  return { byId, children, roots: sortMessages(roots) };
}

export function pathToLeaf(messages = [], leafId = null) {
  if (!leafId) return [];
  const byId = new Map(messages.map((message) => [message.id, message]));
  const path = [];
  const seen = new Set();
  let current = byId.get(leafId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return path.reverse();
}

export function childrenOf(messages = [], parentId = null) {
  return sortMessages(messages.filter((message) => (message.parent_id || null) === (parentId || null)));
}

export function deepestLeaf(messages = [], startId) {
  const byId = new Map(messages.map((message) => [message.id, message]));
  let current = byId.get(startId);
  if (!current) return null;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const children = childrenOf(messages, current.id);
    if (!children.length) return current;
    current = children[children.length - 1];
  }
  return current;
}

export function latestLeaf(messages = []) {
  if (!messages.length) return null;
  const roots = childrenOf(messages, null);
  if (!roots.length) return messages[messages.length - 1] || null;
  return deepestLeaf(messages, roots[roots.length - 1].id);
}

export function resolveActiveLeaf(messages = [], activeLeafId = null) {
  if (!messages.length) return null;
  if (activeLeafId && messages.some((message) => message.id === activeLeafId)) return activeLeafId;
  return latestLeaf(messages)?.id || null;
}

export function siblingsOf(messages = [], message) {
  return childrenOf(messages, message?.parent_id || null);
}

export function branchInfo(messages = [], messageId) {
  const message = messages.find((item) => item.id === messageId);
  if (!message) return { index: 0, total: 1, siblings: [] };
  const siblings = siblingsOf(messages, message);
  return {
    index: siblings.findIndex((item) => item.id === messageId),
    total: siblings.length,
    siblings,
  };
}

export function subtreeIds(messages = [], rootId) {
  const ids = new Set();
  if (!rootId) return ids;
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    for (const child of childrenOf(messages, id)) queue.push(child.id);
  }
  return ids;
}

export function pathSegmentIds(messages = [], leafId) {
  return new Set(pathToLeaf(messages, leafId).map((message) => message.id));
}

export function branchSiblingForDirection(messages = [], message, direction) {
  const info = branchInfo(messages, message.id);
  if (info.total < 2) return null;
  const next = (info.index + direction + info.total) % info.total;
  return info.siblings[next] || null;
}

export function lastAssistantWithRequest(messages = [], path = []) {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const message = path[i];
    if (message.role === 'assistant' && message.status !== 'error') return message;
  }
  return null;
}

export function pathMessageCount(messages = [], path = []) {
  return path.filter((message) => message.role !== 'system').length;
}
