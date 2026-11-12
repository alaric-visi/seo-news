/**
 * Fetches every enabled source, saves new stories and Google incidents, and logs a
 * per-source report. A failing or malformed feed is logged and skipped; the run only
 * fails (exit 1) if every source fails.
 *
 *   npm run news:fetch                     # all sources
 *   npm run news:fetch -- --source=moz     # one source
 *   npm run news:fetch -- --dry-run        # fetch and parse, write nothing
 */
import { DEFAULT_TIMEOUT_MS, SOURCES, type SourceConfig } from '../src/config/sources';
import { toStories } from '../src/lib/ingest';
import { FeedParseError, parseFeed, parseGoogleStatus } from '../src/lib/parse';
import { getStore } from '../src/lib/store';
import type { GoogleIncident, NewStory, SourceResult } from '../src/lib/types';
import { flag, loadEnv } from './env';

const USER_AGENT = 'SEO-News-Aggregator/1.0 (+https://mikehiggins.me.uk/tools/seo-news/)';
const RETRY_DELAY_MS = 3_000;

loadEnv();

interface SourceOutcome {
  result: SourceResult;
  stories: NewStory[];
  incidents: GoogleIncident[];
}

async function download(source: SourceConfig): Promise<string> {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: source.format === 'google-status'
        ? 'application/json'
        : 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(source.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  return res.text();
}

/** One retry for network errors, timeouts and 5xx; parse errors and 4xx fail at once. */
async function downloadWithRetry(source: SourceConfig): Promise<string> {
  try {
    return await download(source);
  } catch (err) {
    const msg = (err as Error).message;
    if (/^HTTP 4\d\d/.test(msg)) throw err;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return download(source);
  }
}

async function runSource(source: SourceConfig, now: Date): Promise<SourceOutcome> {
  const started = Date.now();
  try {
    const body = await downloadWithRetry(source);
    let incidents: GoogleIncident[] = [];
    let items;
    if (source.format === 'google-status') {
      ({ incidents, items } = parseGoogleStatus(body, source.url));
    } else {
      items = parseFeed(body, source.url);
    }
    if (!items.length) throw new FeedParseError('Feed parsed but contained no usable items.');
    const stories = toStories(items, source, now);
    return {
      result: { sourceId: source.id, ok: true, items: items.length, newItems: 0, ms: Date.now() - started },
      stories,
      incidents,
    };
  } catch (err) {
    const e = err as Error;
    const error = e.name === 'TimeoutError' ? `Timed out after ${source.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms` : e.message;
    return {
      result: { sourceId: source.id, ok: false, items: 0, newItems: 0, ms: Date.now() - started, error },
      stories: [],
      incidents: [],
    };
  }
}

async function main() {
  const only = flag('source');
  const dryRun = Boolean(flag('dry-run'));
  const sources = SOURCES.filter((s) => (typeof only === 'string' ? s.id === only : s.enabled));
  if (!sources.length) {
    console.error(only ? `No source with id "${only}".` : 'No enabled sources.');
    process.exit(1);
  }

  const store = dryRun ? null : getStore(process.env, 'write');
  const startedAt = new Date();
  console.log(`Fetching ${sources.length} source(s)${dryRun ? ' (dry run)' : ` into ${store!.kind} store`}…`);

  const outcomes = await Promise.all(sources.map((s) => runSource(s, startedAt)));

  // Insert per source so each report line can say how many were new.
  let newStories = 0;
  for (const o of outcomes) {
    if (!o.result.ok || dryRun) {
      o.result.newItems = dryRun ? o.stories.length : 0;
      continue;
    }
    try {
      const inserted = await store!.insertStories(o.stories);
      await store!.upsertIncidents(o.incidents);
      o.result.newItems = inserted.length;
      newStories += inserted.length;
    } catch (err) {
      o.result.ok = false;
      o.result.error = `Save failed: ${(err as Error).message}`;
    }
  }

  const results = outcomes.map((o) => o.result);
  const failed = results.filter((r) => !r.ok);

  console.log('');
  console.table(
    results.map((r) => ({
      source: r.sourceId,
      status: r.ok ? 'ok' : 'FAILED',
      items: r.items,
      [dryRun ? 'kept' : 'new']: r.newItems,
      ms: r.ms,
      error: r.error ?? '',
    })),
  );
  for (const r of failed) console.warn(`::warning title=Feed failed::${r.sourceId}: ${r.error}`);

  if (dryRun) {
    const sample = outcomes.flatMap((o) => o.stories).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 15);
    console.log('\nNewest stories:');
    for (const s of sample) console.log(`  ${s.day}  ${s.sourceId.padEnd(26)} ${s.title}`);
  } else {
    await store!.recordRun({ startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), newStories, results });
    console.log(`\n${newStories} new stor${newStories === 1 ? 'y' : 'ies'} saved; ${failed.length} source(s) failed.`);
  }

  if (failed.length === results.length) {
    console.error('Every source failed. Check the network or the feed URLs.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
