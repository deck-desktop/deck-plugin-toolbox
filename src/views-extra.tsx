// The second batch of tools: Unicode, Password, Numbers and HTTP status.
import { useDeferredValue, useEffect, useMemo } from "react";
import { Select } from "../shim/ui.js";
import { useTool } from "./store";
import { Area, Check, Chip, Err, LIST, Label, Line, NUMBER, Out, PRIMARY, ROW, attempt, tone } from "./parts";
import { Bar, Stack, Table } from "./views";
import { charInfo, clean, stats } from "./tools/unicode";
import { entropy, generate } from "./tools/password";
import { formatBase, parseInteger, parseSize, sizeTable, twosComplement } from "./tools/numbers";
import { CLASSES, findStatus } from "./tools/http";

// ---- Unicode ----------------------------------------------------------------------------------

const MAX_CHARS = 500;

export function UnicodeTool() {
  const [s, set] = useTool("unicode", { input: "" });
  const text = useDeferredValue(s.input);
  const st = useMemo(() => stats(text), [text]);
  const chars = useMemo(() => [...text].slice(0, 20000).map(charInfo), [text]);
  const odd = useMemo(() => {
    const m = new Map<string, { info: ReturnType<typeof charInfo>; n: number }>();
    for (const c of chars) if (c.suspicious) m.set(c.cp, { info: c, n: (m.get(c.cp)?.n ?? 0) + 1 });
    return [...m.values()];
  }, [chars]);
  const cleaned = useMemo(() => clean(text), [text]);
  return (
    <Stack>
      <Area value={s.input} onChange={(input) => set({ input })} placeholder="Paste text to see what every character really is" rows={5} />
      {text && (
        <>
          <div className="text-[12px] text-text-secondary">
            {st.codePoints.toLocaleString()} characters · {st.graphemes.toLocaleString()} as displayed · {st.utf16.toLocaleString()} UTF-16 units
            · {st.utf8.toLocaleString()} UTF-8 bytes · {st.lines.toLocaleString()} {st.lines === 1 ? "line" : "lines"} · {st.words.toLocaleString()} words
          </div>
          {odd.length === 0
            ? <div className="text-[12px]" style={{ color: tone("green") }}>No invisible or lookalike characters.</div>
            : (
              <>
                <Label>Worth a look</Label>
                <div className={LIST}>
                  {odd.map(({ info, n }) => (
                    <div key={info.cp} className={`${ROW} gap-3`}>
                      <span className="w-20 font-mono text-text-primary">{info.cp}</span>
                      <span className="flex-1" style={{ color: tone("amber") }}>{info.note ?? info.category}</span>
                      <span className="text-text-muted">x{n}</span>
                    </div>
                  ))}
                </div>
                <Label>Where they are</Label>
                <pre style={{ maxHeight: 240 }} className="overflow-auto whitespace-pre-wrap break-all rounded-lg border border-subtle px-2.5 py-2 font-mono text-[12px] text-text-secondary">
                  {chars.map((c, i) => (c.suspicious
                    ? <mark key={i} title={c.note ?? c.category} className="rounded-sm px-0.5 text-[10px]"
                        style={{ background: `color-mix(in srgb, ${tone("amber")} 30%, transparent)`, color: "var(--text-primary)" }}>{c.cp}</mark>
                    : c.char))}
                </pre>
                <Out label="Cleaned: invisible characters removed, typographic ones made ASCII" value={cleaned} rows={4} />
              </>
            )}
          <Label>{chars.length > MAX_CHARS ? `First ${MAX_CHARS} characters` : "Characters"}</Label>
          <div style={{ maxHeight: 320 }} className={`overflow-auto ${LIST}`}>
            {chars.slice(0, MAX_CHARS).map((c, i) => (
              <div key={i} className="flex h-6 items-center gap-3 rounded-md px-2 font-mono transition-colors hover:bg-white/5">
                <span className="w-8 text-center text-text-primary">{/\s/.test(c.char) || c.category === "Format" ? "·" : c.char}</span>
                <span className="w-20 text-text-secondary">{c.cp}</span>
                <span className="w-28 text-text-muted">{c.utf8}</span>
                <span className="w-24 text-text-muted">{c.category}</span>
                <span className="text-text-muted" style={c.suspicious ? { color: tone("amber") } : undefined}>{c.note}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Stack>
  );
}

// ---- Password ---------------------------------------------------------------------------------

const PW_INIT = { length: 20, lower: true, upper: true, digits: true, symbols: true, unambiguous: false, count: 5, out: "", error: "" };

export function PasswordTool() {
  const [s, set] = useTool("password", PW_INIT);
  const make = (o: typeof s) => {
    const r = attempt(() => Array.from({ length: Math.min(50, Math.max(1, o.count)) }, () => generate(o)).join("\n"));
    set({ ...o, out: r.ok ? r.value : "", error: r.ok ? "" : r.error });
  };
  const change = (patch: Partial<typeof s>) => make({ ...s, ...patch });
  useEffect(() => { if (!s.out && !s.error) make(s); }, []);
  const bits = entropy(s);
  const [label, color] = bits < 50 ? ["Weak", "red"] : bits < 80 ? ["Fair", "amber"] : ["Strong", "green"];
  return (
    <Stack>
      <Bar>
        <label className="flex items-center gap-2 text-[12px] text-text-secondary">
          Length
          <input type="range" min={4} max={128} value={s.length} onChange={(e) => change({ length: Number(e.target.value) })} className="w-48 accent-[var(--accent)]" />
          <span className="w-8 font-mono text-text-primary">{s.length}</span>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          How many <input type="number" min={1} max={50} value={s.count} onChange={(e) => change({ count: Number(e.target.value) || 1 })}
            className={NUMBER} />
        </label>
      </Bar>
      <Bar>
        <Check on={s.lower} onChange={(lower) => change({ lower })}>a-z</Check>
        <Check on={s.upper} onChange={(upper) => change({ upper })}>A-Z</Check>
        <Check on={s.digits} onChange={(digits) => change({ digits })}>0-9</Check>
        <Check on={s.symbols} onChange={(symbols) => change({ symbols })}>Symbols</Check>
        <Check on={s.unambiguous} onChange={(unambiguous) => change({ unambiguous })}>No lookalikes (I l 1 O 0 o)</Check>
        <button onClick={() => make(s)} className={PRIMARY} style={{ background: "var(--accent)" }}>Generate again</button>
      </Bar>
      {s.error ? <Err>{s.error}</Err> : (
        <>
          <div className="flex items-center gap-2 text-[12px] text-text-secondary">About {bits} bits of entropy each <Chip color={color}>{label}</Chip></div>
          <Out value={s.out} rows={Math.min(14, s.out.split("\n").length + 1)} />
        </>
      )}
      <div className="text-[11px] text-text-muted">From the system's cryptographic random source. Nothing is kept once Deck closes.</div>
    </Stack>
  );
}

// ---- Numbers ----------------------------------------------------------------------------------

export function NumbersTool() {
  const [s, set] = useTool("numbers", { input: "", base: "10", size: "" });
  // A pasted size ("1.5 GB") arrives in the main field; it belongs in the size box.
  const pastedSize = !s.size && /[a-z]$/i.test(s.input.trim()) && parseSize(s.input) !== null;
  const intText = pastedSize ? "" : s.input;
  const sizeText = pastedSize ? s.input : s.size;
  const n = useMemo(() => (intText.trim() ? attempt(() => parseInteger(intText, Number(s.base))) : null), [intText, s.base]);
  const bytes = sizeText.trim() ? parseSize(sizeText) : null;
  const twos = n?.ok && n.value < 0n
    ? [8, 16, 32, 64].flatMap((b): [string, string][] => {
      const t = twosComplement(n.value, b);
      return t === null ? [] : [[`As int${b}`, `0x${formatBase(t, 16, false).padStart(b / 4, "0")}`]];
    })
    : [];
  return (
    <Stack>
      <Label>Integer</Label>
      <Bar>
        <Line value={intText} onChange={(input) => set({ input })} placeholder="255, 0xFF, 0b1111_1111, 0o377" className="min-w-0 flex-1" />
        <div className="w-52"><Select value={s.base} onChange={(e) => set({ base: e.target.value })}>
          <option value="10">Bare digits are decimal</option><option value="16">Bare digits are hex</option>
          <option value="2">Bare digits are binary</option><option value="8">Bare digits are octal</option>
        </Select></div>
      </Bar>
      {n && !n.ok && <Err>{n.error}</Err>}
      {n?.ok && (
        <Table rows={[
          ["Decimal", formatBase(n.value, 10, false)],
          ["Hex", (n.value < 0n ? "-0x" : "0x") + formatBase(n.value < 0n ? -n.value : n.value, 16, false)],
          ["Binary", formatBase(n.value, 2)],
          ["Octal", formatBase(n.value, 8)],
          ...twos,
        ]} />
      )}
      <Label>Size</Label>
      <Line value={sizeText} onChange={(size) => set({ size, ...(pastedSize ? { input: "" } : {}) })} placeholder="1.5 GB, 512MiB, 4k, or a byte count" />
      {sizeText.trim() && (bytes === null
        ? <Err>Not a size: a number, then B, KB, MB, GB, TB, or KiB, MiB, GiB, TiB</Err>
        : <Table rows={sizeTable(bytes)} />)}
    </Stack>
  );
}

// ---- HTTP status ------------------------------------------------------------------------------

export function HttpTool() {
  const [s, set] = useTool("http", { input: "" });
  const list = useMemo(() => findStatus(s.input), [s.input]);
  return (
    <Stack>
      <Line value={s.input} onChange={(input) => set({ input })} placeholder="A code (404, or 40 for every 40x) or words (rate limit, gateway)" />
      {list.length === 0 && <div className="text-[12px] text-text-muted">No status matches.</div>}
      {[1, 2, 3, 4, 5].map((c) => {
        const rows = list.filter((x) => Math.floor(x.code / 100) === c);
        if (!rows.length) return null;
        return (
          <div key={c}>
            <Label>{c}xx {CLASSES[c]}</Label>
            <div className={LIST}>
              {rows.map((x) => (
                <div key={x.code} className="flex items-start gap-3 rounded-md px-2 py-1 transition-colors hover:bg-white/5">
                  <span className="w-10 shrink-0 font-mono font-semibold" style={{ color: tone(c === 2 ? "green" : c >= 4 ? "red" : c === 3 ? "blue" : "cyan") }}>{x.code}</span>
                  <span className="w-56 shrink-0 text-text-primary">{x.name}</span>
                  <span className="text-text-secondary">{x.desc}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Stack>
  );
}
