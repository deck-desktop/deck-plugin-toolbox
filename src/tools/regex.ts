// A regex tester: every match with its groups, and a replace preview.
//
// ponytail: runs on the UI thread, so a catastrophically backtracking pattern freezes Deck until
// it finishes. Move it to a Worker with a timeout if that bites.

export interface Match { index: number; text: string; groups: (string | undefined)[]; named: Record<string, string | undefined> }

export const MAX_MATCHES = 1000;

export function compile(pattern: string, flags: string): RegExp {
  // Always global to list every match; the flag is added, not required of the user.
  return new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
}

export function matches(re: RegExp, text: string): Match[] {
  const out: Match[] = [];
  for (const m of text.matchAll(re)) {
    out.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1), named: { ...(m.groups ?? {}) } });
    if (out.length >= MAX_MATCHES) break;
  }
  return out;
}
