// Integers across bases, and byte sizes across units.

/** An integer in any base: 0x, 0b and 0o prefixes, or `base` for bare digits. Underscores and spaces are ignored. */
export function parseInteger(input: string, base = 10): bigint {
  let s = input.trim().replace(/[_\s]/g, "").toLowerCase();
  const neg = s.startsWith("-");
  if (neg || s.startsWith("+")) s = s.slice(1);
  const pre = /^0([xbo])/.exec(s);
  if (pre) { base = { x: 16, b: 2, o: 8 }[pre[1] as "x" | "b" | "o"]; s = s.slice(2); }
  else if (base === 16 && s.startsWith("#")) s = s.slice(1);
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
  if (!s || [...s].some((c) => !digits.includes(c))) throw new Error(`Not a base-${base} integer`);
  let n = 0n;
  for (const c of s) n = n * BigInt(base) + BigInt(digits.indexOf(c));
  return neg ? -n : n;
}

/** `n` in `base`, digits grouped from the right (4 for binary and hex, 3 for decimal). */
export function formatBase(n: bigint, base: number, group = true): string {
  const neg = n < 0n;
  const s = (neg ? -n : n).toString(base).toUpperCase();
  const size = base === 2 || base === 16 ? 4 : base === 10 ? 3 : 0;
  const sep = base === 10 ? "," : " ";
  const g = group && size ? s.replace(new RegExp(`\\B(?=(.{${size}})+$)`, "g"), sep) : s;
  return (neg ? "-" : "") + g;
}

/** Two's complement of a negative number at `bits` wide; null when it does not fit. */
export function twosComplement(n: bigint, bits: number): bigint | null {
  const min = -(1n << BigInt(bits - 1)), max = (1n << BigInt(bits)) - 1n;
  if (n < min || n > max) return null;
  return n < 0n ? (1n << BigInt(bits)) + n : n;
}

const UNITS: Record<string, number> = {
  b: 1, byte: 1, bytes: 1,
  kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15,
  kib: 2 ** 10, mib: 2 ** 20, gib: 2 ** 30, tib: 2 ** 40, pib: 2 ** 50,
  k: 2 ** 10, m: 2 ** 20, g: 2 ** 30, t: 2 ** 40, // what ls -h and Docker mean by a bare letter
};

/** "1.5 GB", "512MiB", "4k", or a plain byte count, to bytes. */
export function parseSize(input: string): number | null {
  const m = /^\s*([\d.,]+)\s*([a-z]*)\s*$/i.exec(input);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  const unit = m[2].toLowerCase() || "b";
  if (Number.isNaN(n) || !(unit in UNITS)) return null;
  return n * UNITS[unit];
}

const trim = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 3 }));

/** The size in every unit, decimal (KB = 1000) and binary (KiB = 1024). */
export function sizeTable(bytes: number): [string, string][] {
  return [["Bytes", trim(bytes)],
    ...(["KB", "MB", "GB", "TB"] as const).map((u, i): [string, string] => [u, trim(bytes / 1000 ** (i + 1))]),
    ...(["KiB", "MiB", "GiB", "TiB"] as const).map((u, i): [string, string] => [u, trim(bytes / 1024 ** (i + 1))])];
}
