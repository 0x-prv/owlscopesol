import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { buildAuthMessage } from "@/lib/server/auth/message";
import { isValidSolanaPublicKey, randomToken, sha256Hex, verifySolanaSignatureDetailed } from "@/lib/server/auth/crypto";
import { SESSION_TTL_SECONDS } from "@/lib/server/auth/config";
import { setSessionCookie } from "@/lib/server/auth/session";
import { requestIp } from "@/lib/server/auth/ip";
import { checkRateLimit } from "@/lib/server/auth/rate-limit";

type VerifyFailureReason = "invalid_request_shape" | "invalid_wallet" | "nonce_not_found" | "wallet_mismatch" | "nonce_used" | "nonce_expired" | "stored_message_mismatch" | "canonical_message_mismatch" | "malformed_signature" | "signature_verification_failed" | "auth_rpc_failed";
const fail = (reason: VerifyFailureReason, status = 401) => { if (process.env.NODE_ENV !== "production") console.warn("wallet auth verify failed", { reason }); return NextResponse.json({ error: "Authentication failed" }, { status, headers: { "Cache-Control": "no-store" } }); };

export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const body = await request.json();
    const { walletAddress, nonce, message, signature } = body;
    if (![walletAddress, nonce, message, signature].every((v) => typeof v === "string")) return fail("invalid_request_shape");
    if (!isValidSolanaPublicKey(walletAddress)) return fail("invalid_wallet");
    const limited = await checkRateLimit("verify", [requestIp(request), walletAddress, nonce]);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...noStore, "Retry-After": String(limited.retryAfter) } });
    const { data: nonceRow, error } = await supabaseAdmin.from("auth_nonces").select("wallet_address,nonce,message,issued_at,expires_at,used_at").eq("nonce", nonce).maybeSingle();
    if (error) { console.error("nonce lookup failed", { code: error.code }); return fail("nonce_not_found"); }
    if (!nonceRow) return fail("nonce_not_found");
    if (nonceRow.wallet_address !== walletAddress) return fail("wallet_mismatch");
    if (nonceRow.used_at) return fail("nonce_used");
    if (new Date(nonceRow.expires_at).getTime() <= Date.now()) return fail("nonce_expired");
    const expected = buildAuthMessage({ walletAddress, nonce, issuedAt: nonceRow.issued_at, expiresAt: nonceRow.expires_at });
    if (message !== nonceRow.message) return fail("stored_message_mismatch");
    if (message !== expected) return fail("canonical_message_mismatch");
    const signatureResult = verifySolanaSignatureDetailed(message, signature, walletAddress);
    if (!signatureResult.ok) return fail(signatureResult.reason);
    const rawSession = randomToken(48); const sessionHash = sha256Hex(rawSession); const sessionExpires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const { data, error: rpcError } = await supabaseAdmin.rpc("authenticate_wallet_nonce", { p_nonce: nonce, p_wallet_address: walletAddress, p_session_token_hash: sessionHash, p_session_expires_at: sessionExpires.toISOString() }).single();
    if (rpcError || !data) { console.error("auth rpc failed", { code: rpcError?.code }); return fail("auth_rpc_failed"); }
    const authData = data as { user_id: string; wallet_address: string; session_expires_at: string };
    const response = NextResponse.json({ user: { id: authData.user_id, walletAddress: authData.wallet_address }, session: { expiresAt: authData.session_expires_at } }, { headers: noStore });
    setSessionCookie(response, rawSession, sessionExpires);
    return response;
  } catch (error) { console.error("verify request failed", { error: error instanceof Error ? error.message : "unknown" }); return fail("invalid_request_shape"); }
}
