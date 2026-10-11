// JWT: decode only. The signature is shown, never checked — that needs the key, and a decoder
// that said "valid" without one would be lying.
import { decodeBase64 } from "./codec";

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  /** The time claims present, as dates. */
  times: { claim: string; date: Date }[];
  /** null when there is no exp claim. */
  expired: boolean | null;
}

const TIME_CLAIMS = ["iat", "nbf", "exp", "auth_time"];

function segment(s: string, what: string): Record<string, unknown> {
  let v: unknown;
  try { v = JSON.parse(decodeBase64(s)); } catch { throw new Error(`The ${what} is not base64url JSON`); }
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(`The ${what} is not a JSON object`);
  return v as Record<string, unknown>;
}

export function decodeJwt(token: string, now = Date.now()): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length === 5) throw new Error("This is an encrypted token (JWE); it cannot be read without the key");
  if (parts.length !== 3) throw new Error("A JWT has three parts separated by dots");
  const header = segment(parts[0], "header");
  const payload = segment(parts[1], "payload");
  const times = TIME_CLAIMS.filter((k) => typeof payload[k] === "number").map((k) => ({ claim: k, date: new Date((payload[k] as number) * 1000) }));
  const expired = typeof payload.exp === "number" ? payload.exp * 1000 <= now : null;
  return { header, payload, signature: parts[2], times, expired };
}
