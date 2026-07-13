import { NextResponse } from "next/server";
import { discoverTokens } from "@/lib/server/discovery/token-discovery-service";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST() { const result = await discoverTokens(); return NextResponse.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } }); }
