import { state } from './state.js';
import { toast } from './ui.js';

export function attachDragEvents(card, item) {
    const isFolder = item.type === 'dir';
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // ── Desktop: native drag & drop ──
    if (!isTouchDevice) {
        card.draggable = true;

        card.addEventListener('dragstart', (e) => {
            let dragItems = [];
            if (state.selectedPaths.size > 1 && state.selectedPaths.has(item.path)) {
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
            document.querySelectorAll('.file-card.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (isFolder) card.classList.add('drag-over');
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
                const items = Array.isArray(sourceItems) ? sourceItems : [sourceItems];
                document.dispatchEvent(new CustomEvent('drop-items', { detail: { items, destDir: item.path } }));
            } catch (err) {
                toast(`Operation failed: ${err.message}`, 'error');
            }
        });
    }

    // ── Touch: only long‑press (NO drag) ──
    if (isTouchDevice) {
        let touchTimer = null;
        let touchStart = null;

        card.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            touchStart = { x: touch.clientX, y: touch.clientY };
            touchTimer = setTimeout(() => {
                // Long press -> select + show context menu
                if (!state.selectedPaths.has(item.path)) {
                    state.selectedPaths.clear();
                    state.selectedPaths.add(item.path);
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
                    isFolder,
                };
                document.dispatchEvent(new CustomEvent('ctxmenu-show', { detail: { x: touch.clientX, y: touch.clientY } }));
            }, 600);
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (touchTimer && touchStart) {
                const touch = e.touches[0];
                const dx = touch.clientX - touchStart.x;
                const dy = touch.clientY - touchStart.y;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            }
        }, { passive: true });

        card.addEventListener('touchend', () => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        }, { passive: true });
    }
}