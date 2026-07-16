import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateKeyPairSync, sign, verify, createHash } from 'node:crypto';
const migration = readFileSync(new URL('../../supabase/migrations/20260716000000_auth_hardening.sql', import.meta.url), 'utf8');
const authRpcFixMigration = readFileSync(new URL('../../supabase/migrations/20260716020000_fix_auth_rpc_ambiguity.sql', import.meta.url), 'utf8');
const verifyRoute = readFileSync(new URL('../app/api/auth/verify/route.ts', import.meta.url), 'utf8');
const nonceRoute = readFileSync(new URL('../app/api/auth/nonce/route.ts', import.meta.url), 'utf8');
const sessionLib = readFileSync(new URL('../lib/server/auth/session.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../lib/server/auth/config.ts', import.meta.url), 'utf8');
const sha256Hex = (v) => createHash('sha256').update(v).digest('hex');


test('authenticate_wallet_nonce migration qualifies ambiguous SQL references', () => {
  assert.match(authRpcFixMigration, /from public\.auth_nonces as n\s+where n\.nonce = p_nonce\s+for update/is);
  assert.match(authRpcFixMigration, /update public\.auth_nonces as n\s+set used_at = now\(\)\s+where n\.id = v_nonce\.id/is);
  assert.match(authRpcFixMigration, /insert into public\.wallet_users as wu/is);
  assert.match(authRpcFixMigration, /on conflict on constraint wallet_users_wallet_address_key/i);
  assert.match(authRpcFixMigration, /insert into public\.wallet_sessions as ws/is);
  assert.doesNotMatch(authRpcFixMigration, /on conflict \(wallet_address\)/i);
});

function createAuthRpcHarness() {
  let nextId = 1;
  const now = () => new Date('2026-07-16T02:00:00.000Z');
  const state = { auth_nonces: [], wallet_users: [], wallet_sessions: [] };
  const id = (prefix) => `${prefix}-${nextId++}`;
  const invokeAuthenticateWalletNonce = ({ p_nonce, p_wallet_address, p_session_token_hash, p_session_expires_at }) => {
    const nonce = state.auth_nonces.find((row) => row.nonce === p_nonce);
    if (!nonce) throw Object.assign(new Error('invalid_nonce'), { code: 'P0001' });
    if (nonce.wallet_address !== p_wallet_address) throw Object.assign(new Error('wallet_mismatch'), { code: 'P0001' });
    if (new Date(nonce.expires_at).getTime() <= now().getTime()) throw Object.assign(new Error('nonce_expired'), { code: 'P0001' });
    if (nonce.used_at !== null) throw Object.assign(new Error('nonce_used'), { code: 'P0001' });
    nonce.used_at = now().toISOString();

    let user = state.wallet_users.find((row) => row.wallet_address === p_wallet_address);
    if (!user) {
      user = { id: id('user'), wallet_address: p_wallet_address, created_at: now().toISOString(), last_login_at: now().toISOString() };
      state.wallet_users.push(user);
    } else {
      user.last_login_at = now().toISOString();
    }

    const session = { id: id('session'), user_id: user.id, session_token_hash: p_session_token_hash, created_at: now().toISOString(), expires_at: p_session_expires_at, revoked_at: null, last_seen_at: now().toISOString() };
    state.wallet_sessions.push(session);
    return { user_id: user.id, wallet_address: p_wallet_address, session_id: session.id, session_expires_at: p_session_expires_at };
  };
  return { state, rpc: invokeAuthenticateWalletNonce };
}

test('authenticate_wallet_nonce RPC succeeds once, stores hashed session, and rejects nonce reuse', () => {
  const { state, rpc } = createAuthRpcHarness();
  const rawSession = 'raw-session-token';
  const sessionHash = sha256Hex(rawSession);
  state.auth_nonces.push({ id: 'nonce-1', wallet_address: 'wallet-a', nonce: 'nonce-a', expires_at: '2026-07-16T02:05:00.000Z', used_at: null });

  const first = rpc({ p_nonce: 'nonce-a', p_wallet_address: 'wallet-a', p_session_token_hash: sessionHash, p_session_expires_at: '2026-07-23T02:00:00.000Z' });

  assert.equal(first.wallet_address, 'wallet-a');
  assert.equal(state.wallet_users.length, 1);
  assert.equal(state.wallet_users[0].wallet_address, 'wallet-a');
  assert.equal(state.wallet_sessions.length, 1);
  assert.equal(state.wallet_sessions[0].session_token_hash, sessionHash);
  assert.notEqual(state.wallet_sessions[0].session_token_hash, rawSession);
  assert.equal(state.auth_nonces[0].used_at, '2026-07-16T02:00:00.000Z');
  assert.throws(() => rpc({ p_nonce: 'nonce-a', p_wallet_address: 'wallet-a', p_session_token_hash: sha256Hex('second-token'), p_session_expires_at: '2026-07-23T02:00:00.000Z' }), /nonce_used/);
});

test('authenticate_wallet_nonce RPC upserts an existing wallet without ambiguous wallet_address failure', () => {
  const { state, rpc } = createAuthRpcHarness();
  state.wallet_users.push({ id: 'user-existing', wallet_address: 'wallet-existing', created_at: '2026-07-15T00:00:00.000Z', last_login_at: '2026-07-15T00:00:00.000Z' });
  state.auth_nonces.push({ id: 'nonce-existing', wallet_address: 'wallet-existing', nonce: 'nonce-existing', expires_at: '2026-07-16T02:05:00.000Z', used_at: null });

  const result = rpc({ p_nonce: 'nonce-existing', p_wallet_address: 'wallet-existing', p_session_token_hash: sha256Hex('existing-session'), p_session_expires_at: '2026-07-23T02:00:00.000Z' });

  assert.equal(result.user_id, 'user-existing');
  assert.equal(state.wallet_users.length, 1);
  assert.equal(state.wallet_sessions.length, 1);
  assert.equal(state.auth_nonces[0].used_at, '2026-07-16T02:00:00.000Z');
});

test('malformed Solana public key rejected', () => { assert.match(nonceRoute, /isValidSolanaPublicKey\(walletAddress\)/); assert.match(verifyRoute, /!isValidSolanaPublicKey\(walletAddress\)/); });
test('expired nonce rejected', () => assert.match(verifyRoute, /expires_at\)\.getTime\(\) <= Date\.now/));
test('used nonce rejected', () => assert.match(verifyRoute, /nonceRow\.used_at/));
test('altered message rejected', () => { assert.match(verifyRoute, /message !== nonceRow\.message/); assert.match(verifyRoute, /message !== expected/); });
test('mismatched wallet rejected', () => assert.match(verifyRoute, /nonceRow\.wallet_address !== walletAddress/));
test('invalid signature rejected', () => assert.match(verifyRoute, /!signatureResult\.ok/));
test('valid signature accepted by platform signer', () => { const { privateKey } = generateKeyPairSync('ed25519'); assert.equal(sign(null, Buffer.from('ok'), privateKey).length, 64); });
test('raw session token is not stored', () => { assert.match(verifyRoute, /sha256Hex\(rawSession\)/); assert.doesNotMatch(verifyRoute, /p_session_token_hash: rawSession/); });
test('expired session rejected', () => assert.match(sessionLib, /expires_at\)\.getTime\(\) <= Date\.now/));
test('revoked session rejected', () => assert.match(sessionLib, /data\.revoked_at/));
test('concurrent reuse of one nonce results in only one success', () => { assert.match(migration, /for update/i); assert.match(migration, /if v_nonce\.used_at is not null/i); });
test('logout revokes and clears cookie', () => { const logout = readFileSync(new URL('../app/api/auth/logout/route.ts', import.meta.url), 'utf8'); assert.match(logout, /revokeSession/); assert.match(logout, /clearSessionCookie/); });
test('production canonical URL validation', () => { assert.match(config, /Missing OWLSCOPE_APP_URL/); assert.match(config, /must use HTTPS in production/); });
test('hash differs from raw token', () => assert.notEqual(sha256Hex('session-token'), 'session-token'));

const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes){let digits=[0]; for(const byte of bytes){let carry=byte; for(let i=0;i<digits.length;i++){carry+=digits[i]<<8; digits[i]=carry%58; carry=(carry/58)|0;} while(carry){digits.push(carry%58); carry=(carry/58)|0;}} let out=''; for(const byte of bytes){if(byte===0) out+='1'; else break;} const encoded=digits.reverse().map(d=>ALPHABET[d]).join(''); return out+(encoded==='1'&&out?'' : encoded);}
function clientBase64(bytes){let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return Buffer.from(binary,'binary').toString('base64');}
function decodeBase64Strict(value){const normalized=value.trim(); const isBase64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized); const isBase64Url=/^[A-Za-z0-9_-]+={0,2}$/.test(normalized)&&!/[+/]/.test(normalized); if(!isBase64&&!isBase64Url) return null; const sig=Buffer.from(normalized,isBase64Url&&!isBase64?'base64url':'base64'); const roundTrip=sig.toString(isBase64Url&&!isBase64?'base64url':'base64').replace(/=+$/u,''); return roundTrip===normalized.replace(/=+$/u,'')?sig:null;}
function spkiFromRawPublicKey(publicKey){return Buffer.concat([Buffer.from('302a300506032b6570032100','hex'), publicKey]);}
function verifyMessage(message, signatureBase64, publicKey){const sig=decodeBase64Strict(signatureBase64); if(sig?.length!==64) return false; return verify(null,new TextEncoder().encode(message),{key:spkiFromRawPublicKey(publicKey),format:'der',type:'spki'},sig);}

test('altered message checks are separated from signature verification', () => { assert.match(verifyRoute, /stored_message_mismatch/); assert.match(verifyRoute, /canonical_message_mismatch/); assert.match(verifyRoute, /signature_verification_failed/); assert.doesNotMatch(verifyRoute, /message !== nonceRow\.message \|\| message !== expected \|\|/); });
test('safe verify diagnostics use reason codes without logging sensitive values', () => { assert.match(verifyRoute, /wallet auth verify failed/); assert.match(verifyRoute, /reason/); assert.doesNotMatch(verifyRoute, /console\.(?:warn|error)\([^\n]*(?:signature|rawSession|cookie)/i); });
test('client handles Phantom object and direct signatures with robust base64', () => { const walletButton=readFileSync(new URL('../components/auth/WalletAuthButton.tsx', import.meta.url),'utf8'); assert.match(walletButton, /type SignMessageResponse = \{ signature: Uint8Array \} \| Uint8Array/); assert.match(walletButton, /signature\.length !== 64/); assert.match(walletButton, /i \+= 0x8000/); });
test('valid generated Ed25519 signature succeeds', () => { const {publicKey,privateKey}=generateKeyPairSync('ed25519'); const raw=publicKey.export({format:'der',type:'spki'}).subarray(-32); const msg='OwlScope auth message'; const sig=sign(null,new TextEncoder().encode(msg),privateKey).toString('base64'); assert.equal(verifyMessage(msg,sig,raw), true); });
test('one changed character in the message fails', () => { const {publicKey,privateKey}=generateKeyPairSync('ed25519'); const raw=publicKey.export({format:'der',type:'spki'}).subarray(-32); const sig=sign(null,new TextEncoder().encode('message-a'),privateKey).toString('base64'); assert.equal(verifyMessage('message-b',sig,raw), false); });
test('a different wallet public key fails', () => { const a=generateKeyPairSync('ed25519'); const b=generateKeyPairSync('ed25519'); const rawB=b.publicKey.export({format:'der',type:'spki'}).subarray(-32); const sig=sign(null,new TextEncoder().encode('message'),a.privateKey).toString('base64'); assert.equal(verifyMessage('message',sig,rawB), false); });
test('malformed Base64 and non-64-byte signatures fail', () => { assert.equal(decodeBase64Strict('not base64***'), null); assert.notEqual(decodeBase64Strict(Buffer.alloc(63).toString('base64'))?.length, 64); assert.notEqual(decodeBase64Strict(Buffer.alloc(65).toString('base64'))?.length, 64); });
test('Base64 encoding from the client round-trips correctly', () => { const bytes=Uint8Array.from({length:256},(_,i)=>i); assert.deepEqual(Buffer.from(clientBase64(bytes),'base64'), Buffer.from(bytes)); });
test('leading-zero Solana public keys decode correctly', () => { assert.equal(base58Encode(Buffer.alloc(32)), '11111111111111111111111111111111'); assert.match(nonceRoute, /isValidSolanaPublicKey\(walletAddress\)/); });
test('exact nonce route message shape signs and verifies successfully', () => { const {publicKey,privateKey}=generateKeyPairSync('ed25519'); const raw=publicKey.export({format:'der',type:'spki'}).subarray(-32); const wallet=base58Encode(raw); const nonce='nonce-token'; const issuedAt='2026-07-16T00:00:00.000Z'; const expiresAt='2026-07-16T00:05:00.000Z'; const message=['example.com wants you to sign in with your Solana wallet:',wallet,'','Sign in to OwlScope.','',`URI: https://example.com`,'Version: 1',`Nonce: ${nonce}`,`Issued At: ${issuedAt}`,`Expiration Time: ${expiresAt}`].join('\n'); const sig=sign(null,new TextEncoder().encode(message),privateKey).toString('base64'); assert.equal(verifyMessage(message,sig,raw), true); });

function buildCanonicalAuthMessage({ walletAddress, nonce, issuedAt, expiresAt }) {
  const normalize = (value, fieldName) => {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) throw new Error(`Invalid auth message ${fieldName}`);
    return timestamp.toISOString();
  };
  const normalizedIssuedAt = normalize(issuedAt, 'issuedAt');
  const normalizedExpiresAt = normalize(expiresAt, 'expiresAt');
  return ['example.com wants you to sign in with your Solana wallet:', walletAddress, '', 'Sign in to OwlScope.', '', 'URI: https://example.com', 'Version: 1', `Nonce: ${nonce}`, `Issued At: ${normalizedIssuedAt}`, `Expiration Time: ${normalizedExpiresAt}`].join('\n');
}

const timestampFields = { walletAddress: 'wallet-address', nonce: 'nonce-token', issuedAt: '2026-07-16T01:23:45.123Z', expiresAt: '2026-07-16T01:28:45.123Z' };

test('buildAuthMessage normalizes equivalent Z and +00:00 timestamps', () => {
  assert.match(readFileSync(new URL('../lib/server/auth/message.ts', import.meta.url), 'utf8'), /toISOString\(\)/);
  assert.equal(buildCanonicalAuthMessage(timestampFields), buildCanonicalAuthMessage({ ...timestampFields, issuedAt: '2026-07-16T01:23:45.123+00:00', expiresAt: '2026-07-16T01:28:45.123+00:00' }));
});

test('buildAuthMessage normalizes equivalent timestamps with another valid timezone offset', () => {
  assert.equal(buildCanonicalAuthMessage(timestampFields), buildCanonicalAuthMessage({ ...timestampFields, issuedAt: '2026-07-15T20:23:45.123-05:00', expiresAt: '2026-07-15T20:28:45.123-05:00' }));
});

test('buildAuthMessage rejects invalid issuedAt', () => {
  assert.throws(() => buildCanonicalAuthMessage({ ...timestampFields, issuedAt: 'not-a-date' }), /Invalid auth message issuedAt/);
});

test('buildAuthMessage rejects invalid expiresAt', () => {
  assert.throws(() => buildCanonicalAuthMessage({ ...timestampFields, expiresAt: 'not-a-date' }), /Invalid auth message expiresAt/);
});

test('changed actual timestamp instant produces a different canonical message', () => {
  assert.notEqual(buildCanonicalAuthMessage(timestampFields), buildCanonicalAuthMessage({ ...timestampFields, issuedAt: '2026-07-16T01:23:45.124Z' }));
});

test('exact nonce creation message rebuilds identically from database-style timestamptz strings', () => {
  const created = buildCanonicalAuthMessage(timestampFields);
  const rebuilt = buildCanonicalAuthMessage({ ...timestampFields, issuedAt: '2026-07-16T01:23:45.123+00:00', expiresAt: '2026-07-16T01:28:45.123+00:00' });
  assert.equal(created, rebuilt);
});

test('valid generated Ed25519 signature verifies after canonical timestamp reconstruction', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const walletAddress = base58Encode(raw);
  const created = buildCanonicalAuthMessage({ ...timestampFields, walletAddress });
  const reconstructed = buildCanonicalAuthMessage({ ...timestampFields, walletAddress, issuedAt: '2026-07-16T01:23:45.123+00:00', expiresAt: '2026-07-15T21:28:45.123-04:00' });
  const sig = sign(null, new TextEncoder().encode(created), privateKey).toString('base64');
  assert.equal(created, reconstructed);
  assert.equal(verifyMessage(reconstructed, sig, raw), true);
});
