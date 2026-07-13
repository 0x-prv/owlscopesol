import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { computeRiskReport, type TopHolder, type RiskReport } from "./risk-engine";
import { explainRiskReport } from "./groq-explainer";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TEST_TOKEN_MINT =
  process.env.TEST_TOKEN_MINT ??
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!HELIUS_API_KEY || HELIUS_API_KEY === "your_helius_api_key_here") {
  console.error(
    "Missing or placeholder HELIUS_API_KEY. Edit .env and add your real key."
  );
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Edit .env and add both."
  );
  process.exit(1);
}

// service_role key bypasses RLS — this script is a trusted backend job,
// never expose this key to the client/browser.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/**
 * Quotes specific numeric JSON fields as strings BEFORE JSON.parse runs,
 * so large integers (e.g. raw token supply, which can exceed
 * Number.MAX_SAFE_INTEGER) are preserved exactly instead of being
 * silently rounded to the nearest float64 by JSON.parse.
 *
 * Only touches unquoted numeric values immediately following the given
 * field names — safe for the narrow, known shape of Helius responses.
 */
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
  bigIntFields: string[] = []
) {
  const response = await fetch(url, options);
  const rawText = await response.text();

  console.log(`\n--- [${label}] HTTP ${response.status} ---`);

  if (!rawText || rawText.trim() === "") {
    console.log(`--- [${label}] EMPTY RESPONSE BODY ---`);
    throw new Error(`${label}: empty response body (status ${response.status})`);
  }

  const textToParse =
    bigIntFields.length > 0
      ? preserveBigIntFields(rawText, bigIntFields)
      : rawText;

  try {
    return JSON.parse(textToParse);
  } catch (e) {
    console.log(`--- [${label}] RAW BODY (first 500 chars) ---`);
    console.log(rawText.slice(0, 500));
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
        id: "owlscope-poc",
        method: "getAsset",
        params: {
          id: mintAddress,
          displayOptions: { showFungible: true },
        },
      }),
    },
    ["supply"] // preserve exact integer — can exceed Number.MAX_SAFE_INTEGER
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
    // raw supply, base units, EXACT string (preserved via preserveBigIntFields)
    // — must be divided by 10^decimals before use, via BigInt, not Number()
    rawSupply: tokenInfo.supply != null ? String(tokenInfo.supply) : null,
    mintAuthority: tokenInfo.mint_authority ?? null,
    freezeAuthority: tokenInfo.freeze_authority ?? null,
    isMutable: asset?.mutable ?? null,
  };
}

async function getTopHolders(mintAddress: string, retries = 2) {
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
            id: "owlscope-poc",
            method: "getTokenLargestAccounts",
            params: [mintAddress],
          }),
        }
      );

      if (json.error) {
        throw new Error(
          `Helius getTokenLargestAccounts error: ${JSON.stringify(json.error)}`
        );
      }

      const accounts = json.result?.value ?? [];

      // NOTE: this is the top 20 largest accounts only — NOT total holder
      // count. Never treat accounts.length as holder_count.
      return accounts.map((acc: any) => ({
        address: acc.address,
        amount: acc.uiAmountString,
      }));
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`Retrying getTopHolders in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return [];
}

async function getPriceData(mintAddress: string) {
  // Price API v3 (v2 is deprecated). Lite endpoint = free, no key needed.
  const json = await safeFetchJson(
    "Jupiter Price API v3",
    `https://lite-api.jup.ag/price/v3?ids=${mintAddress}`
  );

  const priceData = json?.[mintAddress];

  return {
    priceUsd: priceData?.usdPrice ? Number(priceData.usdPrice) : null,
    priceChange24h: priceData?.priceChange24h ?? null,
  };
}

/**
 * Computes market cap = normalized supply × price.
 * Returns null (never 0, never a guess) if any required input is
 * missing, non-numeric, or non-finite.
 *
 * rawSupply is treated as an EXACT integer string (from preserveBigIntFields)
 * and parsed via BigInt, so on-chain supply values larger than
 * Number.MAX_SAFE_INTEGER are not silently rounded during parsing.
 * The only float conversion happens at the very last step, when we
 * must multiply by priceUsd (which is inherently float precision anyway).
 */
function computeMarketCapUsd(
  rawSupply: string | null,
  decimals: number | null,
  priceUsd: number | null
): number | null {
  if (rawSupply === null || decimals === null || priceUsd === null) {
    return null;
  }

  if (!Number.isFinite(decimals) || !Number.isFinite(priceUsd)) {
    return null;
  }

  let rawSupplyBigInt: bigint;
  try {
    rawSupplyBigInt = BigInt(rawSupply);
  } catch {
    // rawSupply wasn't a clean integer string — refuse to guess
    return null;
  }

  const uiSupply = Number(rawSupplyBigInt) / 10 ** decimals;

  if (!Number.isFinite(uiSupply)) {
    return null;
  }

  const marketCapUsd = uiSupply * priceUsd;

  return Number.isFinite(marketCapUsd) ? marketCapUsd : null;
}

/**
 * Upserts a token into public.tokens keyed on mint_address.
 * Returns the token's uuid (id) for use in token_snapshots.
 */
async function upsertToken(
  mintAddress: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined
) {
  const row = {
    mint_address: mintAddress,
    name: assetInfo?.name ?? null,
    symbol: assetInfo?.symbol ?? null,
    decimals: assetInfo?.decimals ?? null,
    mint_authority: assetInfo?.mintAuthority ?? null,
    freeze_authority: assetInfo?.freezeAuthority ?? null,
    last_updated_at: new Date().toISOString(),
    // Per-field provenance. All asset-level fields here come from the
    // same Helius getAsset (DAS API) call.
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
      // Exact on-chain integer, preserved as a string (never a float64)
      // so downstream consumers can re-derive market cap precisely
      // instead of trusting a pre-rounded number.
      raw_supply: assetInfo?.rawSupply ?? null,
    },
  };

  const { data, error } = await supabase
    .from("tokens")
    .upsert(row, { onConflict: "mint_address" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase upsertToken error: ${JSON.stringify(error)}`);
  }

  return data.id as string;
}

/**
 * Inserts a new snapshot row for a token. Snapshots are append-only
 * (time-series), so this is always an insert, never an upsert.
 */
async function insertSnapshot(
  tokenId: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined,
  topHolders: Awaited<ReturnType<typeof getTopHolders>> | undefined,
  priceData: Awaited<ReturnType<typeof getPriceData>> | undefined
) {
  const priceUsd = priceData?.priceUsd ?? null;

  const marketCapUsd = computeMarketCapUsd(
    assetInfo?.rawSupply ?? null,
    assetInfo?.decimals ?? null,
    priceUsd
  );

  // Granular provenance packed into the single `source` text column.
  // Format: field:provider pairs, separated by "|". null-valued fields
  // are still listed so it's clear no data was silently dropped.
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
    // Intentionally null — top-20 largest accounts is not a total
    // holder count. Never infer this from array length.
    liquidity_usd: null,
    // Intentionally null — no reliable liquidity source wired up yet.
    volume_24h_usd: null,
    // Intentionally null — no verified market-data endpoint yet.
    holder_count: null,
    // Sample only, not exhaustive. UI must label this clearly.
    top_holders: topHolders ?? [],
    source: sourceParts.join("|"),
    snapshot_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("token_snapshots")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase insertSnapshot error: ${JSON.stringify(error)}`);
  }

  return data.id as string;
}

/**
 * Inserts a risk report row. risk_reports.risk_factors is a jsonb
 * column (default '[]') — here we intentionally store a structured
 * OBJECT ({ factors, confidence, caveats }) rather than a bare array,
 * since that's a strictly richer, still-valid jsonb shape and is what
 * the downstream API/frontend/Groq layer will actually consume.
 *
 * developer_risk_score and liquidity_risk_score are left null — the
 * risk engine does not evaluate those factors yet (Phase 2 scope is
 * authority + holder concentration + metadata only). ai_summary is
 * left null — Groq explanation is Phase 3, not wired yet.
 */
async function insertRiskReport(
  tokenId: string,
  assetInfo: Awaited<ReturnType<typeof getAssetInfo>> | undefined,
  topHolders: TopHolder[] | undefined
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
    developer_risk_score: null, // not evaluated yet — Phase "V2"
    liquidity_risk_score: null, // not evaluated yet — Phase 2 backlog
    holder_concentration_score: report.holder_concentration_score,
    risk_factors: report.risk_factors,
    ai_summary: null, // Groq explanation is Phase 3, not wired yet
    ai_model: null,
    generated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("risk_reports")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase insertRiskReport error: ${JSON.stringify(error)}`);
  }

  console.log("\n=== RISK REPORT (deterministic, no AI) ===");
  console.log(`Overall Risk: ${report.overall_risk_label} (score: ${report.overall_risk_score ?? "N/A"})`);
  console.log(`Confidence: ${report.confidence}%`);
  console.log("Findings:");
  for (const finding of report.findings) {
    console.log(`  • ${finding}`);
  }

  return { id: data.id as string, report };
}

/**
 * Calls the Groq explanation layer (with automatic deterministic
 * fallback) using the SAME facts already computed by the risk engine,
 * then updates the existing risk_reports row by id.
 *
 * Never overwrites deterministic columns (overall_risk_score,
 * developer_risk_score, liquidity_risk_score, holder_concentration_score,
 * risk_factors, generated_at) — only writes the ai_* columns.
 */
async function insertAiExplanation(riskReportId: string, report: RiskReport) {
  const explanation = await explainRiskReport({
    overallRiskScore: report.overall_risk_score,
    overallRiskLabel: report.overall_risk_label,
    confidence: report.confidence,
    findings: report.findings,
    caveats: report.risk_factors.caveats,
  });

const { error } = await supabase
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

  if (error) {
    throw new Error(`Supabase insertAiExplanation error: ${JSON.stringify(error)}`);
  }

  console.log(`\n=== AI EXPLANATION (provider: ${explanation.provider}, model: ${explanation.model}) ===`);
  console.log(`Headline: ${explanation.headline}`);
  console.log(`Summary: ${explanation.summary}`);
  console.log("Key Findings:");
  for (const f of explanation.key_findings) {
    console.log(`  • ${f}`);
  }
  console.log("Limitations:");
  for (const l of explanation.limitations) {
    console.log(`  • ${l}`);
  }

  return explanation;
}


async function main() {
  console.log(`\nFetching facts for mint: ${TEST_TOKEN_MINT}\n`);

  let assetInfo, topHolders, priceData;

  try {
    assetInfo = await getAssetInfo(TEST_TOKEN_MINT);
    console.log("getAssetInfo succeeded");
  } catch (err) {
    console.error("getAssetInfo FAILED:", err);
  }

  try {
    topHolders = await getTopHolders(TEST_TOKEN_MINT);
    console.log("getTopHolders succeeded");
  } catch (err) {
    console.error("getTopHolders FAILED:", err);
  }

  try {
    priceData = await getPriceData(TEST_TOKEN_MINT);
    console.log("getPriceData succeeded");
  } catch (err) {
    console.error("getPriceData FAILED:", err);
  }

  console.log("\n=== FETCHED FACTS ===");
  console.log(JSON.stringify({ assetInfo, topHolders, priceData }, null, 2));

  // If asset info completely failed, there's nothing meaningful to
  // key the token row on beyond the mint address itself — still try,
  // since mint_address alone is a valid row.
  console.log("\n=== SUPABASE INSERT ===");

  try {
    const tokenId = await upsertToken(TEST_TOKEN_MINT, assetInfo);
    console.log(`Token upserted. id = ${tokenId}`);

    const snapshotId = await insertSnapshot(
      tokenId,
      assetInfo,
      topHolders,
      priceData
    );
    console.log(`Snapshot inserted. id = ${snapshotId}`);

    const riskReportId = await insertRiskReport(tokenId, assetInfo, topHolders);
    console.log(`\nRisk report inserted. id = ${riskReportId.id}`);

    await insertAiExplanation(riskReportId.id, riskReportId.report);
    console.log(`\nAI explanation saved.`);

    console.log("\n=== DONE ===");
  } catch (err) {
    console.error("Supabase insert FAILED:", err);
    process.exit(1);
  }
}

main();