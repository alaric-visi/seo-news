import { formatDayLong } from './dates';
import type { StoryView } from './query';

/** schema.org CollectionPage + ItemList for a list of outbound stories. */
export function collectionJsonLd(opts: { name: string; description: string; url: string; stories: StoryView[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: 'SEO News', url: 'https://seo-news.mikehiggins.me.uk/' },
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

/** Meta description for a day page, built from its top headlines. */
export function dayDescription(day: string, stories: StoryView[]): string {
  const lead = stories.find((s) => s.sourceCategory === 'official') ?? stories[0];
  const base = `SEO news for ${formatDayLong(day)}: ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} from Google and the search industry`;
  const text = lead ? `${base}, including "${lead.title}".` : `${base}.`;
  return text.length > 300 ? `${text.slice(0, 297)}…` : text;
}
