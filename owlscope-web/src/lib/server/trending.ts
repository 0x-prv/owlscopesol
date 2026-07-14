import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { asNumber, asRecord, asString, fetchJson } from "./providers/utils";
import { jupiterProvider } from "./providers/jupiter";

export type TrendingRisk = { score: number | null; label: string | null; generatedAt: string | null };
export type TrendingToken = { rank: number; mintAddress: string; tokenName: string | null; tokenSymbol: string | null; tokenLogoUrl: string | null; tokenCategory: string | null; trendingScore: number; priceUsd: number | null; priceChangePercent: number | null; priceChangeTimeframe: string; volumeUsd: number | null; volumeTimeframe: string; liquidityUsd: number | null; tradeCount: number | null; rankingComponents: Record<string, number>; rankingReason: string; source: string; sourceTimestamp: string; risk: TrendingRisk | null };
export type TrendingResult = { tokens: TrendingToken[]; provider: string; rankingTimeframe: string; sourceTimestamp: string | null; lastSuccessfulRefresh: string | null; status: "current" | "cached" | "unavailable"; error?: string; candidateCount?: number; eligibleCount?: number };
type Candidate = Omit<TrendingToken, "rank" | "trendingScore" | "rankingComponents" | "rankingReason" | "risk"> & { marketCapUsd: number | null };
type JupiterToken = Awaited<ReturnType<typeof jupiterProvider.discoverNewTokens>>[number];

const PROVIDER = "Jupiter token discovery + DexScreener markets";
const RANKING_TIMEFRAME = "24 hours";
const DEXSCREENER_BATCH_SIZE = 30;
const DEXSCREENER_BATCH_DELAY_MS = 250;
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function finite(value: number | null): value is number { return typeof value === "number" && Number.isFinite(value); }
function positive(value: number | null) { return finite(value) && value > 0; }
function normalize(value: number, max: number) { return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function chunks<T>(items: T[], size: number) { const out: T[][] = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out; }

function buildReason(token: TrendingToken) { const labels: Record<string, string> = { volume: "high verified 24-hour volume", tradeActivity: "elevated 24-hour buys and sells", liquidity: "strong verified liquidity", priceMovement: "absolute 24-hour price movement", marketCap: "available verified market cap or FDV" }; const parts = Object.entries(token.rankingComponents).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => labels[key]).filter(Boolean); return `Ranked for ${parts.join(", ")}.`; }

function pairTokenAddress(pair: Record<string, unknown>, side: "baseToken" | "quoteToken") { return asString(asRecord(pair[side]).address); }
function pairLiquidity(pair: Record<string, unknown>) { return asNumber(asRecord(pair.liquidity).usd); }
function pairVolume24h(pair: Record<string, unknown>) { return asNumber(asRecord(pair.volume).h24); }
function pairTradeCount24h(pair: Record<string, unknown>) { const txns = asRecord(asRecord(pair.txns).h24); const buys = asNumber(txns.buys); const sells = asNumber(txns.sells); return finite(buys) || finite(sells) ? (buys ?? 0) + (sells ?? 0) : null; }
function isSolanaPairForMint(pair: Record<string, unknown>, mint: string) { return asString(pair.chainId) === "solana" && (pairTokenAddress(pair, "baseToken") === mint || pairTokenAddress(pair, "quoteToken") === mint); }
function chooseCanonicalPair(pairs: unknown[], mint: string) { return pairs.map(asRecord).filter((pair) => isSolanaPairForMint(pair, mint)).sort((a, b) => (pairLiquidity(b) ?? -1) - (pairLiquidity(a) ?? -1) || (pairVolume24h(b) ?? -1) - (pairVolume24h(a) ?? -1))[0] ?? null; }

function mapCandidate(token: JupiterToken, pair: Record<string, unknown>, sourceTimestamp: string): Candidate | null {
  const mint = token.mintAddress;
  if (!MINT_RE.test(mint)) return null;
  const volumeUsd = pairVolume24h(pair);
  const liquidityUsd = pairLiquidity(pair);
  const tradeCount = pairTradeCount24h(pair);
  const priceUsd = asNumber(pair.priceUsd);
  const priceChangePercent = asNumber(asRecord(pair.priceChange).h24);
  const marketCapUsd = asNumber(pair.marketCap) ?? asNumber(pair.fdv);
  if (![volumeUsd, liquidityUsd, tradeCount, priceUsd, priceChangePercent, marketCapUsd].some(finite)) return null;
  if (![volumeUsd, liquidityUsd, tradeCount].some(positive)) return null;
  return { mintAddress: mint, tokenName: token.name, tokenSymbol: token.symbol, tokenLogoUrl: token.logoUrl, tokenCategory: null, priceUsd, priceChangePercent, priceChangeTimeframe: "24h", volumeUsd, volumeTimeframe: "24h", liquidityUsd, tradeCount, marketCapUsd, source: PROVIDER, sourceTimestamp };
}

async function fetchDexScreenerPairs(mints: string[]) {
  const results = new Map<string, unknown[]>();
  for (const [index, batch] of chunks(mints, DEXSCREENER_BATCH_SIZE).entries()) {
    if (index > 0) await sleep(DEXSCREENER_BATCH_DELAY_MS);
    const json = await fetchJson(`https://api.dexscreener.com/tokens/v1/solana/${batch.map(encodeURIComponent).join(",")}`, { next: { revalidate: 120 } });
    const pairs = Array.isArray(json) ? json : [];
    for (const pair of pairs) {
      const record = asRecord(pair);
      for (const mint of batch) if (isSolanaPairForMint(record, mint)) results.set(mint, [...(results.get(mint) ?? []), record]);
    }
  }
  return results;
}

function score(candidates: Candidate[]): TrendingToken[] { const maxima = { volume: Math.max(...candidates.map((c) => c.volumeUsd ?? 0)), tradeActivity: Math.max(...candidates.map((c) => c.tradeCount ?? 0)), liquidity: Math.max(...candidates.map((c) => c.liquidityUsd ?? 0)), priceMovement: Math.max(...candidates.map((c) => Math.abs(c.priceChangePercent ?? 0))), marketCap: Math.max(...candidates.map((c) => c.marketCapUsd ?? 0)) }; const base = { volume: 0.35, tradeActivity: 0.25, liquidity: 0.2, priceMovement: 0.1, marketCap: 0.1 }; return candidates.map((c) => { const raw: Record<keyof typeof base, number | null> = { volume: finite(c.volumeUsd) ? normalize(c.volumeUsd, maxima.volume) : null, tradeActivity: finite(c.tradeCount) ? normalize(c.tradeCount, maxima.tradeActivity) : null, liquidity: finite(c.liquidityUsd) ? normalize(c.liquidityUsd, maxima.liquidity) : null, priceMovement: finite(c.priceChangePercent) ? normalize(Math.abs(c.priceChangePercent), maxima.priceMovement) : null, marketCap: finite(c.marketCapUsd) ? normalize(c.marketCapUsd, maxima.marketCap) : null }; const available = Object.entries(raw).filter(([, v]) => v !== null && v > 0) as [keyof typeof base, number][]; const weightTotal = available.reduce((sum, [k]) => sum + base[k], 0); const rankingComponents = Object.fromEntries(available.map(([k, v]) => [k, Math.round((base[k] / weightTotal) * v * 10000) / 100])); const trendingScore = Math.round(Object.values(rankingComponents).reduce((a, b) => a + b, 0) * 100) / 100; return { mintAddress: c.mintAddress, tokenName: c.tokenName, tokenSymbol: c.tokenSymbol, tokenLogoUrl: c.tokenLogoUrl, tokenCategory: c.tokenCategory, priceUsd: c.priceUsd, priceChangePercent: c.priceChangePercent, priceChangeTimeframe: c.priceChangeTimeframe, volumeUsd: c.volumeUsd, volumeTimeframe: c.volumeTimeframe, liquidityUsd: c.liquidityUsd, tradeCount: c.tradeCount, source: c.source, sourceTimestamp: c.sourceTimestamp, rank: 0, trendingScore, rankingComponents, rankingReason: "", risk: null }; }).sort((a, b) => b.trendingScore - a.trendingScore || (b.volumeUsd ?? -1) - (a.volumeUsd ?? -1) || a.mintAddress.localeCompare(b.mintAddress)).slice(0, 10).map((t, i) => ({ ...t, rank: i + 1, rankingReason: buildReason({ ...t, rank: i + 1 }) })); }
async function attachRisk(tokens: TrendingToken[]) { if (!tokens.length) return tokens; const { data } = await supabaseAdmin.from("tokens").select("mint_address,risk_reports(overall_risk_score,overall_risk_label,generated_at)").in("mint_address", tokens.map((t) => t.mintAddress)); const map = new Map<string, TrendingRisk>(); for (const row of (data ?? []) as { mint_address: string; risk_reports?: { overall_risk_score: number | null; overall_risk_label: string | null; generated_at: string | null }[] }[]) { const latest = [...(row.risk_reports ?? [])].sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0]; if (latest) map.set(row.mint_address, { score: latest.overall_risk_score, label: latest.overall_risk_label, generatedAt: latest.generated_at }); } return tokens.map((t) => ({ ...t, risk: map.get(t.mintAddress) ?? null })); }
async function persist(tokens: TrendingToken[]) { if (!tokens.length) return; await supabaseAdmin.from("trending_snapshots").insert(tokens.map((t) => ({ mint_address: t.mintAddress, token_name: t.tokenName, token_symbol: t.tokenSymbol, token_logo_url: t.tokenLogoUrl, token_category: t.tokenCategory, rank: t.rank, trending_score: t.trendingScore, price_usd: t.priceUsd, price_change_percent: t.priceChangePercent, price_change_timeframe: t.priceChangeTimeframe, volume_usd: t.volumeUsd, volume_timeframe: t.volumeTimeframe, liquidity_usd: t.liquidityUsd, trade_count: t.tradeCount, ranking_components: t.rankingComponents, ranking_reason: t.rankingReason, source: t.source, source_timestamp: t.sourceTimestamp }))); }
async function cached(): Promise<TrendingResult | null> { const { data } = await supabaseAdmin.from("trending_snapshots").select("*").order("created_at", { ascending: false }).limit(100); const latestCreated = (data?.[0] as { created_at?: string } | undefined)?.created_at; if (!latestCreated) return null; const rows = (data ?? []).filter((r) => (r as { created_at?: string }).created_at === latestCreated).sort((a, b) => ((a as { rank: number }).rank - (b as { rank: number }).rank)); const tokens = await attachRisk(rows.map((r) => ({ rank: r.rank, mintAddress: r.mint_address, tokenName: r.token_name, tokenSymbol: r.token_symbol, tokenLogoUrl: r.token_logo_url, tokenCategory: r.token_category, trendingScore: Number(r.trending_score), priceUsd: r.price_usd, priceChangePercent: r.price_change_percent, priceChangeTimeframe: r.price_change_timeframe, volumeUsd: r.volume_usd, volumeTimeframe: r.volume_timeframe, liquidityUsd: r.liquidity_usd, tradeCount: r.trade_count, rankingComponents: r.ranking_components ?? {}, rankingReason: r.ranking_reason, source: r.source, sourceTimestamp: r.source_timestamp, risk: null }))); return { tokens, provider: PROVIDER, rankingTimeframe: RANKING_TIMEFRAME, sourceTimestamp: tokens[0]?.sourceTimestamp ?? null, lastSuccessfulRefresh: latestCreated, status: "cached" }; }
export async function getTrendingTokens(): Promise<TrendingResult> { try { const sourceTimestamp = new Date().toISOString(); const discovered = await jupiterProvider.discoverNewTokens(); const metadataByMint = new Map(discovered.filter((token) => MINT_RE.test(token.mintAddress)).map((token) => [token.mintAddress, token])); const pairMap = await fetchDexScreenerPairs([...metadataByMint.keys()]); const candidates = [...metadataByMint.values()].flatMap((token) => { const pair = chooseCanonicalPair(pairMap.get(token.mintAddress) ?? [], token.mintAddress); return pair ? mapCandidate(token, pair, sourceTimestamp) ?? [] : []; }); const tokens = await attachRisk(score(candidates)); if (tokens.length < 10) throw new Error(`Only ${tokens.length} eligible Jupiter-discovered tokens had active DexScreener markets`); await persist(tokens); return { tokens, provider: PROVIDER, rankingTimeframe: RANKING_TIMEFRAME, sourceTimestamp, lastSuccessfulRefresh: new Date().toISOString(), status: "current", candidateCount: metadataByMint.size, eligibleCount: candidates.length }; } catch (error) { return (await cached()) ?? { tokens: [], provider: PROVIDER, rankingTimeframe: RANKING_TIMEFRAME, sourceTimestamp: null, lastSuccessfulRefresh: null, status: "unavailable", error: error instanceof Error ? error.message : "Unknown provider failure" }; } }
