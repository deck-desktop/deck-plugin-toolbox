// HTTP status codes: the registered ones and the few unofficial ones people meet in practice.

export interface Status { code: number; name: string; desc: string }

export const STATUSES: Status[] = [
  { code: 100, name: "Continue", desc: "The headers were accepted; send the body." },
  { code: 101, name: "Switching Protocols", desc: "The server agreed to an Upgrade, e.g. to a WebSocket." },
  { code: 103, name: "Early Hints", desc: "Preload hints sent before the final response." },
  { code: 200, name: "OK", desc: "The request succeeded." },
  { code: 201, name: "Created", desc: "A resource was created; Location usually points at it." },
  { code: 202, name: "Accepted", desc: "Queued for processing; not done yet." },
  { code: 203, name: "Non-Authoritative Information", desc: "A proxy changed the response." },
  { code: 204, name: "No Content", desc: "Succeeded with no body." },
  { code: 205, name: "Reset Content", desc: "Succeeded; the client should reset its form." },
  { code: 206, name: "Partial Content", desc: "A Range request was answered with part of the body." },
  { code: 207, name: "Multi-Status", desc: "WebDAV: several statuses in the body." },
  { code: 208, name: "Already Reported", desc: "WebDAV: members already listed." },
  { code: 226, name: "IM Used", desc: "Delta encoding applied to the response." },
  { code: 300, name: "Multiple Choices", desc: "Several representations; pick one." },
  { code: 301, name: "Moved Permanently", desc: "Use the Location URL from now on. Clients may switch POST to GET." },
  { code: 302, name: "Found", desc: "Temporarily at Location. Clients may switch POST to GET." },
  { code: 303, name: "See Other", desc: "Fetch Location with GET, typically after a POST." },
  { code: 304, name: "Not Modified", desc: "The cached copy is still good (ETag / If-Modified-Since)." },
  { code: 307, name: "Temporary Redirect", desc: "Temporarily at Location; repeat with the same method and body." },
  { code: 308, name: "Permanent Redirect", desc: "Permanently at Location; repeat with the same method and body." },
  { code: 400, name: "Bad Request", desc: "The request is malformed: bad JSON, a missing field, a bad parameter." },
  { code: 401, name: "Unauthorized", desc: "Not authenticated: no credentials, or bad or expired ones." },
  { code: 402, name: "Payment Required", desc: "Reserved; used by some APIs for billing limits." },
  { code: 403, name: "Forbidden", desc: "Authenticated, but not allowed to do this." },
  { code: 404, name: "Not Found", desc: "Nothing at this URL (or hidden from you)." },
  { code: 405, name: "Method Not Allowed", desc: "The URL exists but not for this method; Allow lists the ones it takes." },
  { code: 406, name: "Not Acceptable", desc: "Nothing matches the Accept headers." },
  { code: 407, name: "Proxy Authentication Required", desc: "The proxy wants credentials." },
  { code: 408, name: "Request Timeout", desc: "The client took too long to send the request." },
  { code: 409, name: "Conflict", desc: "Clashes with the current state: an edit conflict, a duplicate." },
  { code: 410, name: "Gone", desc: "Removed for good, and will not come back." },
  { code: 411, name: "Length Required", desc: "Content-Length is needed." },
  { code: 412, name: "Precondition Failed", desc: "An If-Match / If-Unmodified-Since condition failed." },
  { code: 413, name: "Content Too Large", desc: "The body is bigger than the server accepts." },
  { code: 414, name: "URI Too Long", desc: "The URL is longer than the server accepts." },
  { code: 415, name: "Unsupported Media Type", desc: "The Content-Type is not one the server takes." },
  { code: 416, name: "Range Not Satisfiable", desc: "The Range asked for is outside the resource." },
  { code: 417, name: "Expectation Failed", desc: "The Expect header cannot be met." },
  { code: 418, name: "I'm a teapot", desc: "An April Fools' joke (RFC 2324) that stuck." },
  { code: 421, name: "Misdirected Request", desc: "Sent to a server that cannot answer for this host." },
  { code: 422, name: "Unprocessable Content", desc: "Well-formed but invalid: validation failed." },
  { code: 423, name: "Locked", desc: "WebDAV: the resource is locked." },
  { code: 424, name: "Failed Dependency", desc: "WebDAV: an earlier request it depended on failed." },
  { code: 425, name: "Too Early", desc: "Will not process a request that might be replayed." },
  { code: 426, name: "Upgrade Required", desc: "Switch protocol (see Upgrade) and try again." },
  { code: 428, name: "Precondition Required", desc: "The request must be conditional (If-Match)." },
  { code: 429, name: "Too Many Requests", desc: "Rate limited; Retry-After says when to try again." },
  { code: 431, name: "Request Header Fields Too Large", desc: "A header, or all of them together, is too big. Often an oversized cookie." },
  { code: 451, name: "Unavailable For Legal Reasons", desc: "Blocked for legal reasons." },
  { code: 499, name: "Client Closed Request", desc: "Unofficial (nginx): the client hung up before the response." },
  { code: 500, name: "Internal Server Error", desc: "The server failed; look at its logs." },
  { code: 501, name: "Not Implemented", desc: "The server does not support this method at all." },
  { code: 502, name: "Bad Gateway", desc: "A proxy got a bad answer from the app behind it, or none: is the app up?" },
  { code: 503, name: "Service Unavailable", desc: "Overloaded or down for maintenance; Retry-After may say when." },
  { code: 504, name: "Gateway Timeout", desc: "A proxy gave up waiting for the app behind it." },
  { code: 505, name: "HTTP Version Not Supported", desc: "The server does not speak this HTTP version." },
  { code: 507, name: "Insufficient Storage", desc: "WebDAV: the server is out of space." },
  { code: 508, name: "Loop Detected", desc: "WebDAV: infinite loop while processing." },
  { code: 511, name: "Network Authentication Required", desc: "A captive portal wants you to log in." },
  { code: 520, name: "Web Server Returned an Unknown Error", desc: "Unofficial (Cloudflare): the origin sent something unexpected." },
  { code: 521, name: "Web Server Is Down", desc: "Unofficial (Cloudflare): the origin refused the connection." },
  { code: 522, name: "Connection Timed Out", desc: "Unofficial (Cloudflare): could not reach the origin in time." },
  { code: 524, name: "A Timeout Occurred", desc: "Unofficial (Cloudflare): the origin took too long to respond." },
];

export const CLASSES: Record<number, string> = { 1: "Informational", 2: "Success", 3: "Redirection", 4: "Client error", 5: "Server error" };

/** Codes matching a number prefix ("40" finds 400-409) or words in the name or description. */
export function findStatus(query: string): Status[] {
  const q = query.trim().toLowerCase();
  if (!q) return STATUSES;
  if (/^\d+$/.test(q)) return STATUSES.filter((s) => String(s.code).startsWith(q));
  const terms = q.split(/\s+/);
  return STATUSES.filter((s) => terms.every((t) => `${s.name} ${s.desc}`.toLowerCase().includes(t)));
}
