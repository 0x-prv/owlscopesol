import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { resolveLogoUrl } from "@/lib/server/logo-fallback";
import { getServerEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { CRON_SECRET } = getServerEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("tokens")
    .select("id, mint_address, logo_url")
    .is("logo_url", null)
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let updated = 0;
  let stillMissing = 0;

  for (const token of tokens ?? []) {
    const logoUrl = await resolveLogoUrl(token.mint_address, null);
    if (logoUrl) {
      await supabaseAdmin.from("tokens").update({ logo_url: logoUrl }).eq("id", token.id);
      updated += 1;
    } else {
      stillMissing += 1;
    }
  }

  return NextResponse.json({ success: true, checked: tokens?.length ?? 0, updated, stillMissing });
}