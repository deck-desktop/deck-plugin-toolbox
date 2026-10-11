// Base64, in both alphabets, over UTF-8 text.
//
// btoa/atob work on Latin-1 strings, so "é" or an emoji either throws or comes back as mojibake.
// Everything goes through bytes instead, and the JWT tool reuses the url-safe decoder.

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let bin = "";
  // In chunks: spreading a whole large array into fromCharCode overflows the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const out = btoa(bin);
  return urlSafe ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : out;
}

/** Either alphabet, padded or not, whitespace ignored. Throws on anything that is not base64. */
export function base64ToBytes(text: string): Uint8Array {
  let t = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(t) || t.length % 4 === 1) throw new Error("Not valid base64");
  t += "=".repeat((4 - (t.length % 4)) % 4);
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}

export const encodeBase64 = (text: string, urlSafe = false) => bytesToBase64(new TextEncoder().encode(text), urlSafe);

/** Throws when the bytes are not UTF-8 text, rather than returning replacement characters. */
export function decodeBase64(text: string): string {
  const bytes = base64ToBytes(text);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Decodes to ${bytes.length} bytes that are not UTF-8 text`);
  }
}
