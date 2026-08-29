(function () {
  "use strict";

  let editor = null;
  let pyodide = null;
  let isReady = false;
  let isRunning = false;

  const DEFAULT_CODE = `# NeonPy — Cyber Python IDE
# Press Ctrl+Enter (or Cmd+Enter) to run

print("◈ Welcome to NeonPy IDE")
print("─" * 32)

nums = [1, 1, 2, 3, 5, 8, 13, 21]
print("Fibonacci:", nums)
print("Sum:", sum(nums))
print("Mean:", sum(nums) / len(nums))

squares = [n**2 for n in range(1, 8)]
print("Squares:", squares)

def greet(name="hacker"):
    return f"Hello, {name}! ✨"

print(greet("NeonCoder"))
print("\\nChange this code and hit Run!")
`;

  const $ = (sel) => document.querySelector(sel);
  const outputEl = $("#output");
  const statusEl = $("#status");
  const statusText = statusEl.querySelector(".status-text");
  const loader = $("#loader");
  const btnRun = $("#btn-run");
  const btnClear = $("#btn-clear");
  const btnReset = $("#btn-reset");

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

  function initMonaco() {
    return new Promise((resolve) => {
      require.config({
        paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
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
            { token: "identifier", foreground: "e0e0ff" },
          ],
          colors: {
            "editor.background": "#06060e",
            "editor.foreground": "#e0e0ff",
            "editor.lineHighlightBackground": "#0c0c18",
            "editor.selectionBackground": "#00f0ff33",
            "editorCursor.foreground": "#00f0ff",
            "editorLineNumber.foreground": "#444466",
            "editorLineNumber.activeForeground": "#00f0ff",
            "editorGutter.background": "#06060e",
          },
        });

        editor = monaco.editor.create(document.getElementById("editor"), {
          value: DEFAULT_CODE,
          language: "python",
          theme: "neon-dark",
          fontSize: 15,
          fontFamily: "Consolas, Monaco, monospace",
          minimap: { enabled: window.innerWidth > 900 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          runCode();
        });

        resolve();
      });
    });
  }

  async function initPyodide() {
    setStatus("", "Loading Python…");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/",
    });

    pyodide.setStdout({
      batched: (text) => appendOutput(text + "\n", "stdout"),
    });
    pyodide.setStderr({
      batched: (text) => appendOutput(text + "\n", "stderr"),
    });

    isReady = true;
    setStatus("ready", "Ready");
    btnRun.disabled = false;
  }

  async function runCode() {
    if (!isReady || isRunning) return;

    isRunning = true;
    btnRun.disabled = true;
    setStatus("running", "Running…");
    clearOutput();

    const code = editor.getValue();
    const start = performance.now();

    try {
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

  function initResizer() {
    const resizer = $("#resizer");
    const workspace = $(".workspace");
    const editorPanel = $(".panel-editor");
    const outputPanel = $(".panel-output");
    let isDragging = false;

    resizer.addEventListener("mousedown", (e) => {
      isDragging = true;
      resizer.classList.add("active");
      document.body.style.cursor = window.innerWidth <= 900 ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const rect = workspace.getBoundingClientRect();

      if (window.innerWidth <= 900) {
        const percent = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 25), 75);
        editorPanel.style.flex = `0 0 ${percent}%`;
        outputPanel.style.flex = `0 0 ${100 - percent}%`;
      } else {
        const percent = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 30), 75);
        editorPanel.style.flex = `0 0 ${percent}%`;
        outputPanel.style.flex = `0 0 ${100 - percent}%`;
      }
    });

    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  btnRun.addEventListener("click", runCode);
  btnClear.addEventListener("click", clearOutput);
  btnReset.addEventListener("click", () => {
    editor.setValue(DEFAULT_CODE);
    clearOutput();
  });

  async function boot() {
    try {
      await initMonaco();
      await initPyodide();
      initResizer();
      loader.classList.add("hidden");
      editor.focus();
    } catch (err) {
      console.error(err);
      setStatus("error", "Failed to load");
      loader.querySelector(".loader-text").textContent = "Failed to initialize";
      loader.querySelector(".loader-sub").textContent = String(err);
    }
  }

  boot();
})();