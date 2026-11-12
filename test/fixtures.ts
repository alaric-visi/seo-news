// Small hand-written feeds that mimic the real sources' structure (no third-party content).

export const RSS_FEEDBURNER = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0">
<channel><title>Example Blog</title><link>https://example.com/blog/</link>
<item>
  <title>Moving to a CDN &amp;#8211; what to check</title>
  <link>https://feeds.example.com/~r/blog/abc</link>
  <feedburner:origLink>https://example.com/blog/2026/11/cdn?utm_source=feedburner&amp;utm_medium=feed</feedburner:origLink>
  <guid isPermaLink="false">2026-11-11-cdn</guid>
  <pubDate>Wed, 11 Nov 2026 10:00:00 +0000</pubDate>
  <description>&lt;p&gt;A short &lt;b&gt;summary&lt;/b&gt; of the post.&lt;/p&gt;</description>
</item>
<item>
  <title>No link here</title>
</item>
</channel></rss>`;

export const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Example News</title>
<entry>
  <title type="html">Google Releases November 2026 Core Update</title>
  <link rel="alternate" type="text/html" href="https://news.example.com/google-november-2026-core-update/123/"/>
  <link rel="replies" href="https://news.example.com/google-november-2026-core-update/123/#comments"/>
  <id>https://news.example.com/?p=123</id>
  <published>2026-11-10T19:02:00Z</published>
  <summary type="html">Google has started rolling out its November 2026 core update.</summary>
</entry>
</feed>`;

export const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel rdf:about="https://rdf.example.com/"><title>RDF example</title></channel>
<item rdf:about="https://rdf.example.com/post-1">
  <title>Bing adds IndexNow reporting</title>
  <link>https://rdf.example.com/post-1</link>
  <dc:date>2026-11-11T08:30:00-05:00</dc:date>
  <description>Short text.</description>
</item>
</rdf:RDF>`;

export const RSS_SHARED_LINKS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Docs</title>
<item><title>Updated guidance A</title><link>https://docs.example.com/updates#november-2026</link><guid isPermaLink="false">2026-11-09-a</guid><pubDate>Mon, 09 Nov 2026 00:00:00 +0000</pubDate></item>
<item><title>Updated guidance B</title><link>https://docs.example.com/updates#november-2026</link><guid isPermaLink="false">2026-11-02-b</guid><pubDate>Mon, 02 Nov 2026 00:00:00 +0000</pubDate></item>
</channel></rss>`;

export const STATUS_JSON = JSON.stringify([
  {
    id: 'INC1', begin: '2026-11-10T18:06:00+00:00', external_desc: 'November 2026 core update',
    service_key: 'ranking', service_name: 'Ranking', severity: 'low', status_impact: 'SERVICE_INFORMATION',
    uri: 'incidents/INC1', modified: '2026-11-10T18:07:10+00:00',
    updates: [{ when: '2026-11-10T18:07:10+00:00', text: 'Released the November 2026 core update.', status: 'SERVICE_INFORMATION' }],
    most_recent_update: { status: 'SERVICE_INFORMATION' },
  },
  {
    id: 'INC2', begin: '2026-02-25T03:55:00+00:00', end: '2026-02-25T04:10:00+00:00', external_desc: 'Serving was experiencing an issue',
    service_name: 'Serving', uri: 'incidents/INC2', updates: [], most_recent_update: { status: 'AVAILABLE' },
  },
  { nonsense: true },
]);
