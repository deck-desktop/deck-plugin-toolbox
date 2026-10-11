// Identifier case conversion.

/** The words in an identifier or phrase: split on separators and on case changes. */
export function words(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export const CASES: { id: string; label: string; fn: (w: string[]) => string }[] = [
  { id: "camel", label: "camelCase", fn: (w) => w.map((x, i) => (i ? cap(x) : x)).join("") },
  { id: "pascal", label: "PascalCase", fn: (w) => w.map(cap).join("") },
  { id: "snake", label: "snake_case", fn: (w) => w.join("_") },
  { id: "constant", label: "CONSTANT_CASE", fn: (w) => w.join("_").toUpperCase() },
  { id: "kebab", label: "kebab-case", fn: (w) => w.join("-") },
  { id: "dot", label: "dot.case", fn: (w) => w.join(".") },
  { id: "title", label: "Title Case", fn: (w) => w.map(cap).join(" ") },
  { id: "sentence", label: "Sentence case", fn: (w) => cap(w.join(" ")) },
];

/** Each line converted on its own, so a pasted list of names stays a list. */
export const convertLines = (text: string, fn: (w: string[]) => string) =>
  text.split("\n").map((l) => (l.trim() ? fn(words(l)) : l)).join("\n");
