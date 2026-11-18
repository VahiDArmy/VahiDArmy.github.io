import { idbSet, idbGet, idbGetAll, idbDelete } from '../lib/idb.js';
import { createCheckpointRow } from './db.js';

export async function createCheckpoint(fs, projectId, label = 'Checkpoint', paths = null) {
  const tree = await fs.tree();
  const targets = paths ? tree.filter((f) => paths.includes(f.path)) : tree;
  const files = {};
  for (const f of targets) {
    if (f.binary) continue;
    try {
      files[f.path] = await fs.read(f.path);
    } catch { files[f.path] = null; }
  }
  const id = crypto.randomUUID();
  const checkpoint = { id, projectId, label, createdAt: Date.now(), files };
  await idbSet('checkpoints', checkpoint);
  try {
    await createCheckpointRow(projectId, { id, label, fileCount: Object.keys(files).length });
  } catch { /* local checkpoint still valid */ }
  return checkpoint;
}

export async function listCheckpoints(projectId) {
  return idbGetAll('checkpoints', 'projectId', projectId);
}

export async function restoreCheckpoint(fs, checkpointId) {
  const cp = await idbGet('checkpoints', checkpointId);
  if (!cp) throw new Error('Checkpoint not found');
  for (const [path, content] of Object.entries(cp.files)) {
    if (content === null) {
      await fs.delete(path).catch(() => {});
    } else {
      await fs.write(path, content);
    }
  }
  return { restored: Object.keys(cp.files).length };
}

export async function deleteCheckpoint(checkpointId) {
  await idbDelete('checkpoints', checkpointId);
}
