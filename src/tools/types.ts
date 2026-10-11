// JSON to TypeScript interfaces and Dart model classes.
//
// One sample is inferred into a type, objects in an array are merged (a key missing from some
// becomes optional, a null makes it nullable), then each named object is written out.
import { words } from "./case";

type Kind = "string" | "int" | "double" | "bool" | "null" | "never" | "any" | "list" | "object";
interface Field { ty: Ty; optional: boolean }
interface Ty { kind: Kind; nullable: boolean; of?: Ty; fields?: Map<string, Field>; name?: string }

const T = (kind: Kind, extra: Partial<Ty> = {}): Ty => ({ kind, nullable: false, ...extra });

function infer(v: unknown): Ty {
  if (v === null || v === undefined) return T("null", { nullable: true });
  if (typeof v === "string") return T("string");
  if (typeof v === "boolean") return T("bool");
  if (typeof v === "number") return T(Number.isInteger(v) ? "int" : "double");
  if (Array.isArray(v)) return T("list", { of: v.map(infer).reduce(merge, T("never")) });
  const fields = new Map<string, Field>();
  for (const [k, x] of Object.entries(v as object)) fields.set(k, { ty: infer(x), optional: false });
  return T("object", { fields });
}

/** The type that covers both: what one array's elements, or one key across objects, share. */
function merge(a: Ty, b: Ty): Ty {
  if (a.kind === "never") return b;
  if (b.kind === "never") return a;
  if (a.kind === "null") return { ...b, nullable: true };
  if (b.kind === "null") return { ...a, nullable: true };
  const nullable = a.nullable || b.nullable;
  if (a.kind !== b.kind) {
    const nums = new Set([a.kind, b.kind]);
    return nums.has("int") && nums.has("double") && nums.size === 2 ? T("double", { nullable }) : T("any", { nullable });
  }
  if (a.kind === "list") return T("list", { nullable, of: merge(a.of!, b.of!) });
  if (a.kind === "object") {
    const fields = new Map<string, Field>();
    for (const k of new Set([...a.fields!.keys(), ...b.fields!.keys()])) {
      const x = a.fields!.get(k), y = b.fields!.get(k);
      fields.set(k, x && y ? { ty: merge(x.ty, y.ty), optional: x.optional || y.optional } : { ty: (x ?? y)!.ty, optional: true });
    }
    return T("object", { nullable, fields });
  }
  return T(a.kind, { nullable });
}

const pascal = (s: string) => words(s).map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Item";
const singular = (s: string) => (/ies$/.test(s) ? s.slice(0, -3) + "y" : /[^s]s$/.test(s) ? s.slice(0, -1) : s);

/** Name every object type, reusing a name for an identical shape and numbering a clash. */
function nameAll(root: Ty, rootName: string): Ty[] {
  const out: Ty[] = [];
  const bySig = new Map<string, string>();
  const taken = new Set<string>();
  const sig = (t: Ty): string => t.kind === "object"
    ? `{${[...t.fields!].map(([k, f]) => `${k}${f.optional ? "?" : ""}:${sig(f.ty)}`).join(",")}}${t.nullable ? "?" : ""}`
    : t.kind === "list" ? `[${sig(t.of!)}]${t.nullable ? "?" : ""}` : t.kind + (t.nullable ? "?" : "");
  const visit = (t: Ty, hint: string) => {
    if (t.kind === "list") return visit(t.of!, singular(hint));
    if (t.kind !== "object") return;
    const s = sig({ ...t, nullable: false });
    const known = bySig.get(s);
    if (known) { t.name = known; return; }
    let name = pascal(hint), n = 2;
    while (taken.has(name)) name = `${pascal(hint)}${n++}`;
    taken.add(name); bySig.set(s, name); t.name = name;
    out.push(t);
    for (const [k, f] of t.fields!) visit(f.ty, k);
  };
  visit(root, rootName);
  return out;
}

function prepare(json: unknown, rootName: string): { types: Ty[]; rootIsList: boolean; root: Ty } {
  const root = infer(json);
  const obj = root.kind === "list" ? root.of! : root;
  if (obj.kind !== "object") throw new Error("Needs a JSON object, or an array of objects");
  return { types: nameAll(root, root.kind === "list" ? singular(rootName) : rootName), rootIsList: root.kind === "list", root: obj };
}

// ---- TypeScript -------------------------------------------------------------------------------

function tsType(t: Ty): string {
  let s: string;
  switch (t.kind) {
    case "string": s = "string"; break;
    case "int": case "double": s = "number"; break;
    case "bool": s = "boolean"; break;
    // Always null in the sample says nothing about what it holds when it is not.
    case "null": case "never": case "any": return "unknown";
    case "list": { const inner = tsType(t.of!); s = /[| ]/.test(inner) ? `(${inner})[]` : `${inner}[]`; break; }
    case "object": s = t.name!; break;
  }
  return t.nullable ? `${s} | null` : s;
}

export function toTypeScript(json: unknown, rootName = "Root"): string {
  const { types, rootIsList, root } = prepare(json, rootName);
  const blocks = types.map((t) => {
    const lines = [...t.fields!].map(([k, f]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return `  ${key}${f.optional ? "?" : ""}: ${tsType(f.ty)};`;
    });
    return lines.length ? `export interface ${t.name} {\n${lines.join("\n")}\n}` : `export interface ${t.name} {}`;
  });
  if (rootIsList) blocks.unshift(`export type ${root.name}List = ${root.name}[];`);
  return blocks.join("\n\n");
}

// ---- Dart -------------------------------------------------------------------------------------

const DART_RESERVED = new Set(("abstract as assert async await break case catch class const continue covariant default deferred do " +
  "dynamic else enum export extends extension external factory false final finally for get hide if implements import in " +
  "interface is late library mixin new null on operator part required rethrow return set show static super switch sync " +
  "this throw true try typedef var void while with yield").split(" "));

function dartField(key: string, used: Set<string>): string {
  const w = words(key);
  let name = w.map((x, i) => (i ? x[0].toUpperCase() + x.slice(1) : x)).join("") || "field";
  if (/^\d/.test(name)) name = `n${name}`;
  if (DART_RESERVED.has(name)) name += "_";
  let out = name, n = 2;
  while (used.has(out)) out = `${name}${n++}`;
  used.add(out);
  return out;
}

const nullableOf = (f: Field) => f.optional || f.ty.nullable || f.ty.kind === "null";

function dartType(t: Ty, nullable = t.nullable): string {
  let s: string;
  switch (t.kind) {
    case "string": s = "String"; break;
    case "int": s = "int"; break;
    case "double": s = "double"; break;
    case "bool": s = "bool"; break;
    case "null": case "never": case "any": return "dynamic";
    case "list": s = `List<${dartType(t.of!)}>`; break;
    case "object": s = t.name!; break;
  }
  return nullable ? `${s}?` : s;
}

/** The expression that reads `e` (a decoded JSON value) as type `t`. */
function fromJson(t: Ty, e: string, nullable: boolean, depth = 0): string {
  const q = nullable ? "?" : "";
  switch (t.kind) {
    case "string": case "int": case "bool": return `${e} as ${dartType(t, false)}${q}`;
    case "double": return nullable ? `(${e} as num?)?.toDouble()` : `(${e} as num).toDouble()`;
    case "null": case "never": case "any": return e;
    case "object": {
      const read = `${t.name}.fromJson(${e} as Map<String, dynamic>)`;
      return nullable ? `${e} == null ? null : ${read}` : read;
    }
    case "list": {
      if (t.of!.kind === "any" || t.of!.kind === "null" || t.of!.kind === "never") return `${e} as List<dynamic>${q}`;
      const p = depth ? `e${depth}` : "e";
      return `(${e} as List<dynamic>${q})${q}.map((${p}) => ${fromJson(t.of!, p, t.of!.nullable, depth + 1)}).toList()`;
    }
  }
}

const needsConversion = (t: Ty): boolean => t.kind === "object" || (t.kind === "list" && needsConversion(t.of!));

/** The expression that writes field value `e` back to JSON. */
function toJson(t: Ty, e: string, nullable: boolean, depth = 0): string {
  const q = nullable ? "?" : "";
  if (t.kind === "object") return `${e}${q}.toJson()`;
  if (t.kind === "list" && needsConversion(t.of!)) {
    const p = depth ? `e${depth}` : "e";
    return `${e}${q}.map((${p}) => ${toJson(t.of!, p, t.of!.nullable, depth + 1)}).toList()`;
  }
  return e;
}

const dartString = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$")}'`;

export function toDart(json: unknown, rootName = "Root"): string {
  const { types, rootIsList, root } = prepare(json, rootName);
  const classes = types.map((t) => {
    const used = new Set<string>();
    const fields = [...t.fields!].map(([key, f]) => ({ key, f, name: dartField(key, used), nullable: nullableOf(f) }));
    if (!fields.length) {
      return `class ${t.name} {\n  const ${t.name}();\n\n  factory ${t.name}.fromJson(Map<String, dynamic> json) => const ${t.name}();\n\n  Map<String, dynamic> toJson() => {};\n}`;
    }
    const decl = fields.map((x) => `  final ${dartType(x.f.ty, x.nullable)} ${x.name};`).join("\n");
    const params = fields.map((x) => (x.nullable ? `this.${x.name}` : `required this.${x.name}`)).join(", ");
    const reads = fields.map((x) => `        ${x.name}: ${fromJson(x.f.ty, `json[${dartString(x.key)}]`, x.nullable)},`).join("\n");
    // A key missing from some samples is left out when null, as the JSON it came from did.
    const writes = fields.map((x) => `        ${x.f.optional ? `if (${x.name} != null) ` : ""}${dartString(x.key)}: ${toJson(x.f.ty, x.name, x.nullable)},`).join("\n");
    return [
      `class ${t.name} {`,
      decl,
      "",
      `  const ${t.name}({${params}});`,
      "",
      `  factory ${t.name}.fromJson(Map<String, dynamic> json) => ${t.name}(`,
      reads,
      "      );",
      "",
      "  Map<String, dynamic> toJson() => {",
      writes,
      "      };",
      "}",
    ].join("\n");
  });
  if (rootIsList) {
    classes.unshift(`// The JSON is a list of ${root.name}:\n// final items = (jsonDecode(text) as List<dynamic>).map((e) => ${root.name}.fromJson(e as Map<String, dynamic>)).toList();`);
  }
  return classes.join("\n\n");
}
