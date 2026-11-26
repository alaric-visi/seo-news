import { TAG_RULES } from '../config/tags';
import { clusterStories, eventKey } from './cluster';
import { MIN_EDITION_STORIES } from './constants';
import { londonDay, todayInLondon } from './dates';
import { getStore } from './store';
import { tagsFor } from './tagging';
import { slugify } from './text';
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
  /** YYYY-MM-DD -> YYYY-MM-DD-<lead-story-slug> */
  daySlugs: Map<string, string>;
  /** YYYY-MM-DD-<lead-story-slug> (or bare YYYY-MM-DD) -> YYYY-MM-DD */
  dayBySlug: Map<string, string>;
  clusters: Map<string, StoryView[]>;
  digests: Map<string, DayDigest>;
  incidents: GoogleIncident[];
  /** incident.id -> URL slug under /updates/<slug>/ */
  incidentSlugs: Map<string, string>;
  /** URL slug -> GoogleIncident */
  incidentBySlug: Map<string, GoogleIncident>;
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

  const days = [...byDay.keys()].sort().reverse();
  const sortedIncidents = [...incidents].sort((a, b) => b.beginAt.localeCompare(a.beginAt));
  const incidentSlugs = new Map<string, string>();
  const incidentBySlug = new Map<string, GoogleIncident>();
  for (const inc of sortedIncidents) {
    const base = slugify(inc.title) || slugify(inc.id) || 'update';
    let slug = base;
    if (incidentBySlug.has(slug)) slug = `${base}-${londonDay(inc.beginAt)}`;
    if (incidentBySlug.has(slug)) slug = `${slug}-${slugify(inc.id, 2, 16)}`;
    incidentSlugs.set(inc.id, slug);
    incidentBySlug.set(slug, inc);
  }

  const daySlugs = new Map<string, string>();
  const dayBySlug = new Map<string, string>();
  const data: NewsData = {
    stories,
    byDay,
    days,
    daySlugs,
    dayBySlug,
    clusters,
    digests: new Map(digestList.map((d) => [d.day, d])),
    incidents: sortedIncidents,
    incidentSlugs,
    incidentBySlug,
    tagCounts,
    today: todayInLondon(),
  };

  for (const d of days) {
    const [top] = groupsForDay(data, d);
    const tail = top ? slugify(top.lead.title, 7, 56) : '';
    const slug = tail ? `${d}-${tail}` : d;
    daySlugs.set(d, slug);
    dayBySlug.set(slug, d);
    dayBySlug.set(d, d);
  }

  return data;
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

/** Ranking updates usually say "may take up to 2 weeks"; read the figure if present. */
export function rolloutWindowDays(updates: { text: string }[]): number | null {
  for (const u of updates) {
    const m = /up to (\d+|one|two|three|four) (day|week)s?/i.exec(u.text);
    if (!m) continue;
    const n = { one: 1, two: 2, three: 3, four: 4 }[m[1].toLowerCase()] ?? Number(m[1]);
    return m[2].toLowerCase() === 'week' ? n * 7 : n;
  }
  return null;
}

/**
 * Every story covering a Google Search Status Dashboard incident, across all days:
 * the incident's own official story, its cluster members and any stories matching its named event key.
 */
export function storiesForIncident(data: NewsData, incident: GoogleIncident): StoryView[] {
  const matched = new Map<string, StoryView>();
  const add = (s: StoryView) => matched.set(s.id, s);

  const ev = eventKey(incident.title, incident.beginAt);
  if (ev) {
    for (const s of data.clusters.get(`event:${ev.key}`) ?? []) add(s);
  }

  for (const s of data.stories) {
    if (s.url === incident.uri || s.guid === incident.id || (ev && eventKey(s.title, s.publishedAt)?.key === ev.key)) {
      add(s);
      if (s.clusterId) {
        for (const member of data.clusters.get(s.clusterId) ?? []) add(member);
      }
    }
  }

  return [...matched.values()].sort(newestFirst);
}
