import { state, getSelectedItems, setClipboard, clearClipboard } from './state.js';
import { toast, showModal, updateToolbarPasteButton } from './ui.js';
import { copyFolderTo, copyFileTo } from './clipboard.js'; // we'll define later

let touchTimer = null;
let touchStartX = 0, touchStartY = 0;
let isLongPress = false;
let isDragging = false;
let dragItems = [];

export function attachDragEvents(card, item) {
    const isFolder = item.type === 'dir';

    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
        isDragging = true;
        if (state.selectedPaths.size > 1 && state.selectedPaths.has(item.path)) {
            dragItems = [];
            for (const selPath of state.selectedPaths) {
                const found = state.currentFileItems.find(f => f.path === selPath);
                if (found) {
                    dragItems.push({
                        path: found.path,
                        name: found.name,
                        isFolder: found.type === 'dir',
                    });
                }
            }
        } else {
            dragItems = [{ path: item.path, name: item.name, isFolder: isFolder }];
        }
        e.dataTransfer.setData('text/plain', JSON.stringify(dragItems));
        e.dataTransfer.effectAllowed = 'copyMove';
    });

    card.addEventListener('dragend', () => {
        isDragging = false;
        document.querySelectorAll('.file-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (isFolder) {
            card.classList.add('drag-over');
        }
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (!isFolder) return;
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;
        try {
            const sourceItems = JSON.parse(rawData);
            if (!Array.isArray(sourceItems)) {
                const single = [sourceItems];
                await handleDropItems(single, item.path);
            } else {
                await handleDropItems(sourceItems, item.path);
            }
        } catch (err) {
            toast(`Operation failed: ${err.message}`, 'error');
        }
    });

    // ===== TOUCH HANDLING (fixed: only long-press triggers context menu, drag after movement) =====
    card.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isLongPress = false;
        touchTimer = setTimeout(() => {
            isLongPress = true;
            // Long press -> select and show context menu
            if (!state.selectedPaths.has(item.path)) {
                state.selectedPaths.clear();
                state.selectedPaths.add(item.path);
                // Update UI via event
                document.dispatchEvent(new CustomEvent('selection-update'));
                if (!state.selectionMode) {
                    state.selectionMode = true;
                    document.dispatchEvent(new CustomEvent('toolbar-show'));
                }
            }
            state.config.ctxTarget = {
                type: isFolder ? 'folder' : 'file',
                path: item.path,
                name: item.name,
                sha: item.sha || null,
                isFolder: isFolder,
            };
            // Show context menu at touch position
            document.dispatchEvent(new CustomEvent('ctxmenu-show', { detail: { x: touch.clientX, y: touch.clientY } }));
        }, 600);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) { // threshold increased to avoid accidental drag
            clearTimeout(touchTimer);
            isLongPress = false;
            if (!isDragging) {
                isDragging = true;
                if (state.selectedPaths.size > 1 && state.selectedPaths.has(item.path)) {
                    dragItems = [];
                    for (const selPath of state.selectedPaths) {
                        const found = state.currentFileItems.find(f => f.path === selPath);
                        if (found) {
                            dragItems.push({
                                path: found.path,
                                name: found.name,
                                isFolder: found.type === 'dir',
                            });
                        }
                    }
                } else {
                    dragItems = [{ path: item.path, name: item.name, isFolder: isFolder }];
                }
            }
        }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
        clearTimeout(touchTimer);
        if (isLongPress) {
            isLongPress = false;
            return;
        }
        if (isDragging) {
            const touch = e.changedTouches[0];
            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            const folderCard = dropTarget?.closest('.file-card.folder');
            if (folderCard) {
                const destPath = folderCard.dataset.path;
                const dropEvent = new Event('drop');
                dropEvent.dataTransfer = {
                    getData: () => JSON.stringify(dragItems),
                };
                folderCard.dispatchEvent(dropEvent);
            }
            isDragging = false;
            dragItems = [];
            document.querySelectorAll('.file-card.drag-over').forEach(el => el.classList.remove('drag-over'));
            e.preventDefault();
            return;
        }
        // Single tap – do nothing (no copy)
    }, { passive: true });
}

async function handleDropItems(sourceItems, destDir) {
    const action = await showModal(
        'Copy or Move?',
        `What would you like to do with ${sourceItems.length} item(s)?`,
        'Copy',
        'Move'
    );
    for (const src of sourceItems) {
        const srcObj = { ...src, isFolder: src.isFolder === 'true' };
        if (action) {
            await copyItemTo(srcObj, destDir);
        } else {
            await moveItemTo(srcObj, destDir);
        }
    }
    document.dispatchEvent(new CustomEvent('navigate', { detail: { path: state.config.currentPath } }));
    toast(`Operation completed for ${sourceItems.length} item(s)`, 'success');
}

// These functions need to be imported from clipboard.js (we'll create that)
// For simplicity, we'll define them here.
async function copyItemTo(source, destDir) {
    // Placeholder – we'll import actual functions
    // We'll move to clipboard.js later
}

async function moveItemTo(source, destDir) {
    // Placeholder
}