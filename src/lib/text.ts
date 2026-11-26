const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  pound: '£', euro: '€', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•',
};

/** Decodes HTML entities, including double-encoded ones like `&amp;#8217;`. */
export function decodeEntities(input: string): string {
  let out = input;
  for (let i = 0; i < 2; i++) {
    const next = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return NAMED[code.toLowerCase()] ?? m;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Strips tags and collapses whitespace: for titles and excerpts. */
export function plainText(input: string): string {
  const noTags = input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(noTags)
    .replace(/<[^>]+>/g, ' ') // tags that were entity-encoded
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts text at a word boundary, adding an ellipsis when shortened. */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:–—-]+$/, '')}…`;
}

/** Removes boilerplate some feeds append, e.g. "The post X appeared first on Y." */
export function cleanExcerpt(input: string): string {
  return input
    .replace(/\bThe post .{1,200}? appeared first on .{1,100}?\.?$/i, '')
    .replace(/\s*\[(…|&#8230;|\.\.\.)\]\s*$/, '…')
    .replace(/\b(Continue reading|Read more)\b.*$/i, '')
    .replace(/\s*…\s*$/, '…')
    .trim();
}

const SLUG_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'with',
  'in', 'of', 'into', 'onto', 'upon', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
  'might', 'must', 'that', 'this', 'these', 'those', 'it', 'its', 'how', 'why', 'what',
  'when', 'where', 'who', 'whom', 'which', 'your', 'you', 'our', 'we', 'their', 'they', 'about',
  'over', 'after', 'before', 'more', 'most', 'some', 'any', 'new', 'now', 'here', 'via', 'per',
]);

/**
 * Turns a headline or title into a concise, descriptive URL slug.
 * Drops common stopwords when enough content words exist, capped at maxWords and maxChars.
 */
export function slugify(input: string, maxWords = 8, maxChars = 60): string {
  const rawTokens = plainText(input)
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!rawTokens.length) return '';

  const contentTokens = rawTokens.filter((t) => !SLUG_STOPWORDS.has(t));
  const source = contentTokens.length >= 3 ? contentTokens : rawTokens;

  const picked: string[] = [];
  let len = 0;
  for (const token of source) {
    if (picked.length >= maxWords) break;
    const nextLen = len === 0 ? token.length : len + 1 + token.length;
    if (nextLen > maxChars && picked.length > 0) break;
    picked.push(token);
    len = nextLen;
  }
  return picked.join('-');
}
