// Timestamps and timezones.

export type Unit = "s" | "ms" | "µs" | "ns" | "date";

/**
 * A Unix timestamp in any common unit, sniffed by size, or a date string.
 *
 * A date with no zone of its own ("2026-10-11 14:30") is read in `zone`, which is how you ask
 * "what is 14:30 in Tokyo, here?". `zone` undefined means this machine's zone.
 */
export function parseTime(input: string, zone?: string): { ms: number; unit: Unit } | null {
  const s = input.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s), a = Math.abs(n);
    // Seconds reach 1e11 in the year 5138; milliseconds pass 1e14 likewise. Nothing real is near.
    if (a < 1e11) return { ms: n * 1000, unit: "s" };
    if (a < 1e14) return { ms: n, unit: "ms" };
    if (a < 1e17) return { ms: n / 1e3, unit: "µs" };
    return { ms: n / 1e6, unit: "ns" };
  }
  const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(s);
  if (wall && zone) {
    const [y, mo, d, h, mi, sec, frac] = wall.slice(1).map((x) => Number(x ?? 0));
    const ms = frac ? Number(wall[7].padEnd(3, "0")) : 0;
    return { ms: wallToInstant(y, mo, d, h, mi, sec, ms, zone), unit: "date" };
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : { ms: t, unit: "date" };
}

/** Minutes `zone` is ahead of UTC at instant `ms`. */
export function zoneOffset(zone: string, ms: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The instant a wall-clock time in `zone` names. A time skipped by DST lands just after the gap. */
export function wallToInstant(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const off = zoneOffset(zone, guess);
  let t = guess - off * 60000;
  // The offset at the guess can differ from the offset at the answer when DST changes between them.
  const off2 = zoneOffset(zone, t);
  if (off2 !== off) t = guess - off2 * 60000;
  return t;
}

/** `ms` as a readable time in `zone`, with the zone's short name. */
export function formatIn(ms: number, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, weekday: "short", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short",
  }).format(new Date(ms));
}

/** "in 3 hours", "2 days ago". */
export function relative(ms: number, now = Date.now()): string {
  const diff = (ms - now) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  const [unit, size] = units.find(([, n]) => Math.abs(diff) >= n) ?? ["second", 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(diff / size), unit);
}

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const allZones = (): string[] => Intl.supportedValuesOf("timeZone");
