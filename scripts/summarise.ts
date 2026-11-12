/**
 * Writes AI one-line summaries for new stories and an intro paragraph for each day,
 * using DeepSeek. Works only from headlines and feed excerpts.
 *
 * Runs after the fetch. Without DEEPSEEK_API_KEY it logs and exits cleanly, so the
 * site still publishes. One request per day (chunked for very busy days).
 *
 *   npm run news:summarise                       # the last 3 London days
 *   npm run news:summarise -- --days=10          # the last 10 days (backfill)
 *   npm run news:summarise -- --day=2026-11-10   # one day
 *   npm run news:summarise -- --dry-run          # print the requests, call nothing
 */
import { addDays, todayInLondon } from '../src/lib/dates';
import { chatJsonWithRetry } from '../src/lib/llm/deepseek';
import {
  buildUserMessage,
  INTRO_MAX_CHARS,
  PROMPT_VERSION,
  ResponseSchema,
  SUMMARY_MAX_CHARS,
  SYSTEM_PROMPT,
  toPromptItems,
} from '../src/lib/llm/prompt';
import { MIN_EDITION_STORIES } from '../src/lib/constants';
import { getStore } from '../src/lib/store';
import { truncate } from '../src/lib/text';
import type { Story, StorySummary } from '../src/lib/types';
import { flag, loadEnv } from './env';

/** Stories summarised per request; every request still sees all the day's headlines for context. */
const CHUNK = 40;

loadEnv();

async function main() {
  const dryRun = Boolean(flag('dry-run'));
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  if (!apiKey && !dryRun) {
    console.log('DEEPSEEK_API_KEY is not set: skipping summaries.');
    return;
  }

  const store = getStore(process.env, 'write');
  const onlyDay = typeof flag('day') === 'string' ? (flag('day') as string) : null;
  const days = Number(flag('days') ?? 3);
  const sinceDay = onlyDay ?? addDays(todayInLondon(), -(Math.max(1, days) - 1));

  const [stories, summaries, digests] = await Promise.all([
    store.listStories({ sinceDay }),
    store.listSummaries(),
    store.listDigests(),
  ]);
  const summarised = new Set(summaries.map((s) => s.storyId));
  const digestCount = new Map(digests.map((d) => [d.day, d.storyCount]));

  const byDay = new Map<string, Story[]>();
  for (const s of stories) {
    if (onlyDay && s.day !== onlyDay) continue;
    byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
  }

  let calls = 0;
  let written = 0;
  let failedDays = 0;
  const tokens = { prompt: 0, completion: 0, cacheHit: 0 };

  for (const day of [...byDay.keys()].sort()) {
    const dayStories = byDay.get(day)!.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    const missing = dayStories.filter((s) => !summarised.has(s.id));
    // Intros are rewritten when late stories arrive, but not for thin days (it would be padding).
    const needIntro = dayStories.length >= MIN_EDITION_STORIES && digestCount.get(day) !== dayStories.length;
    if (!missing.length && !needIntro) continue;

    const { items, idMap } = toPromptItems(dayStories);
    const shortIdOf = new Map([...idMap].map(([shortId, id]) => [id, shortId]));
    const toSummarise = missing.map((s) => shortIdOf.get(s.id)!);
    const chunks: string[][] = [];
    for (let i = 0; i < Math.max(toSummarise.length, 1); i += CHUNK) chunks.push(toSummarise.slice(i, i + CHUNK));

    console.log(`${day}: ${dayStories.length} stories, ${missing.length} to summarise${needIntro ? ', intro to write' : ''}`);

    for (const [i, chunk] of chunks.entries()) {
      const writeIntro = needIntro && i === 0;
      if (!chunk.length && !writeIntro) continue;
      const user = buildUserMessage(day, items, chunk, writeIntro);
      if (dryRun) {
        console.log(`  request ${i + 1}: ${user.length} chars, ${chunk.length} summaries, intro=${writeIntro}`);
        if (i === 0 && day === [...byDay.keys()].sort()[0]) console.log(`\n--- system ---\n${SYSTEM_PROMPT}\n--- user ---\n${user.slice(0, 1500)}…\n`);
        continue;
      }

      try {
        calls++;
        const result = await chatJsonWithRetry({
          apiKey: apiKey!,
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: user },
          ],
        });
        tokens.prompt += result.usage.promptTokens;
        tokens.completion += result.usage.completionTokens;
        tokens.cacheHit += result.usage.cacheHitTokens;

        const parsed = ResponseSchema.safeParse(result.json);
        if (!parsed.success) throw new Error(`Unexpected response shape: ${parsed.error.message.slice(0, 200)}`);
        const now = new Date().toISOString();
        const wanted = new Set(chunk);
        const rows: StorySummary[] = parsed.data.summaries
          .filter((s) => wanted.has(s.id) && s.summary.trim())
          .map((s) => ({
            storyId: idMap.get(s.id)!,
            summary: truncate(s.summary.trim(), SUMMARY_MAX_CHARS),
            model: result.model,
            promptVersion: PROMPT_VERSION,
            createdAt: now,
          }));
        await store.upsertSummaries(rows);
        written += rows.length;
        if (rows.length < chunk.length) console.warn(`  ${chunk.length - rows.length} summaries missing from the response`);

        if (writeIntro) {
          const intro = parsed.data.intro?.trim();
          if (intro) {
            await store.upsertDigest({
              day,
              intro: truncate(intro, INTRO_MAX_CHARS),
              storyCount: dayStories.length,
              model: result.model,
              promptVersion: PROMPT_VERSION,
              createdAt: now,
            });
          } else {
            console.warn('  intro missing from the response');
          }
        }
      } catch (err) {
        failedDays++;
        console.warn(`::warning title=Summaries failed::${day}: ${(err as Error).message}`);
        break; // move on to the next day
      }
    }
  }

  if (dryRun) return;
  console.log(
    `\n${written} summaries written in ${calls} request(s) with ${model}. ` +
      `Tokens: ${tokens.prompt} in (${tokens.cacheHit} cached), ${tokens.completion} out.` +
      (failedDays ? ` ${failedDays} day(s) failed.` : ''),
  );
}

main().catch((err) => {
  // Summaries are optional: report, but don't fail the pipeline.
  console.error(`::warning title=Summaries skipped::${(err as Error).message}`);
});
