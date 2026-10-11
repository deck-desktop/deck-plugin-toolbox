// URLs: encode and decode a component, and take a whole URL apart.

export const encodeUrl = (s: string) => encodeURIComponent(s);

/** `plus`: treat + as a space, as form-encoded query strings do. Throws on a stray %. */
export function decodeUrl(s: string, plus = false): string {
  try {
    return decodeURIComponent(plus ? s.replace(/\+/g, " ") : s);
  } catch {
    throw new Error("Not valid percent-encoding (a % not followed by two hex digits?)");
  }
}

export interface UrlParts {
  protocol: string;
  username: string;
  password: string;
  host: string;
  port: string;
  path: string;
  hash: string;
  query: [string, string][];
}

export function parseUrl(s: string): UrlParts {
  let u: URL;
  try { u = new URL(s.trim()); } catch { throw new Error("Not a full URL (it needs a scheme, like https://)"); }
  return {
    protocol: u.protocol.replace(/:$/, ""),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port,
    path: decodeURIComponent(u.pathname),
    hash: u.hash.replace(/^#/, ""),
    query: [...u.searchParams.entries()],
  };
}
