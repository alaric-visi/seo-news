/**
 * Writes the logo and app icons into public/ from src/lib/brand.ts.
 * Run after changing the logo:  npm run brand
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFile } from 'node:fs/promises';
import { BRAND, logoSvg } from '../src/lib/brand';

const svg = logoSvg();
const png = (size: number) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng();

await writeFile('public/favicon.svg', svg);
await writeFile('public/logo.svg', svg);
await writeFile('public/favicon.png', png(32));
await writeFile('public/apple-touch-icon.png', png(180));
await writeFile('public/icon-192.png', png(192));
await writeFile('public/icon-512.png', png(512));
await writeFile(
  'public/site.webmanifest',
  JSON.stringify(
    {
      name: 'SEO News',
      short_name: 'SEO News',
      description: 'Every day in SEO, on one calendar.',
      start_url: '/',
      display: 'browser',
      background_color: BRAND.bg,
      theme_color: BRAND.bg,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Wrote favicon.svg, logo.svg, favicon.png, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest');
