<div align="center">

<img src="public/logo.svg" width="88" height="88" alt="SEO News logo" />

# SEO News

**Every day in SEO, on one calendar.**

[seo-news.mikehiggins.me.uk](https://seo-news.mikehiggins.me.uk/) · [RSS feed](https://seo-news.mikehiggins.me.uk/rss.xml) · [Archive](https://seo-news.mikehiggins.me.uk/archive/)

<a href="https://github.com/alaric-visi/seo-news/raw/main/media/seo-news-launch.mp4">
  <img src="media/seo-news-launch.gif" width="860" alt="SEO News launch film: nineteen source tabs collapse into one calendar, a day opens to Google's core update with coverage grouped under it, the rollout progress, an AI brief and the archive" />
</a>

<sub>▶ <a href="https://github.com/alaric-visi/seo-news/raw/main/media/seo-news-launch.mp4">Watch the 26-second film with sound (MP4, 1080p)</a></sub>

</div>

---

## Technical Overview

SEO News is an automated daily aggregator and archive for search engine optimisation developments. It monitors official search engine documentation, status dashboards, trade publications, tool vendors and industry analysts. Rather than republishing external copy, the platform acts as an indexed catalogue: it tracks publication timestamps, identifies duplicate coverage across outlets, maps ongoing Google algorithm rollouts and generates concise, fact-checked AI briefings.

The application is engineered as an immutable static site generated with Astro 5 and hosted on Netlify, backed by a managed PostgreSQL instance on Supabase. A scheduled ingestion pipeline runs each morning via GitHub Actions to fetch, normalise, cluster, tag and summarise updates before triggering a fresh production build.

```
+----------------------------------------------------------------------------------------------------+
|                                      DAILY INGESTION PIPELINE                                      |
|                                     (GitHub Actions @ 05:15 UTC)                                   |
|                                                                                                    |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|  |  19 Upstream Sources  | --> | Feed Parser & Cleaner  | --> | URL Canonicaliser & Deduplicator|  |
|  |  (RSS, Atom, JSON)    |     | (fast-xml-parser, zod) |     | (Tracking stripped, sha/dedupe) |  |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|                                                                                |                   |
|                                                                                v                   |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|  | DeepSeek LLM Engine   | <-- | Multi-Pass Clustering  | <-- | Storage Layer                   |  |
|  | (JSON Mode, v2 Prompt)|     | (Union-Find + Jaccard) |     | (Supabase PostgreSQL / RLS)     |  |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|              |                                                                                     |
|              v                                                                                     |
|  +-----------------------+                                                                         |
|  | Netlify Build Webhook |                                                                         |
|  +-----------------------+                                                                         |
+--------------|-------------------------------------------------------------------------------------+
               v
+----------------------------------------------------------------------------------------------------+
|                                    STATIC SITE COMPILATION                                         |
|                                        (Netlify / Astro 5)                                         |
|                                                                                                    |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|  | Supabase Read Client  | --> | Astro Page Generator   | --> | Satori OG Image Engine          |  |
|  | (Anon key, read-only) |     | (SSG, London Day Tree) |     | (resvg-js, 1200x630 PNG)        |  |
|  +-----------------------+     +------------------------+     +---------------------------------+  |
|                                                                                |                   |
|                                                                                v                   |
|                                                               +---------------------------------+  |
|                                                               | Global CDN Edge Deployment      |  |
|                                                               | (Static HTML, RSS, Sitemap)     |  |
|                                                               +---------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## Architectural Principles

1. **Zero Content Scraping**: The database stores headlines, publication timestamps, canonical source URLs and authorial metadata. Feed descriptions are truncated to 280 characters and retained strictly in private storage to support classification and summarisation; raw article body text is never stored or served.
2. **Strict Temporal Partitioning**: Because search news breaks across international boundaries, all calendar days are anchored strictly to the `Europe/London` timezone (accounting for GMT and British Summer Time). A story published at 23:30 in New York belongs to the following calendar day in London.
3. **Decoupled Persistence**: An abstract storage contract (`NewsStore`) isolates database calls from build routines. The pipeline runs equally well against Supabase PostgreSQL in production or a lightweight local JSON file (`.data/local-store.json`) for offline development.
4. **Compile-Time Static Composition**: All HTML pages, XML feeds and social preview cards are rendered at compile time. The production edge contains zero runtime database connections, ensuring resilience against upstream outages and high traffic spikes.

---

## System Architecture

### 1. Ingestion and Normalisation Pipeline (`scripts/fetch.ts`)

The ingestion script is executed automatically each morning. It polls nineteen configured sources spanning distinct serialisation formats:

* **RSS 2.0**: Standard syndication feeds, with support for namespaces such as `dc:date` and FeedBurner's `feedburner:origLink`.
* **Atom**: Syndicated web feeds parsing `<entry>` and `<link rel="alternate">` trees.
* **RSS 1.0 (RDF)**: Resource Description Framework index feeds.
* **Google Search Status Dashboard JSON**: The official Google Search incidents endpoint (`incidents.json`), ingested directly to extract service keys, status severity, incident milestones and rollout updates.

```
                                  [ Upstream Feed Body ]
                                             |
                                             v
                           +-----------------------------------+
                           | fast-xml-parser XMLValidator Check|
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | fast-xml-parser DOM Deserialiser  |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | HTML Entity Decoding & Stripping  |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Canonical URL Filtering & Hash    |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | London Calendar Day Resolution    |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Supabase Idempotent Upsert        |
                           +-----------------------------------+
```

#### Ingestion Resilience and Defensive Parsing

* **Stream Validation**: The pipeline invokes `XMLValidator.validate()` prior to parsing. Truncated network streams or non-XML responses (such as captive portal HTML or Cloudflare challenge pages) throw an immediate `FeedParseError` rather than polluting the database with partial records.
* **Transient Fault Retries**: HTTP requests run with explicit `AbortSignal.timeout(15_000)` deadlines. Network errors, timeouts and HTTP 5xx responses trigger an automatic three-second exponential backoff and retry. Client errors (HTTP 4xx) fail immediately to prevent request flooding.
* **Text Sanitisation**: Raw titles and descriptions pass through a sanitisation filter (`src/lib/text.ts`) that strips HTML markup, decodes nested numerical and named HTML entities, removes WordPress syndication signatures (such as "The post ... appeared first on...") and truncates long headlines cleanly on word boundaries.

#### URL Canonicalisation and Deduplication (`src/lib/url.ts`)

To ensure stories published across varying syndication channels are not duplicated:

* Protocols are upgraded to `https:`.
* Hostnames are converted to lowercase and stripped of `www.` prefixes.
* URL hash fragments and standard port numbers are stripped.
* Query parameters are sorted alphabetically, whilst tracking tokens are pruned using a regular expression filter matching `utm_*`, `gclid`, `fbclid`, `msclkid`, `yclid`, `igshid`, `mc_cid`, `mc_eid`, `ref`, `ref_src`, `source`, `campaign` and HubSpot tracking parameters.
* Feeds whose individual articles share a root URL (e.g. status updates) fallback to a composite deduplication key: `<source_id>:<guid>`.

---

### 2. Multi-Pass Event Clustering Engine (`src/lib/cluster.ts`)

When major industry events occur (such as a Google Core Update), multiple publications report on identical developments simultaneously. The clustering engine merges these related dispatches into coherent narrative threads using a two-pass algorithm:

```
Pass 1a: Named Event Matching
  Extract regex: \b(Month) (Year)? (Update Type) update\b
  Maps "Google November 2026 Core Update" -> Key: "2026-11:core update"
  Union-Find joins stories across publications to identical event keys.
                              |
                              v
Pass 1b: Type-Only Windowed Matching
  Headlines citing generic update types ("New core update rolling out")
  join existing named events within an active 21-day rollout window.
                              |
                              v
Pass 2: Lexical Jaccard Similarity
  Sliding 48-hour comparison window across remaining unclustered stories:
  - Text tokenisation, punctuation stripping and stopword pruning
  - Plural suffix trimming (stemming normalisation)
  - Jaccard similarity index: J(A, B) = |A ∩ B| / |A ∪ B|
  - Match criteria: >= 3 shared significant tokens AND Jaccard index >= 0.5
                              |
                              v
Disjoint Set Union (Union-Find) Resolves Final Equivalence Classes
```

#### Disjoint Set Union Implementation

The clustering engine utilises a Union-Find data structure with path compression:

```typescript
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
```

#### Group Hierarchy and Sorting

When rendering a grouped event card on the interface:
1. Official announcements from Google or Bing are selected as the lead story.
2. If no official story exists, the earliest published trade article takes the lead.
3. Coverage from other outlets is nested underneath in reverse chronological order.
4. Cross-day coverage linking to the same event published earlier or later is surfaced in a dedicated chronological accordion.

---

### 3. Dynamic Build-Time Tagging Engine (`src/lib/tagging.ts`)

Taxonomy classification runs dynamically during compilation rather than being fixed into database rows. Tag definitions are expressed as declarative rules in `src/config/tags.ts`:

* **Zero-Migration Re-indexing**: Because tagging occurs during the Astro static build, adding a new topic or adjusting regex boundaries automatically updates the entire historical archive without requiring database migrations or batch data updates.
* **Rule Specificity**: Rules match against normalised titles and descriptions. Broad terms prone to false positives in excerpts (such as "Bing" or "Perplexity") feature a `titleOnly: true` flag to restrict matching strictly to the headline.
* **Source Taxonomy**: Stories automatically inherit source classification tags based on source provenance: `official`, `press`, `vendor` or `community`.

---

### 4. LLM Summarisation and Synthesis (`scripts/summarise.ts`)

The summarisation layer produces concise one-sentence summaries for individual stories alongside an overarching daily briefing for busy days.

```
+-------------------------------------------------------------------------+
| Prompt Isolation & Anti-Hallucination Framework                         |
|                                                                         |
| 1. System Prompt Specification:                                         |
|    - Plain British English only; no hype, emojis, exclamation marks     |
|    - Grounding: Strictly forbidden from using external knowledge        |
|    - Single sentence summaries <= 30 words                              |
|    - Daily overview: 2 concise paragraphs (90-170 words total)          |
|                                                                         |
| 2. Prompt Injection Defence:                                            |
|    - Headlines and excerpts passed as structured JSON arrays            |
|    - Feed text treated strictly as quoted untrusted data                |
|    - Instructions inside syndicated content are explicitly ignored      |
|                                                                         |
| 3. Execution Parameters:                                                |
|    - Model: DeepSeek Chat (deepseek-flash / deepseek-v4-pro)            |
|    - Mode: response_format: { type: 'json_object' }                     |
|    - Reasoning: thinking: { type: 'disabled' }                          |
|    - Temperature: 0.3 | Max Tokens: 8000                                |
+-------------------------------------------------------------------------+
```

#### Token Efficiency and Id Invalidation

* **Short Identifier Mapping**: To minimise prompt payload costs, stories are mapped to transient keys (`s1`, `s2`, `s3`) before transmission. The script maps responses back to UUIDs upon return.
* **Chunked Execution**: Days with heavy news volume are partitioned into 40-story chunks, ensuring LLM output limits are never exceeded while retaining context across the full day.
* **Editorial Invalidation**: Day intros are generated for days with five or more stories (`MIN_EDITION_STORIES`). If late-arriving stories are fetched after an intro was initially generated, the story count discrepancy triggers an automatic rewrite.
* **Audit Trail**: Every generated summary and intro record is committed to PostgreSQL along with the generating model name and prompt version string (`v2`), allowing historical prompt tracking and targeted regeneration.

---

### 5. Persistence Architecture and Data Schema (`supabase/migrations/`)

The persistence tier relies on PostgreSQL with strict Row Level Security (RLS) enforcement.

```
                      +-----------------------------------+
                      |          public.stories           |
                      +-----------------------------------+
                      | id: uuid (PK)                     |
                      | dedupe_key: text (UNIQUE)         |
                      | url: text                         |
                      | title: text                       |
                      | source_id: text                   |
                      | source_name: text                 |
                      | source_category: text             |
                      | published_at: timestamptz         |
                      | first_seen_at: timestamptz        |
                      | day: date (INDEX)                 |
                      | excerpt: text (private)           |
                      | guid: text                        |
                      | extra: jsonb                      |
                      +-----------------------------------+
                                        |
                 +----------------------+----------------------+
                 | 1:1                                         | 1:N
                 v                                             v
+-----------------------------------+         +-----------------------------------+
|      public.story_summaries       |         |        public.day_digests         |
+-----------------------------------+         +-----------------------------------+
| story_id: uuid (PK, FK)           |         | day: date (PK)                    |
| summary: text                     |         | intro: text                       |
| model: text                       |         | story_count: integer              |
| prompt_version: text              |         | model: text                       |
| created_at: timestamptz           |         | prompt_version: text              |
+-----------------------------------+         | created_at: timestamptz           |
                                              +-----------------------------------+

+-----------------------------------+         +-----------------------------------+
|     public.google_incidents       |         |        public.fetch_runs          |
+-----------------------------------+         +-----------------------------------+
| id: text (PK)                     |         | id: uuid (PK)                     |
| title: text                       |         | started_at: timestamptz           |
| service_key: text                 |         | finished_at: timestamptz          |
| service_name: text                |         | new_stories: integer              |
| begin_at: timestamptz (INDEX)     |         | results: jsonb                    |
| end_at: timestamptz               |         +-----------------------------------+
| severity / status_impact: text    |
| latest_status: text               |
| uri: text                         |
| updates: jsonb                    |
| modified_at: timestamptz          |
+-----------------------------------+
```

#### Row Level Security Policies

* The static site build authenticates using the Supabase publishable/anonymous key, which is granted `SELECT` access exclusively on public data tables: `stories`, `story_summaries`, `day_digests` and `google_incidents`.
* All mutations (inserts, updates and run logging) are executed by automated scripts using the Supabase secret service key, which bypasses RLS.
* The internal telemetry table `fetch_runs` maintains no public RLS policy, protecting pipeline health statistics and error traces from external inspection.

---

### 6. Static Site Generation (Astro 5 and Tailwind CSS)

The user-facing site is pre-rendered into static HTML, CSS and asset bundles using Astro 5 in directory output format (`build: { format: 'directory' }`).

#### Routing Structure

| Route | Template File | Architectural Purpose |
|---|---|---|
| `/` | `src/pages/index.astro` | Dynamic edition resolving the latest complete day alongside an active "so far today" ledger for early-morning updates. |
| `/[date]/` | `src/pages/[date].astro` | Static daily edition showing the day's AI intro, grouped event clusters, timeline progress and day navigation. |
| `/archive/` | `src/pages/archive.astro` | Multi-month density calendar shaded according to publication volume. |
| `/tag/[tag]/` | `src/pages/tag/[tag].astro` | Historical topic archive aggregating coverage filtered by taxonomy rules. |
| `/rss.xml` | `src/pages/rss.xml.ts` | Syndicate feed publishing the 50 most recent stories with outbound source links. |
| `/sitemap.xml` | `src/pages/sitemap.xml.ts` | Fully qualified search engine indexation sitemap. |
| `/og/[...slug].png` | `src/pages/og/[...slug].png.ts` | Compile-time Open Graph cards rasterised as standalone PNG assets. |

#### In-Memory Compilation Cache

During execution of `astro build`, Astro invokes `getStaticPaths()` across routes concurrently. To avoid redundant network roundtrips to Supabase, `src/lib/query.ts` wraps store queries in a singleton promise cache (`loadNews()`). All pages, feeds and image generators query a single unified in-memory snapshot of the database.

---

### 7. Compile-Time Open Graph Card Generation (`src/lib/og.ts`)

Social cards (1200 x 630 PNG) are rasterised dynamically during the Astro compilation process without requiring headless browser runtimes or external screenshot services:

* **Vector Layout Engine**: `satori` converts virtual JSX-like tree declarations into vector SVG representations.
* **Rust-Based Rasterisation**: `@resvg/resvg-js` renders the resulting SVG markup into high-density PNG buffers.
* **Embedded Font Glyphs**: TrueType and WOFF font files for `Inter` (weights 400, 600 and 700) and `DM Mono` (weights 400 and 500) are loaded directly from `@fontsource` packages and embedded into the renderer memory space.
* **Dynamic Title Fitting**: Headline text dynamically scales its font size (`68px`, `58px`, `50px` or `42px`) based on string length to guarantee clean, unclipped three-line layouts.

---

### 8. Programmatic Launch Film Engine (`media/launch/`)

The launch film embedded in this repository is built entirely through code rather than video editing software. The source pipeline lives in `media/launch/`:

```
media/launch/
├── film.js          # Pure functional animation scene: seek(timestamp) -> DOM state
├── audio.mjs        # Algorithmic synthesiser: 120 BPM D minor score and sound FX -> mix.wav
├── cues.mjs         # Visual event timestamp exporter (ticks, drops, morphs) -> cues.json
├── index.html       # Visual staging harness (1920x1080)
└── render.mjs       # Headless Playwright capture -> ffmpeg temporal blur -> MP4
```

* **Pure State Functional Rendering**: `film.js` models the visual layout as a strict mathematical function of playback time `t`. Scrubbing or seeking is completely deterministic.
* **Synthesised Sound Architecture**: `audio.mjs` implements an algorithmic audio synthesiser in Node.js. It generates rhythmic drum sequences, sub-bass lines, chord stabs, sweeping noise risers and precise micro-sound effects directly into a 44.1 kHz 16-bit stereo WAV buffer.
* **Temporal Motion Blur**: `render.mjs` drives headless Chromium via Playwright, capturing frames at sub-interval steps and accumulating them with an FFmpeg blending filter to produce smooth 60 fps motion blur.

---

## Directory Layout

```
.
├── .github/workflows/
│   └── daily.yml                # Scheduled ingestion and Netlify webhook workflow
├── docs/
│   └── DEVELOPMENT.md           # Operational setup and environment configuration
├── media/
│   ├── seo-news-launch.mp4      # Master launch film (1080p60)
│   ├── seo-news-launch.gif      # Readme visual preview asset
│   └── launch/                  # Code source for launch film and audio synthesiser
├── public/                      # Static favicons, web manifest and brand logo
├── scripts/
│   ├── fetch.ts                 # Source poll, parse, canonicalise and ingest script
│   ├── summarise.ts             # DeepSeek AI one-line summary and intro generator
│   └── env.ts                   # Environment variable parser and CLI flag loader
├── src/
│   ├── config/
│   │   ├── sources.ts           # Upstream RSS, Atom and JSON source definitions
│   │   └── tags.ts              # Declarative topic rules and category mappings
│   ├── components/              # Astro UI components (DayView, Calendar, StoryCard)
│   ├── layouts/                 # Base HTML document shell and metadata tags
│   ├── lib/
│   │   ├── cluster.ts           # Union-Find and Jaccard event clustering logic
│   │   ├── dates.ts             # Europe/London calendar arithmetic and date formatters
│   │   ├── ingest.ts            # Raw feed item to validated story conversion
│   │   ├── parse.ts             # XML, RSS, Atom and Google Status parsers
│   │   ├── query.ts             # In-memory aggregation, group sorting and caching
│   │   ├── text.ts              # HTML stripping, entity decoding and excerpt trimming
│   │   ├── url.ts               # Tracking pruning and URL canonicalisation
│   │   ├── llm/                 # DeepSeek API client and prompt schemas
│   │   ├── store/               # NewsStore abstraction (Supabase and Local implementations)
│   │   └── og.ts                # Satori and Resvg Open Graph image rasteriser
│   └── pages/                   # Astro static page and feed endpoints
└── supabase/
    └── migrations/              # Database schema migrations and RLS policies
```

---

## Tracked News Sources

The system polls nineteen primary sources across four distinct categories:

| Category | Source Name | Endpoint Type | Focus Area |
|---|---|---|---|
| **Official** | Google Search Central Blog | RSS | Official ranking, policy and infrastructure announcements |
| **Official** | Google Search Status Dashboard | JSON API | Real-time tracking of algorithm updates and service disruptions |
| **Official** | Google Search Documentation | Atom | Technical developer guides and documentation revisions |
| **Official** | Google The Keyword: Search | RSS | Consumer search features and generative AI product updates |
| **Official** | Bing Search Blog | RSS | Microsoft search engine announcements |
| **Official** | Bing Webmaster Blog | RSS | Webmaster tools, crawling updates and Bingbot documentation |
| **Press** | Search Engine Journal | RSS | Daily search industry news, analysis and guides |
| **Press** | Search Engine Roundtable | RSS | Community discussions, unconfirmed algorithm shifts and commentary |
| **Press** | Search Engine Watch | RSS | Search engine marketing reporting and industry developments |
| **Tool Vendors** | Ahrefs Blog | RSS | Search research, data studies and SEO education |
| **Tool Vendors** | Moz Blog | RSS | Organic search strategies and SERP analysis |
| **Tool Vendors** | Semrush Blog | RSS | Search insights, algorithm commentary and workflow guides |
| **Tool Vendors** | Sistrix Blog | RSS | Visibility index reports and ranking volatility analysis |
| **Tool Vendors** | Screaming Frog Blog | RSS | Technical SEO, crawling software and log analysis updates |
| **Tool Vendors** | Yoast SEO Blog | RSS | Technical WordPress SEO and structured data developments |
| **Community** | GSQi (Glenn Gabe) | RSS | Algorithm update analysis and search volatility audits |
| **Community** | Marie Haynes Consulting | RSS | Google quality guidelines, algorithms and AI search commentary |
| **Community** | Growth Memo (Kevin Indig) | RSS | Strategic organic search analysis and search ecosystem economics |
| **Community** | Hacker News (SEO Curated) | RSS | Technology discussions mentioning SEO clearing a 50+ score threshold |

---

## Environment Variables and Configuration

The application requires specific environment variables depending on whether it is running the daily ingestion pipeline, the local development server or the Netlify build process.

| Variable | Description | Required Context |
|---|---|---|
| `NEWS_STORE` | Storage driver selector: `supabase` or `local`. Default is `local`. | All environments |
| `NEWS_LOCAL_PATH` | Path to the local JSON store file. Default is `.data/local-store.json`. | Local development |
| `SUPABASE_URL` | Root URL for the Supabase project instance. | Production ingest and build |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key. Bypasses RLS to allow writes. | Ingestion scripts (`scripts/fetch.ts`, `scripts/summarise.ts`) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase public anonymous key. Restricted by RLS to read-only access. | Netlify build (`astro build`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI summary and intro generation. | Summarisation script (`scripts/summarise.ts`) |
| `DEEPSEEK_MODEL` | DeepSeek model name. Options: `deepseek-flash` (default) or `deepseek-v4-pro`. | Summarisation script |
| `NETLIFY_BUILD_HOOK` | Netlify incoming webhook URL triggered by GitHub Actions to initiate rebuilds. | GitHub Actions CI/CD |
| `PUBLIC_GA_ID` | Optional Google Analytics measurement identifier (e.g. `G-RV46FH6BMG`). | Production build |
| `SEO_NEWS_NOINDEX` | Set to `true` to inject `<meta name="robots" content="noindex" />` across all pages. | Staging deployments |

---

## Local Development and Operations

### Prerequisites

* Node.js >= 20.3.0
* npm >= 10.0.0

### 1. Installation

```bash
git clone https://github.com/alaric-visi/seo-news.git
cd seo-news
npm install
```

### 2. Running Completely Offline (Zero Cloud Accounts)

The project includes a flat-file JSON storage engine. You can run the entire pipeline locally without Supabase or DeepSeek:

```bash
# Configure local file storage
cp .env.example .env
# Verify NEWS_STORE=local in .env

# Ingest from all live sources into .data/local-store.json
npm run news:fetch

# Test parsing against a single source without persisting changes
npm run news:fetch -- --source=moz --dry-run

# Start the Astro local development server
npm run dev
# Interface opens at http://localhost:4321/
```

### 3. Executing Unit and Integration Tests

The test suite is powered by Vitest. It validates feed parsing across RSS, Atom, RDF and JSON formats, checks London timezone date conversions across summer time boundaries, tests URL canonicalisation, verifies keyword tagging accuracy and exercises the Union-Find clustering algorithm:

```bash
npm test
```

### 4. Running Static Type Checks and Production Builds

```bash
# Validate Astro templates and TypeScript definitions
npm run check

# Execute production static site compilation
npm run build

# Preview the compiled static directory locally
npm run preview
```

---

<div align="center"><sub>Maintained by <a href="https://mikehiggins.me.uk/">Mike Higgins</a></sub></div>
