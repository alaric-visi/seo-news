import type { APIRoute } from 'astro';
import { londonDay } from '../lib/dates';
import { dayHref, href, tagHref, updateHref } from '../lib/paths';
import { activeTags, loadNews } from '../lib/query';

/** The app's own sitemap; the portfolio's sitemap can reference it once the app is live. */
export const GET: APIRoute = async ({ site }) => {
  const data = await loadNews();
  const abs = (path: string) => new URL(path, site).toString();
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: abs(href()), lastmod: data.days[0] },
    { loc: abs(href('archive')), lastmod: data.days[0] },
    ...data.days.map((d) => ({ loc: abs(dayHref(d, data.daySlugs)), lastmod: d })),
    ...data.incidents.map((i) => ({
      loc: abs(updateHref(data.incidentSlugs.get(i.id)!)),
      lastmod: londonDay(i.modifiedAt ?? i.endAt ?? i.beginAt),
    })),
    ...activeTags(data).map((t) => ({ loc: abs(tagHref(t.id)), lastmod: data.stories.find((s) => s.tags.includes(t.id))?.day })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
