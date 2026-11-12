-- SEO News: initial schema.
-- Run once in the Supabase SQL editor (or `supabase db push` with the CLI).
--
-- Access model: RLS is on everywhere. The publishable/anon key can only SELECT the
-- public tables (the site build uses it). All writes come from the scripts in
-- GitHub Actions using the secret/service_role key, which bypasses RLS.

create extension if not exists pgcrypto;

-- One row per story (a link to someone else's article; we never store article text).
create table public.stories (
  id               uuid primary key default gen_random_uuid(),
  -- Cleaned-up URL, or "<source_id>:<guid>" for feeds whose items share a URL.
  dedupe_key       text not null unique,
  url              text not null,
  title            text not null,
  source_id        text not null,
  source_name      text not null,
  source_category  text not null check (source_category in ('official', 'press', 'vendor', 'community')),
  published_at     timestamptz not null,
  first_seen_at    timestamptz not null default now(),
  -- Calendar day in Europe/London, worked out by the fetch script.
  day              date not null,
  -- Up to ~280 characters of the feed's description. Used for tagging and AI
  -- summaries only; never shown on the site.
  excerpt          text,
  guid             text,
  -- Source-specific extras, e.g. { "discussionUrl": "https://news.ycombinator.com/item?id=…" }.
  extra            jsonb not null default '{}'::jsonb
);

create index stories_day_idx on public.stories (day desc);
create index stories_published_at_idx on public.stories (published_at desc);

-- AI one-line summaries, kept apart from stories so they can be regenerated and audited.
create table public.story_summaries (
  story_id        uuid primary key references public.stories (id) on delete cascade,
  summary         text not null,
  model           text not null,
  prompt_version  text not null,
  created_at      timestamptz not null default now()
);

-- AI-written intro paragraph for each day page.
create table public.day_digests (
  day             date primary key,
  intro           text not null,
  -- How many stories the day had when the intro was written; a change triggers a rewrite.
  story_count     integer not null,
  model           text not null,
  prompt_version  text not null,
  created_at      timestamptz not null default now()
);

-- Google Search Status Dashboard incidents (incidents.json only keeps the latest ~10).
create table public.google_incidents (
  id             text primary key,
  title          text not null,
  service_key    text,
  service_name   text,
  begin_at       timestamptz not null,
  end_at         timestamptz,
  severity       text,
  status_impact  text,
  latest_status  text,
  uri            text not null,
  updates        jsonb not null default '[]'::jsonb,
  modified_at    timestamptz
);

create index google_incidents_begin_idx on public.google_incidents (begin_at desc);

-- One row per fetch run, with per-source results. Not public.
create table public.fetch_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null,
  finished_at  timestamptz not null,
  new_stories  integer not null default 0,
  results      jsonb not null default '[]'::jsonb
);

alter table public.stories          enable row level security;
alter table public.story_summaries  enable row level security;
alter table public.day_digests      enable row level security;
alter table public.google_incidents enable row level security;
alter table public.fetch_runs       enable row level security;

create policy "Public read" on public.stories          for select to anon, authenticated using (true);
create policy "Public read" on public.story_summaries  for select to anon, authenticated using (true);
create policy "Public read" on public.day_digests      for select to anon, authenticated using (true);
create policy "Public read" on public.google_incidents for select to anon, authenticated using (true);
-- fetch_runs: no policy, so only the secret key can read or write it.
