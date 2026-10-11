// UUIDs and ULIDs: make them, and read the time out of the kinds that carry one.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const dashed = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

export const uuidV4 = () => crypto.randomUUID();

/** Version 7: the first 48 bits are the Unix time in ms, so these sort by creation time. */
export function uuidV7(now = Date.now(), rnd = random(10)): string {
  const b = new Uint8Array(16);
  for (let i = 0; i < 6; i++) b[i] = Math.floor(now / 2 ** (8 * (5 - i))) & 0xff;
  b.set(rnd, 6);
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  return dashed(hex(b));
}

/** 48-bit ms time then 80 random bits, Crockford base32: 26 characters that sort by time. */
export function ulid(now = Date.now(), rnd = random(10)): string {
  let time = "";
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time;
  let bits = 0, acc = 0, out = "";
  for (const byte of rnd) {
    acc = (acc << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; out += CROCKFORD[(acc >> bits) & 31]; }
    acc &= (1 << bits) - 1;
  }
  return time + out;
}

export interface IdInfo { kind: string; time?: Date }

/** What a pasted id is, and when it was made if it says. */
export function inspectId(s: string): IdInfo | null {
  const t = s.trim();
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(t)) {
    let ms = 0;
    for (const c of t.slice(0, 10).toUpperCase()) ms = ms * 32 + CROCKFORD.indexOf(c);
    return { kind: "ULID", time: new Date(ms) };
  }
  const m = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.exec(t);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(t)) return { kind: "Nil UUID" };
  if (v === 7) return { kind: "UUID v7", time: new Date(parseInt(t.replace(/-/g, "").slice(0, 12), 16)) };
  if (v === 1) {
    // 60-bit count of 100ns intervals since 1582-10-15, split across three fields.
    const h = t.replace(/-/g, "");
    const ticks = BigInt(`0x${h.slice(13, 16)}${h.slice(8, 12)}${h.slice(0, 8)}`);
    return { kind: "UUID v1", time: new Date(Number(ticks / 10000n) - 12219292800000) };
  }
  return { kind: `UUID v${v}` };
}
