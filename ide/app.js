/* ============================================================
   NeonPy Multi — Multi-file Python IDE
   File tree + tabs + Pyodide
   ============================================================ */

(function () {
  "use strict";

  // ---------- State ----------
  let editor = null;
  let pyodide = null;
  let isReady = false;
  let isRunning = false;

  // Virtual file system (in memory)
  let fs = {
    name: "project",
    type: "folder",
    open: true,
    children: [
      {
        name: "src",
        type: "folder",
        open: true,
        children: [
          {
            name: "main.py",
            type: "file",
            content: `# main.py — entry point
print("◈ NeonPy Multi-file IDE")
print("─" * 36)

from utils import greet, add

print(greet("Developer"))
print("2 + 3 =", add(2, 3))

print("\\nOpen other files from the left sidebar!")
`
          },
          {
            name: "utils.py",
            type: "file",
            content: `# utils.py — helper functions

def greet(name="world"):
    return f"Hello, {name}! ✨"

def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
`
          }
        ]
      },
      {
        name: "tests",
        type: "folder",
        open: false,
        children: [
          {
            name: "test_utils.py",
            type: "file",
            content: `# test_utils.py
# Simple tests (run this file to see results)

def test_add():
    assert 2 + 3 == 5
    print("✓ test_add passed")

def test_multiply():
    assert 4 * 5 == 20
    print("✓ test_multiply passed")

if __name__ == "__main__":
    test_add()
    test_multiply()
    print("\\nAll tests passed!")
`
          }
        ]
      },
      {
        name: "data",
        type: "folder",
        open: false,
        children: [
          {
            name: "notes.txt",
            type: "file",
            content: "This is a data folder.\\nYou can put text files here.\\n(Python can read them later if needed)"
          }
        ]
      },
      {
        name: "README.md",
        type: "file",
        content: `# My Project

This is a sample multi-file Python project.

## Structure
- src/       → source code
- tests/     → test files
- data/      → data files

Open main.py and click Run!
`
      }
    ]
  };

  // Open tabs
  let openTabs = [];
  let activePath = null;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const fileTreeEl = $("#file-tree");
  const tabsEl = $("#tabs");
  const outputEl = $("#output");
  const statusEl = $("#status");
  const statusText = statusEl.querySelector(".status-text");
  const loader = $("#loader");
  const btnRun = $("#btn-run");
  const currentFileBadge = $("#current-file-badge");
  const modal = $("#modal");
  const modalTitle = $("#modal-title");
  const modalInput = $("#modal-input");
  const sidebar = $("#sidebar");
  const btnReopen = $("#btn-reopen-sidebar");

  let modalMode = null;
  let modalParentPath = "";

  // ---------- Helpers ----------
  function setStatus(state, text) {
    statusEl.className = "status " + state;
    statusText.textContent = text;
  }

  function appendOutput(text, type = "stdout") {
    const span = document.createElement("span");
    span.className = type;
    span.textContent = text;
    outputEl.appendChild(span);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clearOutput() {
    outputEl.innerHTML = "";
  }

  function findNode(path) {
    if (!path) return null;
    const parts = path.split("/");
    let node = fs;
    for (const part of parts) {
      if (!node.children) return null;
      node = node.children.find((c) => c.name === part);
      if (!node) return null;
    }
    return node;
  }

  // ---------- File Tree ----------
  function renderTree() {
    fileTreeEl.innerHTML = "";
    fs.children.forEach((child) => {
      fileTreeEl.appendChild(createTreeItem(child, child.name, 0));
    });
  }

  function createTreeItem(node, path, depth) {
    const item = document.createElement("div");
    item.className = "tree-item " + node.type;
    if (path === activePath) item.classList.add("active");

    const icon = document.createElement("span");
    icon.className = "icon";
    if (node.type === "folder") {
      icon.textContent = node.open ? "📂" : "📁";
    } else if (node.name.endsWith(".py")) {
      icon.textContent = "🐍";
    } else if (node.name.endsWith(".md")) {
      icon.textContent = "📄";
    } else {
      icon.textContent = "📃";
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = node.name;

    item.appendChild(icon);
    item.appendChild(nameSpan);
    item.style.paddingLeft = (0.7 + depth * 0.85) + "rem";

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (node.type === "folder") {
        node.open = !node.open;
        renderTree();
      } else {
        openFile(path);
      }
    });

    const wrapper = document.createElement("div");
    wrapper.appendChild(item);

    if (node.type === "folder" && node.open && node.children) {
      const childrenBox = document.createElement("div");
      childrenBox.className = "tree-children";
      node.children.forEach((child) => {
        const childPath = path ? path + "/" + child.name : child.name;
        childrenBox.appendChild(createTreeItem(child, childPath, depth + 1));
      });
      wrapper.appendChild(childrenBox);
    }

    return wrapper;
  }

  // ---------- Tabs ----------
  function renderTabs() {
    tabsEl.innerHTML = "";
    openTabs.forEach((tab) => {
      const el = document.createElement("div");
      el.className = "tab" + (tab.path === activePath ? " active" : "");
      el.innerHTML = `<span class="name">${tab.name}</span><span class="close" title="Close">×</span>`;
      el.querySelector(".name").addEventListener("click", () => openFile(tab.path));
      el.querySelector(".close").addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.path);
      });
      tabsEl.appendChild(el);
    });
  }

  function openFile(path) {
    const node = findNode(path);
    if (!node || node.type !== "file") return;

    if (!openTabs.find((t) => t.path === path)) {
      openTabs.push({ path, name: node.name });
    }

    activePath = path;
    currentFileBadge.textContent = path;

    if (editor) {
      saveCurrentFile();
      editor.setValue(node.content || "");
      const lang = node.name.endsWith(".py") ? "python" :
                   node.name.endsWith(".md") ? "markdown" : "plaintext";
      monaco.editor.setModelLanguage(editor.getModel(), lang);
    }

    renderTree();
    renderTabs();
  }

  function saveCurrentFile() {
    if (!activePath || !editor) return;
    const node = findNode(activePath);
    if (node && node.type === "file") {
      node.content = editor.getValue();
    }
  }

  function closeTab(path) {
    const idx = openTabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    if (path === activePath) saveCurrentFile();

    openTabs.splice(idx, 1);

    if (path === activePath) {
      if (openTabs.length > 0) {
        const newIdx = Math.min(idx, openTabs.length - 1);
        openFile(openTabs[newIdx].path);
      } else {
        activePath = null;
        currentFileBadge.textContent = "No file";
        if (editor) editor.setValue("");
        renderTree();
        renderTabs();
      }
    } else {
      renderTabs();
    }
  }

  // ---------- Create new file / folder ----------
  function showModal(mode, parentPath = "") {
    modalMode = mode;
    modalParentPath = parentPath;
    modalTitle.textContent = mode === "file" ? "New File" : "New Folder";
    modalInput.value = mode === "file" ? "new_file.py" : "new_folder";
    modalInput.placeholder = mode === "file" ? "filename.py" : "folder name";
    modal.classList.remove("hidden");
    modalInput.focus();
    modalInput.select();
  }

  function createItem() {
    const name = modalInput.value.trim();
    if (!name) return;

    let parent = fs;
    if (modalParentPath) {
      parent = findNode(modalParentPath);
      if (!parent || parent.type !== "folder") parent = fs;
    }

    if (!parent.children) parent.children = [];

    if (parent.children.some((c) => c.name === name)) {
      alert("A file or folder with that name already exists.");
      return;
    }

    if (modalMode === "file") {
      parent.children.push({
        name,
        type: "file",
        content: name.endsWith(".py") ? `# ${name}\n\nprint("Hello from ${name}")\n` : ""
      });
      const newPath = modalParentPath ? modalParentPath + "/" + name : name;
      renderTree();
      openFile(newPath);
    } else {
      parent.children.push({
        name,
        type: "folder",
        open: true,
        children: []
      });
      parent.open = true;
      renderTree();
    }

    modal.classList.add("hidden");
  }

  // ---------- Monaco ----------
  function initMonaco() {
    return new Promise((resolve) => {
      require.config({
        paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" }
      });

      require(["vs/editor/editor.main"], () => {
        monaco.editor.defineTheme("neon-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "comment", foreground: "555577", fontStyle: "italic" },
            { token: "keyword", foreground: "00f0ff", fontStyle: "bold" },
            { token: "string", foreground: "00ff9d" },
            { token: "number", foreground: "ff9d00" },
            { token: "type", foreground: "b400ff" },
            { token: "operator", foreground: "ff00aa" },
            { token: "identifier", foreground: "e0e0ff" }
          ],
          colors: {
            "editor.background": "#06060e",
            "editor.foreground": "#e0e0ff",
            "editor.lineHighlightBackground": "#0c0c18",
            "editor.selectionBackground": "#00f0ff33",
            "editorCursor.foreground": "#00f0ff",
            "editorLineNumber.foreground": "#444466",
            "editorLineNumber.activeForeground": "#00f0ff",
            "editorGutter.background": "#06060e"
          }
        });

        editor = monaco.editor.create(document.getElementById("editor"), {
          value: "",
          language: "python",
          theme: "neon-dark",
          fontSize: 14,
          fontFamily: "Consolas, Monaco, 'Courier New', monospace",
          minimap: { enabled: window.innerWidth > 1000 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "on",
          padding: { top: 10, bottom: 10 }
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCode());

        resolve();
      });
    });
  }

  // ---------- Pyodide ----------
  async function initPyodide() {
    setStatus("", "Loading Python…");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/"
    });

    pyodide.setStdout({
      batched: (text) => appendOutput(text + "\n", "stdout")
    });
    pyodide.setStderr({
      batched: (text) => appendOutput(text + "\n", "stderr")
    });

    isReady = true;
    setStatus("ready", "Ready");
    btnRun.disabled = false;
  }

  // ---------- Run current file ----------
  async function runCode() {
    if (!isReady || isRunning) return;
    if (!activePath) {
      appendOutput("No file is open. Open a .py file first.\n", "info");
      return;
    }

    const node = findNode(activePath);
    if (!node || !activePath.endsWith(".py")) {
      appendOutput("Only Python (.py) files can be run.\n", "info");
      return;
    }

    saveCurrentFile();

    isRunning = true;
    btnRun.disabled = true;
    setStatus("running", "Running…");
    clearOutput();
    appendOutput(`▶ Running: ${activePath}\n`, "info");
    appendOutput("─".repeat(40) + "\n", "info");

    const code = node.content || "";
    const start = performance.now();

    try {
      await injectProjectModules();
      await pyodide.runPythonAsync(code);

      const ms = (performance.now() - start).toFixed(0);
      appendOutput(`\n── finished in ${ms} ms ──\n`, "info");
      setStatus("ready", "Ready");
    } catch (err) {
      let msg = err.message || String(err);
      appendOutput(msg + "\n", "stderr");
      setStatus("error", "Error");
    } finally {
      isRunning = false;
      btnRun.disabled = false;
    }
  }

  // Simple module injection so basic imports work
  async function injectProjectModules() {
    const pyFiles = [];
    function walk(node, path) {
      if (node.type === "file" && node.name.endsWith(".py") && path !== activePath) {
        pyFiles.push({ path, name: node.name, content: node.content || "" });
      }
      if (node.children) {
        node.children.forEach((c) => {
          const p = path ? path + "/" + c.name : c.name;
          walk(c, p);
        });
      }
    }
    walk(fs, "");

    for (const f of pyFiles) {
      try {
        await pyodide.runPythonAsync(f.content);
      } catch (e) {
        // ignore injection errors
      }
    }
  }

  // ---------- Resizer ----------
  function initResizer() {
    const resizer = $("#resizer");
    const container = $(".editor-output");
    const editorPanel = $(".panel-editor");
    const outputPanel = $(".panel-output");
    let dragging = false;

    resizer.addEventListener("mousedown", (e) => {
      dragging = true;
      resizer.classList.add("active");
      document.body.style.cursor = window.innerWidth <= 900 ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      if (window.innerWidth <= 900) {
        const pct = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 25), 75);
        editorPanel.style.flex = `0 0 ${pct}%`;
        outputPanel.style.flex = `0 0 ${100 - pct}%`;
      } else {
        const pct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 30), 75);
        editorPanel.style.flex = `0 0 ${pct}%`;
        outputPanel.style.flex = `0 0 ${100 - pct}%`;
      }
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  // ---------- Sidebar reopen (mobile) ----------
  function updateSidebarButton() {
    if (sidebar.classList.contains("collapsed")) {
      btnReopen.classList.add("visible");
    } else {
      btnReopen.classList.remove("visible");
    }
  }

  // ---------- Events ----------
  btnRun.addEventListener("click", runCode);
  $("#btn-clear").addEventListener("click", clearOutput);

  $("#btn-new-file").addEventListener("click", () => {
    showModal("file", "");
  });
  $("#btn-new-folder").addEventListener("click", () => {
    showModal("folder", "");
  });

  $("#modal-ok").addEventListener("click", createItem);
  $("#modal-cancel").addEventListener("click", () => modal.classList.add("hidden"));
  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createItem();
    if (e.key === "Escape") modal.classList.add("hidden");
  });

  $("#btn-toggle-sidebar").addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    updateSidebarButton();
  });

  btnReopen.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
    updateSidebarButton();
  });

  // ---------- Boot ----------
  async function boot() {
    try {
      await initMonaco();
      await initPyodide();
      initResizer();

      renderTree();
      openFile("src/main.py");
      updateSidebarButton();

      loader.classList.add("hidden");
      if (editor) editor.focus();
    } catch (err) {
      console.error(err);
      setStatus("error", "Failed to load");
      loader.querySelector(".loader-text").textContent = "Failed to initialize";
      loader.querySelector(".loader-sub").textContent = String(err);
    }
  }

  boot();
})();