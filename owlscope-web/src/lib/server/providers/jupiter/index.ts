import "server-only";
import type { DiscoveredToken, MarketSnapshot, TokenDiscoveryProvider, TokenLookupResult } from "../types";
import { asNumber, asRecord, asString, fetchJson } from "../utils";
import { getPriceData } from "../../jupiter";

const TOKEN_LIST_URL = "https://tokens.jup.ag/tokens?tags=verified,community,strict,lst,unknown";

function mapToken(item: unknown): DiscoveredToken | null {
  const record = asRecord(item);
  const mint = asString(record.address) ?? asString(record.mint);
  if (!mint) return null;
  const now = new Date().toISOString();
  return { mintAddress: mint, name: asString(record.name), symbol: asString(record.symbol), logoUrl: asString(record.logoURI), decimals: asNumber(record.decimals), source: "jupiter", sourceKind: "token_list", sourceId: mint, discoveredAt: now, firstSeenAt: null, raw: record };
}

export const jupiterProvider: TokenDiscoveryProvider = {
  id: "jupiter",
  enabled: () => true,
  async discoverNewTokens() {
    const json = await fetchJson(TOKEN_LIST_URL, { next: { revalidate: 300 } });
    const list = Array.isArray(json) ? json : [];
    return list.flatMap((item) => mapToken(item) ?? []).slice(0, 250);
  },
  async lookupToken(query: string): Promise<TokenLookupResult | null> {
    const tokens = await this.discoverNewTokens();
    const q = query.toLowerCase();
    const found = tokens.find((token) => token.mintAddress === query || token.symbol?.toLowerCase() === q || token.name?.toLowerCase() === q) ?? null;
    return found ? { ...found, supply: null } : null;
  },
  async getMarketSnapshot(mintAddress: string): Promise<MarketSnapshot | null> {
    const price = await getPriceData(mintAddress);
    return { mintAddress, priceUsd: price.priceUsd, marketCapUsd: null, liquidityUsd: null, volume24hUsd: null, priceChange24hPercent: null, source: "jupiter", updatedAt: new Date().toISOString() };
  },
};
