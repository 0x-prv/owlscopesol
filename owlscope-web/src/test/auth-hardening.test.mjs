import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateKeyPairSync, sign, verify, createHash } from 'node:crypto';
const migration = readFileSync(new URL('../../supabase/migrations/20260716000000_auth_hardening.sql', import.meta.url), 'utf8');
const verifyRoute = readFileSync(new URL('../app/api/auth/verify/route.ts', import.meta.url), 'utf8');
const nonceRoute = readFileSync(new URL('../app/api/auth/nonce/route.ts', import.meta.url), 'utf8');
const sessionLib = readFileSync(new URL('../lib/server/auth/session.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../lib/server/auth/config.ts', import.meta.url), 'utf8');
const sha256Hex = (v) => createHash('sha256').update(v).digest('hex');
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
