# SEO News

Every day in SEO, on one calendar. A daily aggregator of Google's own announcements,
Search Status Dashboard rollouts and search-industry coverage, live at
**https://seo-news.mikehiggins.me.uk/**.

Each story shows its headline, source, time and a link to the original. Article text
is never republished: we keep up to 280 characters of each feed's description for
tagging and AI summaries, and never show it.

## How it works

```
GitHub Action (05:15 UTC daily)
  1. npm run news:fetch       feeds -> Supabase (new stories, Google incidents, run log)
  2. npm run news:summarise   DeepSeek one-line summaries + a daily intro -> Supabase
  3. POST Netlify build hook
Netlify build
  Astro reads Supabase (read-only key) and renders static pages
```

- **Sources** live in [`src/config/sources.ts`](src/config/sources.ts). Add, remove or set `enabled: false`.
- **Tags** are keyword rules in [`src/config/tags.ts`](src/config/tags.ts). They are applied at build time, so editing a rule re-tags the whole archive.
- **Grouping** ([`src/lib/cluster.ts`](src/lib/cluster.ts)) joins stories about the same named Google update ("November 2026 core update") and near-identical headlines from different outlets within 48 hours.
- **Days** are London days, worked out when a story is first saved.
- A failing or malformed feed is logged (and shown as a warning in the Action) and the rest carry on. The run only fails if every source fails.
- If Supabase is unreachable during a Netlify build, the build fails and Netlify keeps serving the previous deploy.

## Pages

On https://seo-news.mikehiggins.me.uk:

| Path | |
|---|---|
| `/` | Latest full day, "so far today", Google updates panel, calendar |
| `/2026-11-12/` | One day: AI intro, stories grouped by event, previous/next day |
| `/archive/` | Month calendars |
| `/tag/core-update/` | One page per tag that has stories |
| `/rss.xml` | Our feed (latest 50 stories, linking to the originals) |
| `/sitemap.xml` | The app's own sitemap |

Pages are indexable, and `robots.txt` points to the sitemap. Set `SEO_NEWS_NOINDEX=true` on a deploy (e.g. staging) to add `noindex` everywhere. Old `/tools/seo-news/…` links 301 to the root.

## Local development

```bash
npm install
cp .env.example .env          # set NEWS_STORE=local to work without Supabase
npm run news:fetch            # fetch every feed into the store
npm run news:fetch -- --dry-run          # fetch and parse only, write nothing
npm run news:fetch -- --source=moz       # one source
npm run news:summarise -- --dry-run      # show the DeepSeek requests without sending
npm run dev                   # http://localhost:4321/
npm test
```

With `NEWS_STORE=local` everything is stored in `.data/local-store.json` (git-ignored).

## Setup

### 1. Supabase (project `seo-news`)

Run [`supabase/migrations/20261112000000_init.sql`](supabase/migrations/20261112000000_init.sql) once in the
SQL editor. Row-level security lets the publishable key read the public tables; only
the secret key can write.

### 2. GitHub repository secrets

| Secret | Value |
|---|---|
| `SUPABASE_URL` | `https://xayayfpwxnmtrlojjcua.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase secret (or legacy `service_role`) key |
| `DEEPSEEK_API_KEY` | DeepSeek API key (optional: without it summaries are skipped) |
| `NETLIFY_BUILD_HOOK` | Netlify build hook URL |

Optional repository variable `DEEPSEEK_MODEL`: `deepseek-flash` (default) or `deepseek-v4-pro`.

### 3. Netlify site

Connect this repository. Build settings come from `netlify.toml`. Environment variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | as above |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (or legacy `anon`) key, read-only |
| `NEWS_STORE` | `supabase` |
| `PUBLIC_GA_ID` | optional, e.g. `G-RV46FH6BMG` |

Never give Netlify the secret key. Create a build hook (Site configuration → Build hooks) and store it as `NETLIFY_BUILD_HOOK` in GitHub.

## Search Console

Add `https://seo-news.mikehiggins.me.uk/` as a property in Google Search Console and Bing
Webmaster Tools, and submit `https://seo-news.mikehiggins.me.uk/sitemap.xml`.

## AI summaries

[`scripts/summarise.ts`](scripts/summarise.ts) sends one request per day to DeepSeek
(`deepseek-flash`, JSON mode, thinking off) containing that day's headlines and
excerpts. It writes one sentence per new story and, for days with 5+ stories, a short
intro, which is rewritten when late stories arrive. The prompt (in
[`src/lib/llm/prompt.ts`](src/lib/llm/prompt.ts)) allows only facts in the headline and
excerpt. Every summary is labelled "AI summary" on the page and stored with its model
and prompt version. At current prices this costs well under $1 a month.

## Later

- **Email digest:** `groupsForDay()` in `src/lib/query.ts` already produces one day's stories, grouped; add a `digest_sends` table and a step in the Action.
- **Volatility data:** add a `volatility_readings` table and a panel beside Google updates.
