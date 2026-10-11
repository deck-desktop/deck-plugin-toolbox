// The few pieces every tool is made of: an input box, an output with a copy button, an error.
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "../shim/ui.js";

const BOX = "rounded-md border border-strong bg-elev font-mono text-[12px] text-text-primary outline-none transition focus:border-accent";

export function Area({ value, onChange, placeholder, rows = 8, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; autoFocus?: boolean;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      autoFocus={autoFocus} spellCheck={false} className={`${BOX} w-full resize-y p-2 placeholder:text-text-muted`} />
  );
}

export function Line({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  // Full width unless the caller sizes it: a width class beside w-full loses to it.
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false}
      className={`${BOX} h-8 px-2 placeholder:text-text-muted ${className || "w-full"}`} />
  );
}

export function copy(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast("Copied", "success"),
    () => toast("Could not copy to the clipboard", "error"),
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <button onClick={() => copy(text)} title="Copy" disabled={!text}
      className="shrink-0 rounded p-1 text-text-muted transition hover:bg-white/5 hover:text-text-primary disabled:opacity-40">
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
          ? <textarea readOnly value={value} rows={rows ?? Math.min(20, value.split("\n").length + 1)} spellCheck={false} className={`${BOX} min-w-0 flex-1 resize-y p-2`} />
          : <div className={`${BOX} min-w-0 flex-1 break-all px-2 py-1.5`} style={{ minHeight: 32 }}>{value || <>&nbsp;</>}</div>}
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export const Label = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">{children}</div>
);

export const Err = ({ children }: { children: ReactNode }) => (
  <div className="rounded-md border border-subtle px-2 py-1.5 text-[12px]" style={{ color: "var(--danger)" }}>{children}</div>
);

export function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-text-secondary">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

/** A row of small toggle buttons: lighter than Segmented when there are many options. */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-md border px-2.5 py-1 text-[12px] transition ${v === value ? "border-accent text-text-primary" : "border-subtle text-text-secondary hover:text-text-primary"}`}
          style={v === value ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)" } : undefined}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Run `fn`, returning its value or the message it threw. */
export function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}
