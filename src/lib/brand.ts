/**
 * The SEO News mark: a calendar in the studio teal on near-black, with "today" lit.
 * Used for the favicon, app icons, the header and the Open Graph images.
 */
export const BRAND = {
  bg: '#09090b',
  surface: '#121215',
  accent: '#2dd4bf',
  accentText: '#5eead4',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  dim: '#8c8c96',
} as const;

/** The calendar glyph on its own, in a 512 x 512 box (no background). */
export function markGlyph(color: string = BRAND.accent, today: string = '#ccfbf1'): string {
  const cells = [
    [150, 252], [230, 252], [310, 252],
    [150, 318], [230, 318], [310, 318],
  ];
  return [
    `<rect x="112" y="136" width="288" height="264" rx="40" fill="none" stroke="${color}" stroke-width="28"/>`,
    `<path d="M112 214h288" stroke="${color}" stroke-width="28"/>`,
    `<path d="M184 100v68M328 100v68" stroke="${color}" stroke-width="28" stroke-linecap="round"/>`,
    ...cells.map(([x, y], i) =>
      i === 4
        ? `<rect x="${x}" y="${y}" width="52" height="44" rx="10" fill="${today}"/>`
        : `<rect x="${x}" y="${y}" width="52" height="44" rx="10" fill="${color}" fill-opacity="0.32"/>`,
    ),
  ].join('');
}

/** Full logo: glyph on a rounded dark tile with a faint teal rim. */
export function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
    `<rect width="512" height="512" rx="112" fill="${BRAND.bg}"/>` +
    `<rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="${BRAND.accent}" stroke-opacity="0.35" stroke-width="12"/>` +
    markGlyph() +
    `</svg>`;
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
