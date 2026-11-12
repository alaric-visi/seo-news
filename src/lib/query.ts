import { TAG_RULES } from '../config/tags';
import { clusterStories } from './cluster';
import { MIN_EDITION_STORIES } from './constants';
import { todayInLondon } from './dates';
import { getStore } from './store';
import { tagsFor } from './tagging';
import type { DayDigest, GoogleIncident, Story } from './types';

/** A story with everything the pages need worked out. */
export interface StoryView extends Story {
  tags: string[];
  summary: string | null;
  clusterId: string | null;
}

/** Stories about one event, as shown on one day's page. */
export interface StoryGroup {
  lead: StoryView;
  others: StoryView[];
  /** Stories in the same event published on other days. */
  elsewhere: StoryView[];
}

export interface NewsData {
  stories: StoryView[];
  byDay: Map<string, StoryView[]>;
  /** Days with stories, newest first. */
  days: string[];
  clusters: Map<string, StoryView[]>;
  digests: Map<string, DayDigest>;
  incidents: GoogleIncident[];
  tagCounts: Map<string, number>;
  /** "Today" for the build: London date. */
  today: string;
}

const isOfficial = (s: Story) => s.sourceCategory === 'official';
const newestFirst = (a: Story, b: Story) => b.publishedAt.localeCompare(a.publishedAt);

let cached: Promise<NewsData> | null = null;

/** Loads everything once per build. */
export function loadNews(): Promise<NewsData> {
  cached ??= build();
  return cached;
}

async function build(): Promise<NewsData> {
  const env = { ...process.env, ...(import.meta.env as Record<string, string | undefined>) };
  const store = getStore(env, 'read');
  // On Netlify there is no local store, so a missing key would publish an empty site.
  // Fail the build instead; Netlify keeps serving the previous deploy.
  // Astro turns "true" in env vars into a boolean, so compare as strings.
  if (String(env.NETLIFY) === 'true' && store.kind !== 'supabase') {
    throw new Error('Netlify build has no Supabase credentials: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  }
  const [rawStories, summaries, digestList, incidents] = await Promise.all([
    store.listStories(),
    store.listSummaries(),
    store.listDigests(),
    store.listIncidents(),
  ]);

  const summaryById = new Map(summaries.map((s) => [s.storyId, s.summary]));
  const clusterOf = clusterStories(rawStories);
  const stories: StoryView[] = rawStories
    .map((s) => ({
      ...s,
      tags: tagsFor(s),
      summary: summaryById.get(s.id) ?? null,
      clusterId: clusterOf.get(s.id) ?? null,
    }))
    .sort(newestFirst);

  const byDay = new Map<string, StoryView[]>();
  const clusters = new Map<string, StoryView[]>();
  const tagCounts = new Map<string, number>();
  for (const s of stories) {
    byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    if (s.clusterId) clusters.set(s.clusterId, [...(clusters.get(s.clusterId) ?? []), s]);
    for (const t of s.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }

  return {
    stories,
    byDay,
    days: [...byDay.keys()].sort().reverse(),
    clusters,
    digests: new Map(digestList.map((d) => [d.day, d])),
    incidents: [...incidents].sort((a, b) => b.beginAt.localeCompare(a.beginAt)),
    tagCounts,
    today: todayInLondon(),
  };
}

/**
 * A day's stories grouped by event. Groups with an official Google item come first,
 * then bigger groups, then the most recent.
 */
export function groupsForDay(data: NewsData, day: string): StoryGroup[] {
  const dayStories = data.byDay.get(day) ?? [];
  const groups = new Map<string, StoryView[]>();
  for (const s of dayStories) {
    const key = s.clusterId ?? `single:${s.id}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return [...groups.entries()]
    .map(([key, members]): StoryGroup => {
      const ordered = [...members].sort((a, b) => Number(isOfficial(b)) - Number(isOfficial(a)) || a.publishedAt.localeCompare(b.publishedAt));
      const elsewhere = key.startsWith('single:')
        ? []
        : (data.clusters.get(key) ?? []).filter((s) => s.day !== day).sort(newestFirst);
      return { lead: ordered[0], others: ordered.slice(1), elsewhere };
    })
    .sort((a, b) =>
      Number(isOfficial(b.lead)) - Number(isOfficial(a.lead)) ||
      b.others.length - a.others.length ||
      b.lead.publishedAt.localeCompare(a.lead.publishedAt),
    );
}

/**
 * What the home page shows. The daily build runs early in the morning, so today
 * usually has only a few overnight stories: lead with the latest full day and list
 * today's stories separately until today has enough of its own.
 */
export function homeEdition(data: NewsData): { day: string | null; soFarToday: StoryView[] } {
  const today = data.byDay.get(data.today) ?? [];
  const previous = data.days.find((d) => d < data.today) ?? null;
  if (today.length >= MIN_EDITION_STORIES || (today.length > 0 && !previous)) {
    return { day: data.today, soFarToday: [] };
  }
  return { day: previous ?? data.days[0] ?? null, soFarToday: today };
}

/** Tags that have at least one story, in config order. */
export function activeTags(data: NewsData) {
  return TAG_RULES.filter((t) => (data.tagCounts.get(t.id) ?? 0) > 0);
}

/** Incidents still rolling out or ongoing (no end time). */
export function openIncidents(data: NewsData) {
  return data.incidents.filter((i) => !i.endAt);
}
