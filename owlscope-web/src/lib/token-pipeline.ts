import { supabaseAdmin } from "@/lib/supabase-server";
import { computeRiskReport, type TopHolder, type RiskReport } from "@/lib/risk-engine";
import { explainRiskReport } from "@/lib/groq-explainer";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

function preserveBigIntFields(rawText: string, fieldNames: string[]): string {
  let text = rawText;
  for (const field of fieldNames) {
    const regex = new RegExp(`("${field}"\\s*:\\s*)(-?\\d+)(?!\\d*")`, "g");
    text = text.replace(regex, `$1"$2"`);
  }
  return text;
}

async function safeFetchJson(
  label: string,
  url: string,
  options?: RequestInit,
  bigIntFields: string[] = [],
) {
  const response = await fetch(url, options);
  const rawText = await response.text();

  if (!rawText || rawText.trim() === "") {
    throw new Error(`${label}: empty response body (status ${response.status})`);
  }

  const textToParse =
    bigIntFields.length > 0 ? preserveBigIntFields(rawText, bigIntFields) : rawText;

  try {
    return JSON.parse(textToParse);
  } catch {
    throw new Error(`${label}: response was not valid JSON (status ${response.status})`);
  }
}

async function getAssetInfo(mintAddress: string) {
  const json = await safeFetchJson(
    "Helius getAsset",
    HELIUS_RPC_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "owlscope-web",
        method: "getAsset",
        params: { id: mintAddress, displayOptions: { showFungible: true } },
      }),
    },
    ["supply"],
  );

  if (json.error) {
    throw new Error(`Helius getAsset error: ${JSON.stringify(json.error)}`);
  }

  const asset = json.result;
  const tokenInfo = asset?.token_info ?? {};

  return {
    name: asset?.content?.metadata?.name ?? null,
    symbol: asset?.content?.metadata?.symbol ?? tokenInfo.symbol ?? null,
    decimals: tokenInfo.decimals ?? null,
    rawSupply: tokenInfo.supply != null ? String(tokenInfo.supply) : null,
    mintAuthority: tokenInfo.mint_authority ?? null,
    freezeAuthority: tokenInfo.freeze_authority ?? null,
    isMutable: asset?.mutable ?? null,
  };
}

async function getTopHolders(mintAddress: string, retries = 2): Promise<TopHolder[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const json = await safeFetchJson(
        `Helius getTokenLargestAccounts (attempt ${attempt + 1})`,
        HELIUS_RPC_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "owlscope-web",
            method: "getTokenLargestAccounts",
            params: [mintAddress],
          }),
        },
      );

      if (json.error) {
        throw new Error(`Helius getTokenLargestAccounts error: ${JSON.stringify(json.error)}`);
      }

      const accounts = json.result?.value ?? [];

      return accounts.map((acc: any) => ({
        address: acc.address,
        amount: acc.uiAmountString,
      }));
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return [];
}

async function getPriceData(mintAddress: string) {
  const json = await safeFetchJson(
    "Jupiter Price API v3",
    `https://lite-api.jup.ag/price/v3?ids=${mintAddress}`,
  );

  const priceData = json?.[mintAddress];

  return {
    priceUsd: priceData?.usdPrice ? Number(priceData.usdPrice) : null,
  };
}

function computeMarketCapUsd(
  rawSupply: string | null,
  decimals: number | null,
  priceUsd: number | null,
): number | null {
  if (rawSupply === null || decimals === null || priceUsd === null) return null;
  if (!Number.isFinite(decimals) || !Number.isFinite(priceUsd)) return null;

  let rawSupplyBigInt: bigint;
  try {
    rawSupplyBigInt = BigInt(rawSupply);
  } catch {
    return null;
  }

  const uiSupply = Number(rawSupplyBigInt) / 10 ** decimals;
  if (!Number.isFinite(uiSupply)) return null;

  const marketCapUsd = uiSupply * priceUsd;
  return Number.isFinite(marketCapUsd) ? marketCapUsd : null;
}

async function upsertToken(
  mintAddress: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined,
) {
  const row = {
    mint_address: mintAddress,
    name: assetInfo?.name ?? null,
    symbol: assetInfo?.symbol ?? null,
    decimals: assetInfo?.decimals ?? null,
    mint_authority: assetInfo?.mintAuthority ?? null,
    freeze_authority: assetInfo?.freezeAuthority ?? null,
    last_updated_at: new Date().toISOString(),
    metadata: {
      field_sources: {
        name: "helius_das",
        symbol: "helius_das",
        decimals: "helius_das",
        mint_authority: "helius_das",
        freeze_authority: "helius_das",
        raw_supply: "helius_das",
      },
      is_mutable: assetInfo?.isMutable ?? null,
      raw_supply: assetInfo?.rawSupply ?? null,
    },
  };

  const { data, error } = await supabaseAdmin
    .from("tokens")
    .upsert(row, { onConflict: "mint_address" })
    .select("id")
    .single();

  if (error) throw new Error(`Supabase upsertToken error: ${JSON.stringify(error)}`);
  return data.id as string;
}

async function insertSnapshot(
  tokenId: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined,
  topHolders: TopHolder[] | undefined,
  priceData: Awaited<ReturnType<typeof getPriceData>> | undefined,
) {
  const priceUsd = priceData?.priceUsd ?? null;
  const marketCapUsd = computeMarketCapUsd(
    assetInfo?.rawSupply ?? null,
    assetInfo?.decimals ?? null,
    priceUsd,
  );

  const sourceParts = [
    `price_usd:${priceUsd !== null ? "jupiter_price_v3" : "unavailable"}`,
    `market_cap_usd:${marketCapUsd !== null ? "computed(supply×price)" : "unavailable"}`,
    `top_holders:${topHolders && topHolders.length > 0 ? "helius_getTokenLargestAccounts(top20)" : "unavailable"}`,
    `holder_count:unavailable(no_total_holder_source)`,
    `liquidity_usd:unavailable(no_liquidity_source)`,
    `volume_24h_usd:unavailable(no_market_data_source)`,
  ];

  const row = {
    token_id: tokenId,
    price_usd: priceUsd,
    market_cap_usd: marketCapUsd,
    liquidity_usd: null,
    volume_24h_usd: null,
    holder_count: null,
    top_holders: topHolders ?? [],
    source: sourceParts.join("|"),
    snapshot_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("token_snapshots")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(`Supabase insertSnapshot error: ${JSON.stringify(error)}`);
  return data.id as string;
}

async function insertRiskReport(
  tokenId: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined,
  topHolders: TopHolder[] | undefined,
) {
  const report = computeRiskReport({
    mintAuthority: assetInfo?.mintAuthority ?? null,
    freezeAuthority: assetInfo?.freezeAuthority ?? null,
    assetInfoAvailable: assetInfo !== undefined,
    name: assetInfo?.name ?? null,
    symbol: assetInfo?.symbol ?? null,
    decimals: assetInfo?.decimals ?? null,
    rawSupply: assetInfo?.rawSupply ?? null,
    topHolders,
  });

  const row = {
    token_id: tokenId,
    overall_risk_score: report.overall_risk_score,
    overall_risk_label: report.overall_risk_label,
    developer_risk_score: null,
    liquidity_risk_score: null,
    holder_concentration_score: report.holder_concentration_score,
    risk_factors: report.risk_factors,
    ai_summary: null,
    ai_model: null,
    generated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("risk_reports")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(`Supabase insertRiskReport error: ${JSON.stringify(error)}`);
  return { id: data.id as string, report };
}

async function insertAiExplanation(riskReportId: string, report: RiskReport) {
  const explanation = await explainRiskReport({
    overallRiskScore: report.overall_risk_score,
    overallRiskLabel: report.overall_risk_label,
    confidence: report.confidence,
    findings: report.findings,
    caveats: report.risk_factors.caveats,
  });

  const { error } = await supabaseAdmin
    .from("risk_reports")
    .update({
      ai_summary: explanation.summary,
      ai_headline: explanation.headline,
      ai_findings: explanation.key_findings,
      ai_limitations: explanation.limitations,
      ai_provider: explanation.provider,
      ai_model: explanation.model,
      ai_generated_at: explanation.generated_at,
    })
    .eq("id", riskReportId);

  if (error) throw new Error(`Supabase insertAiExplanation error: ${JSON.stringify(error)}`);
}

export async function runTokenPipeline(mintAddress: string): Promise<void> {
  if (!HELIUS_API_KEY) {
    throw new Error("Missing HELIUS_API_KEY environment variable.");
  }

  let assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined;
  let topHolders: TopHolder[] | undefined;
  let priceData: Awaited<ReturnType<typeof getPriceData>> | undefined;

  try {
    assetInfo = await getAssetInfo(mintAddress);
  } catch (err) {
    console.error("[token-pipeline] getAssetInfo failed:", err);
  }

  try {
    topHolders = await getTopHolders(mintAddress);
  } catch (err) {
    console.error("[token-pipeline] getTopHolders failed:", err);
  }

  try {
    priceData = await getPriceData(mintAddress);
  } catch (err) {
    console.error("[token-pipeline] getPriceData failed:", err);
  }

  const tokenId = await upsertToken(mintAddress, assetInfo);
  await insertSnapshot(tokenId, assetInfo, topHolders, priceData);
  const { id: riskReportId, report } = await insertRiskReport(tokenId, assetInfo, topHolders);
  await insertAiExplanation(riskReportId, report);
}
