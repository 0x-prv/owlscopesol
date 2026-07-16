import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { buildAuthMessage } from "@/lib/server/auth/message";
import { isValidSolanaPublicKey, randomToken } from "@/lib/server/auth/crypto";
import { NONCE_TTL_SECONDS } from "@/lib/server/auth/config";
import { requestIp } from "@/lib/server/auth/ip";
import { checkRateLimit } from "@/lib/server/auth/rate-limit";

export async function POST(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  try {
    const { walletAddress } = await request.json();
    if (typeof walletAddress !== "string" || !isValidSolanaPublicKey(walletAddress)) return NextResponse.json({ error: "Invalid wallet address" }, { status: 400, headers: noStore });
    const limited = await checkRateLimit("nonce", [requestIp(request), walletAddress]);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...noStore, "Retry-After": String(limited.retryAfter) } });
    const issuedAt = new Date(); const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_SECONDS * 1000); const nonce = randomToken(24);
    const message = buildAuthMessage({ walletAddress, nonce, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() });
    const { error } = await supabaseAdmin.from("auth_nonces").insert({ wallet_address: walletAddress, nonce, message, issued_at: issuedAt.toISOString(), created_at: issuedAt.toISOString(), expires_at: expiresAt.toISOString() });
    if (error) { console.error("nonce insert failed", { code: error.code }); return NextResponse.json({ error: "Unable to create authentication challenge" }, { status: 500, headers: noStore }); }
    return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() }, { headers: noStore });
  } catch (error) { console.error("nonce request failed", { error: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ error: "Unable to create authentication challenge" }, { status: 500, headers: noStore }); }
}
