import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// The app is built to live at mikehiggins.me.uk/tools/seo-news. Until the portfolio
// proxies that path here, it is served from its own Netlify site, where
// public/_redirects maps /tools/seo-news/* onto the build output.
export default defineConfig({
  site: 'https://mikehiggins.me.uk',
  base: '/tools/seo-news',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [tailwind({ applyBaseStyles: false })],
});
