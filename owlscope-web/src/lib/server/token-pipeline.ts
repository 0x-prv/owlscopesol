import "server-only";
import { explainRiskReport } from "./groq-explainer";
import { getAssetInfo, getTopHolders, type AssetInfo } from "./helius";
import { getPriceData, type PriceData } from "./jupiter";
import { computeRiskReport, type RiskReport, type TopHolder } from "./risk-engine";
import { supabaseAdmin } from "./supabase-admin";

export type DataAvailabilityWarning = {
  provider: "helius" | "jupiter" | "supabase" | "groq";
  operation: string;
  message: string;
};

export type TokenAnalysisResult = {
  token: {
    id: string;
    mintAddress: string;
    symbol: string | null;
    name: string | null;
    decimals: number | null;
    supply: string | null;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  };
  snapshot: {
    id: string;
    priceUsd: number | null;
    marketCapUsd: number | null;
    topHolders: TopHolder[];
    capturedAt: string;
    source: string;
  };
  risk: {
    id: string;
    overallRiskScore: number | null;
    overallRiskLabel: RiskReport["overall_risk_label"];
    confidence: number;
    findings: string[];
    caveats: string[];
    factors: RiskReport["risk_factors"];
  };
  ai: {
    headline: string;
    summary: string;
    findings: string[];
    limitations: string[];
    provider: string;
    model: string;
    generatedAt: string;
  };
  dataAvailabilityWarnings: DataAvailabilityWarning[];
};

function computeMarketCapUsd(rawSupply: string | null, decimals: number | null, priceUsd: number | null): number | null {
  if (rawSupply === null || decimals === null || priceUsd === null) return null;
  if (!Number.isFinite(decimals) || !Number.isFinite(priceUsd)) return null;
  try {
    const uiSupply = Number(BigInt(rawSupply)) / 10 ** decimals;
    const marketCapUsd = uiSupply * priceUsd;
    return Number.isFinite(marketCapUsd) ? marketCapUsd : null;
  } catch { return null; }
}

function warning(provider: DataAvailabilityWarning["provider"], operation: string): DataAvailabilityWarning {
  return { provider, operation, message: `${operation} failed; related fields are unavailable or analysis may be incomplete.` };
}

async function upsertToken(mintAddress: string, assetInfo: AssetInfo | undefined): Promise<string> {
  const { data, error } = await supabaseAdmin.from("tokens").upsert({
    mint_address: mintAddress,
    name: assetInfo?.name ?? null,
    symbol: assetInfo?.symbol ?? null,
    decimals: assetInfo?.decimals ?? null,
    mint_authority: assetInfo?.mintAuthority ?? null,
    freeze_authority: assetInfo?.freezeAuthority ?? null,
    last_updated_at: new Date().toISOString(),
    metadata: { field_sources: { name: "helius_das", symbol: "helius_das", decimals: "helius_das", mint_authority: "helius_das", freeze_authority: "helius_das", raw_supply: "helius_das" }, is_mutable: assetInfo?.isMutable ?? null, raw_supply: assetInfo?.rawSupply ?? null },
  }, { onConflict: "mint_address" }).select("id").single();
  if (error) throw new Error(`Supabase token upsert failed: ${error.message}`);
  return String(data.id);
}

async function insertSnapshot(tokenId: string, assetInfo: AssetInfo | undefined, topHolders: TopHolder[] | undefined, priceData: PriceData | undefined) {
  const priceUsd = priceData?.priceUsd ?? null;
  const marketCapUsd = computeMarketCapUsd(assetInfo?.rawSupply ?? null, assetInfo?.decimals ?? null, priceUsd);
  const source = [
    `price_usd:${priceUsd !== null ? "jupiter_price_v3" : "unavailable"}`,
    `market_cap_usd:${marketCapUsd !== null ? "computed(supply×price)" : "unavailable"}`,
    `top_holders:${topHolders && topHolders.length > 0 ? "helius_getTokenLargestAccounts(top20)" : "unavailable"}`,
    "holder_count:unavailable(no_total_holder_source)",
    "liquidity_usd:unavailable(no_liquidity_source)",
    "volume_24h_usd:unavailable(no_market_data_source)",
  ].join("|");
  const capturedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("token_snapshots").insert({ token_id: tokenId, price_usd: priceUsd, market_cap_usd: marketCapUsd, liquidity_usd: null, volume_24h_usd: null, holder_count: null, top_holders: topHolders ?? [], source, snapshot_at: capturedAt }).select("id").single();
  if (error) throw new Error(`Supabase snapshot insert failed: ${error.message}`);
  return { id: String(data.id), priceUsd, marketCapUsd, topHolders: topHolders ?? [], capturedAt, source };
}

async function insertRiskReport(tokenId: string, report: RiskReport) {
  const generatedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("risk_reports").insert({ token_id: tokenId, overall_risk_score: report.overall_risk_score, overall_risk_label: report.overall_risk_label, developer_risk_score: null, liquidity_risk_score: null, holder_concentration_score: report.holder_concentration_score, confidence: report.confidence, risk_factors: report.risk_factors, ai_summary: null, ai_model: null, generated_at: generatedAt }).select("id").single();
  if (error) throw new Error(`Supabase risk report insert failed: ${error.message}`);
  return String(data.id);
}

export async function runTokenPipeline(mintAddress: string): Promise<TokenAnalysisResult> {
  const dataAvailabilityWarnings: DataAvailabilityWarning[] = [];
  let assetInfo: AssetInfo | undefined;
  let topHolders: TopHolder[] | undefined;
  let priceData: PriceData | undefined;

  try { assetInfo = await getAssetInfo(mintAddress); } catch (error) { console.error("[token-pipeline] getAssetInfo failed:", error instanceof Error ? error.message : String(error)); dataAvailabilityWarnings.push(warning("helius", "Helius getAsset")); }
  try { topHolders = await getTopHolders(mintAddress); } catch (error) { console.error("[token-pipeline] getTopHolders failed:", error instanceof Error ? error.message : String(error)); dataAvailabilityWarnings.push(warning("helius", "Helius getTokenLargestAccounts")); }
  try { priceData = await getPriceData(mintAddress); } catch (error) { console.error("[token-pipeline] getPriceData failed:", error instanceof Error ? error.message : String(error)); dataAvailabilityWarnings.push(warning("jupiter", "Jupiter Price API")); }

  const tokenId = await upsertToken(mintAddress, assetInfo);
  const snapshot = await insertSnapshot(tokenId, assetInfo, topHolders, priceData);
  const report = computeRiskReport({ mintAuthority: assetInfo?.mintAuthority ?? null, freezeAuthority: assetInfo?.freezeAuthority ?? null, assetInfoAvailable: assetInfo !== undefined, name: assetInfo?.name ?? null, symbol: assetInfo?.symbol ?? null, decimals: assetInfo?.decimals ?? null, rawSupply: assetInfo?.rawSupply ?? null, topHolders });
  const riskReportId = await insertRiskReport(tokenId, report);
  const explanation = await explainRiskReport({ overallRiskScore: report.overall_risk_score, overallRiskLabel: report.overall_risk_label, confidence: report.confidence, findings: report.findings, caveats: report.risk_factors.caveats });
  const { error } = await supabaseAdmin.from("risk_reports").update({ ai_summary: explanation.summary, ai_headline: explanation.headline, ai_findings: explanation.key_findings, ai_limitations: explanation.limitations, ai_provider: explanation.provider, ai_model: explanation.model, ai_generated_at: explanation.generated_at }).eq("id", riskReportId);
  if (error) throw new Error(`Supabase AI explanation update failed: ${error.message}`);

  return { token: { id: tokenId, mintAddress, symbol: assetInfo?.symbol ?? null, name: assetInfo?.name ?? null, decimals: assetInfo?.decimals ?? null, supply: assetInfo?.rawSupply ?? null, mintAuthority: assetInfo?.mintAuthority ?? null, freezeAuthority: assetInfo?.freezeAuthority ?? null }, snapshot, risk: { id: riskReportId, overallRiskScore: report.overall_risk_score, overallRiskLabel: report.overall_risk_label, confidence: report.confidence, findings: report.findings, caveats: report.risk_factors.caveats, factors: report.risk_factors }, ai: { headline: explanation.headline, summary: explanation.summary, findings: explanation.key_findings, limitations: explanation.limitations, provider: explanation.provider, model: explanation.model, generatedAt: explanation.generated_at }, dataAvailabilityWarnings };
}
