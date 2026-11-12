import type { APIRoute, GetStaticPaths } from 'astro';
import { SOURCES } from '../../config/sources';
import { tagById } from '../../config/tags';
import { formatDayLong } from '../../lib/dates';
import { renderOgImage, type OgContent } from '../../lib/og';
import { activeTags, groupsForDay, loadNews, openIncidents, type NewsData } from '../../lib/query';

/** One Open Graph image per page: /og/home.png, /og/archive.png, /og/2026-11-10.png, /og/tag/core-update.png */
export const getStaticPaths = (async () => {
  const data = await loadNews();
  return [
    { params: { slug: 'home' } },
    { params: { slug: 'archive' } },
    ...data.days.map((d) => ({ params: { slug: d } })),
    ...activeTags(data).map((t) => ({ params: { slug: `tag/${t.id}` } })),
  ];
}) satisfies GetStaticPaths;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function contentFor(slug: string, data: NewsData): OgContent {
  const rolling = openIncidents(data).filter((i) => i.serviceName === 'Ranking');
  const sourceCount = SOURCES.filter((s) => s.enabled).length;

  if (slug === 'home') {
    return {
      kicker: 'Every day in SEO, on one calendar',
      title: "Google's announcements, algorithm updates and the industry's coverage, every day",
      pills: [...rolling.slice(0, 1).map((i) => `${i.title} rolling out`), `${sourceCount} sources`, 'Updated daily'],
      highlightFirstPill: rolling.length > 0,
    };
  }
  if (slug === 'archive') {
    return {
      kicker: 'Archive',
      title: 'Every day in SEO, on one calendar',
      subtitle: `${data.stories.length} stories across ${data.days.length} days, from Google, Bing and the search industry.`,
      pills: [plural(data.days.length, 'day'), `${sourceCount} sources`],
    };
  }
  if (slug.startsWith('tag/')) {
    const rule = tagById(slug.slice(4))!;
    return {
      kicker: 'Topic',
      title: `${rule.label} news`,
      subtitle: rule.intro,
      pills: [plural(data.tagCounts.get(rule.id) ?? 0, 'story', 'stories')],
    };
  }

  // A day: lead with its top story.
  const stories = data.byDay.get(slug) ?? [];
  const [top] = groupsForDay(data, slug);
  const official = stories.filter((s) => s.sourceCategory === 'official').length;
  const sources = new Set(stories.map((s) => s.sourceId)).size;
  return {
    kicker: formatDayLong(slug),
    title: top?.lead.title ?? 'SEO News',
    subtitle: stories.length > 1 ? `Plus ${plural(stories.length - 1, 'more story', 'more stories')} from Google, Bing and the search industry.` : undefined,
    pills: [plural(stories.length, 'story', 'stories'), plural(sources, 'source'), ...(official ? [`${official} official`] : [])],
  };
}

export const GET: APIRoute = async ({ params }) => {
  const data = await loadNews();
  const png = await renderOgImage(contentFor(params.slug!, data));
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
