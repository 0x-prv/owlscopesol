import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTokenPipeline } from "@/lib/server/token-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mintAddressSchema = z.string().trim().min(32, "Mint address is too short.").max(44, "Mint address is too long.").regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Mint address is not valid Base58.");

type RouteContext = { params: Promise<{ mint: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { mint } = await context.params;
  const validation = mintAddressSchema.safeParse(mint);
  if (!validation.success) {
    return NextResponse.json({ success: false, error: { code: "INVALID_MINT_ADDRESS", message: validation.error.issues[0]?.message ?? "Invalid Solana mint address." } }, { status: 400 });
  }

  try {
    const analysis = await runTokenPipeline(validation.data);
    return NextResponse.json({ success: true, data: analysis, warnings: analysis.dataAvailabilityWarnings }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[token-api] Analysis failed:", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error && error.message.includes("environment variables")
      ? "Token analysis is not configured on this server."
      : "Token analysis is temporarily unavailable.";
    return NextResponse.json({ success: false, error: { code: "TOKEN_ANALYSIS_FAILED", message } }, { status: 500 });
  }
}
