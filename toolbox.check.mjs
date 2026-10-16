// node toolbox.check.mjs
//
// The tools' logic, which shows a wrong answer without ever throwing: a time off by an hour, a
// YAML file that reads back different, a cron that skips a day. Compiled from the real source.
import assert from "node:assert/strict";
import { build } from "esbuild";

// Fixed zone, so the DST cases below mean the same thing on every machine.
process.env.TZ = "Europe/London";

const load = async (file) => {
  const out = await build({ entryPoints: [`src/tools/${file}`], bundle: true, format: "esm", write: false, platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
};

// ---- base64 -----------------------------------------------------------------------------------
const b64 = await load("codec.ts");
assert.equal(b64.encodeBase64("héllo ✓"), "aMOpbGxvIOKckw==", "UTF-8, not Latin-1");
assert.equal(b64.decodeBase64("aMOpbGxvIOKckw=="), "héllo ✓");
assert.equal(b64.encodeBase64("??>", true), "Pz8-", "url-safe alphabet, no padding");
assert.equal(b64.decodeBase64("Pz8-"), "??>", "url-safe decodes without padding");
assert.throws(() => b64.decodeBase64("abc$"), /Not valid base64/);
assert.throws(() => b64.decodeBase64("/w=="), /not UTF-8/, "binary is reported, not mangled");

// ---- JSON, YAML, CSV --------------------------------------------------------------------------
const j = await load("json.ts");
assert.equal(j.formatJson('{"a":[1,2]}'), '{\n  "a": [\n    1,\n    2\n  ]\n}');
assert.equal(j.minifyJson('{ "a" : 1 }'), '{"a":1}');
assert.throws(() => j.parseJson('{\n  "a": 1,\n}'), /line 3, column 1/, "error points at a line and column");

const doc = {
  name: "deck", version: 22, ok: true, none: null, empty: "", list: [1, "two", { three: 3, four: [4] }],
  nested: { "a key": "yes", quote: 'say "hi"', colon: "a: b", hash: "x #y", num: "007", multi: "a\nb" },
  emptyList: [], emptyMap: {}, deep: [[1, 2], []],
};
const yaml = j.toYaml(doc);
assert.match(yaml, /^name: deck$/m);
assert.match(yaml, /^  a key: "yes"$/m, "a reserved word is quoted so it stays a string");
assert.match(yaml, /^  num: "007"$/m, "a numeric-looking string is quoted");
assert.deepEqual(j.fromYaml(yaml), doc, "YAML out reads back as the same value");
assert.deepEqual(j.fromYaml("# config\nport: 8080 # http\nhosts:\n- a\n- b\nmode: 'it''s'\n"), { port: 8080, hosts: ["a", "b"], mode: "it's" });
assert.deepEqual(j.fromYaml("tags: [1, 2]\nmeta: {\"a\": 1}"), { tags: [1, 2], meta: { a: 1 } }, "JSON-style flow values");
assert.throws(() => j.fromYaml("a: |\n  text"), /line 1: multi-line/);
assert.throws(() => j.fromYaml("a: 1\n    b: 2"), /line 2: unexpected indentation/);
assert.throws(() => j.fromYaml("a:\n\tb: 1"), /tabs/);

const rows = [{ id: 1, name: 'He said "hi", twice' }, { id: 2, note: "line1\nline2" }];
const csv = j.toCsv(rows);
assert.equal(csv, 'id,name,note\n1,"He said ""hi"", twice",\n2,,"line1\nline2"');
assert.deepEqual(j.fromCsv(csv), [{ id: "1", name: 'He said "hi", twice', note: "" }, { id: "2", name: "", note: "line1\nline2" }], "quotes, commas and newlines round-trip");
assert.deepEqual(j.parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]], "CRLF, and no phantom last row");
assert.throws(() => j.toCsv({ a: 1 }), /array/);

// ---- JWT --------------------------------------------------------------------------------------
const jwt = await load("jwt.ts");
const seg = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${seg({ alg: "HS256", typ: "JWT" })}.${seg({ sub: "1", iat: 1_700_000_000, exp: 1_700_003_600 })}.c2ln`;
const dec = jwt.decodeJwt(`Bearer ${token}`, 1_700_000_000_000);
assert.equal(dec.header.alg, "HS256");
assert.equal(dec.payload.sub, "1");
assert.equal(dec.expired, false);
assert.equal(jwt.decodeJwt(token, 1_700_003_600_000).expired, true, "expired at exp exactly");
assert.deepEqual(dec.times.map((t) => [t.claim, t.date.toISOString()]), [["iat", "2023-11-14T22:13:20.000Z"], ["exp", "2023-11-14T23:13:20.000Z"]]);
assert.throws(() => jwt.decodeJwt("a.b.c.d.e"), /JWE/);
assert.throws(() => jwt.decodeJwt("abc"), /three parts/);

// ---- URL --------------------------------------------------------------------------------------
const url = await load("url.ts");
assert.equal(url.encodeUrl("a b&c=d/é"), "a%20b%26c%3Dd%2F%C3%A9");
assert.equal(url.decodeUrl("a+b%20c", true), "a b c");
assert.equal(url.decodeUrl("a+b", false), "a+b");
assert.throws(() => url.decodeUrl("100%"), /percent-encoding/);
const parts = url.parseUrl("https://user:p%40ss@example.com:8443/a%20b/c?x=1&x=2&q=hello%20world#top");
assert.deepEqual(parts, {
  protocol: "https", username: "user", password: "p@ss", host: "example.com", port: "8443",
  path: "/a b/c", hash: "top", query: [["x", "1"], ["x", "2"], ["q", "hello world"]],
});
assert.throws(() => url.parseUrl("example.com"), /scheme/);

// ---- time -------------------------------------------------------------------------------------
const t = await load("time.ts");
assert.deepEqual(t.parseTime("1700000000"), { ms: 1_700_000_000_000, unit: "s" });
assert.deepEqual(t.parseTime("1700000000123"), { ms: 1_700_000_000_123, unit: "ms" });
assert.deepEqual(t.parseTime("1700000000123456"), { ms: 1_700_000_000_123.456, unit: "µs" });
assert.equal(t.parseTime("2026-10-11T12:00:00Z").ms, Date.UTC(2026, 9, 11, 12));
assert.equal(t.parseTime("2026-10-11 14:30", "Asia/Tokyo").ms, Date.UTC(2026, 9, 11, 5, 30), "a zoneless time is read in the chosen zone");
assert.equal(t.parseTime("2026-07-01 12:00", "Europe/London").ms, Date.UTC(2026, 6, 1, 11), "summer time is applied");
assert.equal(t.parseTime("2026-01-01 12:00", "Europe/London").ms, Date.UTC(2026, 0, 1, 12));
assert.equal(t.parseTime("nonsense"), null);
assert.equal(t.zoneOffset("Asia/Kolkata", Date.UTC(2026, 0, 1)), 330);
assert.equal(t.zoneOffset("America/New_York", Date.UTC(2026, 6, 1)), -240);
assert.equal(t.relative(0, 3 * 3600_000), "3 hours ago");
assert.equal(t.relative(2 * 86400_000, 0), "in 2 days");
assert.match(t.formatIn(Date.UTC(2026, 9, 11, 5, 30), "Asia/Tokyo"), /14:30:00/);

// ---- ids --------------------------------------------------------------------------------------
const ids = await load("ids.ts");
const zeros = new Uint8Array(10);
assert.equal(ids.ulid(1469918176385, zeros), "01ARYZ6S410000000000000000", "the ULID spec's time vector");
assert.equal(ids.ulid(0, new Uint8Array(10).fill(255)), "0000000000ZZZZZZZZZZZZZZZZ");
assert.equal(ids.inspectId("01ARYZ6S410000000000000000").time.getTime(), 1469918176385);
const v7 = ids.uuidV7(1_700_000_000_000, zeros);
assert.match(v7, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(ids.inspectId(v7).time.getTime(), 1_700_000_000_000);
assert.equal(ids.inspectId(ids.uuidV4()).kind, "UUID v4");
assert.equal(ids.inspectId("c232ab00-9414-11ec-b3c8-9f6bdeced846").time.toISOString(), "2022-02-22T19:22:22.000Z", "UUID v1 time");
assert.equal(ids.inspectId("not an id"), null);

// ---- hash -------------------------------------------------------------------------------------
const h = await load("hash.ts");
assert.equal(await h.hashText("abc", "SHA-256"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(await h.hashText("abc", "SHA-1"), "a9993e364706816aba3e25717850c26c9cd0d89d");

// ---- regex ------------------------------------------------------------------------------------
const rx = await load("regex.ts");
const ms = rx.matches(rx.compile("(?<k>\\w+)=(\\d+)", ""), "a=1, bb=22");
assert.deepEqual(ms.map((m) => [m.index, m.text, m.groups, m.named.k]), [[0, "a=1", ["a", "1"], "a"], [5, "bb=22", ["bb", "22"], "bb"]]);
assert.equal(rx.matches(rx.compile("x*", ""), "abc").length, 4, "empty matches do not loop forever");
assert.throws(() => rx.compile("(", ""));

// ---- cron -------------------------------------------------------------------------------------
const cron = await load("cron.ts");
const iso = (ds) => ds.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
const from = new Date(2026, 9, 11, 10, 0); // Sunday 11 Oct 2026, 10:00
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("0 3 * * 1"), from, 3)), ["2026-10-12 03:00", "2026-10-19 03:00", "2026-10-26 03:00"]);
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("*/15 * * * *"), from, 3)), ["2026-10-11 10:15", "2026-10-11 10:30", "2026-10-11 10:45"], "strictly after `from`");
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("0 9-17/4 * * MON-FRI"), from, 4)), ["2026-10-12 09:00", "2026-10-12 13:00", "2026-10-12 17:00", "2026-10-13 09:00"]);
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("0 0 13 * 5"), new Date(2026, 1, 1), 3)), ["2026-02-06 00:00", "2026-02-13 00:00", "2026-02-20 00:00"], "both day fields set: either matches");
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("0 0 29 2 *"), from, 1)), ["2028-02-29 00:00"], "leap day");
assert.deepEqual(cron.nextRuns(cron.parseCron("0 0 30 2 *"), from, 1), [], "never matches: gives up, does not hang");
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("@daily"), from, 1)), ["2026-10-12 00:00"]);
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("0 0 * * 7"), from, 1)), ["2026-10-18 00:00"], "7 is Sunday");
// Clocks go forward at 01:00 on 29 March 2026 in London: 01:30 does not exist that day.
assert.deepEqual(iso(cron.nextRuns(cron.parseCron("30 1 * * *"), new Date(2026, 2, 28, 12), 2)), ["2026-03-30 01:30", "2026-03-31 01:30"], "a skipped time is skipped, not run twice or hung on");
// Clocks go back at 02:00 on 25 October 2026: 01:30 happens twice; cron runs it once.
assert.equal(cron.nextRuns(cron.parseCron("30 1 * * *"), new Date(2026, 9, 25, 0), 2).filter((d) => d.getDate() === 25).length, 1);

assert.equal(cron.describeCron(cron.parseCron("0 3 * * 1")), "At 03:00 on Monday");
assert.equal(cron.describeCron(cron.parseCron("*/15 * * * *")), "Every 15 minutes");
assert.equal(cron.describeCron(cron.parseCron("* * * * *")), "Every minute");
assert.equal(cron.describeCron(cron.parseCron("0 9,17 * * MON-FRI")), "At 09:00 and 17:00 on Monday through Friday");
assert.equal(cron.describeCron(cron.parseCron("30 * 1,15 * *")), "At minute 30 past every hour on day 1 and 15 of the month");
assert.equal(cron.describeCron(cron.parseCron("0 0 1 JAN *")), "At 00:00 on day 1 of the month in January");
assert.equal(cron.describeCron(cron.parseCron("0 */2 * * *")), "At minute 0 past hour every 2");
assert.throws(() => cron.parseCron("60 * * * *"), /not a valid minute/);
assert.throws(() => cron.parseCron("* * * *"), /5 fields/);
assert.throws(() => cron.parseCron("5-1 * * * *"), /backwards/);

// ---- case -------------------------------------------------------------------------------------
const cs = await load("case.ts");
assert.deepEqual(cs.words("parseHTTPResponse_v2-final"), ["parse", "http", "response", "v2", "final"]);
const conv = (id, s) => cs.convertLines(s, cs.CASES.find((c) => c.id === id).fn);
assert.equal(conv("camel", "user_id\nHTTP server"), "userId\nhttpServer", "each line on its own");
assert.equal(conv("constant", "maxRetryCount"), "MAX_RETRY_COUNT");
assert.equal(conv("kebab", "MyComponent"), "my-component");
assert.equal(conv("pascal", "deck plugin api"), "DeckPluginApi");

// ---- color ------------------------------------------------------------------------------------
const col = await load("color.ts");
const rgb = (s) => { const c = col.parseColor(s); return c && [Math.round(c.r), Math.round(c.g), Math.round(c.b), Math.round(c.a * 100) / 100]; };
assert.deepEqual(rgb("#1e90ff"), [30, 144, 255, 1]);
assert.deepEqual(rgb("#abc"), [170, 187, 204, 1]);
assert.deepEqual(rgb("#1e90ff80"), [30, 144, 255, 0.5]);
assert.deepEqual(rgb("Color(0x801E90FF)"), [30, 144, 255, 0.5], "Flutter puts alpha first");
assert.deepEqual(rgb("const Color(0xFF1E90FF)"), [30, 144, 255, 1]);
assert.deepEqual(rgb("Color.fromARGB(255, 30, 144, 255)"), [30, 144, 255, 1]);
assert.deepEqual(rgb("rgb(30 144 255 / 50%)"), [30, 144, 255, 0.5]);
assert.deepEqual(rgb("hsl(210, 100%, 56%)"), [31, 143, 255, 1]);
assert.equal(col.parseColor("blue-ish"), null);
assert.deepEqual(col.formats(col.parseColor("#1e90ff80")), [["HEX", "#1e90ff80"], ["RGB", "rgba(30, 144, 255, 0.5)"], ["HSL", "hsla(210, 100%, 56%, 0.5)"], ["Flutter", "Color(0x801E90FF)"]]);
assert.equal(col.contrast(col.parseColor("#000"), col.parseColor("#fff")), 21);
assert.equal(Math.round(col.contrast(col.parseColor("#777"), col.parseColor("#fff")) * 100) / 100, 4.48);
assert.deepEqual(col.grades(4.48), { aa: false, aaa: false, aaLarge: true, aaaLarge: false });

// ---- JSON to TypeScript and Dart --------------------------------------------------------------
const ty = await load("types.ts");
const order = { id: 1, user_name: "a", items: [{ sku: "a", qty: 1 }, { sku: "b", qty: 2.5, note: "x" }], zip: null, matrix: [[1]], class: "c", meta: {} };
const ts = ty.toTypeScript(order, "Order");
assert.match(ts, /^export interface Order \{$/m);
assert.match(ts, /^  items: Item\[\];$/m, "array element named in the singular");
assert.match(ts, /^  qty: number;$/m);
assert.match(ts, /^  note\?: string;$/m, "a key missing from some elements is optional");
assert.match(ts, /^  zip: unknown;$/m, "always null says nothing about the type");
assert.match(ts, /^  matrix: number\[\]\[\];$/m);
assert.match(ts, /^export interface Meta \{\}$/m);
assert.match(ty.toTypeScript([{ a: 1 }, { a: 2 }], "Rows"), /^export type RowList = Row\[\];$/m, "a root array names its element");
assert.match(ty.toTypeScript({ "content-type": "x" }), /^  "content-type": string;$/m, "a key that is not an identifier is quoted");
assert.throws(() => ty.toTypeScript([1, 2]), /object/);

const dart = ty.toDart(order, "Order");
assert.match(dart, /^  final String userName;$/m, "snake_case keys become camelCase fields");
assert.match(dart, /^        userName: json\['user_name'\] as String,$/m, "and still read their own key");
assert.match(dart, /^  final double qty;$/m, "int and double in one key make a double");
assert.match(dart, /^        qty: \(json\['qty'\] as num\)\.toDouble\(\),$/m);
assert.match(dart, /^  final String\? note;$/m);
assert.match(dart, /^        if \(note != null\) 'note': note,$/m, "an optional key is left out when null");
assert.match(dart, /^        items: \(json\['items'\] as List<dynamic>\)\.map\(\(e\) => Item\.fromJson\(e as Map<String, dynamic>\)\)\.toList\(\),$/m);
assert.match(dart, /^        'items': items\.map\(\(e\) => e\.toJson\(\)\)\.toList\(\),$/m);
assert.match(dart, /^        matrix: \(json\['matrix'\] as List<dynamic>\)\.map\(\(e\) => \(e as List<dynamic>\)\.map\(\(e1\) => e1 as int\)\.toList\(\)\)\.toList\(\),$/m, "nested lists name each level's parameter");
assert.match(dart, /^  final String class_;$/m, "a reserved word is not a field name");
assert.match(dart, /const Order\(\{required this\.id, required this\.userName, required this\.items, this\.zip,/);
assert.match(dart, /factory Meta\.fromJson\(Map<String, dynamic> json\) => const Meta\(\);/);
assert.match(ty.toDart({ "$price": 1 }), /'\\\$price': price,/, "a $ in a key is escaped, not interpolated");

// ---- Unicode ----------------------------------------------------------------------------------
const uni = await load("unicode.ts");
const zwsp = String.fromCodePoint(0x200b), nbsp = String.fromCodePoint(0xa0), bom = String.fromCodePoint(0xfeff);
assert.deepEqual(uni.charInfo(zwsp), { char: zwsp, cp: "U+200B", utf8: "E2 80 8B", category: "Format", note: "Zero-width space (invisible)", suspicious: true });
assert.equal(uni.charInfo("a").suspicious, false);
assert.equal(uni.charInfo(String.fromCodePoint(0x430)).note, "Looks like a Latin letter", "Cyrillic a");
assert.equal(uni.charInfo("é").suspicious, false, "an ordinary accented letter is fine");
assert.equal(uni.clean(`${bom}const${nbsp}x = “hi” — 1…${zwsp}`), 'const x = "hi" - 1...');
// e + combining acute, a space, thumbs-up + skin tone, a newline, ok: 8 code points, 6 graphemes.
assert.deepEqual(uni.stats(`e${String.fromCodePoint(0x301)} ${String.fromCodePoint(0x1f44d, 0x1f3fd)}\nok`), { codePoints: 8, utf16: 10, utf8: 15, graphemes: 6, lines: 2, words: 2 });
assert.equal(uni.hasInvisible(`a${zwsp}b`), true);
assert.equal(uni.hasInvisible("plain"), false);

// ---- passwords --------------------------------------------------------------------------------
const pw = await load("password.ts");
const all = { length: 24, lower: true, upper: true, digits: true, symbols: true, unambiguous: false };
for (let i = 0; i < 50; i++) {
  const p = pw.generate(all);
  assert.equal(p.length, 24);
  assert.ok(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p), `every kind present: ${p}`);
}
assert.ok(!/[Il1O0o|]/.test(pw.generate({ ...all, length: 200, unambiguous: true })), "no lookalike characters");
assert.match(pw.generate({ ...all, upper: false, symbols: false, digits: false }), /^[a-z]{24}$/);
assert.throws(() => pw.generate({ ...all, lower: false, upper: false, digits: false, symbols: false }), /at least one/);
assert.throws(() => pw.generate({ ...all, length: 3 }), /at least 4/);
assert.equal(pw.entropy({ ...all, length: 10, upper: false, symbols: false, digits: false }), 47, "10 x log2(26)");
// Rejection sampling: a source that returns a value past the last whole multiple is redrawn.
let calls = 0;
const biased = () => (calls++ === 0 ? 0xffffffff : 5);
assert.equal(pw.generate({ length: 1, lower: false, upper: false, digits: true, symbols: false, unambiguous: false }, biased), "5");
assert.equal(calls, 2, "the out-of-range draw was thrown away, not folded into the range");

// ---- numbers ----------------------------------------------------------------------------------
const num = await load("numbers.ts");
assert.equal(num.parseInteger("0xff"), 255n);
assert.equal(num.parseInteger("0b1010_1010"), 170n);
assert.equal(num.parseInteger("-0o17"), -15n);
assert.equal(num.parseInteger("ff", 16), 255n);
assert.equal(num.parseInteger("#1E90FF", 16), 0x1e90ffn);
assert.equal(num.parseInteger("18446744073709551615"), 18446744073709551615n, "beyond a double, exactly");
assert.throws(() => num.parseInteger("12a"), /base-10/);
assert.equal(num.formatBase(255n, 2), "1111 1111");
assert.equal(num.formatBase(0x1e90ffn, 16), "1E 90FF");
assert.equal(num.formatBase(1234567n, 10), "1,234,567");
assert.equal(num.formatBase(-255n, 16), "-FF");
assert.equal(num.twosComplement(-1n, 8), 255n);
assert.equal(num.twosComplement(-129n, 8), null);
assert.equal(num.parseSize("1.5 GB"), 1.5e9);
assert.equal(num.parseSize("512MiB"), 512 * 2 ** 20);
assert.equal(num.parseSize("4k"), 4096);
assert.equal(num.parseSize("1,024"), 1024);
assert.equal(num.parseSize("3 parsecs"), null);
assert.deepEqual(num.sizeTable(1536).slice(0, 2), [["Bytes", "1,536"], ["KB", "1.536"]]);
assert.deepEqual(num.sizeTable(1536)[5], ["KiB", "1.5"]);

// ---- HTTP status ------------------------------------------------------------------------------
const http = await load("http.ts");
assert.deepEqual(http.findStatus("418").map((s) => s.name), ["I'm a teapot"]);
assert.deepEqual(http.findStatus("40").map((s) => s.code), [400, 401, 402, 403, 404, 405, 406, 407, 408, 409]);
assert.deepEqual(http.findStatus("rate limited").map((s) => s.code), [429]);
assert.equal(http.findStatus("").length, http.STATUSES.length);
assert.ok(http.STATUSES.every((s, i, a) => i === 0 || a[i - 1].code < s.code), "sorted, no duplicates");

// ---- paste detection --------------------------------------------------------------------------
const { detect } = await load("detect.ts");
const cases = {
  [token]: "jwt", [`Bearer ${token}`]: "jwt", "1700000000": "time", "2026-10-11T12:00:00Z": "time",
  '{"a": 1}': "json", "[1, 2]": "json", "01ARYZ6S410000000000000000": "ids", [v7]: "ids",
  "#1e90ff": "color", "Color(0xFF1E90FF)": "color", "https://example.com/a?b=1": "url", "a%20b": "url",
  "0 3 * * 1": "cron", "@hourly": "cron", "aGVsbG8gd29ybGQ=": "base64",
  "": null, "hello world": null, "{not json": null, "one two three four five": null,
  password: null, localhost: null, deadbeef: null, configuration: null,
  "404": "http", "0xff": "numbers", "0b1010": "numbers", "1.5 GB": "numbers", "512MiB": "numbers", "999": null,
  [`a${String.fromCodePoint(0x200b)}b`]: "unicode", [`${String.fromCodePoint(0xfeff)}{"a":1}`]: "unicode",
};
for (const [input, want] of Object.entries(cases)) assert.equal(detect(input), want, `detect(${JSON.stringify(input)})`);

console.log("toolbox: ok");
