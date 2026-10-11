// Passwords from crypto randomness, with every chosen kind of character present at least once.

export interface PasswordOptions { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; unambiguous: boolean }

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
};
/** Characters that read alike in many fonts: I l 1 | O 0 o. */
const AMBIGUOUS = /[Il1O0o|]/g;

/** A uniform integer below `n`. Rejection sampling: `byte % n` would favour the low values. */
function below(n: number, rnd: () => number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) { const x = rnd(); if (x < limit) return x % n; }
}

const cryptoU32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function pools(o: PasswordOptions): string[] {
  return (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]).map((k) => (o.unambiguous ? SETS[k].replace(AMBIGUOUS, "") : SETS[k]));
}

export function generate(o: PasswordOptions, rnd: () => number = cryptoU32): string {
  const ps = pools(o);
  if (!ps.length) throw new Error("Pick at least one kind of character");
  if (o.length < ps.length) throw new Error(`Needs at least ${ps.length} characters to include every kind picked`);
  const all = ps.join("");
  // One from each kind first, the rest from all of them, then shuffled so the first few are not
  // predictable by kind.
  const chars = [...ps.map((p) => p[below(p.length, rnd)]), ...Array.from({ length: o.length - ps.length }, () => all[below(all.length, rnd)])];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = below(i + 1, rnd);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Bits of entropy for a password of this length drawn from these pools. */
export const entropy = (o: PasswordOptions) => Math.round(o.length * Math.log2(Math.max(1, pools(o).join("").length)));
