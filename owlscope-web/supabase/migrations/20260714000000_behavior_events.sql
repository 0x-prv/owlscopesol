create table if not exists behavior_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references tokens(id) on delete cascade,
  event_type text not null check (event_type in ('authority_change', 'holder_concentration_spike')),
  severity integer not null check (severity between 1 and 5),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  title text not null,
  summary text not null,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists behavior_events_detected_at_idx
  on behavior_events (detected_at desc);

create index if not exists behavior_events_event_type_detected_at_idx
  on behavior_events (event_type, detected_at desc);

create index if not exists behavior_events_token_id_idx
  on behavior_events (token_id);

create table if not exists behavior_event_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references behavior_events(id) on delete cascade,
  evidence_type text not null,
  before_value jsonb default '{}'::jsonb,
  after_value jsonb default '{}'::jsonb,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists behavior_event_evidence_event_id_idx
  on behavior_event_evidence (event_id);

create table if not exists holder_snapshots (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references tokens(id) on delete cascade,
  top_10_pct numeric,
  top_holders jsonb not null default '[]'::jsonb,
  snapshot_at timestamptz not null default now()
);

create index if not exists holder_snapshots_token_id_snapshot_at_idx
  on holder_snapshots (token_id, snapshot_at desc);

create table if not exists authority_snapshots (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references tokens(id) on delete cascade,
  mint_authority text,
  freeze_authority text,
  snapshot_at timestamptz not null default now()
);

create index if not exists authority_snapshots_token_id_snapshot_at_idx
  on authority_snapshots (token_id, snapshot_at desc);

alter table behavior_events enable row level security;
alter table behavior_event_evidence enable row level security;
alter table holder_snapshots enable row level security;
alter table authority_snapshots enable row level security;

drop policy if exists "Behavior events are publicly readable" on behavior_events;
create policy "Behavior events are publicly readable"
  on behavior_events for select
  using (true);

drop policy if exists "Behavior event evidence is publicly readable" on behavior_event_evidence;
create policy "Behavior event evidence is publicly readable"
  on behavior_event_evidence for select
  using (true);

drop policy if exists "Holder snapshots are publicly readable" on holder_snapshots;
create policy "Holder snapshots are publicly readable"
  on holder_snapshots for select
  using (true);

drop policy if exists "Authority snapshots are publicly readable" on authority_snapshots;
create policy "Authority snapshots are publicly readable"
  on authority_snapshots for select
  using (true);
