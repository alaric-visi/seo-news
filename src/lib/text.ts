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
    .replace(/\bContinue reading\b.*$/i, '')
    .trim();
}
