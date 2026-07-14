import { NextResponse } from "next/server";
import { getTrendingTokens } from "@/lib/server/trending";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const result = await getTrendingTokens();
  return NextResponse.json({ success: result.status !== "unavailable", ...result }, { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } });
}
