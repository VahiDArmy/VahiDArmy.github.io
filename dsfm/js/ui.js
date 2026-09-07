import { state, clearSelection, exitSelectionMode, toggleSelection, getSelectedItems, setClipboard, clearClipboard, normalizePath } from './state.js';
import { getContents, createFolder, createOrUpdateFile, deleteFile, deleteFolder, getFileUrl } from './github.js';
import { openFile, closeEditor } from './editor.js';
import { getFileIconSVG } from './icons.js'; // we'll define icons.js

// ===== TOAST =====
export function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `
        <span class="t-icon ${type}"><i class="fas ${icons[type] || icons.info}"></i></span>
        <span class="t-msg">${message}</span>
        <button class="t-close"><i class="fas fa-times"></i></button>
    `;
    el.addEventListener('click', (e) => {
        if (e.target.closest('.t-close')) return;
        const msg = el.querySelector('.t-msg').textContent;
        navigator.clipboard.writeText(msg).then(() => {
            el.classList.add('copied');
            setTimeout(() => el.classList.remove('copied'), 800);
            const copyToast = document.createElement('div');
            copyToast.className = 'toast';
            copyToast.style.borderColor = 'var(--success)';
            copyToast.style.boxShadow = '0 16px 50px rgba(0,0,0,0.5), 0 0 30px rgba(76,217,160,0.15)';
            copyToast.innerHTML = `
                <span class="t-icon success"><i class="fas fa-check-circle"></i></span>
                <span class="t-msg">Copied!</span>
                <button class="t-close"><i class="fas fa-times"></i></button>
            `;
            copyToast.querySelector('.t-close').addEventListener('click', () => {
                copyToast.classList.add('removing');
                setTimeout(() => copyToast.remove(), 250);
            });
            container.appendChild(copyToast);
            setTimeout(() => {
                if (copyToast.parentNode) {
                    copyToast.classList.add('removing');
                    setTimeout(() => copyToast.remove(), 250);
                }
            }, 1500);
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = msg;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Copied!', 'success', 1200);
        });
    });
    el.querySelector('.t-close').addEventListener('click', (e) => {
        e.stopPropagation();
        el.classList.add('removing');
        setTimeout(() => el.remove(), 250);
    });
    container.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 250);
        }
    }, duration);
}

// ===== MODAL =====
let modalResolve = null;
export function showModal(title, message, confirmText = 'OK', cancelText = 'Cancel', isDanger = false) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('modalConfirm').textContent = confirmText;
        document.getElementById('modalCancel').textContent = cancelText;
        const confirmBtn = document.getElementById('modalConfirm');
        confirmBtn.className = 'btn ' + (isDanger ? 'btn-danger' : 'btn-confirm');
        modalResolve = resolve;
        overlay.classList.add('active');
    });
}

// Modal events (set up once)
export function setupModal() {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalConfirm').addEventListener('click', () => {
        overlay.classList.remove('active');
        if (modalResolve) modalResolve(true);
    });
    document.getElementById('modalCancel').addEventListener('click', () => {
        overlay.classList.remove('active');
        if (modalResolve) modalResolve(false);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            if (modalResolve) modalResolve(false);
        }
    });
}

// ===== RENDER FILE LIST =====
export async function renderFileList(items, path) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    // Upload zone
    const uploadZone = document.createElement('div');
    uploadZone.className = 'upload-zone-top';
    uploadZone.id = 'uploadZoneTop';
    uploadZone.innerHTML = `
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Upload</span>
        <input type="file" id="fileInputTop" multiple />
    `;
    fileList.appendChild(uploadZone);
    setupUploadZoneTop();

    if (!items || items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1 / -1';
        empty.innerHTML = `<i class="fas fa-folder-open"></i><p>Empty folder</p>`;
        fileList.appendChild(empty);
        clearSelection();
        exitSelectionMode();
        return;
    }

    const folders = items.filter(i => i.type === 'dir');
    const files = items.filter(i => i.type !== 'dir');
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    const tree = [...folders, ...files];
    state.currentFileItems = tree;

    for (let i = 0; i < tree.length; i++) {
        const item = tree[i];
        const isFolder = item.type === 'dir';
        const card = document.createElement('div');
        card.className = 'file-card';
        if (isFolder) card.classList.add('folder');
        else card.classList.add('file');

        const iconSVG = getFileIconSVG(item.name, isFolder);
        const isHtml = !isFolder && (item.name.endsWith('.html') || item.name.endsWith('.htm'));

        // Selection indicator
        const indicator = document.createElement('div');
        indicator.className = 'selection-indicator';
        indicator.innerHTML = '<i class="fas fa-check"></i>';
        card.appendChild(indicator);

        card.innerHTML += `
            <div class="f-icon">${iconSVG}</div>
            <div class="f-name">${item.name}</div>
            ${item.size ? `<div class="f-size">${formatSize(item.size)}</div>` : ''}
            <div class="card-actions">
                ${isHtml ? `<button class="action-btn open-btn" title="Open"><i class="fas fa-external-link-alt"></i></button>` : ''}
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        card.appendChild(indicator);

        card.dataset.path = item.path;
        card.dataset.name = item.name;
        card.dataset.type = isFolder ? 'folder' : 'file';
        card.dataset.sha = item.sha || '';
        card.dataset.isFolder = isFolder;
        card.dataset.index = i;

        const isSelected = state.selectedPaths.has(item.path);
        if (isSelected) card.classList.add('selected');
        if (state.clipboard.operation === 'cut' && state.clipboard.items.some(c => c.path === item.path)) {
            card.classList.add('cut');
        }

        // --- Attach drag and touch events (handled in drag.js) ---
        // We'll export a function to attach drag events, to keep ui.js focused on rendering.
        // But we can also attach them here, but to keep separation, we'll import and call a function from drag.js later.
        // For simplicity, we'll attach them here but delegate to drag module later.
        // In the main app, we'll call attachDragEvents(card, item) from drag.js after rendering.
        // We'll store the card and item temporarily.
        card._item = item;

        // Click handler
        card.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            if (e.target.closest('.selection-indicator')) return;

            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            if (state.selectionMode || ctrl || shift) {
                if (ctrl) {
                    toggleSelection(item.path);
                    updateSelectionUI();
                    updateDownloadButton();
                    e.preventDefault();
                    return;
                }
                if (shift) {
                    if (state.lastClickedIndex >= 0) {
                        const start = Math.min(state.lastClickedIndex, i);
                        const end = Math.max(state.lastClickedIndex, i);
                        for (let j = start; j <= end; j++) {
                            const pathToSelect = tree[j].path;
                            if (!state.selectedPaths.has(pathToSelect)) {
                                state.selectedPaths.add(pathToSelect);
                            }
                        }
                        updateSelectionUI();
                        updateDownloadButton();
                        e.preventDefault();
                        return;
                    }
                }
                toggleSelection(item.path);
                updateSelectionUI();
                updateDownloadButton();
                e.preventDefault();
                return;
            }

            if (isFolder) {
                // Navigate (handled by app)
                // We'll dispatch a custom event
                document.dispatchEvent(new CustomEvent('navigate', { detail: { path: item.path } }));
            } else {
                openFile(item);
            }
        });

        card.addEventListener('mousedown', (e) => {
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                state.lastClickedIndex = i;
            }
        });

        // Context menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!state.selectedPaths.has(item.path)) {
                state.selectedPaths.clear();
                state.selectedPaths.add(item.path);
                updateSelectionUI();
                updateDownloadButton();
                if (!state.selectionMode) {
                    state.selectionMode = true;
                    showToolbar();
                }
            }
            state.config.ctxTarget = {
                type: isFolder ? 'folder' : 'file',
                path: item.path,
                name: item.name,
                sha: item.sha || null,
                isFolder: isFolder,
            };
            showCtxMenu(e.clientX, e.clientY);
        });

        // Action buttons
        const openBtn = card.querySelector('.open-btn');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = getFileUrl(item.path);
                if (url) window.open(url, '_blank');
                else toast('GitHub Pages URL not configured', 'warning');
                toast(`Opening ${item.path}`, 'info', 1500);
            });
        }

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleDelete({
                type: isFolder ? 'folder' : 'file',
                path: item.path,
                name: item.name,
                sha: item.sha || null,
                isFolder: isFolder,
                isRoot: false,
            });
        });

        fileList.appendChild(card);
    }

    if (window.innerWidth <= 640) {
        document.querySelectorAll('.card-actions').forEach(el => el.classList.add('always-visible'));
    }
    updateDownloadButton();

    // If selection mode is on, show toolbar
    if (state.selectionMode) {
        showToolbar();
    }
}

function formatSize(bytes) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(1)} ${units[i]}`;
}

// Upload zone setup
function setupUploadZoneTop() {
    const zone = document.getElementById('uploadZoneTop');
    const input = document.getElementById('fileInputTop');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const targetPath = state.config.currentPath || '';
        let successCount = 0;
        for (const file of files) {
            const ok = await uploadFile(file, targetPath);
            if (ok) successCount++;
        }
        document.dispatchEvent(new CustomEvent('navigate', { detail: { path: state.config.currentPath } }));
        // Refresh tree will be handled by app
        input.value = '';
        toast(`Uploaded ${successCount} file(s)`, 'success');
    });
}

async function uploadFile(file, targetPath) {
    const cleanTarget = normalizePath(targetPath);
    const path = cleanTarget ? `${cleanTarget}/${file.name}` : file.name;
    const isText = file.type.startsWith('text/') ||
        file.name.match(/\.(txt|html|css|js|py|json|md|xml|yml|yaml|sh|bash|svg)$/i);

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let content = e.target.result;
                let data = isText ? content : atob(content.split(',')[1] || '');

                let existingSha = null;
                let fileExists = false;
                try {
                    const existing = await getContents(path, state.config.branch);
                    if (existing && !Array.isArray(existing) && existing.sha) {
                        existingSha = existing.sha;
                        fileExists = true;
                    }
                } catch (err) {
                    if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
                        fileExists = false;
                    } else {
                        toast(`Error checking ${file.name}: ${err.message}`, 'error');
                        resolve(false);
                        return;
                    }
                }

                if (fileExists && existingSha) {
                    const overwrite = await showModal(
                        'File exists',
                        `"${file.name}" already exists. Overwrite?`,
                        'Overwrite',
                        'Skip',
                        true
                    );
                    if (!overwrite) {
                        toast(`Skipped ${file.name}`, 'warning');
                        resolve(false);
                        return;
                    }
                    await createOrUpdateFile(path, data, `Overwrite ${file.name}`, existingSha);
                    toast(`Overwrote ${file.name}`, 'success');
                } else {
                    await createOrUpdateFile(path, data, `Upload ${file.name}`, null);
                    toast(`Uploaded ${file.name}`, 'success');
                }
                resolve(true);
            } catch (err) {
                toast(`Upload error for ${file.name}: ${err.message}`, 'error');
                resolve(false);
            }
        };
        reader.onerror = () => {
            toast(`Failed to read ${file.name}`, 'error');
            resolve(false);
        };
        isText ? reader.readAsText(file) : reader.readAsDataURL(file);
    });
}

// ===== SELECTION UI =====
export function updateSelectionUI() {
    const cards = document.querySelectorAll('#fileList .file-card');
    cards.forEach(card => {
        const path = card.dataset.path;
        if (state.selectedPaths.has(path)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

export function updateDownloadButton() {
    const count = state.selectedPaths.size;
    const btn = document.getElementById('downloadSelectedBtn');
    const span = document.getElementById('selectedCount');
    if (count > 0) {
        btn.style.display = 'inline-flex';
        span.textContent = count;
    } else {
        btn.style.display = 'none';
    }
}

// ===== TOOLBAR =====
export function showToolbar() {
    const toolbar = document.getElementById('selectionToolbar');
    toolbar.classList.add('active');
    updateToolbarPasteButton();
}

export function hideToolbar() {
    document.getElementById('selectionToolbar').classList.remove('active');
}

export function updateToolbarPasteButton() {
    const hasItems = state.clipboard.items.length > 0;
    const pasteBtn = document.getElementById('toolbarPaste');
    pasteBtn.style.opacity = hasItems ? '1' : '0.4';
    pasteBtn.style.pointerEvents = hasItems ? 'auto' : 'none';
}

// ===== CONTEXT MENU =====
export function showCtxMenu(x, y) {
    const menu = document.getElementById('ctxMenu');
    const w = Math.min(170, window.innerWidth - 16);
    menu.style.width = w + 'px';
    let left = Math.min(x, window.innerWidth - w - 6);
    let top = Math.min(y, window.innerHeight - 280);
    top = Math.max(6, top);
    left = Math.max(6, left);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('open');
}

export function closeCtxMenu() {
    document.getElementById('ctxMenu').classList.remove('open');
    state.config.ctxTarget = null;
}

// ===== CONTEXT ACTIONS (to be used by app) =====
export async function handleDelete(target) {
    if (target.isRoot) return toast('Cannot delete root', 'warning');
    const confirmed = await showModal(
        'Delete?',
        `Delete "${target.name}" permanently?`,
        'Delete',
        'Cancel',
        true
    );
    if (!confirmed) return;
    try {
        if (target.isFolder) {
            const items = await getContents(target.path, state.config.branch);
            const files = Array.isArray(items) ? items : [];
            for (const item of files) {
                await deleteFile(item.path, item.sha, `Delete ${item.name}`);
            }
            try {
                const data = await getContents(`${target.path}/.gitkeep`, state.config.branch);
                if (data && data.sha) await deleteFile(`${target.path}/.gitkeep`, data.sha, 'Delete folder');
            } catch (e) { /* ignore */ }
            toast(`Deleted folder ${target.name}`, 'success');
        } else {
            await deleteFile(target.path, target.sha, `Delete ${target.name}`);
            toast(`Deleted ${target.name}`, 'success');
            if (state.editor.currentFile && state.editor.currentFile.path === target.path) closeEditor();
        }
        if (state.selectedPaths.has(target.path)) {
            state.selectedPaths.delete(target.path);
            updateDownloadButton();
            if (state.selectedPaths.size === 0 && state.selectionMode) exitSelectionMode();
        }
        document.dispatchEvent(new CustomEvent('navigate', { detail: { path: state.config.currentPath } }));
        // Refresh tree handled by app
    } catch (e) { toast(`Delete error: ${e.message}`, 'error'); }
}

// ===== RENDER TREE =====
export function renderTree(items, path, container) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="tree-empty"><i class="fas fa-folder-open"></i><br />Empty</div>';
        return;
    }
    const folders = [];
    const files = [];
    for (const item of items) {
        if (item.type === 'dir') folders.push(item);
        else files.push(item);
    }
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    const sorted = [...folders, ...files];
    for (const item of sorted) {
        const div = document.createElement('div');
        div.className = 'tree-item';
        if (item.type === 'dir') div.classList.add('folder');
        else div.classList.add('file');
        if (item.path === state.config.currentPath) div.classList.add('active');

        const iconSVG = getFileIconSVG(item.name, item.type === 'dir');
        div.innerHTML = `
            <span class="icon">${iconSVG}</span>
            <span class="name">${item.name}</span>
            ${item.type === 'dir' ? `<span class="chevron"><i class="fas fa-chevron-right"></i></span>` : ''}
        `;
        div.dataset.path = item.path;
        div.dataset.name = item.name;
        div.dataset.type = item.type === 'dir' ? 'folder' : 'file';

        if (item.type === 'dir') {
            const chevron = div.querySelector('.chevron');
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            div.appendChild(childContainer);

            div.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = childContainer.classList.contains('open');
                if (isOpen) {
                    childContainer.classList.remove('open');
                    chevron.classList.remove('open');
                } else {
                    childContainer.classList.add('open');
                    chevron.classList.add('open');
                    if (childContainer.children.length === 0) {
                        loadFolderChildren(item.path, childContainer);
                    }
                }
            });

            if (item.path === state.config.currentPath) {
                childContainer.classList.add('open');
                chevron.classList.add('open');
                loadFolderChildren(item.path, childContainer);
            }
        } else {
            div.addEventListener('click', () => {
                // Open file (use openFile from editor)
                openFile(item);
            });
        }
        container.appendChild(div);
    }
}

async function loadFolderChildren(path, container) {
    try {
        const items = await getContents(path, state.config.branch);
        renderTree(Array.isArray(items) ? items : [], path, container);
    } catch (e) {
        container.innerHTML = `<div class="tree-empty text-muted">Error: ${e.message}</div>`;
    }
}