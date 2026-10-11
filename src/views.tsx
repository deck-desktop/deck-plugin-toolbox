// One component per tool. Each keeps its fields in the store (useTool), so switching tools or
// navigating away and back finds them as they were.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { monaco } from "../shim/monaco.js";
import { Select } from "../shim/ui.js";
import { useTool } from "./store";
import { Area, Check, CopyButton, Err, Label, Line, Out, Pills, attempt } from "./parts";
import { decodeBase64, encodeBase64 } from "./tools/codec";
import { formatJson, fromCsv, fromYaml, minifyJson, parseJson, toCsv, toYaml } from "./tools/json";
import { toDart, toTypeScript } from "./tools/types";
import { decodeJwt } from "./tools/jwt";
import { decodeUrl, encodeUrl, parseUrl } from "./tools/url";
import { allZones, formatIn, localZone, parseTime, relative } from "./tools/time";
import { inspectId, ulid, uuidV4, uuidV7 } from "./tools/ids";
import { ALGOS, hashBytes, hashText } from "./tools/hash";
import { MAX_MATCHES, compile, matches } from "./tools/regex";
import { describeCron, nextRuns, parseCron } from "./tools/cron";
import { CASES, convertLines } from "./tools/case";
import { contrast, formats, grades, parseColor } from "./tools/color";

export const Stack = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-3">{children}</div>;
export const Bar = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>;

// ---- JSON -------------------------------------------------------------------------------------

type JsonMode = "format" | "minify" | "toYaml" | "fromYaml" | "toCsv" | "fromCsv" | "toTs" | "toDart";

export function JsonTool() {
  const [s, set] = useTool("json", { input: "", mode: "format" as JsonMode, indent: "2", root: "Root" });
  const codegen = s.mode === "toTs" || s.mode === "toDart";
  const out = useMemo(() => {
    if (!s.input.trim()) return null;
    const indent = s.indent === "tab" ? "\t" : Number(s.indent);
    return attempt(() => {
      switch (s.mode) {
        case "format": return formatJson(s.input, indent);
        case "minify": return minifyJson(s.input);
        case "toYaml": return toYaml(parseJson(s.input));
        case "fromYaml": return JSON.stringify(fromYaml(s.input), null, indent);
        case "toCsv": return toCsv(parseJson(s.input));
        case "fromCsv": return JSON.stringify(fromCsv(s.input), null, indent);
        case "toTs": return toTypeScript(parseJson(s.input), s.root.trim() || "Root");
        case "toDart": return toDart(parseJson(s.input), s.root.trim() || "Root");
      }
    });
  }, [s.input, s.mode, s.indent, s.root]);
  const source = s.mode === "fromYaml" ? "YAML" : s.mode === "fromCsv" ? "CSV" : "JSON";
  return (
    <Stack>
      <Bar>
        <Pills value={s.mode} onChange={(mode) => set({ mode })} options={[
          ["format", "Format"], ["minify", "Minify"], ["toYaml", "JSON → YAML"], ["fromYaml", "YAML → JSON"], ["toCsv", "JSON → CSV"], ["fromCsv", "CSV → JSON"],
          ["toTs", "JSON → TypeScript"], ["toDart", "JSON → Dart"],
        ]} />
        {codegen && (
          <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            Name <Line value={s.root} onChange={(root) => set({ root })} placeholder="Root" className="w-40" />
          </label>
        )}
        {(s.mode === "format" || s.mode === "fromYaml" || s.mode === "fromCsv") && (
          <div className="w-28"><Select value={s.indent} onChange={(e) => set({ indent: e.target.value })}>
            <option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tabs</option>
          </Select></div>
        )}
      </Bar>
      <Area value={s.input} onChange={(input) => set({ input })} placeholder={`Paste ${source}`} rows={10} />
      {out && (out.ok ? <Out label="Result" value={out.value} rows={Math.max(8, Math.min(40, out.value.split("\n").length + 1))} /> : <Err>{out.error}</Err>)}
      {s.mode === "fromYaml" && <div className="text-[11px] text-text-muted">Block YAML only: no anchors, tags or multi-line (| and &gt;) strings.</div>}
      {codegen && <div className="text-[11px] text-text-muted">Inferred from this one sample: objects in an array are merged, a key missing from some is optional, and a value that is always null comes out as {s.mode === "toTs" ? "unknown" : "dynamic"}.</div>}
    </Stack>
  );
}

// ---- JWT --------------------------------------------------------------------------------------

export function JwtTool() {
  const [s, set] = useTool("jwt", { input: "" });
  const out = useMemo(() => (s.input.trim() ? attempt(() => decodeJwt(s.input)) : null), [s.input]);
  return (
    <Stack>
      <Area value={s.input} onChange={(input) => set({ input })} placeholder="Paste a JWT (a leading “Bearer ” is fine)" rows={4} />
      {out && !out.ok && <Err>{out.error}</Err>}
      {out?.ok && (
        <>
          {out.value.times.length > 0 && (
            <div className="rounded-md border border-subtle p-2 text-[12px]">
              {out.value.expired !== null && (
                <div className="mb-1 font-semibold" style={{ color: out.value.expired ? "var(--danger)" : "var(--ok)" }}>
                  {out.value.expired ? "Expired" : "Not expired"}
                </div>
              )}
              {out.value.times.map((t) => (
                <div key={t.claim} className="flex gap-2 text-text-secondary">
                  <span className="w-20 font-mono text-text-muted">{t.claim}</span>
                  <span>{t.date.toLocaleString()}</span><span className="text-text-muted">({relative(t.date.getTime())})</span>
                </div>
              ))}
            </div>
          )}
          <Out label="Header" value={JSON.stringify(out.value.header, null, 2)} />
          <Out label="Payload" value={JSON.stringify(out.value.payload, null, 2)} />
          <Out label="Signature (not verified)" value={out.value.signature} />
        </>
      )}
    </Stack>
  );
}

// ---- Base64 -----------------------------------------------------------------------------------

export function Base64Tool() {
  const [s, set] = useTool("base64", { input: "", mode: "decode" as "encode" | "decode", urlSafe: false });
  const out = useMemo(() => {
    if (!s.input) return null;
    return attempt(() => (s.mode === "encode" ? encodeBase64(s.input, s.urlSafe) : decodeBase64(s.input)));
  }, [s.input, s.mode, s.urlSafe]);
  return (
    <Stack>
      <Bar>
        <Pills value={s.mode} onChange={(mode) => set({ mode })} options={[["decode", "Decode"], ["encode", "Encode"]]} />
        {s.mode === "encode" && <Check on={s.urlSafe} onChange={(urlSafe) => set({ urlSafe })}>URL-safe (no + / =)</Check>}
      </Bar>
      <Area value={s.input} onChange={(input) => set({ input })} placeholder={s.mode === "encode" ? "Text to encode" : "Base64 to decode (either alphabet)"} />
      {out && (out.ok ? <Out label="Result" value={out.value} rows={8} /> : <Err>{out.error}</Err>)}
      <div><button onClick={() => out?.ok && set({ input: out.value, mode: s.mode === "encode" ? "decode" : "encode" })}
        className="text-[12px] text-text-muted hover:text-text-primary" disabled={!out?.ok}>⇅ Use the result as input</button></div>
    </Stack>
  );
}

// ---- URL --------------------------------------------------------------------------------------

export function UrlTool() {
  const [s, set] = useTool("url", { input: "", mode: "parse" as "parse" | "decode" | "encode", plus: true });
  const out = useMemo(() => {
    if (!s.input.trim()) return null;
    if (s.mode === "encode") return attempt(() => encodeUrl(s.input));
    if (s.mode === "decode") return attempt(() => decodeUrl(s.input, s.plus));
    return null;
  }, [s.input, s.mode, s.plus]);
  const parts = useMemo(() => (s.mode === "parse" && s.input.trim() ? attempt(() => parseUrl(s.input)) : null), [s.input, s.mode]);
  return (
    <Stack>
      <Bar>
        <Pills value={s.mode} onChange={(mode) => set({ mode })} options={[["parse", "Parse"], ["decode", "Decode"], ["encode", "Encode"]]} />
        {s.mode === "decode" && <Check on={s.plus} onChange={(plus) => set({ plus })}>+ is a space</Check>}
      </Bar>
      <Area value={s.input} onChange={(input) => set({ input })} rows={4}
        placeholder={s.mode === "parse" ? "https://example.com/path?a=1#top" : s.mode === "decode" ? "a%20b%26c" : "text to put in a URL"} />
      {out && (out.ok ? <Out label="Result" value={out.value} /> : <Err>{out.error}</Err>)}
      {parts && !parts.ok && <Err>{parts.error}</Err>}
      {parts?.ok && (
        <>
          <Table rows={([["Scheme", parts.value.protocol], ["User", parts.value.username], ["Password", parts.value.password], ["Host", parts.value.host],
            ["Port", parts.value.port], ["Path", parts.value.path], ["Fragment", parts.value.hash]] as [string, string][]).filter(([, v]) => v)} />
          {parts.value.query.length > 0 && <><Label>Query</Label><Table rows={parts.value.query} mono /></>}
        </>
      )}
    </Stack>
  );
}

export function Table({ rows, mono }: { rows: [string, string][]; mono?: boolean }) {
  return (
    <div className="divide-y divide-subtle rounded-md border border-subtle text-[12px]">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1">
          <span className={`w-28 shrink-0 text-text-muted ${mono ? "font-mono" : ""}`}>{k}</span>
          <span className="min-w-0 flex-1 break-all font-mono text-text-primary">{v}</span>
          <CopyButton text={v} />
        </div>
      ))}
    </div>
  );
}

// ---- Time -------------------------------------------------------------------------------------

export function TimeTool() {
  const [s, set] = useTool("time", { input: "", zone: "", zones: ["UTC"] as string[], add: "" });
  const zones = useMemo(() => allZones(), []);
  const parsed = useMemo(() => (s.input.trim() ? parseTime(s.input, s.zone || undefined) : { ms: Date.now(), unit: "date" as const }), [s.input, s.zone]);
  const local = localZone();
  return (
    <Stack>
      <Bar>
        <Line value={s.input} onChange={(input) => set({ input })} placeholder="1700000000, 1700000000000, 2026-10-11 14:30, or an ISO date (empty = now)" className="min-w-0 flex-1" />
        <button onClick={() => set({ input: String(Math.floor(Date.now() / 1000)) })} className="text-[12px] text-text-muted hover:text-text-primary">Now</button>
      </Bar>
      <Bar>
        <span className="text-[12px] text-text-secondary">A date with no zone is in</span>
        <div className="w-60"><Select value={s.zone} onChange={(e) => set({ zone: e.target.value })}>
          <option value="">this machine ({local})</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </Select></div>
      </Bar>
      {!parsed && <Err>Not a timestamp or a date Deck can read</Err>}
      {parsed && (
        <>
          <div className="text-[12px] text-text-muted">
            {parsed.unit === "date" ? "Read as a date" : `Read as Unix ${parsed.unit === "s" ? "seconds" : parsed.unit === "ms" ? "milliseconds" : parsed.unit === "µs" ? "microseconds" : "nanoseconds"}`}, {relative(parsed.ms)}
          </div>
          <Table rows={[
            ["Unix seconds", String(Math.floor(parsed.ms / 1000))],
            ["Unix ms", String(Math.floor(parsed.ms))],
            ["ISO 8601 (UTC)", new Date(parsed.ms).toISOString()],
            [`Here (${local})`, formatIn(parsed.ms, local)],
          ]} />
          <Label>Other zones</Label>
          <div className="divide-y divide-subtle rounded-md border border-subtle text-[12px]">
            {s.zones.map((z) => (
              <div key={z} className="flex items-center gap-2 px-2 py-1">
                <span className="w-44 shrink-0 truncate text-text-muted">{z}</span>
                <span className="min-w-0 flex-1 font-mono text-text-primary">{formatIn(parsed.ms, z)}</span>
                <CopyButton text={formatIn(parsed.ms, z)} />
                <button onClick={() => set({ zones: s.zones.filter((x) => x !== z) })} title="Remove" className="rounded p-1 text-text-muted hover:text-text-primary"><X size={13} /></button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="min-w-0 flex-1"><Select value={s.add} onChange={(e) => set({ add: e.target.value })}>
                <option value="">Add a zone…</option>
                {zones.filter((z) => !s.zones.includes(z)).map((z) => <option key={z} value={z}>{z}</option>)}
              </Select></div>
              <button disabled={!s.add} onClick={() => set({ zones: [...s.zones, s.add], add: "" })} title="Add"
                className="rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-40"><Plus size={14} /></button>
            </div>
          </div>
        </>
      )}
    </Stack>
  );
}

// ---- IDs --------------------------------------------------------------------------------------

type IdKind = "v4" | "v7" | "ulid";
const makeId = (k: IdKind) => (k === "v4" ? uuidV4() : k === "v7" ? uuidV7() : ulid());

export function IdsTool() {
  const [s, set] = useTool("ids", { kind: "v4" as IdKind, count: "1", upper: false, out: "", input: "" });
  const generate = (kind = s.kind, count = s.count, upper = s.upper) => {
    const n = Math.min(1000, Math.max(1, Number(count) || 1));
    const ids = Array.from({ length: n }, () => makeId(kind));
    set({ kind, count, upper, out: ids.map((x) => (upper ? x.toUpperCase() : x.toLowerCase())).join("\n") });
  };
  useEffect(() => { if (!s.out) generate(); }, []);
  const info = s.input.trim() ? inspectId(s.input) : null;
  return (
    <Stack>
      <Bar>
        <Pills value={s.kind} onChange={(kind) => generate(kind)} options={[["v4", "UUID v4"], ["v7", "UUID v7 (sortable)"], ["ulid", "ULID"]]} />
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          Count <input type="number" min={1} max={1000} value={s.count} onChange={(e) => set({ count: e.target.value })}
            className="h-7 w-16 rounded-md border border-strong bg-elev px-2 text-[12px] text-text-primary outline-none focus:border-accent" />
        </label>
        <Check on={s.upper} onChange={(upper) => generate(s.kind, s.count, upper)}>Uppercase</Check>
        <button onClick={() => generate()} className="rounded-md border border-subtle px-2.5 py-1 text-[12px] text-text-secondary hover:text-text-primary">Generate</button>
      </Bar>
      <Out value={s.out} rows={Math.min(14, s.out.split("\n").length + 1)} />
      <Label>Inspect an id</Label>
      <Line value={s.input} onChange={(input) => set({ input })} placeholder="Paste a UUID or ULID to see its version and when it was made" />
      {s.input.trim() && (info
        ? <div className="text-[12px] text-text-secondary">{info.kind}{info.time && <> — made {info.time.toLocaleString()} ({relative(info.time.getTime())})</>}{!info.time && " — carries no time"}</div>
        : <Err>Not a UUID or ULID</Err>)}
    </Stack>
  );
}

// ---- Hash -------------------------------------------------------------------------------------

export function HashTool() {
  const [s, set] = useTool("hash", { input: "", upper: false });
  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);
  const [out, setOut] = useState<Record<string, string>>({});
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const src = file ? new Uint8Array(file.bytes) : null;
    void Promise.all(ALGOS.map((a) => (src ? hashBytes(src, a) : hashText(s.input, a)))).then((hs) => {
      // A slower earlier hash must not overwrite a newer one.
      if (n === seq.current) setOut(Object.fromEntries(ALGOS.map((a, i) => [a, hs[i]])));
    });
  }, [s.input, file]);
  return (
    <Stack>
      <Bar>
        <label className="cursor-pointer rounded-md border border-subtle px-2.5 py-1 text-[12px] text-text-secondary hover:text-text-primary">
          Hash a file…
          <input type="file" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.arrayBuffer().then((bytes) => setFile({ name: f.name, bytes }));
            e.target.value = "";
          }} />
        </label>
        {file && <span className="text-[12px] text-text-secondary">{file.name} ({file.bytes.byteLength.toLocaleString()} bytes)
          <button onClick={() => setFile(null)} className="ml-2 text-text-muted hover:text-text-primary">back to text</button></span>}
        <Check on={s.upper} onChange={(upper) => set({ upper })}>Uppercase</Check>
      </Bar>
      {!file && <Area value={s.input} onChange={(input) => set({ input })} placeholder="Text to hash (as UTF-8)" rows={6} />}
      {ALGOS.map((a) => <Out key={a} label={a} value={s.upper ? (out[a] ?? "").toUpperCase() : (out[a] ?? "")} />)}
      <div className="text-[11px] text-text-muted">No MD5: the browser's crypto does not offer it.</div>
    </Stack>
  );
}

// ---- Regex ------------------------------------------------------------------------------------

export function RegexTool() {
  const [s, set] = useTool("regex", { pattern: "", flags: "", text: "", replace: "" });
  // Deferred: typing stays responsive while a slow pattern runs over a big text. Each field on its
  // own, since the state object is new on every render and deferring it would defer nothing.
  const d = { pattern: useDeferredValue(s.pattern), flags: useDeferredValue(s.flags), text: useDeferredValue(s.text), replace: useDeferredValue(s.replace) };
  const res = useMemo(() => {
    if (!d.pattern) return null;
    return attempt(() => {
      const re = compile(d.pattern, d.flags);
      return { list: matches(re, d.text), replaced: d.replace ? d.text.replace(re, d.replace) : null };
    });
  }, [d.pattern, d.flags, d.text, d.replace]);
  // The text with every match marked.
  const marked = useMemo(() => {
    if (!res?.ok) return null;
    const out: React.ReactNode[] = [];
    let at = 0;
    res.value.list.forEach((m, i) => {
      if (m.index > at) out.push(d.text.slice(at, m.index));
      out.push(<mark key={i} className="rounded-sm text-text-primary" style={{ background: "color-mix(in srgb, var(--accent) 35%, transparent)" }}>{m.text || <>&#8203;</>}</mark>);
      at = m.index + m.text.length;
    });
    out.push(d.text.slice(at));
    return out;
  }, [res, d.text]);
  return (
    <Stack>
      <Bar>
        <span className="font-mono text-text-muted">/</span>
        <Line value={s.pattern} onChange={(pattern) => set({ pattern })} placeholder="pattern" className="min-w-0 flex-1" />
        <span className="font-mono text-text-muted">/</span>
        <Line value={s.flags} onChange={(flags) => set({ flags: flags.replace(/[^dgimsuvy]/g, "") })} placeholder="imsu" className="w-20" />
      </Bar>
      <Area value={s.text} onChange={(text) => set({ text })} placeholder="Text to test against" rows={8} />
      {res && !res.ok && <Err>{res.error}</Err>}
      {res?.ok && (
        <>
          <Label>{res.value.list.length >= MAX_MATCHES ? `First ${MAX_MATCHES} matches` : `${res.value.list.length} match${res.value.list.length === 1 ? "" : "es"}`}</Label>
          <pre style={{ maxHeight: 240 }} className="overflow-auto whitespace-pre-wrap break-all rounded-md border border-subtle p-2 font-mono text-[12px] text-text-secondary">{marked}</pre>
          {res.value.list.some((m) => m.groups.length) && (
            <div style={{ maxHeight: 240 }} className="overflow-auto rounded-md border border-subtle text-[12px]">
              {res.value.list.slice(0, 200).map((m, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 border-b border-subtle px-2 py-1 font-mono last:border-0">
                  <span className="text-text-muted">#{i + 1} @{m.index}</span>
                  {m.groups.map((g, j) => <span key={j}><span className="text-text-muted">{j + 1}:</span> <span className="text-text-primary">{g ?? "—"}</span></span>)}
                  {Object.entries(m.named).map(([k, g]) => <span key={k}><span className="text-text-muted">{k}:</span> <span className="text-text-primary">{g ?? "—"}</span></span>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Line value={s.replace} onChange={(replace) => set({ replace })} placeholder="Replace with (optional; $1, $<name> work)" />
      {res?.ok && res.value.replaced !== null && <Out label="Replaced" value={res.value.replaced} rows={6} />}
    </Stack>
  );
}

// ---- Cron -------------------------------------------------------------------------------------

export function CronTool() {
  const [s, set] = useTool("cron", { input: "0 3 * * 1" });
  const res = useMemo(() => attempt(() => {
    const c = parseCron(s.input);
    return { text: describeCron(c), runs: nextRuns(c, new Date(), 10) };
  }), [s.input]);
  return (
    <Stack>
      <Line value={s.input} onChange={(input) => set({ input })} placeholder="minute hour day month weekday, or @daily" className="w-full text-[14px]" />
      <div className="font-mono text-[11px] text-text-muted">minute (0-59) · hour (0-23) · day of month (1-31) · month (1-12 or JAN) · weekday (0-7 or MON; 0 and 7 are Sunday)</div>
      {!res.ok && <Err>{res.error}</Err>}
      {res.ok && (
        <>
          <div className="text-[15px] text-text-primary">{res.value.text}</div>
          <Label>Next runs (this machine's time)</Label>
          {res.value.runs.length === 0 && <div className="text-[12px] text-text-muted">Never, in the next five years.</div>}
          <div className="divide-y divide-subtle rounded-md border border-subtle text-[12px]">
            {res.value.runs.map((r) => (
              <div key={r.getTime()} className="flex gap-3 px-2 py-1">
                <span className="font-mono text-text-primary">{r.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-text-muted">{relative(r.getTime())}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Stack>
  );
}

// ---- Case -------------------------------------------------------------------------------------

export function CaseTool() {
  const [s, set] = useTool("case", { input: "" });
  return (
    <Stack>
      <Area value={s.input} onChange={(input) => set({ input })} placeholder="userId, HTTP server, max-retry-count… (one per line)" rows={4} />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {CASES.map((c) => <Out key={c.id} label={c.label} value={s.input.trim() ? convertLines(s.input, c.fn) : ""} />)}
      </div>
    </Stack>
  );
}

// ---- Diff -------------------------------------------------------------------------------------

export function DiffTool() {
  const [s, set] = useTool("diff", { left: "", right: "", inline: false, ignoreWs: false });
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<ReturnType<typeof monaco.editor.createDiffEditor> | null>(null);
  const latest = useRef(set);
  latest.current = set;

  useEffect(() => {
    if (!host.current) return;
    const e = monaco.editor.createDiffEditor(host.current, {
      theme: "deck-dark", automaticLayout: true, originalEditable: true, minimap: { enabled: false },
      fontSize: 12, scrollBeyondLastLine: false, renderSideBySide: !s.inline, ignoreTrimWhitespace: s.ignoreWs,
    });
    // No URIs: Monaco names them, so a StrictMode remount cannot collide with a model it left.
    const original = monaco.editor.createModel(s.left, "plaintext");
    const modified = monaco.editor.createModel(s.right, "plaintext");
    e.setModel({ original, modified });
    const subs = [
      original.onDidChangeContent(() => latest.current({ left: original.getValue() })),
      modified.onDidChangeContent(() => latest.current({ right: modified.getValue() })),
    ];
    ed.current = e;
    return () => { subs.forEach((x) => x.dispose()); e.dispose(); original.dispose(); modified.dispose(); ed.current = null; };
    // Mounted once: the text lives in the models, and the options are applied below.
  }, []);

  useEffect(() => { ed.current?.updateOptions({ renderSideBySide: !s.inline, ignoreTrimWhitespace: s.ignoreWs }); }, [s.inline, s.ignoreWs]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Bar>
        <span className="text-[12px] text-text-muted">Type or paste into both sides.</span>
        <Check on={s.inline} onChange={(inline) => set({ inline })}>Inline</Check>
        <Check on={s.ignoreWs} onChange={(ignoreWs) => set({ ignoreWs })}>Ignore leading/trailing whitespace</Check>
      </Bar>
      <div ref={host} style={{ minHeight: 300 }} className="flex-1 overflow-hidden rounded-md border border-subtle" />
    </div>
  );
}

// ---- Color ------------------------------------------------------------------------------------

export function ColorTool() {
  const [s, set] = useTool("color", { input: "#1e90ff", against: "#ffffff" });
  const c = parseColor(s.input);
  const bg = parseColor(s.against);
  const hex = c ? formats(c)[0][1].slice(0, 7) : "#000000";
  return (
    <Stack>
      <Bar>
        <input type="color" value={hex} onChange={(e) => set({ input: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-subtle bg-transparent" />
        <Line value={s.input} onChange={(input) => set({ input })} placeholder="#1e90ff, rgb(30 144 255), hsl(210 100% 56%), Color(0xFF1E90FF)" className="min-w-0 flex-1" />
      </Bar>
      {!c && s.input.trim() && <Err>Not a color Deck can read</Err>}
      {c && (
        <>
          <div className="rounded-md border border-subtle" style={{ height: 64, background: formats(c)[1][1] }} />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {formats(c).map(([label, v]) => <Out key={label} label={label} value={v} />)}
          </div>
          <Label>Contrast</Label>
          <div className="flex flex-col gap-2 text-[12px]">
            {([["White", parseColor("#fff")!], ["Black", parseColor("#000")!]] as const).map(([name, other]) => (
              <Contrast key={name} label={`On ${name.toLowerCase()}`} fg={c} bg={other} />
            ))}
            <Bar>
              <span className="text-text-secondary">On</span>
              <Line value={s.against} onChange={(against) => set({ against })} className="w-40" />
            </Bar>
            {bg ? <Contrast label={`On ${s.against}`} fg={c} bg={bg} /> : <Err>Not a color Deck can read</Err>}
          </div>
        </>
      )}
    </Stack>
  );
}

function Contrast({ label, fg, bg }: { label: string; fg: NonNullable<ReturnType<typeof parseColor>>; bg: NonNullable<ReturnType<typeof parseColor>> }) {
  const r = contrast(fg, bg), g = grades(r);
  const tag = (ok: boolean, text: string) => (
    <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ color: ok ? "var(--ok)" : "var(--danger)", border: "1px solid currentColor" }}>{text}</span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded px-2 py-1 font-semibold" style={{ color: formats(fg)[1][1], background: formats(bg)[1][1] }}>Sample text</span>
      <span className="w-28 text-text-secondary">{label}</span>
      <span className="w-14 font-mono text-text-primary">{r.toFixed(2)}:1</span>
      {tag(g.aa, "AA")}{tag(g.aaa, "AAA")}{tag(g.aaLarge, "AA large")}{tag(g.aaaLarge, "AAA large")}
    </div>
  );
}
