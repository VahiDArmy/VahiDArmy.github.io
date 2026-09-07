import { state, clearClipboard } from './state.js';
import { getContents, createOrUpdateFile, deleteFile, deleteFolder, createFolder } from './github.js';
import { toast, showModal } from './ui.js';

export async function copyFileTo(item, destDir) {
    const destPath = destDir ? `${destDir}/${item.name}` : item.name;

    let sourceData;
    try {
        sourceData = await getContents(item.path, state.config.branch);
        if (!sourceData || Array.isArray(sourceData)) {
            toast(`Source file "${item.name}" not found or is a directory`, 'error');
            return;
        }
    } catch (e) {
        console.error('Source check error:', e);
        toast(`Source file "${item.name}" not found: ${e.message}`, 'error');
        return;
    }

    let destExists = null;
    try {
        destExists = await getContents(destPath, state.config.branch);
    } catch (e) {
        if (!e.message || (!e.message.includes('404') && !e.message.includes('Not Found'))) {
            toast(`Error checking destination: ${e.message}`, 'error');
            return;
        }
    }

    if (destExists && !Array.isArray(destExists) && destExists.sha) {
        const overwrite = await showModal(
            'File exists',
            `"${item.name}" already exists in the destination. Overwrite?`,
            'Overwrite',
            'Skip',
            false
        );
        if (!overwrite) {
            toast(`Skipped ${item.name}`, 'warning');
            return;
        }
        const sourceContent = sourceData.content ? atob(sourceData.content) : '';
        const decoded = decodeURIComponent(escape(sourceContent));
        await createOrUpdateFile(destPath, decoded, `Overwrite ${item.name}`, destExists.sha);
        toast(`Overwrote ${item.name}`, 'success');
    } else {
        const sourceContent = sourceData.content ? atob(sourceData.content) : '';
        const decoded = decodeURIComponent(escape(sourceContent));
        await createOrUpdateFile(destPath, decoded, `Copy ${item.name} to ${destDir || 'root'}`, null);
        toast(`Copied ${item.name} to ${destDir || 'root'}`, 'success');
    }
}

export async function copyFolderTo(item, destDir) {
    const destPath = destDir ? `${destDir}/${item.name}` : item.name;

    let sourceContents;
    try {
        sourceContents = await getContents(item.path);
    } catch (e) {
        toast(`Source folder "${item.name}" not found: ${e.message}`, 'error');
        return;
    }

    if (!Array.isArray(sourceContents)) {
        toast(`Folder "${item.name}" appears empty or invalid`, 'warning');
        return;
    }

    try {
        await createFolder(destPath);
    } catch (e) {
        console.warn('createFolder warning:', e);
    }

    for (const child of sourceContents) {
        try {
            if (child.type === 'dir') {
                await copyFolderTo(child, destPath);
            } else {
                const fileItem = {
                    path: child.path,
                    name: child.name,
                    isFolder: false,
                    sha: child.sha || null,
                };
                await copyFileTo(fileItem, destPath);
            }
        } catch (e) {
            toast(`Failed to copy ${child.name}: ${e.message}`, 'error');
        }
    }
}

export async function copyItemTo(source, destDir) {
    if (source.isFolder) {
        await copyFolderTo(source, destDir);
    } else {
        await copyFileTo(source, destDir);
    }
    toast(`Copied ${source.name} to ${destDir || 'root'}`, 'success');
}

export async function moveItemTo(source, destDir) {
    if (source.isFolder) {
        await copyFolderTo(source, destDir);
    } else {
        await copyFileTo(source, destDir);
    }
    try {
        const existing = await getContents(source.path, state.config.branch);
        if (existing && existing.sha) {
            if (source.isFolder) {
                await deleteFolder(source.path);
            } else {
                await deleteFile(source.path, existing.sha, `Move ${source.name}`);
            }
            toast(`Moved ${source.name} to ${destDir || 'root'}`, 'success');
        } else {
            toast(`Could not find ${source.name} to delete`, 'error');
        }
    } catch (e) {
        toast(`Failed to delete ${source.name}: ${e.message}`, 'error');
    }
    clearClipboard();
}