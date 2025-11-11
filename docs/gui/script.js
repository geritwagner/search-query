// ---- configuration for your package layout in pyodide ----
const FETCH_BASE = "search_query/";
const PKG_DIR = "search_query";

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

  // platform packages that really exist on disk in your repo
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

  // these two matters for registry._discover()
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

// in case someone adds back "ebsco" in HTML
const platformAliases = {
  ebsco: "ebscohost"
};

// allow all the things we just made sure to create
const allowedPlatforms = new Set([
  "wos",
  "pubmed",
  "ebscohost",
  "generic",
  "structured",
  "pre_notation"
]);

// ---- helper DOM functions ----
function appendStatus(msg) {
  const el = document.getElementById("status");
  el.textContent += "\n" + msg;
}

// ---- pyodide loading of your package tree ----
async function loadPackageFilesIntoPyodide(pyodide) {
  try {
    pyodide.FS.mkdir(PKG_DIR);
  } catch (e) {}

  for (const [subdir, files] of Object.entries(PKG_TREE)) {
    const dirPath = subdir === "" ? PKG_DIR : `${PKG_DIR}/${subdir}`;

    if (subdir !== "") {
      try {
        pyodide.FS.mkdir(dirPath);
      } catch (e) {}
    }

    for (const filename of files) {
      const url =
        subdir === ""
          ? `${FETCH_BASE}${filename}`
          : `${FETCH_BASE}${subdir}/${filename}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        appendStatus(`⚠️ Could not fetch ${url} (${resp.status})`);
        // ensure a pkg exists so importlib can still import it
        if (filename === "__init__.py") {
          pyodide.FS.writeFile(`${dirPath}/__init__.py`, "# generated\n");
        }
        continue;
      }
      const text = await resp.text();
      pyodide.FS.writeFile(`${dirPath}/${filename}`, text);
      appendStatus(`✅ loaded ${url}`);
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

// ---- pyodide init ----
let pyodideReady = (async () => {
  const pyodide = await loadPyodide();
  appendStatus("Pyodide loaded. Loading 'packaging'…");
  await pyodide.loadPackage("packaging");
  appendStatus("'packaging' loaded. Fetching search_query files…");
  await loadPackageFilesIntoPyodide(pyodide);
  appendStatus("Done.");
  return pyodide;
})();

async function ensureReady() {
  const pyodide = await pyodideReady;
  document.getElementById("status").textContent = "Pyodide ready.";
  document.getElementById("btn-lint").disabled = false;
  return pyodide;
}

// ---- helper: escape HTML ----
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- helper: ANSI -> HTML ----
function ansiToHtml(str) {
  if (!str) return "";
  let out = escapeHtml(str);
  out = out.replace(/\u001b\[93m/g, '<span class="ansi-yellow">');
  out = out.replace(/\u001b\[91m/g, '<span class="ansi-red">');
  out = out.replace(/\u001b\[92m/g, '<span class="ansi-green">');
  out = out.replace(/\u001b\[0m/g, "</span>");
  return out;
}

// ---- helper: highlight query by positions ----
function highlightQuery(queryStr, positions) {
  if (!positions || !positions.length) {
    return escapeHtml(queryStr);
  }
  const sorted = [...positions].sort((a, b) => a[0] - b[0]);
  let parts = [];
  let cursor = 0;

  sorted.forEach((pos, idx) => {
    const start = pos[0];
    const end = pos[1];
    if (cursor < start) {
      parts.push(escapeHtml(queryStr.slice(cursor, start)));
    }
    const spanClass = `lint-hl-${idx % 5}`;
    parts.push(
      `<span class="${spanClass}">${escapeHtml(queryStr.slice(start, end))}</span>`
    );
    cursor = end;
  });

  if (cursor < queryStr.length) {
    parts.push(escapeHtml(queryStr.slice(cursor)));
  }

  return parts.join("");
}

// normalize messages: array or dict -> dict
function normalizeMessages(messages) {
  if (!messages) {
    return {};
  }
  if (!Array.isArray(messages) && typeof messages === "object") {
    return messages;
  }
  const grouped = {};
  messages.forEach((msg) => {
    const line =
      msg.line_no !== undefined && msg.line_no !== null
        ? msg.line_no
        : msg.line !== undefined && msg.line !== null
        ? msg.line
        : -1;
    const key = String(line);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(msg);
  });
  return grouped;
}

// ---- render lint messages ----
function renderLintMessages(messages, queryStr, platform) {
  const container = document.getElementById("lint-view");
  container.innerHTML = "";

  const grouped = normalizeMessages(messages);
  const lineKeys = Object.keys(grouped);

  if (!lineKeys.length) {
    container.textContent = "No lint messages ✅";
    return;
  }

  const lines = lineKeys.map(Number).sort((a, b) => a - b);

  lines.forEach((line) => {
    const msgs = grouped[String(line)];
    if (!msgs || !msgs.length) return;

    const card = document.createElement("div");
    card.className = "lint-card";

    msgs.forEach((msg) => {
      const label = msg.label || msg.code || "message";
      const code = msg.code ? `(${msg.code})` : "";
      const emoji = msg.is_fatal ? "🚨 " : "ℹ️ ";

      const head = document.createElement("div");
      head.className = "lint-title";
      head.textContent = emoji + `${label} ${code}`;
      card.appendChild(head);

      if (msg.message) {
        const body = document.createElement("div");
        body.className = "lint-meta";
        body.innerHTML = ansiToHtml(msg.message);
        card.appendChild(body);
      }

      if (msg.details) {
        const details = document.createElement("div");
        details.className = "lint-details";
        details.innerHTML = ansiToHtml(msg.details);
        card.appendChild(details);
      }

      const links = document.createElement("div");
      links.className = "lint-links";

      if (msg.code) {
        const docLink = document.createElement("a");
        docLink.href = `https://colrev-environment.github.io/search-query/lint/${msg.code}.html`;
        docLink.target = "_blank";
        docLink.rel = "noopener noreferrer";
        docLink.textContent = "More info";
        links.appendChild(docLink);
      } else {
        const span = document.createElement("span");
        span.textContent = "";
        links.appendChild(span);
      }

      const spacer = document.createElement("div");
      spacer.className = "lint-links-spacer";
      links.appendChild(spacer);

      const issueTitle = encodeURIComponent(
        `Lint message seems inaccurate: ${msg.code || msg.label || ""}`.trim()
      );
      const issueBody = encodeURIComponent(
        [
          "### What seems wrong?",
          "",
          "Describe the inaccurate / overly strict / missing-case lint result here.",
          "",
          "### This lint message",
          "```json",
          JSON.stringify(msg, null, 2),
          "```",
          "",
          "### Original query",
          "```text",
          queryStr,
          "```",
          "",
          "### Platform",
          platform || "",
          ""
        ].join("\n")
      );
      const issueLink = document.createElement("a");
      issueLink.href = `https://github.com/CoLRev-Environment/search-query/issues/new?title=${issueTitle}&body=${issueBody}`;
      issueLink.target = "_blank";
      issueLink.rel = "noopener noreferrer";
      issueLink.textContent = "🐞 Report issue";
      issueLink.className = "lint-report";
      links.appendChild(issueLink);

      card.appendChild(links);

      if (msg.position && msg.position.length) {
        const pre = document.createElement("pre");
        pre.className = "lint-query";
        pre.innerHTML = highlightQuery(queryStr, msg.position);
        card.appendChild(pre);
      }
    });

    container.appendChild(card);
  });
}

// ---- run lint ----
async function runLint() {
  const pyodide = await ensureReady();
  const q = document.getElementById("query").value;
  let platform = document.getElementById("platform").value;

  // apply alias if needed
  if (platformAliases[platform]) {
    platform = platformAliases[platform];
  }

  // guard against unsupported platforms
  if (!allowedPlatforms.has(platform)) {
    document.getElementById("output").textContent =
      `Selected platform "${platform}" is not supported by the linter in this build.`;
    document.getElementById("messages-title").style.display = "block";
    document.getElementById("lint-view").style.display = "block";
    document.getElementById("lint-view").textContent = "Please pick another platform.";
    return;
  }

  const code = `
import json, sys
import search_query.linter as sq_linter

query_str = ${JSON.stringify(q)}
platform = ${JSON.stringify(platform)}

msgs = sq_linter.lint_query_string(
    query_str,
    platform=platform,
    field_general=""
)

json.dumps({"messages": msgs, "sys_path": sys.path})
`;
  try {
    const result = await pyodide.runPythonAsync(code);
    const data = JSON.parse(result);

    document.getElementById("output").textContent = JSON.stringify(
      data.messages,
      null,
      2
    );

    document.getElementById("messages-title").style.display = "block";
    document.getElementById("lint-view").style.display = "block";

    renderLintMessages(data.messages, q, platform);
  } catch (err) {
    document.getElementById("output").textContent =
      "Error during lint:\n" + err;
    document.getElementById("lint-view").innerHTML = "Error ❌";
    document.getElementById("messages-title").style.display = "block";
  }
}

// ---- wire up ----
document.getElementById("btn-lint").addEventListener("click", runLint);

// start
ensureReady();
