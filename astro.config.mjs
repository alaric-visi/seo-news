import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Served at the root of its own subdomain.
export default defineConfig({
  site: 'https://seo-news.mikehiggins.me.uk',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [tailwind({ applyBaseStyles: false })],
});
