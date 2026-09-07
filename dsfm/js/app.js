import { state, clearSelection, exitSelectionMode, toggleSelection, getSelectedItems, setClipboard, clearClipboard, normalizePath, getParentPath, getRepoInfo } from './state.js';
import { getContents, createFolder, deleteFolder, getGitHubPagesBase, getFileUrl } from './github.js';
import { toast, showModal, renderFileList, renderTree, updateSelectionUI, updateDownloadButton, showToolbar, hideToolbar, updateToolbarPasteButton, setupModal, closeCtxMenu, showCtxMenu, handleDelete } from './ui.js';
import { openFile, closeEditor, saveCurrentFile, initEditorEvents } from './editor.js';
import { attachDragEvents } from './drag.js';
import { copyItemTo, moveItemTo } from './clipboard.js';
import { getFileIconSVG } from './icons.js';

// DOM refs
const $ = id => document.getElementById(id);
const tokenInput = $('tokenInput');
const ownerInput = $('ownerInput');
const repoInput = $('repoInput');
const branchInput = $('branchInput');
const connectBtn = $('connectBtn');
const refreshBtn = $('refreshBtn');
const fileTree = $('fileTree');
const fileList = $('fileList');
const pathDisplay = $('currentPath');
const mobileToggle = $('mobileToggle');
const sidebar = $('sidebar');
const newFolderBtn = $('newFolderBtn');
const homeBtn = $('homeBtn');
const upBtn = $('upBtn');
const selectModeBtn = $('selectModeBtn');
const downloadSelectedBtn = $('downloadSelectedBtn');
const selectedCountSpan = $('selectedCount');
const toolbarCut = $('toolbarCut');
const toolbarCopy = $('toolbarCopy');
const toolbarPaste = $('toolbarPaste');
const toolbarClose = $('toolbarClose');

// ===== NAVIGATION =====
export async function navigateTo(path) {
    try {
        const cleanPath = normalizePath(path);
        state.config.currentPath = cleanPath;
        pathDisplay.textContent = cleanPath || '/';
        clearSelection();
        exitSelectionMode();
        const items = await getContents(cleanPath, state.config.branch);
        const currentItems = Array.isArray(items) ? items : [];
        // Store in state for selection usage
        state.currentFileItems = currentItems;
        await renderFileList(currentItems, cleanPath);
        // Attach drag events after rendering
        document.querySelectorAll('#fileList .file-card').forEach(card => {
            const item = card._item;
            if (item) attachDragEvents(card, item);
        });
        await rebuildTree();
        closeEditor();
    } catch (e) {
        toast(`Error: ${e.message}`, 'error');
    }
}

async function rebuildTree() {
    try {
        const rootItems = await getContents('', state.config.branch);
        renderTree(Array.isArray(rootItems) ? rootItems : [], '', fileTree);
    } catch (e) {
        fileTree.innerHTML = `<div class="tree-empty text-muted">Error: ${e.message}</div>`;
    }
}

// ===== CONNECT =====
async function connect() {
    try {
        const token = tokenInput.value.trim();
        const owner = ownerInput.value.trim();
        const repo = repoInput.value.trim();
        const branch = branchInput.value.trim() || 'main';
        if (!token) { toast('Enter token', 'warning'); return; }
        if (!owner || !repo) { toast('Enter Owner and Repo', 'warning'); return; }

        state.config.token = token;
        state.config.owner = owner;
        state.config.repo = repo;
        state.config.branch = branch;

        localStorage.setItem('gh_token', token);
        localStorage.setItem('gh_owner', owner);
        localStorage.setItem('gh_repo', repo);
        localStorage.setItem('gh_branch', branch);

        await getContents('', state.config.branch);
        toast('Connected!', 'success');
        await navigateTo('');
        await rebuildTree();
    } catch (e) {
        console.error('Connect error:', e);
        toast(`Connection error: ${e.message}`, 'error');
    }
}

// ===== BULK DOWNLOAD =====
async function downloadSelected() {
    const selected = Array.from(state.selectedPaths);
    if (selected.length === 0) return;

    toast(`Preparing ${selected.length} item(s)...`, 'info', 2000);
    try {
        const zip = new JSZip();
        for (const itemPath of selected) {
            const item = state.currentFileItems.find(f => f.path === itemPath);
            if (item && item.type === 'dir') {
                await addFolderToZip(itemPath, zip, '');
            } else {
                const data = await getContents(itemPath, state.config.branch);
                let content = '';
                if (data.content) {
                    content = decodeURIComponent(escape(atob(data.content)));
                }
                const fileName = itemPath.split('/').pop();
                zip.file(fileName, content);
            }
        }

        toast('Building ZIP...', 'info', 1500);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Download complete!', 'success');
    } catch (e) {
        console.error('Bulk download error:', e);
        toast(`Download failed: ${e.message || 'Unknown error'}`, 'error');
    }
}

async function addFolderToZip(folderPath, zip, basePath) {
    try {
        const items = await getContents(folderPath, state.config.branch);
        if (!Array.isArray(items)) return;
        for (const item of items) {
            const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
            if (item.type === 'dir') {
                await addFolderToZip(item.path, zip, relativePath);
            } else {
                const data = await getContents(item.path, state.config.branch);
                let content = '';
                if (data.content) {
                    content = decodeURIComponent(escape(atob(data.content)));
                }
                zip.file(relativePath, content);
            }
        }
    } catch (e) {
        console.warn(`Failed to add folder ${folderPath}:`, e);
    }
}

// ===== SELECTION MODE =====
function enterSelectionMode() {
    if (state.selectionMode) return;
    state.selectionMode = true;
    selectModeBtn.classList.add('active');
    showToolbar();
    updateToolbarPasteButton();
}

function exitSelectionModeHandler() {
    state.selectionMode = false;
    selectModeBtn.classList.remove('active');
    hideToolbar();
    clearSelection();
    updateSelectionUI();
    updateDownloadButton();
}

// Toolbar actions
toolbarCut.addEventListener('click', () => {
    handleCut();
    updateToolbarPasteButton();
});

toolbarCopy.addEventListener('click', () => {
    handleCopy();
    updateToolbarPasteButton();
});

toolbarPaste.addEventListener('click', async () => {
    await handlePaste();
    updateToolbarPasteButton();
});

toolbarClose.addEventListener('click', () => {
    exitSelectionModeHandler();
});

// ===== CLIPBOARD OPERATIONS =====
function handleCut() {
    const items = getSelectedItems();
    if (items.length === 0) {
        toast('No items selected to cut', 'warning');
        return;
    }
    setClipboard(items, 'cut');
    document.querySelectorAll('.file-card').forEach(card => {
        const path = card.dataset.path;
        if (items.some(item => item.path === path)) {
            card.classList.add('cut');
        } else {
            card.classList.remove('cut');
        }
    });
    updateToolbarPasteButton();
    toast(`Cut ${items.length} item(s)`, 'info');
}

function handleCopy() {
    const items = getSelectedItems();
    if (items.length === 0) {
        toast('No items selected to copy', 'warning');
        return;
    }
    setClipboard(items, 'copy');
    document.querySelectorAll('.file-card.cut').forEach(el => el.classList.remove('cut'));
    updateToolbarPasteButton();
    toast(`Copied ${items.length} item(s)`, 'info');
}

async function handlePaste() {
    if (state.clipboard.items.length === 0) {
        toast('Clipboard is empty', 'warning');
        return;
    }

    const destDir = state.config.currentPath;
    const sourceItems = state.clipboard.items;
    const op = state.clipboard.operation;

    if (op === 'cut') {
        const allInSameDir = sourceItems.every(item => {
            const parent = item.path.substring(0, item.path.lastIndexOf('/'));
            return parent === destDir;
        });
        if (allInSameDir) {
            toast('Cannot cut and paste in the same directory', 'warning');
            return;
        }
    }

    for (const item of sourceItems) {
        try {
            if (item.isFolder) {
                await copyItemTo(item, destDir);
            } else {
                await copyItemTo(item, destDir);
            }
        } catch (e) {
            toast(`Failed to copy ${item.name}: ${e.message}`, 'error');
        }
    }

    if (op === 'cut') {
        for (const item of sourceItems) {
            try {
                const existing = await getContents(item.path, state.config.branch);
                if (existing && existing.sha) {
                    if (item.isFolder) {
                        await deleteFolder(item.path);
                    } else {
                        await deleteFile(item.path, existing.sha, `Cut: remove ${item.name}`);
                    }
                    toast(`Removed ${item.name} from source`, 'success');
                } else {
                    toast(`Could not find ${item.name} to delete`, 'error');
                }
            } catch (e) {
                toast(`Failed to remove ${item.name}: ${e.message}`, 'error');
            }
        }
        clearClipboard();
    }

    await navigateTo(state.config.currentPath);
    await rebuildTree();
    toast('Paste operation completed', 'success');
    exitSelectionModeHandler();
}

// ===== EVENT BINDING =====
function init() {
    setupModal();
    initEditorEvents();

    // Connect
    connectBtn.addEventListener('click', connect);
    tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });

    // Refresh
    refreshBtn.addEventListener('click', async () => {
        await navigateTo(state.config.currentPath);
        await rebuildTree();
        toast('Refreshed', 'success');
    });

    // Navigation
    homeBtn.addEventListener('click', () => navigateTo(''));
    upBtn.addEventListener('click', () => navigateTo(getParentPath(state.config.currentPath)));

    // Mobile toggle
    mobileToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    // New folder
    newFolderBtn.addEventListener('click', async () => {
        const target = { isFolder: true, path: state.config.currentPath };
        const name = prompt('Enter folder name:', 'newfolder');
        if (!name) return;
        const path = target.path ? `${target.path}/${name}` : name;
        try {
            await createFolder(path);
            toast(`Created folder ${name}`, 'success');
            await navigateTo(state.config.currentPath);
            await rebuildTree();
        } catch (e) {
            toast(`Error creating folder: ${e.message}`, 'error');
        }
    });

    // Select mode
    selectModeBtn.addEventListener('click', () => {
        if (state.selectionMode) {
            exitSelectionModeHandler();
        } else {
            enterSelectionMode();
        }
    });

    // Download selected
    downloadSelectedBtn.addEventListener('click', downloadSelected);

    // Context menu items
    document.querySelectorAll('#ctxMenu .ctx-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            const target = state.config.ctxTarget;
            closeCtxMenu();
            if (!target) return;
            switch (action) {
                case 'newFile': {
                    const name = prompt('Enter file name:', 'newfile.txt');
                    if (!name) return;
                    const base = target.isFolder ? target.path : state.config.currentPath;
                    const path = base ? `${base}/${name}` : name;
                    try {
                        await createOrUpdateFile(path, '', `Create ${name}`, null);
                        toast(`Created ${name}`, 'success');
                        await navigateTo(state.config.currentPath);
                        await rebuildTree();
                    } catch (e) { toast(`Error: ${e.message}`, 'error'); }
                    break;
                }
                case 'newFolder': {
                    const name = prompt('Enter folder name:', 'newfolder');
                    if (!name) return;
                    const base = target.isFolder ? target.path : state.config.currentPath;
                    const path = base ? `${base}/${name}` : name;
                    try {
                        await createFolder(path);
                        toast(`Created folder ${name}`, 'success');
                        await navigateTo(state.config.currentPath);
                        await rebuildTree();
                    } catch (e) { toast(`Error: ${e.message}`, 'error'); }
                    break;
                }
                case 'cut': handleCut(); break;
                case 'copy': handleCopy(); break;
                case 'paste': await handlePaste(); break;
                case 'rename': {
                    if (target.isRoot) return toast('Cannot rename root', 'warning');
                    const newName = prompt('New name:', target.name);
                    if (!newName || newName === target.name) return;
                    const oldPath = target.path;
                    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
                    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
                    try {
                        const data = await getContents(oldPath, state.config.branch);
                        let content = '';
                        if (data.content) content = decodeURIComponent(escape(atob(data.content)));
                        await createOrUpdateFile(newPath, content, `Rename ${target.name} to ${newName}`, null);
                        await deleteFile(oldPath, data.sha, `Delete ${target.name}`);
                        toast(`Renamed to ${newName}`, 'success');
                        await navigateTo(state.config.currentPath);
                        await rebuildTree();
                        if (state.editor.currentFile && state.editor.currentFile.path === oldPath) closeEditor();
                    } catch (e) { toast(`Rename error: ${e.message}`, 'error'); }
                    break;
                }
                case 'delete': await handleDelete(target); break;
                case 'download': {
                    try {
                        const data = await getContents(target.path, state.config.branch);
                        let content = '';
                        if (data.content) content = decodeURIComponent(escape(atob(data.content)));
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = target.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast(`Downloaded ${target.name}`, 'success');
                    } catch (e) { toast(`Download error: ${e.message}`, 'error'); }
                    break;
                }
                case 'copyPath': {
                    try {
                        await navigator.clipboard.writeText(target.path);
                        toast('Path copied!', 'success');
                    } catch (e) {
                        const ta = document.createElement('textarea');
                        ta.value = target.path;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        toast('Path copied!', 'success');
                    }
                    break;
                }
                case 'refresh': {
                    await navigateTo(state.config.currentPath);
                    await rebuildTree();
                    toast('Refreshed', 'success');
                    break;
                }
            }
        });
    });

    // Close context menu on outside click
    document.addEventListener('click', closeCtxMenu);

    // Custom events
    document.addEventListener('navigate', (e) => navigateTo(e.detail.path));
    document.addEventListener('selection-update', () => {
        updateSelectionUI();
        updateDownloadButton();
    });
    document.addEventListener('toolbar-show', showToolbar);
    document.addEventListener('ctxmenu-show', (e) => {
        showCtxMenu(e.detail.x, e.detail.y);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleCopy();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleCut();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handlePaste();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (document.getElementById('editorWrap').classList.contains('visible')) saveCurrentFile();
        }
        if (e.key === 'Escape') {
            if (document.getElementById('ctxMenu').classList.contains('open')) closeCtxMenu();
            if (document.getElementById('editorWrap').classList.contains('visible')) closeEditor();
            if (state.selectionMode) {
                exitSelectionModeHandler();
            }
            if (document.getElementById('modalOverlay').classList.contains('active')) {
                document.getElementById('modalOverlay').classList.remove('active');
                if (modalResolve) modalResolve(false);
            }
        }
    });

    // Auto-load from localStorage
    const savedToken = localStorage.getItem('gh_token');
    const savedOwner = localStorage.getItem('gh_owner');
    const savedRepo = localStorage.getItem('gh_repo');
    const savedBranch = localStorage.getItem('gh_branch');
    if (savedToken) tokenInput.value = savedToken;
    if (savedOwner) ownerInput.value = savedOwner;
    if (savedRepo) repoInput.value = savedRepo;
    if (savedBranch) branchInput.value = savedBranch;

    // Auto-suggest from URL
    if (!savedOwner && !savedRepo) {
        try {
            const url = window.location.href;
            const match = url.match(/https?:\/\/([^.]+)\.github\.io\/([^/?#]+)/);
            if (match) {
                const owner = match[1];
                const repo = match[2];
                if (repo) {
                    ownerInput.value = owner;
                    repoInput.value = repo;
                    branchInput.value = 'main';
                } else {
                    ownerInput.value = owner;
                    repoInput.value = `${owner}.github.io`;
                    branchInput.value = 'master';
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (savedToken && savedOwner && savedRepo) {
        setTimeout(() => connect(), 300);
    }

    // Resize handler
    window.addEventListener('resize', () => {
        if (window.innerWidth > 640) sidebar.classList.remove('open');
        const isMobile = window.innerWidth <= 640;
        document.querySelectorAll('.card-actions').forEach(el => {
            if (isMobile) el.classList.add('always-visible');
            else el.classList.remove('always-visible');
        });
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 640) {
            if (e.target.closest('.file-card') || e.target.closest('.tree-item')) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Initial toast
    toast('FileForge – connect to GitHub', 'info', 3000);
    console.log('🚀 FileForge – modular version with touch fix');
}

// Run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}