import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { buildAuthMessage } from "@/lib/server/auth/message";
import { isValidSolanaPublicKey, randomToken, sha256Hex, verifySolanaSignature } from "@/lib/server/auth/crypto";
import { SESSION_TTL_SECONDS } from "@/lib/server/auth/config";
import { setSessionCookie } from "@/lib/server/auth/session";
import { requestIp } from "@/lib/server/auth/ip";
import { checkRateLimit } from "@/lib/server/auth/rate-limit";

export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const body = await request.json();
    const { walletAddress, nonce, message, signature } = body;
    if (![walletAddress, nonce, message, signature].every((v) => typeof v === "string") || !isValidSolanaPublicKey(walletAddress)) return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore });
    const limited = await checkRateLimit("verify", [requestIp(request), walletAddress, nonce]);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...noStore, "Retry-After": String(limited.retryAfter) } });
    const { data: nonceRow, error } = await supabaseAdmin.from("auth_nonces").select("wallet_address,nonce,message,issued_at,expires_at,used_at").eq("nonce", nonce).maybeSingle();
    if (error) { console.error("nonce lookup failed", { code: error.code }); return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore }); }
    if (!nonceRow || nonceRow.wallet_address !== walletAddress || nonceRow.used_at || new Date(nonceRow.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore });
    const expected = buildAuthMessage({ walletAddress, nonce, issuedAt: nonceRow.issued_at, expiresAt: nonceRow.expires_at });
    if (message !== nonceRow.message || message !== expected || !verifySolanaSignature(message, signature, walletAddress)) return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore });
    const rawSession = randomToken(48); const sessionHash = sha256Hex(rawSession); const sessionExpires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const { data, error: rpcError } = await supabaseAdmin.rpc("authenticate_wallet_nonce", { p_nonce: nonce, p_wallet_address: walletAddress, p_session_token_hash: sessionHash, p_session_expires_at: sessionExpires.toISOString() }).single();
    if (rpcError || !data) { console.error("auth rpc failed", { code: rpcError?.code }); return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore }); }
    const authData = data as { user_id: string; wallet_address: string; session_expires_at: string };
    const response = NextResponse.json({ user: { id: authData.user_id, walletAddress: authData.wallet_address }, session: { expiresAt: authData.session_expires_at } }, { headers: noStore });
    setSessionCookie(response, rawSession, sessionExpires);
    return response;
  } catch (error) { console.error("verify request failed", { error: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: noStore }); }
}
