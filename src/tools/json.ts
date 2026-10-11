// JSON: format, minify, and conversion to and from YAML and CSV.

/** JSON.parse with the error pointing at a line and column rather than a character offset. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = (e as Error).message;
    const pos = /position (\d+)/.exec(msg);
    if (!pos) throw new Error(msg);
    const before = text.slice(0, Number(pos[1]));
    const line = before.split("\n").length;
    const col = before.length - before.lastIndexOf("\n");
    throw new Error(`${msg.replace(/\s*\(line \d+ column \d+\)/, "")} (line ${line}, column ${col})`);
  }
}

export const formatJson = (text: string, indent: number | string = 2) => JSON.stringify(parseJson(text), null, indent);
export const minifyJson = (text: string) => JSON.stringify(parseJson(text));

// ---- YAML out ---------------------------------------------------------------------------------

const RESERVED = /^(true|false|yes|no|on|off|null|~|y|n)$/i;
const NUMBERISH = /^[-+]?(\.?\d|0x|0o)/;

/** A string that would read back as something else, or break the line, is double-quoted. */
function yamlString(s: string): string {
  const plain = s !== "" && s.trim() === s && !RESERVED.test(s) && !NUMBERISH.test(s)
    && !/[\n\r\t]|: |\s#|:$/.test(s) && !/^[-?:,[\]{}#&*!|>'"%@`]/.test(s);
  // A YAML double-quoted string accepts JSON's escapes, so JSON.stringify is a correct quoter.
  return plain ? s : JSON.stringify(s);
}

function yamlScalar(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "[]";
  if (typeof v === "object") return "{}";
  if (typeof v === "string") return yamlString(v);
  return String(v);
}

const isBlock = (v: unknown): v is object => v !== null && typeof v === "object" && Object.keys(v).length > 0;
const pad = (d: number) => "  ".repeat(d);

function yamlLines(v: object, d: number): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      if (isBlock(item)) {
        // The first line of a nested block sits after the dash; the rest line up under it.
        const inner = yamlLines(item, d + 1);
        out.push(`${pad(d)}- ${inner[0].trimStart()}`, ...inner.slice(1));
      } else out.push(`${pad(d)}- ${yamlScalar(item)}`);
    }
  } else {
    for (const [k, val] of Object.entries(v)) {
      if (isBlock(val)) out.push(`${pad(d)}${yamlString(k)}:`, ...yamlLines(val, d + 1));
      else out.push(`${pad(d)}${yamlString(k)}: ${yamlScalar(val)}`);
    }
  }
  return out;
}

export const toYaml = (v: unknown) => (isBlock(v) ? yamlLines(v, 0).join("\n") : yamlScalar(v));

// ---- YAML in ----------------------------------------------------------------------------------
// ponytail: block YAML only (maps, lists, scalars, quotes, comments, JSON-style flow values).
// No anchors, tags, multi-line scalars (| and >) or multiple documents; add a YAML library if
// those are needed.

interface Line { ind: number; text: string; n: number }

/** Cut a `#` comment that is outside quotes and starts the line or follows whitespace. */
function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"') i++; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

function yamlValue(raw: string, n: number): unknown {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"')) {
    try { return JSON.parse(s); } catch { throw new Error(`line ${n}: unterminated or invalid "string"`); }
  }
  if (s.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(s)) throw new Error(`line ${n}: unterminated 'string'`);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith("[") || s.startsWith("{")) {
    try { return JSON.parse(s); } catch { throw new Error(`line ${n}: flow values must be written as JSON`); }
  }
  if (s === "|" || s === ">" || /^[|>][-+]?\d*$/.test(s)) throw new Error(`line ${n}: multi-line strings (| and >) are not supported`);
  if (s.startsWith("&") || s.startsWith("*") || s.startsWith("!")) throw new Error(`line ${n}: anchors, aliases and tags are not supported`);
  return s;
}

/** Where a `key: value` line splits, or -1. The colon must be outside quotes and end a word. */
function keyColon(s: string): number {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === ":" && (i === s.length - 1 || s[i + 1] === " ")) return i;
  }
  return -1;
}

const isItem = (t: string) => t === "-" || t.startsWith("- ");

export function fromYaml(text: string): unknown {
  const lines: Line[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (/^\s*\t/.test(raw)) throw new Error(`line ${i + 1}: tabs cannot indent YAML`);
    const t = stripComment(raw).trimEnd();
    if (t.trim() === "" || t.trim() === "---") return;
    lines.push({ ind: t.length - t.trimStart().length, text: t.trim(), n: i + 1 });
  });
  if (!lines.length) return null;
  let i = 0;

  const block = (ind: number): unknown => {
    if (isItem(lines[i].text)) {
      const out: unknown[] = [];
      while (i < lines.length && lines[i].ind === ind && isItem(lines[i].text)) {
        const l = lines[i];
        const rest = l.text.slice(1).trimStart();
        if (rest === "") {
          i++;
          out.push(i < lines.length && lines[i].ind > ind ? block(lines[i].ind) : null);
        } else if (isItem(rest) || keyColon(rest) >= 0) {
          // "- a: 1" or "- - x": the rest of the line opens a block at its own column.
          lines[i] = { ind: ind + (l.text.length - rest.length), text: rest, n: l.n };
          out.push(block(lines[i].ind));
        } else {
          out.push(yamlValue(rest, l.n));
          i++;
        }
      }
      return out;
    }
    const out: Record<string, unknown> = {};
    while (i < lines.length && lines[i].ind === ind && !isItem(lines[i].text)) {
      const l = lines[i];
      const at = keyColon(l.text);
      if (at < 0) throw new Error(`line ${l.n}: expected "key: value"`);
      const k = yamlValue(l.text.slice(0, at), l.n);
      const rest = l.text.slice(at + 1);
      i++;
      if (rest.trim() !== "") out[String(k)] = yamlValue(rest, l.n);
      // A list may sit at the key's own indent ("key:\n- a"), a map only deeper.
      else if (i < lines.length && (lines[i].ind > ind || (lines[i].ind === ind && isItem(lines[i].text)))) out[String(k)] = block(lines[i].ind);
      else out[String(k)] = null;
    }
    return out;
  };

  const v = block(lines[0].ind);
  if (i < lines.length) throw new Error(`line ${lines[i].n}: unexpected indentation`);
  return v;
}

// ---- CSV --------------------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** An array of objects (columns are every key seen, in order) or an array of arrays. */
export function toCsv(v: unknown): string {
  if (!Array.isArray(v)) throw new Error("CSV needs a JSON array of rows");
  if (v.every(Array.isArray)) return (v as unknown[][]).map((r) => r.map(csvCell).join(",")).join("\n");
  const cols: string[] = [];
  for (const row of v) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) throw new Error("Every row must be an object");
    for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  }
  return [cols.map(csvCell).join(","), ...v.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))].join("\n");
}

/** RFC 4180 rows of fields. Quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"' && field === "") q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (q) throw new Error("A quoted field is never closed");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** The first row names the columns. Values stay strings: "007" is not the number 7. */
export function fromCsv(text: string): Record<string, string>[] {
  const [head, ...rest] = parseCsv(text);
  if (!head) return [];
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
