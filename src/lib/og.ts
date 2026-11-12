/**
 * Open Graph images (1200 x 630 PNG), rendered at build time with satori + resvg.
 * Same look as the site: near-black, teal accent, Inter + DM Mono.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { BRAND, logoSvg, svgDataUri } from './brand';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`));

let fonts: Parameters<typeof satori>[1]['fonts'] | null = null;
function loadFonts() {
  fonts ??= [
    { name: 'Inter', data: font('@fontsource/inter', 'inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter', data: font('@fontsource/inter', 'inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Inter', data: font('@fontsource/inter', 'inter-latin-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'DM Mono', data: font('@fontsource/dm-mono', 'dm-mono-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'DM Mono', data: font('@fontsource/dm-mono', 'dm-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
  ];
  return fonts;
}

export interface OgContent {
  /** Small teal line above the title, e.g. the date. */
  kicker: string;
  title: string;
  subtitle?: string;
  /** Pills along the bottom, e.g. "14 stories". */
  pills?: string[];
  /** Highlight the first pill (e.g. an active rollout). */
  highlightFirstPill?: boolean;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

/** Shrinks the title as it gets longer so it always fits in three lines. */
function titleSize(title: string): number {
  if (title.length <= 40) return 68;
  if (title.length <= 70) return 58;
  if (title.length <= 100) return 50;
  return 44;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–—-]+$/, '')}…`;
}

export async function renderOgImage(content: OgContent): Promise<Buffer> {
  const title = clip(content.title, 130);
  const pills = content.pills ?? [];

  const tree = h(
    'div',
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px 64px',
      backgroundColor: BRAND.bg,
      backgroundImage: 'radial-gradient(circle at 50% -10%, rgba(45,212,191,0.16), transparent 60%), radial-gradient(circle at 100% 100%, rgba(99,102,241,0.10), transparent 50%)',
      border: `1px solid rgba(255,255,255,0.08)`,
      fontFamily: 'Inter',
      color: BRAND.text,
    },
    [
      // Header: logo, name, domain
      h('div', { alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { alignItems: 'center', gap: 18 }, [
          h('img', { width: 64, height: 64 }, undefined, { src: svgDataUri(logoSvg()), width: 64, height: 64 }),
          h('div', { fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }, 'SEO News'),
        ]),
        h('div', { fontFamily: 'DM Mono', fontSize: 22, color: BRAND.dim }, 'seo-news.mikehiggins.me.uk'),
      ]),

      // Body: kicker, title, subtitle
      h('div', { flexDirection: 'column', gap: 18 }, [
        h('div', { fontFamily: 'DM Mono', fontWeight: 500, fontSize: 24, letterSpacing: '0.08em', textTransform: 'uppercase', color: BRAND.accentText }, content.kicker),
        h('div', { fontSize: titleSize(title), fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.025em', color: '#ffffff' }, title),
        ...(content.subtitle ? [h('div', { fontSize: 26, lineHeight: 1.4, color: BRAND.muted }, clip(content.subtitle, 140))] : []),
      ]),

      // Footer: pills and attribution
      h('div', { alignItems: 'center', justifyContent: 'space-between' }, [
        h(
          'div',
          { gap: 12 },
          pills.map((p, i) =>
            h(
              'div',
              {
                fontFamily: 'DM Mono',
                fontSize: 21,
                padding: '6px 16px',
                borderRadius: 999,
                border: i === 0 && content.highlightFirstPill ? '1px solid rgba(45,212,191,0.45)' : '1px solid rgba(255,255,255,0.14)',
                backgroundColor: i === 0 && content.highlightFirstPill ? 'rgba(45,212,191,0.14)' : 'rgba(255,255,255,0.04)',
                color: i === 0 && content.highlightFirstPill ? BRAND.accentText : BRAND.muted,
              },
              p,
            ),
          ),
        ),
        h('div', { fontSize: 22, color: BRAND.dim }, 'by Mike Higgins'),
      ]),
    ],
  );

  const svg = await satori(tree as any, { width: OG_WIDTH, height: OG_HEIGHT, fonts: loadFonts() });
  // satori has already turned text into paths, so skip resvg's system font scan
  // (it costs ~1.5 s per image).
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH }, font: { loadSystemFonts: false } }).render().asPng();
}
