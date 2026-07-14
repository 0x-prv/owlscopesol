create table if not exists trending_snapshots (
  id uuid primary key default gen_random_uuid(),
  mint_address text not null,
  token_name text,
  token_symbol text,
  token_logo_url text,
  token_category text,
  rank integer not null,
  trending_score numeric not null,
  price_usd numeric,
  price_change_percent numeric,
  price_change_timeframe text,
  volume_usd numeric,
  volume_timeframe text,
  liquidity_usd numeric,
  trade_count numeric,
  ranking_components jsonb not null default '{}'::jsonb,
  ranking_reason text not null,
  source text not null,
  source_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists trending_snapshots_created_at_idx on trending_snapshots(created_at desc);
create index if not exists trending_snapshots_rank_idx on trending_snapshots(rank);
create index if not exists trending_snapshots_mint_address_idx on trending_snapshots(mint_address);
