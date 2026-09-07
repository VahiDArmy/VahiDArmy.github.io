// Global state
export const state = {
    config: {
        owner: '',
        repo: '',
        token: '',
        branch: 'main',
        currentPath: '',
        currentSha: null,
        editingFile: null,
        ctxTarget: null,
    },
    selectedPaths: new Set(),
    lastClickedIndex: -1,
    currentFileItems: [],
    selectionMode: false,
    clipboard: {
        items: [],
        operation: null,
    },
    drag: {
        items: [],
        isDragging: false,
    },
    pyodide: {
        ready: false,
        instance: null,
        loading: false,
    },
    editor: {
        currentFile: null,
        currentFileContent: '',
        currentFileLanguage: 'text',
    },
};

// Helper to reset selection
export function clearSelection() {
    state.selectedPaths.clear();
    state.lastClickedIndex = -1;
}

// Helper to exit selection mode
export function exitSelectionMode() {
    state.selectionMode = false;
    clearSelection();
}

// Helper to toggle selection of a path
export function toggleSelection(path) {
    if (state.selectedPaths.has(path)) {
        state.selectedPaths.delete(path);
    } else {
        state.selectedPaths.add(path);
    }
}

// Clipboard helpers
export function setClipboard(items, operation) {
    state.clipboard.items = items;
    state.clipboard.operation = operation;
}

export function clearClipboard() {
    state.clipboard.items = [];
    state.clipboard.operation = null;
}

// Get selected items from currentFileItems
export function getSelectedItems() {
    const selected = [];
    for (const item of state.currentFileItems) {
        if (state.selectedPaths.has(item.path)) {
            selected.push({
                path: item.path,
                name: item.name,
                isFolder: item.type === 'dir',
                sha: item.sha || null,
            });
        }
    }
    return selected;
}

// Normalize path
export function normalizePath(p) {
    if (!p) return '';
    let cleaned = p.replace(/^\/+/, '');
    if (cleaned.length > 0 && cleaned.endsWith('/')) {
        cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
}

// Get parent path
export function getParentPath(path) {
    if (!path || path === '') return '';
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
}

// Get repo info from config or inputs
export function getRepoInfo() {
    const owner = state.config.owner || document.getElementById('ownerInput').value.trim();
    const repo = state.config.repo || document.getElementById('repoInput').value.trim();
    const branch = state.config.branch || document.getElementById('branchInput').value.trim() || 'main';
    return { owner, repo, branch };
}

// Get headers
export function getHeaders() {
    const token = state.config.token || document.getElementById('tokenInput').value.trim();
    if (!token) throw new Error('GitHub token required');
    return {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };
}