import { state, normalizePath } from './state.js';
import { getContents, createOrUpdateFile, getFileUrl } from './github.js';
import { toast } from './ui.js';

let updateTimeout = null;
let previewTimeout = null;

export function detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        html: 'html',
        htm: 'html',
        css: 'css',
        js: 'javascript',
        json: 'json',
        py: 'python',
        md: 'markdown',
        txt: 'text',
        xml: 'xml',
        svg: 'svg',
        yml: 'yaml',
        yaml: 'yaml',
        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',
    };
    return map[ext] || 'text';
}

export async function openFile(item) {
    try {
        if (item.type === 'dir') {
            document.dispatchEvent(new CustomEvent('navigate', { detail: { path: item.path } }));
            return;
        }
        state.editor.currentFile = item;
        state.editor.currentFileLanguage = detectLanguage(item.name);
        state.config.currentSha = item.sha || null;

        const data = await getContents(item.path, state.config.branch);
        let content = '';
        if (data.content) content = decodeURIComponent(escape(atob(data.content)));
        state.editor.currentFileContent = content;
        state.config.currentSha = data.sha || null;

        const editorWrap = document.getElementById('editorWrap');
        const fileList = document.getElementById('fileList');
        document.getElementById('editorFileNameText').textContent = item.name;
        document.getElementById('editorTextarea').value = content;
        editorWrap.classList.add('visible');
        fileList.style.display = 'none';
        document.getElementById('highlightPreview').classList.remove('visible');
        document.getElementById('pythonOutput').classList.remove('visible');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="edit"]').classList.add('active');
        document.getElementById('editorTextarea').style.display = 'block';

        const isPython = state.editor.currentFileLanguage === 'python';
        document.getElementById('pythonTabBtn').style.display = isPython ? 'inline-flex' : 'none';

        const isHtml = state.editor.currentFileLanguage === 'html' || item.name.endsWith('.htm');
        document.getElementById('openBrowserBtn').classList.toggle('visible', isHtml);

        updateLineNumbers();
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(updatePreview, 150);
        toast(`Opened ${item.name}`, 'info', 1200);
    } catch (e) {
        toast(`Error opening: ${e.message}`, 'error');
    }
}

export function closeEditor() {
    const editorWrap = document.getElementById('editorWrap');
    const fileList = document.getElementById('fileList');
    editorWrap.classList.remove('visible');
    fileList.style.display = 'grid';
    state.editor.currentFile = null;
    state.editor.currentFileContent = '';
    document.getElementById('editorTextarea').value = '';
    document.getElementById('highlightPreview').innerHTML = '';
    document.getElementById('pythonOutputContent').innerHTML = '';
    document.getElementById('pythonOutput').classList.remove('visible');
    document.getElementById('openBrowserBtn').classList.remove('visible');
    document.getElementById('lineNumbers').innerHTML = '';
    clearTimeout(previewTimeout);
}

export async function saveCurrentFile() {
    if (!state.editor.currentFile) return toast('No file open', 'warning');
    const content = document.getElementById('editorTextarea').value;
    const path = state.editor.currentFile.path;
    const sha = state.config.currentSha || null;
    try {
        const result = await createOrUpdateFile(path, content, `Update ${path}`, sha);
        state.config.currentSha = result.content.sha;
        toast(`Saved ${state.editor.currentFile.name}`, 'success');
        document.dispatchEvent(new CustomEvent('navigate', { detail: { path: state.config.currentPath } }));
    } catch (e) {
        toast(`Save error: ${e.message}`, 'error');
    }
}

// Line numbers
let lineUpdatePending = false;
function updateLineNumbers() {
    if (lineUpdatePending) return;
    lineUpdatePending = true;
    requestAnimationFrame(() => {
        const text = document.getElementById('editorTextarea').value;
        const lines = text.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) html += `<span>${i}</span>`;
        document.getElementById('lineNumbers').innerHTML = html;
        document.getElementById('lineNumbers').scrollTop = document.getElementById('editorTextarea').scrollTop;
        lineUpdatePending = false;
    });
}

function updatePreview() {
    const lang = state.editor.currentFileLanguage;
    const code = document.getElementById('editorTextarea').value;
    state.editor.currentFileContent = code;
    const preview = document.getElementById('highlightPreview');
    if (lang === 'text' || lang === 'markdown') {
        preview.innerHTML = `<code>${escapeHtml(code)}</code>`;
    } else {
        preview.innerHTML = `<code class="language-${lang}">${escapeHtml(code)}</code>`;
    }
    if (window.Prism) {
        try { Prism.highlightElement(preview.querySelector('code')); } catch (e) { /* ignore */ }
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Editor event bindings (called from app)
export function initEditorEvents() {
    const editorTextarea = document.getElementById('editorTextarea');
    const lineNumbers = document.getElementById('lineNumbers');

    editorTextarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = editorTextarea.scrollTop;
    });

    editorTextarea.addEventListener('input', () => {
        state.editor.currentFileContent = editorTextarea.value;
        updateLineNumbers();
        if (document.querySelector('[data-tab="preview"]').classList.contains('active')) {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(updatePreview, 200);
        }
    });

    document.getElementById('saveFileBtn').addEventListener('click', saveCurrentFile);
    document.getElementById('closeEditorBtn').addEventListener('click', closeEditor);

    document.getElementById('openBrowserBtn').addEventListener('click', () => {
        if (!state.editor.currentFile) return;
        const url = getFileUrl(state.editor.currentFile.path);
        if (url) {
            window.open(url, '_blank');
            toast(`Opening ${state.editor.currentFile.path}`, 'info', 1200);
        } else {
            toast('GitHub Pages URL not configured', 'warning');
        }
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const editorTextarea = document.getElementById('editorTextarea');
            const highlightPreview = document.getElementById('highlightPreview');
            const pythonOutput = document.getElementById('pythonOutput');

            editorTextarea.style.display = 'none';
            highlightPreview.classList.remove('visible');
            pythonOutput.classList.remove('visible');

            if (tab === 'edit') {
                editorTextarea.style.display = 'block';
                updateLineNumbers();
            } else if (tab === 'preview') {
                updatePreview();
                highlightPreview.classList.add('visible');
            } else if (tab === 'python') {
                pythonOutput.classList.add('visible');
                runPythonCode();
            }
        });
    });
}

// ===== PYTHON =====
let pyodideReady = false;
let pyodideInstance = null;
let pyodideLoading = false;

async function loadPyodide() {
    if (pyodideReady) return pyodideInstance;
    if (pyodideLoading) {
        toast('Python loading...', 'info', 1500);
        return null;
    }
    pyodideLoading = true;
    try {
        toast('Loading Python...', 'info', 2000);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
        pyodideInstance = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        });
        pyodideReady = true;
        pyodideLoading = false;
        toast('Python ready!', 'success');
        return pyodideInstance;
    } catch (e) {
        pyodideLoading = false;
        toast(`Python error: ${e.message}`, 'error');
        throw e;
    }
}

async function runPythonCode() {
    if (!pyodideReady) {
        try {
            const instance = await loadPyodide();
            if (!instance) return;
        } catch (e) {
            const output = document.getElementById('pythonOutputContent');
            output.innerHTML = `<span class="out-error">Failed to load Python</span>`;
            document.getElementById('pythonOutput').classList.add('visible');
            return;
        }
    }
    const code = document.getElementById('editorTextarea').value;
    const output = document.getElementById('pythonOutputContent');
    if (!code.trim()) {
        output.innerHTML = '<span class="text-muted">No code</span>';
        document.getElementById('pythonOutput').classList.add('visible');
        return;
    }
    output.innerHTML = '<span class="text-muted"><i class="fas fa-spinner fa-spin"></i> Running...</span>';
    document.getElementById('pythonOutput').classList.add('visible');

    try {
        pyodideInstance.runPython(`
            import sys
            from io import StringIO
            sys.stdout = StringIO()
        `);
        await pyodideInstance.runPythonAsync(code);
        const result = pyodideInstance.runPython('sys.stdout.getvalue()');
        output.innerHTML = `<span class="out-success">${escapeHtml(result) || '(no output)'}</span>`;
    } catch (e) {
        output.innerHTML = `<span class="out-error">${escapeHtml(e.message || String(e))}</span>`;
    }
}