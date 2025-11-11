// translate.js

// where the Python package files can be fetched from
const FETCH_BASE = "search_query/";
const PKG_DIR = "search_query";

// directory tree of the search_query package (mirrors your existing setup)
const PKG_TREE = {
  "": [
    "__init__.py",
    "__version__.py",
    "cli.py",
    "constants.py",
    "database.py",
    "database_queries.py",
    "exception.py",
    "linter.py",
    "linter_base.py",
    "parser.py",
    "parser_base.py",
    "pre_notation.py",
    "query.py",
    "query_and.py",
    "query_or.py",
    "query_near.py",
    "query_not.py",
    "query_range.py",
    "query_term.py",
    "registry.py",
    "search_file.py",
    "serializer_base.py",
    "serializer_structured.py",
    "structured.py",
    "translator_base.py",
    "upgrade.py",
    "utils.py"
  ],
  ebscohost: [
    "__init__.py",
    "constants.py",
    "linter.py",
    "parser.py",
    "serializer.py",
    "translator.py"
  ],
  "ebscohost/v_1": [
    "__init__.py",
    "parser.py",
    "serializer.py",
    "translator.py"
  ],
  "ebscohost/v_1_0_0": ["__init__.py"],
  generic: ["__init__.py", "linter.py", "serializer.py"],
  "generic/v_1": ["__init__.py", "serializer.py"],
  json_db: [
    "ais_senior_scholars_basket.json",
    "ais_senior_scholars_list_of_premier_journals.json",
    "blocks_bmi_343.json",
    "journals_FT50.json"
  ],
  pre_notation: ["__init__.py"],
  structured: ["__init__.py"],
  pubmed: [
    "__init__.py",
    "constants.py",
    "linter.py",
    "parser.py",
    "serializer.py",
    "translator.py"
  ],
  "pubmed/v_1": [
    "__init__.py",
    "parser.py",
    "serializer.py",
    "translator.py"
  ],
  wos: [
    "__init__.py",
    "constants.py",
    "linter.py",
    "parser.py",
    "serializer.py",
    "translator.py"
  ],
  "wos/v_0": ["__init__.py", "parser.py", "serializer.py", "translator.py"],
  "wos/v_1": ["__init__.py", "parser.py", "serializer.py", "translator.py"]
};

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
  setStatus("Loading Pyodide…");
  const pyodide = await loadPyodide();
  setStatus("Pyodide loaded. Loading 'packaging'…");
  await pyodide.loadPackage("packaging");
  setStatus("'packaging' loaded. Fetching search_query files…", true);
  await loadPackageFilesIntoPyodide(pyodide);
  setStatus("Pyodide ready.");
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
