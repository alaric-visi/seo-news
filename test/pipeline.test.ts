import { describe, expect, it } from 'vitest';
import type { SourceConfig } from '../src/config/sources';
import { clusterStories, eventKey } from '../src/lib/cluster';
import { addDays, londonDay, parseFeedDate } from '../src/lib/dates';
import { toStories } from '../src/lib/ingest';
import { FeedParseError, parseFeed, parseGoogleStatus } from '../src/lib/parse';
import { tagsFor } from '../src/lib/tagging';
import { decodeEntities, plainText, truncate } from '../src/lib/text';
import type { Story } from '../src/lib/types';
import { canonicalUrl } from '../src/lib/url';
import { ATOM, RDF, RSS_FEEDBURNER, RSS_SHARED_LINKS, STATUS_JSON } from './fixtures';

const NOW = new Date('2026-11-12T06:00:00Z');
const source = (over: Partial<SourceConfig> = {}): SourceConfig => ({
  id: 'test', name: 'Test', url: 'https://example.com/feed', homepage: 'https://example.com/',
  category: 'press', format: 'feed', enabled: true, ...over,
});

describe('parseFeed', () => {
  it('reads RSS, preferring feedburner:origLink and skipping items without a link', () => {
    const items = parseFeed(RSS_FEEDBURNER, 'https://feeds.example.com/x');
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.com/blog/2026/11/cdn?utm_source=feedburner&utm_medium=feed');
    expect(items[0].guid).toBe('2026-11-11-cdn');
    expect(items[0].publishedAt?.toISOString()).toBe('2026-11-11T10:00:00.000Z');
  });

  it('reads Atom, using the alternate link', () => {
    const [item] = parseFeed(ATOM, 'https://news.example.com/feed');
    expect(item.url).toBe('https://news.example.com/google-november-2026-core-update/123/');
    expect(item.title).toBe('Google Releases November 2026 Core Update');
  });

  it('reads RSS 1.0 / RDF with dc:date', () => {
    const [item] = parseFeed(RDF, 'https://rdf.example.com/');
    expect(item.url).toBe('https://rdf.example.com/post-1');
    expect(item.publishedAt?.toISOString()).toBe('2026-11-11T13:30:00.000Z');
  });

  it('rejects HTML and malformed documents', () => {
    expect(() => parseFeed('<!doctype html><html><body>403</body></html>', 'https://x.test/')).toThrow(FeedParseError);
    expect(() => parseFeed('<rss><channel><item><title>x</title></channel>', 'https://x.test/')).toThrow(FeedParseError);
    expect(() => parseFeed('<?xml version="1.0"?><opml></opml>', 'https://x.test/')).toThrow(/Unrecognised/);
  });
});

describe('parseGoogleStatus', () => {
  it('returns incidents and one story per incident, skipping invalid rows', () => {
    const { incidents, items } = parseGoogleStatus(STATUS_JSON, 'https://status.search.google.com/incidents.json');
    expect(incidents.map((i) => i.id)).toEqual(['INC1', 'INC2']);
    expect(incidents[0].uri).toBe('https://status.search.google.com/incidents/INC1');
    expect(incidents[0].endAt).toBeNull();
    expect(items[0].title).toBe('Google: November 2026 core update');
    expect(items[1].title).toBe('Google Search Serving incident: Serving was experiencing an issue');
  });

  it('rejects non-array JSON', () => {
    expect(() => parseGoogleStatus('{"a":1}', 'https://x.test/')).toThrow(FeedParseError);
  });
});

describe('toStories', () => {
  it('cleans titles and excerpts, sets the London day, and dedupes by canonical URL', () => {
    const items = parseFeed(RSS_FEEDBURNER, 'https://feeds.example.com/x');
    const stories = toStories([...items, ...items], source(), NOW);
    expect(stories).toHaveLength(1);
    expect(stories[0].title).toBe('Moving to a CDN – what to check');
    expect(stories[0].excerpt).toBe('A short summary of the post.');
    expect(stories[0].dedupeKey).toBe('https://example.com/blog/2026/11/cdn');
    expect(stories[0].day).toBe('2026-11-11');
  });

  it('dedupes by guid for feeds whose items share a URL', () => {
    const items = parseFeed(RSS_SHARED_LINKS, 'https://docs.example.com/');
    expect(toStories(items, source(), NOW)).toHaveLength(1);
    expect(toStories(items, source({ dedupeBy: 'guid' }), NOW).map((s) => s.dedupeKey)).toEqual([
      'test:2026-11-09-a',
      'test:2026-11-02-b',
    ]);
  });

  it('skips items older than the backfill window and clamps future dates to now', () => {
    const base = parseFeed(RDF, 'https://rdf.example.com/')[0];
    const old = { ...base, url: 'https://rdf.example.com/old', publishedAt: new Date('2026-01-01T00:00:00Z') };
    const future = { ...base, url: 'https://rdf.example.com/future', publishedAt: new Date('2027-01-01T00:00:00Z') };
    const stories = toStories([old, future], source({ backfillDays: 30 }), NOW);
    expect(stories.map((s) => s.url)).toEqual(['https://rdf.example.com/future']);
    expect(stories[0].publishedAt).toBe(NOW.toISOString());
  });
});

describe('dates', () => {
  it('uses London time across midnight and BST', () => {
    expect(londonDay('2026-11-11T23:30:00Z')).toBe('2026-11-11'); // GMT
    expect(londonDay('2026-07-11T23:30:00Z')).toBe('2026-07-12'); // BST
  });
  it('parses US named zones', () => {
    expect(parseFeedDate('Wed, 11 Nov 2026 15:45:00 EST')?.toISOString()).toBe('2026-11-11T20:45:00.000Z');
  });
  it('adds days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});

describe('text and URLs', () => {
  it('decodes double-encoded entities and strips tags', () => {
    expect(decodeEntities('It&amp;#8217;s')).toBe('It’s');
    expect(plainText('&lt;p&gt;Hi &amp;amp; bye&lt;/p&gt;')).toBe('Hi & bye');
  });
  it('truncates on a word boundary', () => {
    expect(truncate('one two three four five', 14)).toBe('one two three…');
  });
  it('canonicalises URLs', () => {
    expect(canonicalUrl('http://WWW.Example.com/a/?utm_source=x&b=2&a=1#frag')).toBe('https://www.example.com/a?a=1&b=2');
    expect(canonicalUrl('mailto:x@example.com')).toBeNull();
  });
});

describe('tagging', () => {
  it('adds source tags and keyword tags in config order', () => {
    expect(tagsFor({ sourceId: 'google-search-status', title: 'Google: November 2026 core update', excerpt: null }))
      .toEqual(['google', 'core-update']);
    expect(tagsFor({ sourceId: 'test', title: 'ChatGPT and Perplexity referrals', excerpt: 'AI Overviews too' }))
      .toEqual(['ai-overviews', 'openai', 'perplexity']);
  });
});

describe('clustering', () => {
  const story = (id: string, sourceId: string, title: string, publishedAt: string): Story => ({
    id, sourceId, title, publishedAt, dedupeKey: id, url: `https://example.com/${id}`, sourceName: sourceId,
    sourceCategory: sourceId === 'google' ? 'official' : 'press', firstSeenAt: publishedAt,
    day: londonDay(publishedAt), excerpt: null, guid: null, extra: {},
  });

  it('builds event keys, inferring the year', () => {
    expect(eventKey('Google: November 2026 core update', '2026-11-10T00:00:00Z')?.key).toBe('2026-11:core update');
    expect(eventKey("Google's December core update is done", '2027-01-03T00:00:00Z')?.key).toBe('2026-12:core update');
    expect(eventKey('Nothing to see', '2026-11-10T00:00:00Z')).toBeNull();
  });

  it('groups coverage of one update, including type-only headlines, but not unrelated stories', () => {
    const stories = [
      story('a', 'google', 'Google: November 2026 core update', '2026-11-10T18:06:00Z'),
      story('b', 'sej', 'Google Releases November 2026 Core Update', '2026-11-10T19:02:00Z'),
      story('c', 'ser', 'Google Core Update Volatility Heats Up', '2026-11-12T10:00:00Z'),
      story('d', 'ser', 'Bing adds IndexNow reporting', '2026-11-11T10:00:00Z'),
      story('e', 'sej', 'Google March 2026 spam update finished', '2026-11-10T10:00:00Z'),
    ];
    const clusters = clusterStories(stories);
    expect(clusters.get('a')).toBe('event:2026-11:core update');
    expect(clusters.get('b')).toBe('event:2026-11:core update');
    expect(clusters.get('c')).toBe('event:2026-11:core update');
    expect(clusters.has('d')).toBe(false);
    expect(clusters.has('e')).toBe(false);
  });

  it('groups near-identical headlines from different sources within 48 hours', () => {
    const stories = [
      story('x', 'sej', 'Google Loses Legal Battle Against SerpApi Over Scraping', '2026-11-11T09:00:00Z'),
      story('y', 'ser', 'Google Loses Another Round In Legal Battle Against SerpApi Over Scraping', '2026-11-11T15:00:00Z'),
      story('z', 'ser', 'Google Ads Brand Lists Global Brand Library', '2026-11-11T15:00:00Z'),
    ];
    const clusters = clusterStories(stories);
    expect(clusters.get('x')).toBeDefined();
    expect(clusters.get('x')).toBe(clusters.get('y'));
    expect(clusters.has('z')).toBe(false);
  });
});
