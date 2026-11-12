import { sourceById } from '../config/sources';
import { TAG_RULES } from '../config/tags';
import type { Story } from './types';

/** Tags for a story: the source's fixed tags plus every keyword rule that matches. */
export function tagsFor(story: Pick<Story, 'title' | 'excerpt' | 'sourceId'>): string[] {
  const full = `${story.title}\n${story.excerpt ?? ''}`;
  const tags = new Set(sourceById(story.sourceId)?.tags ?? []);
  for (const rule of TAG_RULES) {
    const haystack = rule.titleOnly ? story.title : full;
    if (rule.patterns.some((re) => re.test(haystack))) tags.add(rule.id);
  }
  // Keep the order of TAG_RULES so chips always appear in the same order.
  const order = new Map(TAG_RULES.map((r, i) => [r.id, i]));
  return [...tags].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}
