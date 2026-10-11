// Colors: read CSS and Flutter spellings, write them all, and check contrast.

export interface Rgba { r: number; g: number; b: number; a: number } // r, g, b 0-255; a 0-1

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (s: string, max: number) => (s.endsWith("%") ? (parseFloat(s) / 100) * max : parseFloat(s));

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  let m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  // Flutter: Color(0xAARRGGBB), or the bare 0xAARRGGBB.
  m = /^(?:(?:const\s+)?Color\(\s*)?0x([0-9a-f]{8})\s*\)?$/i.exec(s);
  if (m) {
    const n = (i: number) => parseInt(m![1].slice(i, i + 2), 16);
    return { r: n(2), g: n(4), b: n(6), a: n(0) / 255 };
  }
  m = /^Color\.fromARGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s);
  if (m) return { r: +m[2], g: +m[3], b: +m[4], a: +m[1] / 255 };
  m = /^Color\.fromRGBO\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(s);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: +m[4] };
  // rgb()/rgba()/hsl()/hsla(), comma or space separated, alpha after a comma or a slash.
  m = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i.exec(s);
  if (m) {
    const p = m[2].split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const a = p[3] !== undefined ? clamp(num(p[3], 1), 0, 1) : 1;
    if (m[1].toLowerCase().startsWith("rgb")) {
      return { r: clamp(num(p[0], 255), 0, 255), g: clamp(num(p[1], 255), 0, 255), b: clamp(num(p[2], 255), 0, 255), a };
    }
    const [r, g, b] = hslToRgb(parseFloat(p[0]) % 360, clamp(num(p[1], 1), 0, 1), clamp(num(p[2], 1), 0, 1));
    return { r, g, b, a };
  }
  return null;
}

const h2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function toHsl({ r, g, b }: Rgba): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Every spelling worth copying, labelled. */
export function formats(c: Rgba): [string, string][] {
  const hex = `#${h2(c.r)}${h2(c.g)}${h2(c.b)}${c.a < 1 ? h2(c.a * 255) : ""}`;
  const [h, s, l] = toHsl(c);
  const [r, g, b] = [c.r, c.g, c.b].map(Math.round);
  const alpha = round(c.a);
  return [
    ["HEX", hex],
    ["RGB", c.a < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`],
    ["HSL", c.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${alpha})` : `hsl(${h}, ${s}%, ${l}%)`],
    ["Flutter", `Color(0x${(h2(c.a * 255) + h2(c.r) + h2(c.g) + h2(c.b)).toUpperCase()})`],
  ];
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgba): number {
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. Alpha is ignored: both colors are taken as opaque. */
export function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Which WCAG levels a ratio passes, for normal and large text. */
export const grades = (ratio: number) => ({
  aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3, aaaLarge: ratio >= 4.5,
});
