import { appendFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

/** Appends 301 redirects from bare /YYYY-MM-DD/ paths to their descriptive /YYYY-MM-DD-<slug>/ URLs. */
function dayRedirects() {
  return {
    name: 'day-redirects',
    hooks: {
      'astro:build:done': ({ dir, pages }) => {
        const lines = [];
        for (const { pathname } of pages) {
          const clean = pathname.replace(/^\/+|\/+$/g, '');
          const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(clean);
          if (!m) continue;
          const day = m[1];
          lines.push(`/${day}   /${clean}/   301!`, `/${day}/  /${clean}/   301!`);
        }
        if (lines.length) {
          lines.sort();
          appendFileSync(new URL('_redirects', dir), `\n# Canonical descriptive day URLs\n${lines.join('\n')}\n`);
        }
      },
    },
  };
}

// Served at the root of its own subdomain.
export default defineConfig({
  site: 'https://seo-news.mikehiggins.me.uk',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [tailwind({ applyBaseStyles: false }), dayRedirects()],
});
