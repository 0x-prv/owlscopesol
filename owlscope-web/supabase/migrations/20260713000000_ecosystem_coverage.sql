create table if not exists tokens (
  id uuid primary key default gen_random_uuid(),
  mint_address text unique not null,
  name text,
  symbol text,
  logo_url text,
  decimals integer,
  mint_authority text,
  freeze_authority text,
  discovery_time timestamptz,
  first_seen_at timestamptz,
  last_updated_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create table if not exists token_sources (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references tokens(id) on delete cascade,
  provider text not null,
  source_kind text not null,
  source_id text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  raw jsonb default '{}'::jsonb,
  unique(token_id, provider, source_kind, source_id)
);

create table if not exists token_discovery_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references tokens(id) on delete cascade,
  provider text not null,
  event_type text not null,
  discovered_at timestamptz not null,
  payload jsonb default '{}'::jsonb
);

create table if not exists token_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references tokens(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  priority integer not null default 50,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text
);

create table if not exists token_metadata_cache (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references tokens(id) on delete cascade,
  provider text not null,
  name text,
  symbol text,
  logo_url text,
  decimals integer,
  fetched_at timestamptz not null,
  raw jsonb default '{}'::jsonb,
  unique(token_id, provider)
);

create table if not exists scan_history (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references tokens(id) on delete cascade,
  scan_type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb default '{}'::jsonb
);

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  token_id uuid references tokens(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, token_id)
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid references watchlists(id) on delete cascade,
  token_id uuid references tokens(id) on delete cascade,
  alert_type text not null,
  threshold jsonb default '{}'::jsonb,
  status text not null default 'active',
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);
