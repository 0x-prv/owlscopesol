import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { const { data } = await supabaseAdmin.from("tokens").select("mint_address,name,symbol,logo_url,last_updated_at,token_snapshots(price_usd,market_cap_usd,liquidity_usd,volume_24h_usd,snapshot_at),risk_reports(overall_risk_score,overall_risk_label,confidence,generated_at)").order("last_updated_at", { ascending: false }).limit(50); return NextResponse.json({ success: true, data: data ?? [] }, { headers: { "Cache-Control": "no-store" } }); }
