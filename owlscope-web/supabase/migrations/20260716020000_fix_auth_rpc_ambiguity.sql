-- Forward-only fix for ambiguous PL/pgSQL output variables in wallet auth RPC.
create or replace function public.authenticate_wallet_nonce(
  p_nonce text,
  p_wallet_address text,
  p_session_token_hash text,
  p_session_expires_at timestamptz
)
returns table(
  user_id uuid,
  wallet_address text,
  session_id uuid,
  session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce public.auth_nonces%rowtype;
  v_user_id uuid;
  v_session_id uuid;
begin
  select n.*
  into v_nonce
  from public.auth_nonces as n
  where n.nonce = p_nonce
  for update;

  if not found then
    raise exception 'invalid_nonce' using errcode = 'P0001';
  end if;

  if v_nonce.wallet_address <> p_wallet_address then
    raise exception 'wallet_mismatch' using errcode = 'P0001';
  end if;

  if v_nonce.expires_at <= now() then
    raise exception 'nonce_expired' using errcode = 'P0001';
  end if;

  if v_nonce.used_at is not null then
    raise exception 'nonce_used' using errcode = 'P0001';
  end if;

  update public.auth_nonces as n
  set used_at = now()
  where n.id = v_nonce.id;

  insert into public.wallet_users as wu (
    wallet_address,
    last_login_at
  )
  values (
    p_wallet_address,
    now()
  )
  on conflict on constraint wallet_users_wallet_address_key
  do update
  set last_login_at = excluded.last_login_at
  returning wu.id into v_user_id;

  insert into public.wallet_sessions as ws (
    user_id,
    session_token_hash,
    expires_at,
    last_seen_at
  )
  values (
    v_user_id,
    p_session_token_hash,
    p_session_expires_at,
    now()
  )
  returning ws.id into v_session_id;

  return query
  select
    v_user_id,
    p_wallet_address,
    v_session_id,
    p_session_expires_at;
end;
$$;

revoke all on function public.authenticate_wallet_nonce(text, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.authenticate_wallet_nonce(text, text, text, timestamptz)
to service_role;
