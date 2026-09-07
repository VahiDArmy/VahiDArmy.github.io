import { getRepoInfo, getHeaders, normalizePath } from './state.js';

async function ghFetch(endpoint, opts = {}) {
    const headers = getHeaders();
    const url = `https://api.github.com${endpoint}`;
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function getContents(path, ref) {
    const { owner, repo } = getRepoInfo();
    if (!owner || !repo) throw new Error('Owner and Repository required');
    let endpoint = `/repos/${owner}/${repo}/contents`;
    const cleanPath = normalizePath(path);
    if (cleanPath) endpoint += `/${cleanPath}`;
    if (ref) endpoint += `?ref=${ref}`;
    return ghFetch(endpoint);
}

export async function createOrUpdateFile(path, content, message, sha) {
    const { owner, repo, branch } = getRepoInfo();
    if (!owner || !repo) throw new Error('Owner and Repository required');
    const cleanPath = normalizePath(path);
    if (!cleanPath) throw new Error('Invalid file path');
    const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}`;
    const body = {
        message: message || `Update ${cleanPath}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: branch,
    };
    if (sha) body.sha = sha;
    return ghFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deleteFile(path, sha, message) {
    const { owner, repo, branch } = getRepoInfo();
    if (!owner || !repo) throw new Error('Owner and Repository required');
    const cleanPath = normalizePath(path);
    if (!cleanPath) throw new Error('Invalid file path');
    const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}`;
    const body = {
        message: message || `Delete ${cleanPath}`,
        sha: sha,
        branch: branch,
    };
    return ghFetch(endpoint, { method: 'DELETE', body: JSON.stringify(body) });
}

export async function createFolder(path) {
    const cleanPath = normalizePath(path);
    if (!cleanPath) return;
    const filePath = `${cleanPath}/.gitkeep`;
    try {
        await createOrUpdateFile(filePath, '', `Create folder ${cleanPath}`, null);
    } catch (e) {
        if (e.message && e.message.includes('422')) {
            return;
        }
        throw e;
    }
}

// Recursive delete folder
export async function deleteFolder(path) {
    const contents = await getContents(path);
    for (const item of contents) {
        if (item.type === 'dir') {
            await deleteFolder(item.path);
        } else {
            await deleteFile(item.path, item.sha, `Delete ${item.name}`);
        }
    }
    try {
        const gitkeep = await getContents(`${path}/.gitkeep`);
        if (gitkeep && gitkeep.sha) {
            await deleteFile(`${path}/.gitkeep`, gitkeep.sha, `Delete folder ${path}`);
        }
    } catch (e) { /* ignore */ }
}

// Get GitHub Pages base URL
export function getGitHubPagesBase() {
    const owner = state.config.owner || document.getElementById('ownerInput').value.trim();
    const repo = state.config.repo || document.getElementById('repoInput').value.trim();
    if (!owner || !repo) return '';
    if (repo.endsWith('.github.io')) {
        return `https://${owner}.github.io`;
    } else {
        return `https://${owner}.github.io/${repo}`;
    }
}

export function getFileUrl(path) {
    const base = getGitHubPagesBase();
    if (!base) return '';
    const clean = normalizePath(path);
    return `${base}/${clean}`;
}