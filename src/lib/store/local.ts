import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DayDigest, FetchRun, GoogleIncident, NewStory, Story, StorySummary } from '../types';
import type { NewsStore } from './index';

interface LocalData {
  stories: Story[];
  summaries: StorySummary[];
  digests: DayDigest[];
  incidents: GoogleIncident[];
  runs: FetchRun[];
}

const EMPTY: LocalData = { stories: [], summaries: [], digests: [], incidents: [], runs: [] };

/** JSON-file store for local previews and tests. Not safe for concurrent writers. */
export class LocalStore implements NewsStore {
  readonly kind = 'local' as const;
  private readonly file: string;

  constructor(file?: string) {
    this.file = path.resolve(file ?? '.data/local-store.json');
  }

  private async load(): Promise<LocalData> {
    try {
      return { ...EMPTY, ...JSON.parse(await readFile(this.file, 'utf8')) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(EMPTY);
      throw err;
    }
  }

  private async save(data: LocalData): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, this.file);
  }

  async insertStories(stories: NewStory[]): Promise<Story[]> {
    const data = await this.load();
    const seen = new Set(data.stories.map((s) => s.dedupeKey));
    const inserted: Story[] = [];
    for (const s of stories) {
      if (seen.has(s.dedupeKey)) continue;
      seen.add(s.dedupeKey);
      inserted.push({ ...s, id: randomUUID() });
    }
    if (inserted.length) {
      data.stories.push(...inserted);
      await this.save(data);
    }
    return inserted;
  }

  async upsertIncidents(incidents: GoogleIncident[]): Promise<void> {
    if (!incidents.length) return;
    const data = await this.load();
    const byId = new Map(data.incidents.map((i) => [i.id, i]));
    for (const i of incidents) byId.set(i.id, i);
    data.incidents = [...byId.values()];
    await this.save(data);
  }

  async recordRun(run: FetchRun): Promise<void> {
    const data = await this.load();
    data.runs = [...data.runs, run].slice(-30);
    await this.save(data);
  }

  async upsertSummaries(summaries: StorySummary[]): Promise<void> {
    if (!summaries.length) return;
    const data = await this.load();
    const byId = new Map(data.summaries.map((s) => [s.storyId, s]));
    for (const s of summaries) byId.set(s.storyId, s);
    data.summaries = [...byId.values()];
    await this.save(data);
  }

  async upsertDigest(digest: DayDigest): Promise<void> {
    const data = await this.load();
    data.digests = [...data.digests.filter((d) => d.day !== digest.day), digest];
    await this.save(data);
  }

  async listStories(opts?: { sinceDay?: string }): Promise<Story[]> {
    const { stories } = await this.load();
    return opts?.sinceDay ? stories.filter((s) => s.day >= opts.sinceDay!) : stories;
  }

  async listSummaries(): Promise<StorySummary[]> {
    return (await this.load()).summaries;
  }

  async listDigests(): Promise<DayDigest[]> {
    return (await this.load()).digests;
  }

  async listIncidents(): Promise<GoogleIncident[]> {
    return (await this.load()).incidents;
  }
}
