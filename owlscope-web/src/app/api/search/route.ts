import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { tokenProviders } from "@/lib/server/providers";
import { runTokenPipeline } from "@/lib/server/token-pipeline";

const querySchema = z.string().trim().min(1).max(80);
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: "INVALID_QUERY", message: "Enter a token name, symbol, or mint address." } }, { status: 400 });
  const q = parsed.data;
  const { data } = await supabaseAdmin.from("tokens").select("mint_address,name,symbol,logo_url,last_updated_at").or(`mint_address.eq.${q},symbol.ilike.%${q}%,name.ilike.%${q}%`).limit(10);
  const rows = Array.isArray(data) ? data : [];
  if (rows.length > 0) return NextResponse.json({ success: true, data: { source: "supabase", results: rows } });
  for (const provider of tokenProviders.filter((item) => item.enabled() && item.lookupToken)) {
    try {
      const found = await provider.lookupToken?.(q);
      if (found) {
        if (MINT.test(found.mintAddress)) await runTokenPipeline(found.mintAddress);
        return NextResponse.json({ success: true, data: { source: provider.id, results: [{ mint_address: found.mintAddress, name: found.name, symbol: found.symbol, logo_url: found.logoUrl, last_updated_at: found.discoveredAt }] } });
      }
    } catch { /* continue */ }
  }
  return NextResponse.json({ success: true, data: { source: "none", results: [] } });
}
