-- Forward-only hardening for Solana wallet authentication.
create table if not exists wallet_users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint wallet_users_wallet_address_not_empty check (btrim(wallet_address) <> '')
);

create table if not exists auth_nonces (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  nonce text not null unique,
  message text not null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint auth_nonces_wallet_address_not_empty check (btrim(wallet_address) <> ''),
  constraint auth_nonces_nonce_not_empty check (btrim(nonce) <> ''),
  constraint auth_nonces_expires_after_created check (expires_at > created_at),
  constraint auth_nonces_used_after_created check (used_at is null or used_at >= created_at)
);

create table if not exists wallet_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references wallet_users(id) on delete cascade,
  session_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  constraint wallet_sessions_hash_not_empty check (btrim(session_token_hash) <> ''),
  constraint wallet_sessions_expires_after_created check (expires_at > created_at),
  constraint wallet_sessions_revoked_after_created check (revoked_at is null or revoked_at >= created_at),
  constraint wallet_sessions_last_seen_after_created check (last_seen_at >= created_at)
);

create table if not exists auth_rate_limits (
  id bigserial primary key,
  operation text not null,
  key text not null,
  created_at timestamptz not null default now(),
  constraint auth_rate_limits_operation_not_empty check (btrim(operation) <> ''),
  constraint auth_rate_limits_key_not_empty check (btrim(key) <> '')
);

create index if not exists auth_nonces_wallet_created_idx on auth_nonces(wallet_address, created_at desc);
create index if not exists auth_nonces_expires_unused_idx on auth_nonces(expires_at) where used_at is null;
create index if not exists auth_nonces_used_at_idx on auth_nonces(used_at) where used_at is not null;
create index if not exists wallet_sessions_user_idx on wallet_sessions(user_id);
create index if not exists wallet_sessions_expires_idx on wallet_sessions(expires_at);
create index if not exists wallet_sessions_revoked_idx on wallet_sessions(revoked_at) where revoked_at is not null;
create index if not exists wallet_sessions_last_seen_idx on wallet_sessions(last_seen_at);
create index if not exists auth_rate_limits_lookup_idx on auth_rate_limits(operation, key, created_at desc);
create index if not exists auth_rate_limits_created_idx on auth_rate_limits(created_at);

create or replace function authenticate_wallet_nonce(
  p_nonce text,
  p_wallet_address text,
  p_session_token_hash text,
  p_session_expires_at timestamptz
) returns table(user_id uuid, wallet_address text, session_id uuid, session_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce auth_nonces%rowtype;
  v_user_id uuid;
  v_session_id uuid;
begin
  select * into v_nonce from auth_nonces where nonce = p_nonce for update;
  if not found then raise exception 'invalid_nonce' using errcode = 'P0001'; end if;
  if v_nonce.wallet_address <> p_wallet_address then raise exception 'wallet_mismatch' using errcode = 'P0001'; end if;
  if v_nonce.expires_at <= now() then raise exception 'nonce_expired' using errcode = 'P0001'; end if;
  if v_nonce.used_at is not null then raise exception 'nonce_used' using errcode = 'P0001'; end if;

  update auth_nonces set used_at = now() where id = v_nonce.id;

  insert into wallet_users(wallet_address, last_login_at)
  values (p_wallet_address, now())
  on conflict (wallet_address) do update set last_login_at = excluded.last_login_at
  returning id into v_user_id;

  insert into wallet_sessions(user_id, session_token_hash, expires_at, last_seen_at)
  values (v_user_id, p_session_token_hash, p_session_expires_at, now())
  returning id into v_session_id;

  return query select v_user_id, p_wallet_address, v_session_id, p_session_expires_at;
end;
$$;

revoke all on function authenticate_wallet_nonce(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function authenticate_wallet_nonce(text,text,text,timestamptz) to service_role;

alter table wallet_users enable row level security;
alter table auth_nonces enable row level security;
alter table wallet_sessions enable row level security;
alter table auth_rate_limits enable row level security;
