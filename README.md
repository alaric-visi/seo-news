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

## What it is

Keeping up with SEO means checking a lot of places every morning: Google's blogs and Search Status
Dashboard, Bing, the trade press, tool vendors and a handful of experts. SEO News checks all of them
for you once a day and puts everything on one calendar.

Pick a day and you see what happened in search that day: Google's and Bing's own announcements
first, then the coverage, grouped by story, with a short summary of each. Every story links to the
original article.

## What you get

- **A page for every day.** Everything published that day, each story linking to the original article.
- **Official posts first.** Announcements from Google and Bing are marked *Official* and lead the page, so you can tell them apart from commentary.
- **Stories grouped by event.** When Google releases a core update and five outlets write about it, you see one announcement with the coverage tucked underneath, not six separate items.
- **Google updates panel.** Core, spam and other ranking updates from the Google Search Status Dashboard, with how many days each rollout has been running against Google's stated window, plus recently completed ones.
- **The day in brief.** A short overview of each busy day, and a one-line summary under every story.
- **Topics.** Stories are tagged (core update, spam update, AI Overviews & AI Mode, OpenAI & ChatGPT, Bing, Search Console and more), and each topic has its own page.
- **An archive.** Month calendars shaded by how much happened, so busy days stand out.
- **RSS.** Follow the aggregated feed in any reader: [`/rss.xml`](https://seo-news.mikehiggins.me.uk/rss.xml).

## How it works

```
Every morning at about 05:15 UTC
  1. Fetch    Read the latest posts from 19 sources (RSS, Atom and Google's status data)
  2. Save     Store new stories, skipping anything already seen
  3. Organise Tag each story by topic and group stories about the same event
  4. Summarise Write a one-line summary per story and a brief for the day (AI)
  5. Publish  Rebuild the site, the RSS feed and the sitemap
```

- **Days follow UK time** (London), so a day's page is the same calendar day for every story on it.
- **If a source is down**, it's skipped for that run and the rest carry on; it's picked up again the next morning.
- **Nothing is republished.** Each story is a headline, its source, the time and a link. A short part of each feed's description is kept privately to tag stories and write summaries, and is never shown.
- **AI is labelled.** Summaries and day briefs are written by AI (DeepSeek) from headlines and feed descriptions only. They're marked *AI* on the page, so check the original before relying on them.

## Sources

| Type | Sources |
|---|---|
| **Official** | [Google Search Central Blog](https://developers.google.com/search/blog) · [Google Search Status Dashboard](https://status.search.google.com/) · [Google Search documentation updates](https://developers.google.com/search/updates) · [Google The Keyword: Search](https://blog.google/products/search/) · [Bing Search Blog](https://blogs.bing.com/search/) · [Bing Webmaster Blog](https://blogs.bing.com/webmaster/) |
| **Press** | [Search Engine Journal](https://www.searchenginejournal.com/) · [Search Engine Roundtable](https://www.seroundtable.com/) · [Search Engine Watch](https://www.searchenginewatch.com/) |
| **Tool vendors** | [Ahrefs](https://ahrefs.com/blog/) · [Moz](https://moz.com/blog) · [Semrush](https://www.semrush.com/blog/) · [Sistrix](https://www.sistrix.com/blog/) · [Screaming Frog](https://www.screamingfrog.co.uk/blog/) · [Yoast](https://yoast.com/seo-blog/) |
| **Experts & community** | [GSQi (Glenn Gabe)](https://www.gsqi.com/marketing-blog/) · [Marie Haynes](https://www.mariehaynes.com/blog/) · [Growth Memo (Kevin Indig)](https://www.growth-memo.com/) · [Hacker News](https://news.ycombinator.com/) (SEO stories with 50+ points) |

Know a feed that should be here? [Open an issue](https://github.com/alaric-visi/seo-news/issues).

## Built with

[Astro](https://astro.build/) for the site, [Supabase](https://supabase.com/) to keep the history,
[GitHub Actions](https://github.com/features/actions) for the daily run, [Netlify](https://www.netlify.com/)
for hosting and [DeepSeek](https://www.deepseek.com/) for summaries. The site is static, so pages are fast and
keep working even if a service is briefly down.

The launch film above is made in code too: one animated page rendered frame by frame, with an original
score. Its source is in [`media/launch/`](media/launch/).

## Running it yourself

Setup, configuration and local development are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
You can run the whole pipeline locally without any accounts.

---

<div align="center"><sub>Made by <a href="https://mikehiggins.me.uk/">Mike Higgins</a></sub></div>
