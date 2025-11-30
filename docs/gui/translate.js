const PKG_DIR = "search_query";

const urlParams = new URLSearchParams(window.location.search);
const IS_GITHUB_PAGES = window.location.hostname === "geritwagner.github.io";

const pkgSource = urlParams.get("pkg") || (IS_GITHUB_PAGES ? "remote" : "local");

const LOCAL_FETCH_BASE = new URL("../../search_query/", window.location.href).toString();
const REMOTE_FETCH_BASE =
  "https://raw.githubusercontent.com/CoLRev-Environment/search-query/refs/heads/main/search_query/";

const FETCH_BASE = pkgSource === "remote" ? REMOTE_FETCH_BASE : LOCAL_FETCH_BASE;

console.log(
  `%c[PYODIDE] search_query package loading from: ${FETCH_BASE}`,
  "color: #10b981; font-weight: bold;"
);

const PKG_TREE = window.searchQueryPKG_TREE;

// platform aliases (for convenience)
const platformAliases = {
  ebsco: "ebscohost"
};

// set of platforms actually present in this bundle
const allowedPlatforms = new Set([
  "wos",
  "pubmed",
  "ebscohost",
  "generic",
  "structured",
  "pre_notation"
]);

let pyodideReady = null;

function setStatus(msg, append = false) {
  const el = document.getElementById("status");
  if (!el) return;
  if (append) {
    el.textContent += "\n" + msg;
  } else {
    el.textContent = msg;
  }
}

// load all package files into pyodide's FS
async function loadPackageFilesIntoPyodide(pyodide) {
  try {
    pyodide.FS.mkdir(PKG_DIR);
  } catch (e) {
    // already exists
  }

  for (const [subdir, files] of Object.entries(PKG_TREE)) {
    const dirPath = subdir === "" ? PKG_DIR : `${PKG_DIR}/${subdir}`;

    if (subdir !== "") {
      try {
        pyodide.FS.mkdir(dirPath);
      } catch (e) {
        // already exists
      }
    }

    for (const filename of files) {
      const url =
        subdir === ""
          ? `${FETCH_BASE}${filename}`
          : `${FETCH_BASE}${subdir}/${filename}`;

      const resp = await fetch(url);
      if (!resp.ok) {
        setStatus(`⚠️ Could not fetch ${url} (${resp.status})`, true);
        // at least create an empty __init__.py so imports won't fail
        if (filename === "__init__.py") {
          pyodide.FS.writeFile(`${dirPath}/__init__.py`, "# generated\n");
        }
        continue;
      }
      const text = await resp.text();
      pyodide.FS.writeFile(`${dirPath}/${filename}`, text);
      setStatus(`✅ loaded ${url}`, true);
    }
  }

  await pyodide.runPythonAsync(`
import sys, os, importlib
if "" not in sys.path:
    sys.path.insert(0, "")
cwd = os.getcwd()
if cwd not in sys.path:
    sys.path.insert(0, cwd)
importlib.invalidate_caches()
`);
}

async function initPyodideAndPackage() {
  setStatus("Loading search-query…");
  const pyodide = await loadPyodide();
  setStatus("search-query loaded. Loading 'packaging'…");
  await pyodide.loadPackage("packaging");
  setStatus("'packaging' loaded. Fetching search_query files…", true);
  await loadPackageFilesIntoPyodide(pyodide);
  setStatus("search-query ready.");
  const btn = document.getElementById("btn-translate");
  if (btn) btn.disabled = false;
  return pyodide;
}

// ensure we start loading immediately
pyodideReady = initPyodideAndPackage();

async function runTranslate() {
  const pyodide = await pyodideReady;

  const queryEl = document.getElementById("query");
  const srcEl = document.getElementById("platform-source");
  const tgtEl = document.getElementById("platform-target");
  const resultEl = document.getElementById("result");
  const resultTitleEl = document.getElementById("result-title");
  const messagesEl = document.getElementById("messages");
  const messagesTitleEl = document.getElementById("messages-title");

  const q = queryEl ? queryEl.value : "";
  let src = srcEl ? srcEl.value : "wos";
  let tgt = tgtEl ? tgtEl.value : "pubmed";

  // apply aliases
  if (platformAliases[src]) src = platformAliases[src];
  if (platformAliases[tgt]) tgt = platformAliases[tgt];

  // reset messages
  if (messagesEl && messagesTitleEl) {
    messagesEl.style.display = "none";
    messagesTitleEl.style.display = "none";
    messagesEl.innerHTML = "";
  }

  if (!allowedPlatforms.has(src)) {
    if (messagesEl && messagesTitleEl) {
      messagesTitleEl.style.display = "block";
      messagesEl.style.display = "block";
      messagesEl.textContent = `Source platform "${src}" is not available in this build.`;
    }
    return;
  }
  if (!allowedPlatforms.has(tgt)) {
    if (messagesEl && messagesTitleEl) {
      messagesTitleEl.style.display = "block";
      messagesEl.style.display = "block";
      messagesEl.textContent = `Target platform "${tgt}" is not available in this build.`;
    }
    return;
  }

  const pyCode = `
import json
import search_query.parser as sq_parser

query_str = ${JSON.stringify(q)}
src = ${JSON.stringify(src)}
tgt = ${JSON.stringify(tgt)}

parsed = sq_parser.parse(query_str, platform=src, field_general="")
translated = parsed.translate(tgt)
out_str = translated.to_string()
json.dumps({"translated": out_str})
`;

  try {
    const result = await pyodide.runPythonAsync(pyCode);
    const data = JSON.parse(result);

    if (resultEl && resultTitleEl) {
      resultEl.textContent = data.translated || "(empty translation result)";
      resultEl.style.display = "block";
      resultTitleEl.style.display = "block";
      const jsonActionsEl = document.getElementById("json-actions");
      if (jsonActionsEl) {
        jsonActionsEl.style.display = "flex";
      }
    }
  } catch (err) {
    if (resultEl && resultTitleEl) {
      resultEl.textContent = "Error during translation:\n" + err;
      resultEl.style.display = "block";
      resultTitleEl.style.display = "block";
    }
  }
}

// hook up button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-translate");
  if (btn) {
    btn.addEventListener("click", runTranslate);
  }
});
