/* Shared site helpers: language toggle + Pyodide runner */
(function () {
  const LANG_KEY = "s1py-lang";

  function applyLang(lang) {
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
    });
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  }

  function initLang() {
    let lang = "en";
    try { lang = localStorage.getItem(LANG_KEY) || "en"; } catch (_) {}
    applyLang(lang);
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyLang(btn.dataset.lang));
    });
  }

  let pyodidePromise = null;
  let pyodideReady = false;

  function setStatus(el, text, cls) {
    if (!el) return;
    el.textContent = text;
    el.className = "status" + (cls ? " " + cls : "");
  }

  async function patchInput(py) {
    // Browser-friendly input(): window.prompt so Lesson 3+ can use real input()
    await py.runPythonAsync(`
from js import prompt as _js_prompt
import builtins

def _browser_input(prompt=""):
    value = _js_prompt(str(prompt) if prompt is not None else "")
    if value is None:
        return ""
    return str(value)

builtins.input = _browser_input
`);
  }

  async function loadPyodideOnce(statusEl) {
    if (pyodideReady && window.__pyodide) return window.__pyodide;
    if (pyodidePromise) return pyodidePromise;
    setStatus(statusEl, document.documentElement.lang === "zh" ? "正在載入 Python…" : "Loading Python…");
    pyodidePromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
    }).then(async (py) => {
      await patchInput(py);
      window.__pyodide = py;
      pyodideReady = true;
      setStatus(
        statusEl,
        document.documentElement.lang === "zh" ? "Python 已就緒 ✓" : "Python ready ✓",
        "ready"
      );
      return py;
    }).catch((err) => {
      pyodidePromise = null;
      setStatus(statusEl, "Load error: " + err, "error");
      throw err;
    });
    return pyodidePromise;
  }

  async function runEditor(editorId, outputId, statusId) {
    const editor = document.getElementById(editorId);
    const output = document.getElementById(outputId);
    const status = document.getElementById(statusId);
    if (!editor || !output) return;
    try {
      const py = await loadPyodideOnce(status);
      py.setStdout({ batched: (s) => { output.textContent += s + "\n"; } });
      py.setStderr({ batched: (s) => { output.textContent += s + "\n"; } });
      output.textContent = "";
      await py.runPythonAsync(editor.value);
      if (!output.textContent.trim()) {
        output.textContent = document.documentElement.lang === "zh"
          ? "(沒有輸出 — 試試 print(...))"
          : "(no output — try print(...))";
      }
    } catch (err) {
      output.textContent = String(err);
      setStatus(status, document.documentElement.lang === "zh" ? "執行出錯" : "Runtime error", "error");
    }
  }

  function wireRunners() {
    document.querySelectorAll("[data-run]").forEach((btn) => {
      const editorId = btn.getAttribute("data-run");
      const outputId = btn.getAttribute("data-out");
      const statusId = btn.getAttribute("data-status");
      btn.addEventListener("click", () => runEditor(editorId, outputId, statusId));
    });
    document.querySelectorAll("[data-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-reset");
        const starter = btn.getAttribute("data-starter") || "";
        const el = document.getElementById(id);
        if (el) el.value = starter.replace(/\\n/g, "\n");
      });
    });
    // Preload pyodide if a runner exists on the page
    if (document.querySelector("[data-run]")) {
      const status = document.querySelector(".status");
      loadPyodideOnce(status).catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLang();
    wireRunners();
  });

  window.S1Py = { runEditor, applyLang };
})();
