// Hashes through Web Crypto. No MD5: crypto.subtle does not offer it.

export const ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type Algo = (typeof ALGOS)[number];

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashBytes(bytes: BufferSource, algo: Algo): Promise<string> {
  return hex(await crypto.subtle.digest(algo, bytes));
}

export const hashText = (text: string, algo: Algo) => hashBytes(new TextEncoder().encode(text), algo);
