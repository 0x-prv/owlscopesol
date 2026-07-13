import { supabaseAdmin } from "@/lib/supabase-server";
import type {
  AiExplanation,
  JsonObject,
  TokenIntelligenceResponse,
  TokenOverview,
  TokenRiskReport,
  TokenSnapshot,
} from "@/types/token-intelligence";

export class TokenNotFoundError extends Error {
  constructor(mintAddress: string) {
    super(`Token not found for mint address: ${mintAddress}`);
    this.name = "TokenNotFoundError";
  }
}

export class TokenIntelligenceDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenIntelligenceDatabaseError";
  }
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asJsonObject(value: unknown): JsonObject | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function getNestedNumber(object: JsonObject | null, keys: string[]): number | null {
  if (!object) return null;
  for (const key of keys) {
    const value = asNullableNumber(object[key]);
    if (value !== null) return value;
  }
  return null;
}

function getNestedString(object: JsonObject | null, keys: string[]): string | null {
  if (!object) return null;
  for (const key of keys) {
    const value = asNullableString(object[key]);
    if (value !== null) return value;
  }
  return null;
}

export async function getTokenIntelligence(
  mintAddress: string,
): Promise<TokenIntelligenceResponse> {
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("tokens")
    .select("*")
    .eq("mint_address", mintAddress)
    .maybeSingle();

  if (tokenError) {
    throw new TokenIntelligenceDatabaseError(`Failed to load token: ${tokenError.message}`);
  }
  if (!tokenRow) {
    throw new TokenNotFoundError(mintAddress);
  }

  const [snapshotResult, riskResult] = await Promise.all([
    supabaseAdmin
      .from("token_snapshots")
      .select("*")
      .eq("token_id", tokenRow.id)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("risk_reports")
      .select("*")
      .eq("token_id", tokenRow.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (snapshotResult.error) {
    throw new TokenIntelligenceDatabaseError(`Failed to load token snapshot: ${snapshotResult.error.message}`);
  }
  if (riskResult.error) {
    throw new TokenIntelligenceDatabaseError(`Failed to load risk report: ${riskResult.error.message}`);
  }

  const snapshotRow = snapshotResult.data;
  const riskRow = riskResult.data;
  const riskFactors = riskRow ? asJsonObject(riskRow.risk_factors) : null;

  const token: TokenOverview = {
    id: String(tokenRow.id),
    mintAddress: String(tokenRow.mint_address),
    name: asNullableString(tokenRow.name),
    symbol: asNullableString(tokenRow.symbol),
    decimals: asNullableNumber(tokenRow.decimals),
    mintAuthority: asNullableString(tokenRow.mint_authority),
    freezeAuthority: asNullableString(tokenRow.freeze_authority),
    metadata: asJsonObject(tokenRow.metadata),
    updatedAt: asNullableString(tokenRow.last_updated_at),
  };

  const snapshot: TokenSnapshot | null = snapshotRow
    ? {
        id: String(snapshotRow.id),
        priceUsd: asNullableNumber(snapshotRow.price_usd),
        marketCapUsd: asNullableNumber(snapshotRow.market_cap_usd),
        holderCount: asNullableNumber(snapshotRow.holder_count),
        liquidityUsd: asNullableNumber(snapshotRow.liquidity_usd),
        volume24hUsd: asNullableNumber(snapshotRow.volume_24h_usd),
        topHolders: asUnknownArray(snapshotRow.top_holders).flatMap((holder) => {
          if (typeof holder !== "object" || holder === null || Array.isArray(holder)) return [];
          const candidate = holder as Record<string, unknown>;
          const address = asNullableString(candidate.address);
          const amount = asNullableString(candidate.amount);
          return address && amount ? [{ address, amount }] : [];
        }),
        source: asNullableString(snapshotRow.source),
        capturedAt: asNullableString(snapshotRow.snapshot_at),
      }
    : null;

  const risk: TokenRiskReport | null = riskRow
    ? {
        id: String(riskRow.id),
        score: asNullableNumber(riskRow.overall_risk_score),
        level:
          asNullableString(riskRow.overall_risk_label) ??
          getNestedString(riskFactors, ["overall_risk_label", "label"]),
        confidence:
          getNestedNumber(riskFactors, ["confidence"]) ??
          asNullableNumber(riskRow.confidence),
        factors: riskRow.risk_factors ?? null,
        modelVersion:
          asNullableString(riskRow.model_version) ??
          getNestedString(riskFactors, ["model_version", "modelVersion"]),
        calculatedAt:
          asNullableString(riskRow.calculated_at) ??
          asNullableString(riskRow.generated_at),
      }
    : null;

  const hasAiExplanation = Boolean(
    riskRow && (riskRow.ai_summary || riskRow.ai_findings || riskRow.ai_limitations),
  );

  const ai: AiExplanation | null =
    riskRow && hasAiExplanation
      ? {
          headline: asNullableString(riskRow.ai_headline),
          summary: asNullableString(riskRow.ai_summary),
          findings: asStringArray(riskRow.ai_findings),
          limitations: asStringArray(riskRow.ai_limitations),
          provider: asNullableString(riskRow.ai_provider),
          model: asNullableString(riskRow.ai_model),
          generatedAt: asNullableString(riskRow.ai_generated_at),
        }
      : null;

  const lastUpdated =
    ai?.generatedAt ?? risk?.calculatedAt ?? snapshot?.capturedAt ?? token.updatedAt;

  return {
    token,
    snapshot,
    risk,
    ai,
    metadata: {
      lastUpdated,
      sources: snapshot?.source ?? null,
    },
  };
}