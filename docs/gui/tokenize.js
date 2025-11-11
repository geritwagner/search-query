const FETCH_BASE = "search_query/";
const PKG_DIR = "search_query";

// same tree as in your existing setup
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

const platformAliases = {
  ebsco: "ebscohost"
};

const allowedPlatforms = new Set([
  "wos",
  "pubmed",
  "ebscohost",
  "scopus" // keep here, adjust if not present
]);

function appendStatus(msg) {
  const el = document.getElementById("status");
  el.textContent += "\n" + msg;
}

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
  document.getElementById("btn-tokenize").disabled = false;
  return pyodide;
}

function renderTokens(tokens) {
  const title = document.getElementById("tokens-title");
  const container = document.getElementById("tokens-container");
  container.innerHTML = "";

  if (!tokens || !tokens.length) {
    title.style.display = "block";
    container.textContent = "No tokens returned.";
    return;
  }

  title.style.display = "block";

  const table = document.createElement("table");
  table.id = "tokens-table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>#</th><th>value</th><th>type</th><th>position</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tokens.forEach((tok, idx) => {
    const tr = document.createElement("tr");
    const pos = tok.position ? `[${tok.position[0]}, ${tok.position[1]}]` : "";
    tr.innerHTML = `
      <td>${idx}</td>
      <td><code>${tok.value}</code></td>
      <td>${tok.type || ""}</td>
      <td>${pos}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function runTokenize() {
  const pyodide = await ensureReady();
  const q = document.getElementById("query").value;
  let platform = document.getElementById("platform").value;

  if (platformAliases[platform]) {
    platform = platformAliases[platform];
  }

  if (!allowedPlatforms.has(platform)) {
    document.getElementById("output").textContent =
      `Selected platform "${platform}" is not supported in this tokenizer build.`;
    renderTokens([]);
    return;
  }

  const code = `
import json

query_str = ${JSON.stringify(q)}
platform = ${JSON.stringify(platform)}

def get_parser(platform, query_str):
    if platform == "wos":
        from search_query.wos.parser import WOSParser
        return WOSParser(query_str=query_str)
    elif platform == "pubmed":
        from search_query.pubmed.parser import PubMedParser as Parser
        return Parser(query_str=query_str)
    elif platform == "ebscohost":
        from search_query.ebscohost.parser import EBSCOHostParser as Parser
        return Parser(query_str=query_str)
    elif platform == "scopus":
        from search_query.scopus.parser import ScopusParser as Parser
        return Parser(query_str=query_str)
    else:
        raise ValueError(f"Unsupported platform: {platform}")

parser = get_parser(platform, query_str)
parser.tokenize()

tokens = []
for t in parser.tokens:
    tokens.append({
        "value": t.value,
        "type": getattr(t.type, "name", str(t.type)),
        "position": list(t.position) if getattr(t, "position", None) else None,
    })

json.dumps({"tokens": tokens})
`;
  try {
    const result = await pyodide.runPythonAsync(code);
    const data = JSON.parse(result);
    document.getElementById("output").textContent = JSON.stringify(data, null, 2);
    renderTokens(data.tokens);
  } catch (err) {
    document.getElementById("output").textContent =
      "Error during tokenize:\n" + err;
    renderTokens([]);
  }
}

document.getElementById("btn-tokenize").addEventListener("click", runTokenize);

// kick off
ensureReady();
