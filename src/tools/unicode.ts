// Unicode inspection: what each character really is, and the ones that cause trouble.
//
// No full character-name table (it is megabytes); the characters that actually bite in code and
// config are named here, and everything else gets its code point and category.

/** Characters worth naming, with what they usually break. */
const NOTABLE: Record<number, string> = {
  0x00a0: "No-break space", 0x00ad: "Soft hyphen (invisible)", 0x034f: "Combining grapheme joiner (invisible)",
  0x061c: "Arabic letter mark (invisible)", 0x115f: "Hangul filler (invisible)", 0x180e: "Mongolian vowel separator (invisible)",
  0x2000: "En quad", 0x2001: "Em quad", 0x2002: "En space", 0x2003: "Em space", 0x2004: "Three-per-em space",
  0x2005: "Four-per-em space", 0x2006: "Six-per-em space", 0x2007: "Figure space", 0x2008: "Punctuation space",
  0x2009: "Thin space", 0x200a: "Hair space", 0x200b: "Zero-width space (invisible)", 0x200c: "Zero-width non-joiner (invisible)",
  0x200d: "Zero-width joiner (invisible)", 0x200e: "Left-to-right mark (invisible)", 0x200f: "Right-to-left mark (invisible)",
  0x2010: "Hyphen", 0x2011: "Non-breaking hyphen", 0x2012: "Figure dash", 0x2013: "En dash", 0x2014: "Em dash",
  0x2018: "Left single quote", 0x2019: "Right single quote", 0x201c: "Left double quote", 0x201d: "Right double quote",
  0x2026: "Ellipsis", 0x2028: "Line separator", 0x2029: "Paragraph separator",
  0x202a: "Left-to-right embedding (invisible)", 0x202b: "Right-to-left embedding (invisible)", 0x202c: "Pop directional formatting (invisible)",
  0x202d: "Left-to-right override (invisible)", 0x202e: "Right-to-left override (invisible)", 0x202f: "Narrow no-break space",
  0x205f: "Medium mathematical space", 0x2060: "Word joiner (invisible)", 0x2066: "Left-to-right isolate (invisible)",
  0x2067: "Right-to-left isolate (invisible)", 0x2068: "First strong isolate (invisible)", 0x2069: "Pop directional isolate (invisible)",
  0x2212: "Minus sign", 0x3000: "Ideographic space", 0xfeff: "Byte order mark / zero-width no-break space (invisible)",
  0xfffd: "Replacement character (text was decoded wrongly)",
};

/** ASCII stand-ins for the typographic characters: what a code editor expects. */
const PLAIN: Record<number, string> = {
  0x00a0: " ", 0x2000: " ", 0x2001: " ", 0x2002: " ", 0x2003: " ", 0x2004: " ", 0x2005: " ", 0x2006: " ", 0x2007: " ",
  0x2008: " ", 0x2009: " ", 0x200a: " ", 0x202f: " ", 0x205f: " ", 0x3000: " ",
  0x2010: "-", 0x2011: "-", 0x2012: "-", 0x2013: "-", 0x2014: "-", 0x2212: "-",
  0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0x2026: "...", 0x2028: "\n", 0x2029: "\n",
};

export interface CharInfo {
  char: string;
  cp: string;          // "U+00A0"
  utf8: string;        // "C2 A0"
  category: string;    // "Letter", "Space", ...
  note?: string;
  /** Invisible, a lookalike, or otherwise likely to break code. */
  suspicious: boolean;
}

const CATEGORIES: [RegExp, string][] = [
  [/\p{L}/u, "Letter"], [/\p{N}/u, "Number"], [/\p{P}/u, "Punctuation"], [/\p{S}/u, "Symbol"],
  [/\p{Zs}/u, "Space"], [/\p{Z}/u, "Separator"], [/\p{M}/u, "Mark"], [/\p{Cc}/u, "Control"], [/\p{Cf}/u, "Format"],
];

const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, "0");

export function charInfo(ch: string): CharInfo {
  const n = ch.codePointAt(0)!;
  const utf8 = [...new TextEncoder().encode(ch)].map((b) => hex(b, 2)).join(" ");
  const category = CATEGORIES.find(([re]) => re.test(ch))?.[1] ?? "Other";
  let note = NOTABLE[n];
  // Letters from Cyrillic and Greek that look like Latin ones: the classic lookalike in an identifier.
  if (!note && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(ch) && /[аеорсухіјѕԁԛԝАВЕКМНОРСТХІЈЅοαν]/u.test(ch)) note = "Looks like a Latin letter";
  if (!note && category === "Control" && ch !== "\n" && ch !== "\r" && ch !== "\t") note = "Control character";
  const ascii = n < 0x80;
  return { char: ch, cp: `U+${hex(n, 4)}`, utf8, category, note, suspicious: !ascii && (!!note || category === "Format") };
}

export interface Stats { codePoints: number; utf16: number; utf8: number; graphemes: number; lines: number; words: number }

export function stats(text: string): Stats {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  return {
    codePoints: [...text].length,
    utf16: text.length,
    utf8: new TextEncoder().encode(text).length,
    graphemes,
    lines: text === "" ? 0 : text.split(/\r\n|\r|\n/).length,
    words: (text.match(/[\p{L}\p{N}_'-]+/gu) ?? []).length,
  };
}

/** Invisible characters removed, typographic ones made plain ASCII. */
export function clean(text: string): string {
  let out = "";
  for (const ch of text) {
    const n = ch.codePointAt(0)!;
    if (PLAIN[n] !== undefined) out += PLAIN[n];
    else if (NOTABLE[n]?.includes("invisible") || (/\p{Cf}/u.test(ch))) continue;
    else out += ch;
  }
  return out;
}

/** Whether text holds anything invisible: what makes the paste box open this tool. */
export const hasInvisible = (text: string) => /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/.test(text);
