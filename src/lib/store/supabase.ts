import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DayDigest, FetchRun, GoogleIncident, NewStory, Story, StorySummary } from '../types';
import type { NewsStore } from './index';

// Row shapes as stored in Postgres (snake_case). See supabase/migrations.
interface StoryRow {
  id: string;
  dedupe_key: string;
  url: string;
  title: string;
  source_id: string;
  source_name: string;
  source_category: Story['sourceCategory'];
  published_at: string;
  first_seen_at: string;
  day: string;
  excerpt: string | null;
  guid: string | null;
  extra: Record<string, unknown>;
}

const PAGE = 1000; // PostgREST's default max rows per request.

const toRow = (s: NewStory): Omit<StoryRow, 'id'> => ({
  dedupe_key: s.dedupeKey,
  url: s.url,
  title: s.title,
  source_id: s.sourceId,
  source_name: s.sourceName,
  source_category: s.sourceCategory,
  published_at: s.publishedAt,
  first_seen_at: s.firstSeenAt,
  day: s.day,
  excerpt: s.excerpt,
  guid: s.guid,
  extra: s.extra,
});

const fromRow = (r: StoryRow): Story => ({
  id: r.id,
  dedupeKey: r.dedupe_key,
  url: r.url,
  title: r.title,
  sourceId: r.source_id,
  sourceName: r.source_name,
  sourceCategory: r.source_category,
  publishedAt: r.published_at,
  firstSeenAt: r.first_seen_at,
  day: r.day,
  excerpt: r.excerpt,
  guid: r.guid,
  extra: r.extra ?? {},
});

export class SupabaseStore implements NewsStore {
  readonly kind = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /** Reads every row of a query, a page at a time. */
  private async all<T>(
    table: string,
    columns: string,
    order: string,
    filter?: (q: any) => any,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.db.from(table).select(columns).order(order, { ascending: true }).range(from, from + PAGE - 1);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw new Error(`Supabase ${table}: ${error.message}`);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) return rows;
    }
  }

  async insertStories(stories: NewStory[]): Promise<Story[]> {
    if (!stories.length) return [];
    const { data, error } = await this.db
      .from('stories')
      .upsert(stories.map(toRow), { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select();
    if (error) throw new Error(`Supabase stories insert: ${error.message}`);
    return ((data ?? []) as StoryRow[]).map(fromRow);
  }

  async upsertIncidents(incidents: GoogleIncident[]): Promise<void> {
    if (!incidents.length) return;
    const { error } = await this.db.from('google_incidents').upsert(
      incidents.map((i) => ({
        id: i.id,
        title: i.title,
        service_key: i.serviceKey,
        service_name: i.serviceName,
        begin_at: i.beginAt,
        end_at: i.endAt,
        severity: i.severity,
        status_impact: i.statusImpact,
        latest_status: i.latestStatus,
        uri: i.uri,
        updates: i.updates,
        modified_at: i.modifiedAt,
      })),
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Supabase incidents upsert: ${error.message}`);
  }

  async recordRun(run: FetchRun): Promise<void> {
    const { error } = await this.db.from('fetch_runs').insert({
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      new_stories: run.newStories,
      results: run.results,
    });
    if (error) throw new Error(`Supabase fetch_runs insert: ${error.message}`);
  }

  async upsertSummaries(summaries: StorySummary[]): Promise<void> {
    if (!summaries.length) return;
    const { error } = await this.db.from('story_summaries').upsert(
      summaries.map((s) => ({
        story_id: s.storyId,
        summary: s.summary,
        model: s.model,
        prompt_version: s.promptVersion,
        created_at: s.createdAt,
      })),
      { onConflict: 'story_id' },
    );
    if (error) throw new Error(`Supabase summaries upsert: ${error.message}`);
  }

  async upsertDigest(d: DayDigest): Promise<void> {
    const { error } = await this.db.from('day_digests').upsert(
      {
        day: d.day,
        intro: d.intro,
        story_count: d.storyCount,
        model: d.model,
        prompt_version: d.promptVersion,
        created_at: d.createdAt,
      },
      { onConflict: 'day' },
    );
    if (error) throw new Error(`Supabase digest upsert: ${error.message}`);
  }

  async listStories(opts?: { sinceDay?: string }): Promise<Story[]> {
    const rows = await this.all<StoryRow>('stories', '*', 'published_at', (q) =>
      opts?.sinceDay ? q.gte('day', opts.sinceDay) : q,
    );
    return rows.map(fromRow);
  }

  async listSummaries(): Promise<StorySummary[]> {
    const rows = await this.all<any>('story_summaries', '*', 'story_id');
    return rows.map((r) => ({
      storyId: r.story_id,
      summary: r.summary,
      model: r.model,
      promptVersion: r.prompt_version,
      createdAt: r.created_at,
    }));
  }

  async listDigests(): Promise<DayDigest[]> {
    const rows = await this.all<any>('day_digests', '*', 'day');
    return rows.map((r) => ({
      day: r.day,
      intro: r.intro,
      storyCount: r.story_count,
      model: r.model,
      promptVersion: r.prompt_version,
      createdAt: r.created_at,
    }));
  }

  async listIncidents(): Promise<GoogleIncident[]> {
    const rows = await this.all<any>('google_incidents', '*', 'begin_at');
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      serviceKey: r.service_key,
      serviceName: r.service_name,
      beginAt: r.begin_at,
      endAt: r.end_at,
      severity: r.severity,
      statusImpact: r.status_impact,
      latestStatus: r.latest_status,
      uri: r.uri,
      updates: r.updates ?? [],
      modifiedAt: r.modified_at,
    }));
  }
}
