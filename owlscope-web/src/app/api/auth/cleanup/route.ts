import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server/env";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${getServerEnv().CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const now = new Date();
  const usedBefore = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const revokedBefore = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const rateBefore = new Date(now.getTime() - 86400_000).toISOString();
  await supabaseAdmin.from("auth_nonces").delete().is("used_at", null).lt("expires_at", now.toISOString());
  await supabaseAdmin.from("auth_nonces").delete().not("used_at", "is", null).lt("used_at", usedBefore);
  await supabaseAdmin.from("wallet_sessions").delete().lt("expires_at", now.toISOString());
  await supabaseAdmin.from("wallet_sessions").delete().not("revoked_at", "is", null).lt("revoked_at", revokedBefore);
  await supabaseAdmin.from("auth_rate_limits").delete().lt("created_at", rateBefore);
  return NextResponse.json({ success: true, retention: { usedNoncesDays: 7, revokedSessionsDays: 30, rateLimitRecordsDays: 1 } }, { headers: { "Cache-Control": "no-store" } });
}
