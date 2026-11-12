import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { parseFeedDate } from './dates';
import type { GoogleIncident } from './types';
import { absoluteUrl } from './url';

/** One item from any feed, before it becomes a Story. */
export interface RawItem {
  title: string;
  url: string;
  publishedAt: Date | null;
  /** Description/summary as given by the feed (may contain HTML). */
  description: string | null;
  guid: string | null;
  extra: Record<string, unknown>;
}

export class FeedParseError extends Error {}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // dc:date -> date, feedburner:origLink -> origLink, rdf:RDF -> RDF
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'link'].includes(name),
});

/** Text content of a parsed node: plain string, number, or { '#text': … }. */
function text(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === 'object' && '#text' in (node as object)) return text((node as any)['#text']);
  return null;
}

/** Parses RSS 2.0, Atom or RSS 1.0 (RDF), detected from the document root. */
export function parseFeed(body: string, feedUrl: string): RawItem[] {
  if (!/^\s*(<\?xml|<rss|<feed|<rdf:RDF|<!--)/i.test(body)) {
    throw new FeedParseError('Response is not XML (got HTML or another format).');
  }
  // The parser is lenient about unclosed tags, so validate first: a truncated
  // download should be reported as malformed, not half-read.
  const valid = XMLValidator.validate(body);
  if (valid !== true) {
    throw new FeedParseError(`Malformed XML: ${valid.err.msg} (line ${valid.err.line})`);
  }
  let doc: any;
  try {
    doc = xml.parse(body);
  } catch (err) {
    throw new FeedParseError(`Malformed XML: ${(err as Error).message}`);
  }

  if (doc.rss?.channel) return parseRss(doc.rss.channel.item ?? [], feedUrl);
  if (doc.RDF) return parseRss(doc.RDF.item ?? [], feedUrl);
  if (doc.feed) return parseAtom(doc.feed.entry ?? [], feedUrl);
  throw new FeedParseError('Unrecognised feed format (no <rss>, <feed> or <rdf:RDF> root).');
}

function parseRss(items: any[], feedUrl: string): RawItem[] {
  return items.flatMap((it): RawItem[] => {
    // FeedBurner keeps the publisher's own link in feedburner:origLink.
    const link = text(it.origLink) ?? text(it.link) ?? (it.guid?.['@_isPermaLink'] !== 'false' ? text(it.guid) : null);
    const url = absoluteUrl(link ?? undefined, feedUrl);
    const title = text(it.title);
    if (!url || !title) return [];
    const comments = absoluteUrl(text(it.comments) ?? undefined, feedUrl);
    return [{
      title,
      url,
      publishedAt: parseFeedDate(text(it.pubDate) ?? text(it.date) ?? text(it.published) ?? text(it.updated)),
      description: text(it.description) ?? text(it.encoded) ?? null,
      guid: text(it.guid),
      extra: comments && comments !== url ? { discussionUrl: comments } : {},
    }];
  });
}

function parseAtom(entries: any[], feedUrl: string): RawItem[] {
  return entries.flatMap((e): RawItem[] => {
    const links: any[] = e.link ?? [];
    const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    const url = absoluteUrl(alt?.['@_href'] ?? text(alt) ?? undefined, feedUrl);
    const title = text(e.title);
    if (!url || !title) return [];
    return [{
      title,
      url,
      publishedAt: parseFeedDate(text(e.published) ?? text(e.updated) ?? text(e.issued)),
      description: text(e.summary) ?? text(e.content) ?? null,
      guid: text(e.id),
      extra: {},
    }];
  });
}

/** The Search Status Dashboard's incidents.json: incidents for the panel, plus one story per incident. */
export function parseGoogleStatus(body: string, feedUrl: string): { incidents: GoogleIncident[]; items: RawItem[] } {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch (err) {
    throw new FeedParseError(`Malformed JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(data)) throw new FeedParseError('Expected a JSON array of incidents.');

  const incidents: GoogleIncident[] = [];
  const items: RawItem[] = [];
  for (const raw of data as any[]) {
    if (!raw?.id || !raw?.begin || !raw?.external_desc) continue;
    const uri = absoluteUrl(raw.uri, feedUrl) ?? feedUrl;
    const updates = (Array.isArray(raw.updates) ? raw.updates : []).map((u: any) => ({
      when: u.when ?? u.created,
      text: String(u.text ?? ''),
      status: String(u.status ?? ''),
    }));
    const incident: GoogleIncident = {
      id: String(raw.id),
      title: String(raw.external_desc),
      serviceKey: raw.service_key ?? null,
      serviceName: raw.service_name ?? null,
      beginAt: raw.begin,
      endAt: raw.end ?? null,
      severity: raw.severity ?? null,
      statusImpact: raw.status_impact ?? null,
      latestStatus: raw.most_recent_update?.status ?? null,
      uri,
      updates,
      modifiedAt: raw.modified ?? null,
    };
    incidents.push(incident);

    // The first update is the announcement ("Released the November 2026 core update…").
    const first = [...updates].sort((a, b) => Date.parse(a.when) - Date.parse(b.when))[0];
    items.push({
      title: incident.serviceName === 'Ranking' ? `Google: ${incident.title}` : `Google Search ${incident.serviceName ?? ''} incident: ${incident.title}`.replace(/\s+/g, ' '),
      url: uri,
      publishedAt: parseFeedDate(incident.beginAt),
      description: first?.text ?? null,
      guid: incident.id,
      extra: { incidentId: incident.id, serviceName: incident.serviceName },
    });
  }
  return { incidents, items };
}
