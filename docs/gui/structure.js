const PARENT_ORIGIN = window.location.origin;
const MAX_LINE_LENGTH = 100;

function sendHeight() {
    const height = document.body.scrollHeight;
    if (window.parent) {
        window.parent.postMessage(
            { type: "setHeight", height: height },
            PARENT_ORIGIN
        );
    }
}

// Quote-aware tokenizer: keeps phrases and parentheses
function tokenizeQuery(raw) {
    const tokens = [];
    let current = "";
    let inQuote = false;

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];

        if (ch === '"') {
            current += ch;
            inQuote = !inQuote;
        } else if (!inQuote && (ch === "(" || ch === ")")) {
            if (current.trim().length > 0) {
                tokens.push(current.trim());
                current = "";
            }
            tokens.push(ch);
        } else if (!inQuote && /\s/.test(ch)) {
            if (current.trim().length > 0) {
                tokens.push(current.trim());
                current = "";
            }
        } else {
            current += ch;
        }
    }

    if (current.trim().length > 0) {
        tokens.push(current.trim());
    }

    return tokens;
}

function isBooleanOp(tok) {
    const upper = tok.toUpperCase();
    return (
        upper === "AND" ||
        upper === "OR" ||
        upper === "NOT" ||
        upper === "NEAR" ||
        upper.startsWith("NEAR/")
    );
}

// Quote-aware parenthesis-balance check
function areParenthesesBalanced(raw) {
    let depth = 0;
    let inQuote = false;

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];

        if (ch === '"') {
            inQuote = !inQuote;
        } else if (!inQuote && ch === "(") {
            depth++;
        } else if (!inQuote && ch === ")") {
            depth--;
            if (depth < 0) {
                return false;
            }
        }
    }

    return depth === 0;
}

function formatIndented(tokens) {
    let indent = 0;
    const lines = [];
    let line = "";

    function pushLine() {
        if (line.trim().length > 0) {
            lines.push(" ".repeat(indent * 4) + line.trim());
            line = "";
        }
    }

    function appendTokenInline(tok) {
        const tokenStr = tok;
        if (line.length === 0) {
            line = tokenStr;
        } else {
            const candidate = line + " " + tokenStr;
            if (candidate.length > MAX_LINE_LENGTH) {
                // wrap before adding this token
                pushLine();
                line = tokenStr;
            } else {
                line = candidate;
            }
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;

        if (tok === "(") {
            // If the current line ends with "=", attach "(" to that line: TS=(
            if (line.trim().endsWith("=")) {
                line += "(";
                pushLine();
            } else {
                pushLine();
                lines.push(" ".repeat(indent * 4) + "(");
            }
            indent++;
        } else if (tok === ")") {
            pushLine();
            indent = Math.max(indent - 1, 0);
            lines.push(" ".repeat(indent * 4) + ")");
        } else if (isBooleanOp(tok)) {
            // If followed by a parenthesis, place on its own line (between blocks)
            if (nextTok === "(" || nextTok === ")") {
                pushLine();
                line = tok.toUpperCase();
                pushLine();
            } else {
                // Otherwise keep inline with terms, respecting max line length
                appendTokenInline(tok.toUpperCase());
            }
        } else {
            appendTokenInline(tok);
        }
    }

    pushLine();
    return lines.join("\n");
}

function visualizeCurrentQuery() {
    const textarea = document.getElementById("query");
    const output = document.getElementById("pretty-output");
    const resultContainer = document.getElementById("result-container");

    const raw = textarea.value || "";
    if (!raw.trim()) {
        resultContainer.style.display = "block";
        output.textContent = "No query provided.";
        sendHeight();
        return;
    }

    // New: check for balanced parentheses first
    if (!areParenthesesBalanced(raw)) {
        resultContainer.style.display = "block";
        output.textContent =
            "Warning: Unbalanced parentheses detected. " +
            "Please fix your query and try again.";
        sendHeight();
        return;
    }

    const tokens = tokenizeQuery(raw);
    const pretty = formatIndented(tokens);

    resultContainer.style.display = "block";
    output.textContent = pretty;

    setTimeout(sendHeight, 50);
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btn-visualize");
    const resultContainer = document.getElementById("result-container");

    btn.addEventListener("click", () => {
        // Ensure result container is visible when user triggers visualization
        if (resultContainer.style.display === "none") {
            resultContainer.style.display = "block";
        }
        visualizeCurrentQuery();
    });

    const observer = new MutationObserver(() => {
        sendHeight();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    sendHeight();
});
