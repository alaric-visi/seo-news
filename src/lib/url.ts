const TRACKING_PARAMS = [
  /^utm_/i, /^mc_(cid|eid)$/i, /^(fbclid|gclid|dclid|msclkid|yclid|igshid)$/i,
  /^(ref|ref_src|source|src|cmp|campaign|ncid|_hsenc|_hsmi|mkt_tok)$/i,
];

/**
 * A stable form of a URL for de-duplication:
 * https, lower-case host, no fragment, no tracking parameters, sorted query,
 * no trailing slash (except the root). Returns null if the URL can't be parsed.
 */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  u.port = '';
  const kept = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.some((re) => re.test(k)))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = '';
  for (const [k, v] of kept) u.searchParams.append(k, v);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

/** Resolves a possibly relative link against a base; null if invalid. */
export function absoluteUrl(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw.trim(), base).toString();
  } catch {
    return null;
  }
}

export function hostname(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}
