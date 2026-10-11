// What a pasted value is, so the toolbox can open the right tool for it.
//
// Order matters: the most specific reading wins. A JWT is also base64url text, and a ULID is
// also plain base32, so those are tried before base64.
import { decodeBase64 } from "./codec";
import { parseColor } from "./color";
import { parseCron } from "./cron";
import { STATUSES } from "./http";
import { inspectId } from "./ids";
import { hasInvisible } from "./unicode";

export type ToolId = "json" | "jwt" | "base64" | "url" | "time" | "ids" | "hash" | "regex" | "cron" | "case" | "diff" | "color"
  | "unicode" | "password" | "numbers" | "http";

export function detect(input: string): ToolId | null {
  // Before trimming: trim() would remove a byte order mark, one of the things this looks for.
  if (hasInvisible(input)) return "unicode";
  const s = input.trim();
  if (!s) return null;
  if (/^[1-5]\d\d$/.test(s) && STATUSES.some((x) => x.code === Number(s))) return "http";
  // A prefixed integer (0xFF, 0b1010) or a size (1.5 GB, 512MiB). A bare 0xAARRGGBB is taken as
  // a number too; Color(0x...) is what says it is a color.
  if (/^[-+]?0[xbo][0-9a-f_]+$/i.test(s) || /^\d+(\.\d+)?\s*[kmgtp]i?b$/i.test(s)) return "numbers";
  if (/^(Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(s)) {
    try { if (JSON.parse(decodeBase64(s.replace(/^Bearer\s+/, "").split(".")[0])).alg !== undefined) return "jwt"; } catch { /* not a JWT */ }
  }
  if (/^\d{10}(\d{3})?$/.test(s) || /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) return "time";
  if (/^[[{]/.test(s)) {
    try { JSON.parse(s); return "json"; } catch { /* fall through */ }
  }
  if (inspectId(s)) return "ids";
  if (/^(#|rgba?\(|hsla?\(|(const\s+)?Color(\.from\w+)?\()/i.test(s) && parseColor(s)) return "color";
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s) || /%[0-9a-f]{2}/i.test(s)) return "url";
  if (/^@\w+$/.test(s) || /^(\S+\s+){4}\S+$/.test(s)) {
    try { parseCron(s); return "cron"; } catch { /* not cron */ }
  }
  // Whole groups of four and at least 12 characters: shorter runs of letters are usually words.
  if (s.length >= 12 && s.length % 4 === 0 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) {
    try { if (/^[\P{C}\n\r\t]*$/u.test(decodeBase64(s))) return "base64"; } catch { /* not base64 text */ }
  }
  return null;
}
