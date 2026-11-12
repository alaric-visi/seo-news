import type { DayDigest, FetchRun, GoogleIncident, NewStory, Story, StorySummary } from '../types';
import { LocalStore } from './local';
import { SupabaseStore } from './supabase';

/**
 * Storage for stories, summaries and incidents. Two implementations:
 * - SupabaseStore: production (the GitHub Action writes, the site build reads).
 * - LocalStore: a JSON file in .data/, so the whole pipeline runs with no account.
 */
export interface NewsStore {
  readonly kind: 'supabase' | 'local';
  /** Inserts stories whose dedupeKey is new; returns the ones actually inserted. */
  insertStories(stories: NewStory[]): Promise<Story[]>;
  upsertIncidents(incidents: GoogleIncident[]): Promise<void>;
  recordRun(run: FetchRun): Promise<void>;
  upsertSummaries(summaries: StorySummary[]): Promise<void>;
  upsertDigest(digest: DayDigest): Promise<void>;

  listStories(opts?: { sinceDay?: string }): Promise<Story[]>;
  listSummaries(): Promise<StorySummary[]>;
  listDigests(): Promise<DayDigest[]>;
  listIncidents(): Promise<GoogleIncident[]>;
}

type Env = Record<string, string | undefined>;

/**
 * Picks the store from the environment.
 * `access: 'write'` needs the secret key (scripts); `'read'` uses the publishable key (site build).
 */
export function getStore(env: Env, access: 'read' | 'write'): NewsStore {
  const url = env.SUPABASE_URL;
  const key = access === 'write'
    ? env.SUPABASE_SECRET_KEY
    : env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const wanted = env.NEWS_STORE?.trim().toLowerCase();

  if (wanted === 'local') return new LocalStore(env.NEWS_LOCAL_PATH);
  if (wanted === 'supabase' || (!wanted && url && key)) {
    if (!url || !key) {
      const keyName = access === 'write' ? 'SUPABASE_SECRET_KEY' : 'SUPABASE_PUBLISHABLE_KEY';
      throw new Error(`NEWS_STORE=supabase needs SUPABASE_URL and ${keyName}.`);
    }
    return new SupabaseStore(url, key);
  }
  return new LocalStore(env.NEWS_LOCAL_PATH);
}
