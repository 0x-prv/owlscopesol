-- OwlScope production monitoring: tracked token eligibility and behavior-event deduplication.
-- sources[] is the canonical source of truth; source stores the computed highest-priority effective source for indexed reads.
create table if not exists public.tracked_tokens (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id) on delete cascade,
  mint_address text not null,
  source text not null check (source in ('analyzed','watchlist','saved_analysis','trending','system','retained')),
  sources text[] not null default '{}'::text[],
  priority integer not null default 0,
  is_active boolean not null default true,
  first_tracked_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  next_scan_at timestamptz,
  scan_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_tokens_token_unique unique(token_id),
  constraint tracked_tokens_mint_unique unique(mint_address),
  constraint tracked_tokens_sources_known check (sources <@ array['analyzed','watchlist','saved_analysis','trending','system','retained']::text[]),
  constraint tracked_tokens_nonempty_mint check (btrim(mint_address) <> '')
);
create index if not exists tracked_tokens_scheduler_idx on public.tracked_tokens (is_active, next_scan_at, priority desc, last_scanned_at asc, scan_failures asc);
create index if not exists tracked_tokens_sources_gin_idx on public.tracked_tokens using gin (sources);
create index if not exists tracked_tokens_last_scanned_idx on public.tracked_tokens (last_scanned_at desc);
alter table public.tracked_tokens enable row level security;
revoke all on table public.tracked_tokens from anon, authenticated;
grant all on table public.tracked_tokens to service_role;

alter table public.behavior_events add column if not exists event_fingerprint text;
create unique index if not exists behavior_events_event_fingerprint_unique_idx on public.behavior_events (event_fingerprint) where event_fingerprint is not null;
create index if not exists behavior_events_token_type_detected_idx on public.behavior_events (token_id, event_type, detected_at desc);
