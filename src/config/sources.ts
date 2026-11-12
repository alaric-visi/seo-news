import type { SourceCategory } from '../lib/types';

/**
 * Every feed the aggregator reads. Add, remove or disable sources here; nothing else
 * needs to change.
 *
 * - format: 'feed' auto-detects RSS 2.0, Atom and RSS 1.0/RDF from the content.
 *           'google-status' reads the Search Status Dashboard's incidents.json.
 * - dedupeBy: 'url' (default) or 'guid', for feeds whose items share one URL.
 * - tags: added to every story from this source, on top of the keyword rules.
 * - backfillDays: items older than this are skipped, so a first run doesn't fill
 *   the archive with years-old posts.
 */
export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  /** The site's home page, shown as the source link. */
  homepage: string;
  category: SourceCategory;
  format: 'feed' | 'google-status';
  enabled: boolean;
  dedupeBy?: 'url' | 'guid';
  tags?: string[];
  backfillDays?: number;
  timeoutMs?: number;
  notes?: string;
}

export const DEFAULT_BACKFILL_DAYS = 45;
export const DEFAULT_TIMEOUT_MS = 20_000;

export const SOURCES: SourceConfig[] = [
  // --- Google (official) ---
  {
    id: 'google-search-central',
    name: 'Google Search Central Blog',
    url: 'https://feeds.feedburner.com/blogspot/amDG',
    homepage: 'https://developers.google.com/search/blog',
    category: 'official',
    format: 'feed',
    enabled: true,
    tags: ['google'],
  },
  {
    id: 'google-search-status',
    name: 'Google Search Status Dashboard',
    url: 'https://status.search.google.com/incidents.json',
    homepage: 'https://status.search.google.com/',
    category: 'official',
    format: 'google-status',
    enabled: true,
    tags: ['google'],
    // The dashboard lists ~10 incidents; ranking updates are rare, so keep a year of them.
    backfillDays: 365,
    notes: 'incidents.json has begin/end dates and update history; feed.atom only carries the latest entry.',
  },
  {
    id: 'google-search-docs',
    name: 'Google Search documentation updates',
    url: 'https://developers.google.com/search/updates/search_docs_updates.rss',
    homepage: 'https://developers.google.com/search/updates',
    category: 'official',
    format: 'feed',
    enabled: true,
    dedupeBy: 'guid',
    tags: ['google', 'documentation'],
    notes: 'Items link to a monthly anchor (…/updates#july-2026), so the guid identifies each change.',
  },

  // --- Trade press ---
  {
    id: 'search-engine-land',
    name: 'Search Engine Land',
    url: 'https://searchengineland.com/feed',
    homepage: 'https://searchengineland.com/',
    category: 'press',
    format: 'feed',
    enabled: true,
    notes: 'Returned 403 to automated requests on 2026-11-12. Left on to test from GitHub Actions; disable if it keeps failing.',
  },
  {
    id: 'search-engine-journal',
    name: 'Search Engine Journal',
    url: 'https://www.searchenginejournal.com/category/news/feed/atom/',
    homepage: 'https://www.searchenginejournal.com/',
    category: 'press',
    format: 'feed',
    enabled: true,
  },
  {
    id: 'search-engine-roundtable',
    name: 'Search Engine Roundtable',
    url: 'https://www.seroundtable.com/index.rdf',
    homepage: 'https://www.seroundtable.com/',
    category: 'press',
    format: 'feed',
    enabled: true,
    notes: 'Despite the .rdf name this serves RSS 2.0.',
  },

  // --- Tool vendors ---
  {
    id: 'ahrefs',
    name: 'Ahrefs Blog',
    url: 'https://ahrefs.com/blog/feed/',
    homepage: 'https://ahrefs.com/blog/',
    category: 'vendor',
    format: 'feed',
    enabled: true,
  },
  {
    id: 'moz',
    name: 'Moz Blog',
    url: 'https://moz.com/feeds/blog.rss',
    homepage: 'https://moz.com/blog',
    category: 'vendor',
    format: 'feed',
    enabled: true,
  },
  {
    id: 'semrush',
    name: 'Semrush Blog',
    url: 'https://www.semrush.com/blog/feed/',
    homepage: 'https://www.semrush.com/blog/',
    category: 'vendor',
    format: 'feed',
    enabled: true,
  },

  // --- Community ---
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest?q=SEO&points=50',
    homepage: 'https://news.ycombinator.com/',
    category: 'community',
    format: 'feed',
    enabled: true,
    timeoutMs: 45_000,
    notes: 'hnrss can be slow. Items link to the article; the HN thread is kept in extra.discussionUrl.',
  },
];

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  official: 'Google official',
  press: 'Press',
  vendor: 'Tool vendor',
  community: 'Community',
};

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
