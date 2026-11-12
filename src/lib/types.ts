import { z } from 'zod';

export const SOURCE_CATEGORIES = ['official', 'press', 'vendor', 'community'] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/** A story as written by the fetch script (before the database assigns an id). */
export const NewStorySchema = z.object({
  dedupeKey: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceCategory: z.enum(SOURCE_CATEGORIES),
  publishedAt: z.iso.datetime({ offset: true }),
  firstSeenAt: z.iso.datetime({ offset: true }),
  day: z.iso.date(),
  excerpt: z.string().nullable(),
  guid: z.string().nullable(),
  extra: z.record(z.string(), z.unknown()),
});
export type NewStory = z.infer<typeof NewStorySchema>;

export type Story = NewStory & { id: string };

export interface StorySummary {
  storyId: string;
  summary: string;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface DayDigest {
  day: string;
  intro: string;
  storyCount: number;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface GoogleIncidentUpdate {
  when: string;
  text: string;
  status: string;
}

export interface GoogleIncident {
  id: string;
  title: string;
  serviceKey: string | null;
  serviceName: string | null;
  beginAt: string;
  endAt: string | null;
  severity: string | null;
  statusImpact: string | null;
  latestStatus: string | null;
  uri: string;
  updates: GoogleIncidentUpdate[];
  modifiedAt: string | null;
}

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  items: number;
  newItems: number;
  ms: number;
  error?: string;
}

export interface FetchRun {
  startedAt: string;
  finishedAt: string;
  newStories: number;
  results: SourceResult[];
}
