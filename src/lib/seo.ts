import { formatDayLong, formatDayShort } from './dates';
import type { StoryGroup, StoryView } from './query';
import { truncate } from './text';

/** schema.org CollectionPage + ItemList for a list of outbound stories. */
export function collectionJsonLd(opts: { name: string; description: string; url: string; stories: StoryView[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'en-GB',
    isPartOf: { '@id': 'https://seo-news.mikehiggins.me.uk/#website' },
    author: { '@type': 'Person', name: 'Mike Higgins', url: 'https://mikehiggins.me.uk/' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.stories.length,
      itemListElement: opts.stories.slice(0, 50).map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: s.url,
        name: s.title,
      })),
    },
  };
}

/** Primary editorial heading (<h1>) for a daily edition page. */
export function dayHeading(day: string, groups: StoryGroup[]): string {
  const lead = groups[0]?.lead;
  if (!lead) return `SEO News for ${formatDayLong(day)}`;
  return lead.title;
}

/** Keyword-rich <title> tag for a daily edition page, built from its lead story groups. */
export function dayTitle(day: string, groups: StoryGroup[]): string {
  const lead1 = groups[0]?.lead.title;
  if (!lead1) return `SEO News for ${formatDayLong(day)} | Mike Higgins`;
  const shortDate = `${formatDayShort(day)} ${day.slice(0, 4)}`;
  const lead2 = groups[1]?.lead.title;
  if (lead2 && lead1.length + lead2.length + 3 <= 68) {
    return `${lead1} & ${lead2}: SEO News (${shortDate}) | Mike Higgins`;
  }
  return `${truncate(lead1, 68)}: SEO News (${shortDate}) | Mike Higgins`;
}

/** Meta description for a day page, built from its top headlines. */
export function dayDescription(day: string, stories: StoryView[]): string {
  const lead = stories.find((s) => s.sourceCategory === 'official') ?? stories[0];
  const base = `SEO news for ${formatDayLong(day)}: ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} from Google and the search industry`;
  const text = lead ? `${base}, including "${lead.title}".` : `${base}.`;
  return text.length > 300 ? `${text.slice(0, 297)}…` : text;
}
