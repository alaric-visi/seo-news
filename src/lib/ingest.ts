import { DEFAULT_BACKFILL_DAYS, type SourceConfig } from '../config/sources';
import { londonDay } from './dates';
import type { RawItem } from './parse';
import { cleanExcerpt, plainText, truncate } from './text';
import type { NewStory } from './types';
import { canonicalUrl } from './url';

export const EXCERPT_MAX = 280;
/** Allow for clock skew and feeds that post slightly ahead. */
const FUTURE_TOLERANCE_MS = 6 * 3_600_000;

/** Turns a source's raw items into stories, dropping old, invalid and duplicate ones. */
export function toStories(items: RawItem[], source: SourceConfig, now: Date): NewStory[] {
  const backfillMs = (source.backfillDays ?? DEFAULT_BACKFILL_DAYS) * 86_400_000;
  const seen = new Set<string>();
  const out: NewStory[] = [];

  for (const item of items) {
    const canonical = canonicalUrl(item.url);
    if (!canonical) continue;
    const dedupeKey = source.dedupeBy === 'guid' && item.guid ? `${source.id}:${item.guid}` : canonical;
    if (seen.has(dedupeKey)) continue;

    // No date, or a date in the future: treat as published when we first saw it.
    let published = item.publishedAt;
    if (!published || published.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) published = now;
    if (now.getTime() - published.getTime() > backfillMs) continue;

    const title = plainText(item.title);
    if (!title) continue;
    const excerptText = item.description ? cleanExcerpt(plainText(item.description)) : '';

    seen.add(dedupeKey);
    out.push({
      dedupeKey,
      url: item.url.trim(),
      title: truncate(title, 300),
      sourceId: source.id,
      sourceName: source.name,
      sourceCategory: source.category,
      publishedAt: published.toISOString(),
      firstSeenAt: now.toISOString(),
      day: londonDay(published),
      excerpt: excerptText ? truncate(excerptText, EXCERPT_MAX) : null,
      guid: item.guid,
      extra: item.extra,
    });
  }
  return out;
}
