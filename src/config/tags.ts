/**
 * Keyword tagging rules. A story gets a tag when any pattern matches its title or
 * excerpt. Tags are worked out at build time, so editing a rule here re-tags the
 * whole archive on the next build.
 *
 * `intro` is shown at the top of the tag page (/tag/<id>/); write it once by hand.
 */
export interface TagRule {
  id: string;
  label: string;
  patterns: RegExp[];
  intro: string;
  /** Match the headline only. For broad words that cause false positives in excerpts. */
  titleOnly?: boolean;
}

export const TAG_RULES: TagRule[] = [
  {
    id: 'google',
    label: 'Google',
    patterns: [/\bgoogle(bot)?\b/i, /\bsearch central\b/i],
    intro:
      'Everything about Google Search: official announcements from Search Central and the Search Status Dashboard, documentation changes, and how the trade press and tool vendors covered them.',
  },
  {
    id: 'core-update',
    label: 'Core update',
    patterns: [/\bcore (algorithm )?update/i],
    intro:
      'Google core updates are broad changes to how Search ranks results, usually announced on the Search Status Dashboard and rolling out over about two weeks. This page collects the announcements and the coverage around each one.',
  },
  {
    id: 'spam-update',
    label: 'Spam update',
    patterns: [/\b(link )?spam update/i, /\bspambrain\b/i, /\bsite reputation abuse\b/i],
    intro:
      'Google spam updates target sites that break its spam policies, from link spam to site reputation abuse. Here are the announcements and the reporting on each rollout.',
  },
  {
    id: 'ai-overviews',
    label: 'AI Overviews & AI Mode',
    patterns: [/\bai overviews?\b/i, /\bai mode\b/i, /\bsge\b/i, /\bsearch generative experience\b/i],
    intro:
      "News about Google's AI Overviews and AI Mode: rollouts, traffic effects, reporting in Search Console, and how publishers are responding.",
  },
  {
    id: 'openai',
    label: 'OpenAI & ChatGPT',
    patterns: [/\bopenai\b/i, /\bchatgpt\b/i, /\bsearchgpt\b/i, /\bgptbot\b/i, /\boai-searchbot\b/i],
    intro: 'OpenAI and ChatGPT as a search channel: ChatGPT search, its crawlers, referral traffic and visibility.',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    patterns: [/\bperplexity\b/i, /\bperplexitybot\b/i, /\bcomet browser\b/i],
    intro: 'Perplexity news: product changes, publisher deals, crawling and what it means for search visibility.',
  },
  {
    id: 'ai-search',
    label: 'AI search & GEO',
    patterns: [
      /\bgenerative engine optimi[sz]ation\b/i,
      /\b(geo|aeo|llmo)\b/,
      /\bllms?\b/i,
      /\bai search\b/i,
      /\bllms\.txt\b/i,
      /\bgemini\b/i,
      /\bclaude\b/i,
      /\bcopilot\b/i,
    ],
    titleOnly: true,
    intro:
      'Search beyond the ten blue links: generative engine optimisation, LLM visibility, AI assistants as a traffic source, and the crawlers behind them.',
  },
  {
    id: 'bing',
    label: 'Bing',
    patterns: [/\bbing\b/i, /\bindexnow\b/i, /\bmicrosoft advertising\b/i],
    intro: 'Microsoft Bing: Bing Webmaster Tools, IndexNow, Copilot in Bing and ranking changes.',
  },
  {
    id: 'search-console',
    label: 'Search Console',
    patterns: [/\bsearch console\b/i, /\bgsc\b/],
    intro: 'Changes to Google Search Console: new reports, data issues and features.',
  },
  {
    id: 'structured-data',
    label: 'Structured data',
    patterns: [/\bstructured data\b/i, /\bschema(\.org| markup)\b/i, /\brich (results|snippets)\b/i],
    intro: 'Structured data and rich results: new and retired features, documentation changes and markup advice.',
  },
  {
    id: 'crawling-indexing',
    label: 'Crawling & indexing',
    patterns: [/\bcrawl(ing|er|ers)?\b/i, /\bindex(ing|ed)\b/i, /\brobots\.txt\b/i, /\bsitemaps?\b/i, /\bcanonical/i],
    titleOnly: true,
    intro: 'How search engines discover and store pages: crawling, indexing, robots.txt, sitemaps and canonicals.',
  },
  {
    id: 'local',
    label: 'Local search',
    patterns: [/\bgoogle business profile\b/i, /\blocal (search|seo|pack)\b/i, /\bgoogle maps\b/i],
    intro: 'Local search news: Google Business Profile, the local pack, Maps and reviews.',
  },
  {
    id: 'documentation',
    label: 'Documentation',
    patterns: [/\bdocumentation\b/i],
    titleOnly: true,
    intro: "Changes to Google Search's own documentation, as listed on its updates page.",
  },
];

export const tagById = (id: string) => TAG_RULES.find((t) => t.id === id);
