import type { Story } from './types';

/**
 * Groups stories that cover the same event, in two passes:
 *
 * 1. Named Google updates. "November 2026 core update", "Google's November core
 *    update" and the Status Dashboard's own incident all get the key
 *    `2026-11:core update`. A title that names only the type ("core update") joins
 *    the most recent event of that type that started up to 21 days earlier, since
 *    rollouts run for about two weeks.
 * 2. Similar headlines. Titles from different sources, published within 48 hours,
 *    that share most of their keywords.
 *
 * Returns story id -> cluster id, only for stories that ended up in a group of 2+.
 */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const UPDATE_TYPES = [
  'core', 'spam', 'link spam', 'helpful content', 'reviews', 'product reviews', 'discover', 'site reputation abuse',
];
const UPDATE_TYPE_RE = UPDATE_TYPES.slice().sort((a, b) => b.length - a.length).join('|');
const NAMED_EVENT = new RegExp(`\\b(${MONTHS.join('|')})(?:\\s+(20\\d\\d))?\\s+(${UPDATE_TYPE_RE})\\s+(?:algorithm\\s+)?update`, 'i');
const TYPE_ONLY = new RegExp(`\\b(${UPDATE_TYPE_RE})\\s+(?:algorithm\\s+)?update`, 'i');

const SIMILAR_WINDOW_MS = 48 * 3_600_000;
const EVENT_LOOKBACK_DAYS = 21;
const MIN_SHARED_TOKENS = 3;
const MIN_JACCARD = 0.5;

const STOPWORDS = new Set(
  ('the and for with from that this what your you are was were has have had its into about over after before more most ' +
    'new now how why who will can just than then them they their our out not but all any via vs per may might says said ' +
    'google search seo update updates report reports week today here guide tips').split(' '),
);

export function eventKey(title: string, publishedAt: string): { key: string; type: string } | null {
  const m = NAMED_EVENT.exec(title);
  if (!m) return null;
  const monthIdx = MONTHS.indexOf(m[1].toLowerCase());
  const published = new Date(publishedAt);
  let year = m[2] ? Number(m[2]) : published.getUTCFullYear();
  // "December core update" written in January refers to last year.
  if (!m[2] && monthIdx > published.getUTCMonth() + 1) year -= 1;
  const type = m[3].toLowerCase();
  return { key: `${year}-${String(monthIdx + 1).padStart(2, '0')}:${type} update`, type };
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’']s\b/g, '')
      .split(/[^a-z0-9.]+/)
      .map((t) => t.replace(/^\.+|\.+$/g, '').replace(/(?<=[a-z]{3})s$/, ''))
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

export function clusterStories(stories: Story[]): Map<string, string> {
  const sorted = [...stories].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const uf = new UnionFind();
  const keyOf = new Map<string, string>(); // story id -> event key

  // Pass 1a: stories that name a dated event.
  const events = new Map<string, { type: string; start: number; first: string }>();
  for (const s of sorted) {
    const ev = eventKey(s.title, s.publishedAt);
    if (!ev) continue;
    keyOf.set(s.id, ev.key);
    const existing = events.get(ev.key);
    if (existing) uf.union(existing.first, s.id);
    else events.set(ev.key, { type: ev.type, start: Date.parse(s.publishedAt), first: s.id });
  }

  // Pass 1b: stories naming only the type join the latest matching event.
  for (const s of sorted) {
    if (keyOf.has(s.id)) continue;
    const m = TYPE_ONLY.exec(s.title);
    if (!m) continue;
    const type = m[1].toLowerCase();
    const t = Date.parse(s.publishedAt);
    let best: { key: string; first: string; start: number } | null = null;
    for (const [key, ev] of events) {
      if (ev.type !== type) continue;
      const ageDays = (t - ev.start) / 86_400_000;
      if (ageDays < -1 || ageDays > EVENT_LOOKBACK_DAYS) continue;
      if (!best || ev.start > best.start) best = { key, first: ev.first, start: ev.start };
    }
    if (best) {
      keyOf.set(s.id, best.key);
      uf.union(best.first, s.id);
    }
  }

  // Pass 2: similar headlines from different sources within 48 hours.
  const tokens = new Map(sorted.map((s) => [s.id, titleTokens(s.title)]));
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const ta = tokens.get(a.id)!;
    const tA = Date.parse(a.publishedAt);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (Date.parse(b.publishedAt) - tA > SIMILAR_WINDOW_MS) break;
      if (a.sourceId === b.sourceId) continue;
      const tb = tokens.get(b.id)!;
      let shared = 0;
      for (const t of ta) if (tb.has(t)) shared++;
      const jaccard = shared / (ta.size + tb.size - shared || 1);
      if (shared >= MIN_SHARED_TOKENS && jaccard >= MIN_JACCARD) uf.union(a.id, b.id);
    }
  }

  // Name each group after its event key if it has one, else its earliest story.
  const members = new Map<string, Story[]>();
  for (const s of sorted) {
    const root = uf.find(s.id);
    members.set(root, [...(members.get(root) ?? []), s]);
  }
  const result = new Map<string, string>();
  for (const group of members.values()) {
    if (group.length < 2) continue;
    const key = group.map((s) => keyOf.get(s.id)).find(Boolean);
    const id = key ? `event:${key}` : `group:${group[0].id}`;
    for (const s of group) result.set(s.id, id);
  }
  return result;
}
