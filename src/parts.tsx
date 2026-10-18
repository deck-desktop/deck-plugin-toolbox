// The few pieces every tool is made of: an input box, an output with a copy button, an error.
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "../shim/ui.js";

/** A field on the elevated surface, lit in the accent while typing in it. */
const BOX = "rounded-lg border border-subtle bg-elev font-mono text-[12px] text-text-primary outline-none transition-colors focus:border-[var(--accent)]";

export function Area({ value, onChange, placeholder, rows = 8, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; autoFocus?: boolean;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      autoFocus={autoFocus} spellCheck={false} className={`${BOX} w-full resize-y px-2.5 py-2 placeholder:text-text-muted`} />
  );
}

export function Line({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  // Full width unless the caller sizes it: a width class beside w-full loses to it.
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false}
      className={`${BOX} h-8 px-2.5 placeholder:text-text-muted ${className || "w-full"}`} />
  );
}

/** A secondary button: on the elevated surface, beside at most one accent-filled one. */
export const SECONDARY = "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-subtle bg-elev px-3 text-[12px] text-text-secondary transition-colors hover:border-strong hover:text-text-primary disabled:cursor-default disabled:opacity-40";
/** The one action a screen leads with, filled in the accent. */
export const PRIMARY = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-50";
/** A number box, the size of the small fields. */
export const NUMBER = "h-8 w-16 rounded-lg border border-subtle bg-elev px-2.5 text-[12px] text-text-primary outline-none transition-colors focus:border-[var(--accent)]";

export function copy(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast("Copied", "success"),
    () => toast("Could not copy to the clipboard", "error"),
  );
}

export function CopyButton({ text, hover }: { text: string; hover?: boolean }) {
  return (
    <button onClick={() => copy(text)} title="Copy" disabled={!text}
      // In a list row, shown when the row is hovered (or the button has the keyboard).
      className={(hover ? "opacity-0 focus:opacity-100 group-hover:opacity-100 " : "") + "grid size-6 shrink-0 place-items-center rounded text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:opacity-40"}>
      <Copy size={13} />
    </button>
  );
}

/** A result: a label, the value in a read-only box, and a copy button. */
export function Out({ label, value, rows }: { label?: string; value: string; rows?: number }) {
  const multi = rows !== undefined || value.includes("\n");
  return (
    <div className="min-w-0">
      {label && <Label>{label}</Label>}
      <div className="flex items-start gap-1">
        {multi
          ? <textarea readOnly value={value} rows={rows ?? Math.min(20, value.split("\n").length + 1)} spellCheck={false} className={`${BOX} min-w-0 flex-1 resize-y px-2.5 py-2`} />
          : <div className={`${BOX} min-w-0 flex-1 break-all px-2.5 py-1.5`} style={{ minHeight: 32 }}>{value || <>&nbsp;</>}</div>}
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export const Label = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 text-[12px] font-medium text-text-secondary">{children}</div>
);

export const Err = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg px-2.5 py-1.5 text-[12px] text-red-400" style={{ background: "color-mix(in srgb, rgb(var(--tone-red-400)) 10%, transparent)" }}>{children}</div>
);

export function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-text-secondary">
      <input type="checkbox" className="accent-[var(--accent)]" checked={on} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

/** A row of small toggle buttons: lighter than Segmented when there are many options. */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          // On: the accent's soft fill and a ring, as Deck's own toggles are.
          className={`h-7 rounded-lg border border-subtle px-2.5 text-[12px] transition-colors ${v === value ? "text-text-primary" : "text-text-secondary hover:border-strong hover:text-text-primary"}`}
          style={v === value ? { background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent)" } : { background: "var(--bg-elev)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** A state in its colour (a `--tone-*` name: "green", "red", "amber"), as Deck's status chips are. */
export const tone = (c: string) => `rgb(var(--tone-${c}-400))`;
export function Chip({ color, children }: { color: string; children: ReactNode }) {
  const c = tone(color);
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10.5px]"
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>{children}</span>
  );
}

/** A quiet box holding rows of results. */
export const LIST = "rounded-lg border border-subtle p-1 text-[12px]";
/** One row of a result list: lit on hover, its actions shown then. */
export const ROW = "group flex min-h-7 items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-white/5";

/** Run `fn`, returning its value or the message it threw. */
export function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}
