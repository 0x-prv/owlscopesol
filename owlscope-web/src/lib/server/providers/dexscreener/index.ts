import "server-only";
import type { DiscoveredToken, MarketSnapshot, TokenDiscoveryProvider, TokenLookupResult } from "../types";
import { asNumber, asRecord, asString, fetchJson } from "../utils";

function pairs(json: unknown): unknown[] { const record = asRecord(json); return Array.isArray(record.pairs) ? record.pairs : []; }
function mapPair(pair: unknown): DiscoveredToken | null {
  const record = asRecord(pair); const base = asRecord(record.baseToken); const mint = asString(base.address); if (!mint) return null;
  const created = asNumber(record.pairCreatedAt); const now = new Date().toISOString();
  return { mintAddress: mint, name: asString(base.name), symbol: asString(base.symbol), logoUrl: asString(asRecord(record.info).imageUrl), decimals: null, source: "dexscreener", sourceKind: "pair", sourceId: asString(record.pairAddress), discoveredAt: now, firstSeenAt: created ? new Date(created).toISOString() : null, raw: record };
}
function mapMarket(mintAddress: string, pair: unknown): MarketSnapshot { const r = asRecord(pair); return { mintAddress, priceUsd: asNumber(r.priceUsd), marketCapUsd: asNumber(r.marketCap) ?? asNumber(r.fdv), liquidityUsd: asNumber(asRecord(r.liquidity).usd), volume24hUsd: asNumber(asRecord(r.volume).h24), priceChange24hPercent: asNumber(asRecord(r.priceChange).h24), source: "dexscreener", updatedAt: new Date().toISOString() }; }

export const dexscreenerProvider: TokenDiscoveryProvider = {
  id: "dexscreener",
  enabled: () => true,
  async discoverNewTokens() { const json = await fetchJson("https://api.dexscreener.com/token-profiles/latest/v1", { next: { revalidate: 120 } }); const list = Array.isArray(json) ? json : []; const now = new Date().toISOString(); return list.flatMap((item) => { const r = asRecord(item); if (asString(r.chainId) !== "solana") return []; const mint = asString(r.tokenAddress); return mint ? [{ mintAddress: mint, name: null, symbol: null, logoUrl: asString(r.icon), decimals: null, source: "dexscreener" as const, sourceKind: "new_listing" as const, sourceId: mint, discoveredAt: now, firstSeenAt: null, raw: r }] : []; }).slice(0, 100); },
  async lookupToken(query: string): Promise<TokenLookupResult | null> { const json = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`); const found = pairs(json).map(mapPair).find(Boolean) ?? null; return found ? { ...found, supply: null } : null; },
  async getMarketSnapshot(mintAddress: string) { const json = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mintAddress)}`); const first = pairs(json)[0]; return first ? mapMarket(mintAddress, first) : null; },
};
