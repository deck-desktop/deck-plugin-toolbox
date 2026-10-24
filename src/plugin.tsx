// Toolbox — the small conversions a developer otherwise opens a website for.
//
// A tab, a pane view and palette entries, all showing the same tools with the same contents
// (store.ts). The home screen takes a paste and opens the tool that fits it (tools/detect.ts).
import type { ComponentType } from "react";
import {
  Binary, Braces, Calculator, CalendarClock, CaseSensitive, ClipboardPaste, Clock, Dices, GitCompare, Globe, Hash, KeyRound, Link,
  LockKeyhole, Palette, Regex, ScanText, Wrench,
} from "lucide-react";
import { monaco } from "../shim/monaco.js";
import { toast } from "../shim/ui.js";
import { configRead } from "../shim/bridge.js";
import { listen } from "../shim/event.js";
import { openWith, setCurrent, setHome, useCurrent, useHome } from "./store";
import { detect, type ToolId } from "./tools/detect";
import {
  Base64Tool, CaseTool, ColorTool, CronTool, DiffTool, HashTool, IdsTool, JsonTool, JwtTool, RegexTool, TimeTool, UrlTool,
} from "./views";
import { HttpTool, NumbersTool, PasswordTool, UnicodeTool } from "./views-extra";
import { Area } from "./parts";

interface Tool { id: ToolId; name: string; blurb: string; icon: ComponentType<{ size?: number }>; View: ComponentType }

const TOOLS: Tool[] = [
  { id: "json", name: "JSON", blurb: "Format, convert to YAML and CSV, make TypeScript and Dart models", icon: Braces, View: JsonTool },
  { id: "jwt", name: "JWT", blurb: "Decode a token, see when it expires", icon: KeyRound, View: JwtTool },
  { id: "base64", name: "Base64", blurb: "Encode and decode, UTF-8 safe", icon: Binary, View: Base64Tool },
  { id: "url", name: "URL", blurb: "Encode, decode, take a URL apart", icon: Link, View: UrlTool },
  { id: "time", name: "Time", blurb: "Timestamps and dates across timezones", icon: Clock, View: TimeTool },
  { id: "ids", name: "UUID / ULID", blurb: "Generate ids, read the time out of one", icon: Dices, View: IdsTool },
  { id: "hash", name: "Hash", blurb: "SHA-1 and SHA-2 of text or a file", icon: Hash, View: HashTool },
  { id: "regex", name: "Regex", blurb: "Test a pattern, see matches and groups", icon: Regex, View: RegexTool },
  { id: "cron", name: "Cron", blurb: "Explain an expression, list its next runs", icon: CalendarClock, View: CronTool },
  { id: "case", name: "Case", blurb: "camelCase, snake_case, kebab-case and more", icon: CaseSensitive, View: CaseTool },
  { id: "diff", name: "Diff", blurb: "Compare two pasted texts", icon: GitCompare, View: DiffTool },
  { id: "color", name: "Color", blurb: "HEX, RGB, HSL, Flutter, and contrast", icon: Palette, View: ColorTool },
  { id: "unicode", name: "Unicode", blurb: "Find invisible and lookalike characters, count bytes", icon: ScanText, View: UnicodeTool },
  { id: "password", name: "Password", blurb: "Random passwords, with their strength", icon: LockKeyhole, View: PasswordTool },
  { id: "numbers", name: "Numbers", blurb: "Decimal, hex, binary, octal, and byte sizes", icon: Calculator, View: NumbersTool },
  { id: "http", name: "HTTP status", blurb: "What a status code means", icon: Globe, View: HttpTool },
];

/**
 * The mode a paste implies. A tool keeps the mode it was left on, so without this a full URL
 * pasted after an escaped string would open in Decode, and base64 after an encode would be
 * encoded again.
 */
const PASTE_MODE: Partial<Record<ToolId, (text: string) => Record<string, unknown>>> = {
  url: (t) => ({ mode: t.includes("://") ? "parse" : "decode" }),
  json: () => ({ mode: "format" }),
  base64: () => ({ mode: "decode" }),
  numbers: () => ({ size: "" }),
};

/** Open whatever tool fits `text`; false when nothing does. */
function route(text: string): boolean {
  const id = detect(text);
  if (!id) return false;
  // Not trimmed for Unicode: a leading byte order mark is exactly what it is there to show.
  const t = id === "unicode" ? text : text.trim();
  openWith(id, t, PASTE_MODE[id]?.(t));
  return true;
}

function Home({ focus }: { focus: boolean }) {
  const text = useHome();
  const miss = text.trim() !== "" && !detect(text);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-text-secondary">
          <ClipboardPaste size={14} className="shrink-0 text-text-muted" /> Paste anything: a JWT, JSON, a timestamp, a URL, a color, a cron line…
        </div>
        <Area value={text} autoFocus={focus} rows={5} placeholder="Paste here and the right tool opens"
          onChange={(v) => { if (route(v)) setHome(""); else setHome(v); }} />
        {miss && <div className="mt-1 text-[12px] text-text-muted">Not recognised. Pick a tool below.</div>}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setCurrent(t.id)}
            className="group flex items-start gap-2.5 rounded-lg border border-subtle bg-elev p-3 text-left transition-colors hover:border-strong">
            <span className="mt-0.5 text-text-muted transition-colors group-hover:text-text-primary"><t.icon size={15} /></span>
            <span>
              <span className="block text-[12.5px] font-medium text-text-primary">{t.name}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Toolbox({ pane = false }: { pane?: boolean }) {
  const current = useCurrent();
  const tool = TOOLS.find((t) => t.id === current);
  const item = (id: ToolId | null, label: string, Icon: Tool["icon"]) => (
    <button key={id ?? "home"} onClick={() => setCurrent(id)} title={label}
      // The open tool lit in the accent's soft fill, as the Editor's tree marks the open file.
      className={`flex h-6 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors ${current === id ? "text-text-primary" : "text-text-secondary hover:bg-white/5 hover:text-text-primary"}`}
      style={current === id ? { background: "var(--accent-soft)" } : undefined}>
      <span className={current === id ? "text-text-primary" : "text-text-muted"}><Icon size={14} /></span>
      <span className="truncate">{label}</span>
    </button>
  );
  return (
    <div className="flex h-full min-h-0 bg-app">
      <nav className="scroll-thin flex w-40 shrink-0 flex-col gap-px overflow-y-auto border-r border-subtle bg-panel p-1.5">
        {item(null, "Paste anything", Wrench)}
        <div className="h-2 shrink-0" />
        {TOOLS.map((t) => item(t.id, t.name, t.icon))}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto p-4">
        {/* Keyed by tool: each mounts fresh and reads its own fields from the store. */}
        {tool ? <tool.View key={tool.id} /> : <Home focus={!pane} />}
      </main>
    </div>
  );
}

export default function Tab() { return <Toolbox />; }
// A pane does not take focus when it mounts: Workspaces remounts it on every visit, and the
// terminal beside it should keep the keyboard.
export const PaneView = () => <Toolbox pane />;

/**
 * Where the Toolbox opens from the editor's menu and the palette: a floating window, so what you
 * were working on stays in view, or a tab. Declared rather than drawn: Deck shows it in Settings,
 * Layout, Where things open, and keeps it in this plugin's own settings file, read here at start
 * and again whenever it changes.
 */
export const settings = [{
  in: "where-things-open", key: "openIn", title: "Toolbox from the editor and the palette",
  desc: "Open in Toolbox in the editor's menu, and the palette's Toolbox commands.",
  choices: [["float", "Floating window"], ["tab", "Tab"]], default: "float",
}];
type OpenIn = "float" | "tab";
let openIn: OpenIn = "float";
const readOpenIn = () => configRead("settings")
  .then((t) => { openIn = t.trim() && JSON.parse(t).openIn === "tab" ? "tab" : "float"; })
  .catch((e) => console.warn("[toolbox] settings load failed", e));
void readOpenIn();
// The user changed it in Settings: config-changed names this plugin's own configs as it names them.
const unlisten = listen<string[]>("config-changed", (e) => { if (e.payload.includes("settings")) void readOpenIn(); });

const show = () => window.dispatchEvent(openIn === "tab"
  ? new CustomEvent("deck-navigate", { detail: "toolbox" })
  : new CustomEvent("deck-open-float", { detail: { view: "toolbox", focus: true } }));

/** Open `text` in the tool that fits it, or on the home screen when none does. */
function openText(text: string, from: string) {
  if (!text.trim()) { toast(`Nothing ${from}`); return; }
  if (route(text)) setHome("");
  else { setHome(text); setCurrent(null); toast("Not recognised; pick a tool for it"); }
  show();
}

/**
 * The text selected in an editor (the focused one, else any visible one with a selection), else
 * on the page. A terminal's selection is not reachable from here: copy it and use the clipboard
 * command.
 */
function selectedText(): string {
  const eds = monaco.editor.getEditors();
  const ed = eds.find((e) => e.hasTextFocus())
    ?? eds.find((e) => { const s = e.getSelection(); return !!s && !s.isEmpty() && !!e.getDomNode()?.offsetParent; });
  const sel = ed?.getSelection();
  if (ed && sel && !sel.isEmpty()) return ed.getModel()?.getValueInRange(sel) ?? "";
  return window.getSelection()?.toString() ?? "";
}

// "Open in Toolbox" in every editor's right-click menu while text is selected.
//
// Registered once for all editors, not with addAction on each: every addAction changes Monaco's
// menu registry, and a diff editor already disposed still hears that change and throws. Removed
// in dispose, or every plugin reload would add another.
type CodeEditor = ReturnType<typeof monaco.editor.getEditors>[number];
const OPEN_SELECTION = {
  id: "deck.toolbox.open-selection",
  label: "Open in Toolbox",
  precondition: "editorHasSelection",
  contextMenuGroupId: "9_cutcopypaste",
  contextMenuOrder: 99,
  run: (ed: CodeEditor) => {
    const sel = ed.getSelection();
    if (sel) openText(ed.getModel()?.getValueInRange(sel) ?? "", "selected");
  },
};
const action = monaco.editor.addEditorAction(OPEN_SELECTION);

export function dispose() {
  action.dispose();
  void unlisten.then((f) => f());
}

/** "Toolbox: JSON" and the rest, plus the two that route the clipboard and the selection. */
export function commands() {
  return [
    {
      id: "paste",
      title: "Toolbox: open what is on the clipboard",
      run: () => {
        void navigator.clipboard.readText().then(
          (text) => openText(text, "on the clipboard"),
          () => toast("Could not read the clipboard", "error"),
        );
      },
    },
    { id: "selection", title: "Toolbox: open the selection", run: () => openText(selectedText(), "selected") },
    ...TOOLS.map((t) => ({ id: t.id, title: `Toolbox: ${t.name}`, run: () => { setCurrent(t.id); show(); } })),
  ];
}
