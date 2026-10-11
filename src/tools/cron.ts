// Cron: the standard five fields, explained in words, with the next times it fires.
//
//   minute hour day-of-month month day-of-week
//
// Each field takes *, a value, a range a-b, a step */n, a-b/n or a/n, and comma lists of those.
// Months and weekdays take names (JAN, MON). Weekday 7 is Sunday, like 0. When both day fields
// are restricted, a day matches if EITHER does — cron's own rule, and the usual surprise.

export interface Cron {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domAny: boolean;
  dowAny: boolean;
  /** The five fields as written (after expanding an @macro), for the description. */
  fields: string[];
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *",
};

const SPECS = [
  { name: "minute", lo: 0, hi: 59 },
  { name: "hour", lo: 0, hi: 23 },
  { name: "day of month", lo: 1, hi: 31 },
  { name: "month", lo: 1, hi: 12, names: MONTHS, base: 1 },
  { name: "day of week", lo: 0, hi: 7, names: DAYS, base: 0 },
];

function value(s: string, spec: (typeof SPECS)[number]): number {
  const i = spec.names?.indexOf(s.toUpperCase()) ?? -1;
  const n = i >= 0 ? i + (spec.base ?? 0) : /^\d+$/.test(s) ? Number(s) : NaN;
  if (Number.isNaN(n) || n < spec.lo || n > spec.hi) throw new Error(`"${s}" is not a valid ${spec.name} (${spec.lo}-${spec.hi})`);
  return n;
}

function field(text: string, spec: (typeof SPECS)[number]): Set<number> {
  const out = new Set<number>();
  for (const part of text.split(",")) {
    const m = /^([^/]+)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new Error(`"${part}" is not a valid ${spec.name}`);
    const step = m[2] ? Number(m[2]) : 1;
    if (step < 1) throw new Error(`A step of 0 in the ${spec.name} never moves`);
    let lo: number, hi: number;
    if (m[1] === "*" || m[1] === "?") [lo, hi] = [spec.lo, spec.hi];
    else if (m[1].includes("-")) {
      const [a, b] = m[1].split("-");
      [lo, hi] = [value(a, spec), value(b, spec)];
      if (lo > hi) throw new Error(`The range ${m[1]} runs backwards`);
    } else {
      lo = value(m[1], spec);
      hi = m[2] ? spec.hi : lo; // "5/15" means from 5, every 15
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr: string): Cron {
  const text = MACROS[expr.trim().toLowerCase()] ?? expr.trim();
  const fields = text.split(/\s+/);
  if (fields.length !== 5) throw new Error(`Cron needs 5 fields (minute hour day month weekday); this has ${fields.length}`);
  const [minute, hour, dom, month, dow] = fields.map((f, i) => field(f, SPECS[i]));
  if (dow.has(7)) { dow.delete(7); dow.add(0); }
  const any = (f: string) => f === "*" || f === "?";
  return { minute, hour, dom, month, dow, domAny: any(fields[2]), dowAny: any(fields[4]), fields };
}

function dayMatches(c: Cron, d: Date): boolean {
  const dom = c.dom.has(d.getDate()), dow = c.dow.has(d.getDay());
  if (c.domAny && c.dowAny) return true;
  if (c.domAny) return dow;
  if (c.dowAny) return dom;
  return dom || dow;
}

/**
 * The next `count` times after `from`, in this machine's local time.
 *
 * A time a DST change skips (01:30 on the morning clocks go forward) does not fire that day.
 * Searches five years ahead, so an expression that never matches (30 February) returns fewer.
 */
export function nextRuns(c: Cron, from: Date, count: number): Date[] {
  const out: Date[] = [];
  let d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d = new Date(d.getTime() + 60000);
  const stop = from.getFullYear() + 5;
  while (out.length < count && d.getFullYear() <= stop) {
    if (!c.month.has(d.getMonth() + 1)) { d = new Date(d.getFullYear(), d.getMonth() + 1, 1); continue; }
    if (!dayMatches(c, d)) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); continue; }
    if (!c.hour.has(d.getHours())) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1); continue; }
    if (!c.minute.has(d.getMinutes())) { d = new Date(d.getTime() + 60000); continue; }
    // When clocks go back an hour repeats; a run at the same wall-clock time as the last one is
    // that repeat, and cron fires a fixed time once.
    const prev = out[out.length - 1];
    if (!prev || prev.toLocaleString() !== d.toLocaleString()) out.push(d);
    d = new Date(d.getTime() + 60000);
  }
  return out;
}

// ---- in words ---------------------------------------------------------------------------------

const and = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** One field's text in words, names spelled out: "1-5" as "Monday through Friday". */
function words(text: string, name: (n: number) => string): string {
  return and(text.split(",").map((part) => {
    const [range, step] = part.split("/");
    const r = range.includes("-") ? range.split("-").map((x) => name(asNum(x))).join(" through ") : name(asNum(range));
    if (!step) return r;
    if (range === "*") return `every ${step}`;
    return range.includes("-") ? `every ${step} from ${r}` : `every ${step} starting at ${r}`;
  }));
}

/** A field value as a number, names included; only called on fields parseCron accepted. */
function asNum(s: string): number {
  const up = s.toUpperCase();
  if (MONTHS.includes(up)) return MONTHS.indexOf(up) + 1;
  if (DAYS.includes(up)) return DAYS.indexOf(up);
  return Number(s);
}

export function describeCron(c: Cron): string {
  const [mi, ho, dm, mo, dw] = c.fields;
  const single = (s: Set<number>, f: string) => s.size === 1 && /^\w+$/.test(f);
  const mins = [...c.minute], hours = [...c.hour];
  let time: string;
  if (mi === "*" && ho === "*") time = "Every minute";
  else if (/^\*\/\d+$/.test(mi) && ho === "*") time = `Every ${mi.slice(2)} minutes`;
  else if (single(c.minute, mi) && ho === "*") time = `At minute ${mins[0]} past every hour`;
  else if (single(c.minute, mi) && hours.length * mins.length <= 6) time = `At ${and(hours.map((h) => hhmm(h, mins[0])))}`;
  else if (mi === "*") time = `Every minute during hour ${words(ho, String)}`;
  else time = `At minute ${words(mi, String)} past ${ho === "*" ? "every hour" : `hour ${words(ho, String)}`}`;

  const dowText = words(dw, (n) => DAY_NAMES[n]);
  const domText = `day ${words(dm, String)} of the month`;
  const day = c.domAny && c.dowAny ? "" : c.domAny ? `on ${dowText}` : c.dowAny ? `on ${domText}` : `on ${domText} or on ${dowText}`;
  const month = mo === "*" ? "" : `in ${words(mo, (n) => MONTH_NAMES[n - 1])}`;
  return [time, day, month].filter(Boolean).join(" ");
}
