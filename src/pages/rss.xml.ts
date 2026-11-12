import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { sourceById } from '../config/sources';
import { TAG_RULES } from '../config/tags';
import { loadNews } from '../lib/query';

const ITEMS = 50;
const label = new Map(TAG_RULES.map((t) => [t.id, t.label]));
const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export const GET: APIRoute = async ({ site }) => {
  const data = await loadNews();
  return rss({
    title: 'SEO News, Mike Higgins',
    description: 'Every day in SEO, on one calendar: Google announcements, algorithm updates and search industry coverage.',
    site: new URL(import.meta.env.BASE_URL, site).toString(),
    customData: '<language>en-gb</language>',
    items: data.stories.slice(0, ITEMS).map((s) => ({
      title: s.title,
      link: s.url, // the original article
      pubDate: new Date(s.publishedAt),
      description: s.summary ? `${s.summary} (${s.sourceName})` : s.sourceName,
      categories: s.tags.map((t) => label.get(t) ?? t),
      customData: `<source url="${escapeXml(sourceById(s.sourceId)?.url ?? s.url)}">${escapeXml(s.sourceName)}</source>`,
    })),
  });
};
