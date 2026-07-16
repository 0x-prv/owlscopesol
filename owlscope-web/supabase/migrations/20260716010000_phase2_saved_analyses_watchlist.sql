-- OwlScope Phase 2 Step 2: authenticated saved analyses and watchlists.
create table if not exists saved_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wallet_users(id) on delete cascade,
  token_id uuid null references public.tokens(id) on delete set null,
  mint_address text not null,
  risk_report_id uuid null references public.risk_reports(id) on delete set null,
  token_snapshot_id uuid null references public.token_snapshots(id) on delete set null,
  risk_score integer null,
  risk_level text null,
  confidence numeric null,
  reasons jsonb not null default '[]'::jsonb,
  ai_explanation text null,
  source_metadata jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint saved_analyses_mint_not_empty check (btrim(mint_address) <> ''),
  constraint saved_analyses_risk_score_range check (risk_score is null or risk_score between 0 and 100),
  constraint saved_analyses_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint saved_analyses_reasons_array check (jsonb_typeof(reasons) = 'array'),
  constraint saved_analyses_source_metadata_object check (jsonb_typeof(source_metadata) = 'object'),
  constraint saved_analyses_analyzed_not_future check (analyzed_at <= created_at + interval '5 minutes')
);
create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wallet_users(id) on delete cascade,
  token_id uuid null references public.tokens(id) on delete set null,
  mint_address text not null,
  created_at timestamptz not null default now(),
  constraint watchlist_items_user_mint_unique unique(user_id, mint_address),
  constraint watchlist_items_mint_not_empty check (btrim(mint_address) <> '')
);
create index if not exists saved_analyses_user_created_idx on saved_analyses(user_id, created_at desc, id desc);
create index if not exists saved_analyses_user_mint_idx on saved_analyses(user_id, mint_address, created_at desc);
create index if not exists watchlist_items_user_created_idx on watchlist_items(user_id, created_at desc, id desc);
create index if not exists watchlist_items_user_mint_idx on watchlist_items(user_id, mint_address);
alter table saved_analyses enable row level security;
alter table watchlist_items enable row level security;
revoke all on table saved_analyses from anon, authenticated;
revoke all on table watchlist_items from anon, authenticated;
grant all on table saved_analyses to service_role;
grant all on table watchlist_items to service_role;
