import "server-only";

export type ProviderId = "helius" | "jupiter" | "dexscreener" | "pumpfun";
export type TokenSourceKind = "asset" | "token_list" | "new_listing" | "pair" | "launch" | "pool" | "search";

export type DiscoveredToken = {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
  decimals: number | null;
  source: ProviderId;
  sourceKind: TokenSourceKind;
  sourceId: string | null;
  discoveredAt: string;
  firstSeenAt: string | null;
  raw: Record<string, unknown>;
};

export type MarketSnapshot = {
  mintAddress: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24hPercent: number | null;
  source: ProviderId;
  updatedAt: string;
};

export type TokenLookupResult = DiscoveredToken & { supply: string | null };

export type ProviderHealth = { ok: true } | { ok: false; error: string };

export type TokenDiscoveryProvider = {
  id: ProviderId;
  enabled(): boolean;
  discoverNewTokens(): Promise<DiscoveredToken[]>;
  lookupToken?(query: string): Promise<TokenLookupResult | null>;
  getMarketSnapshot?(mintAddress: string): Promise<MarketSnapshot | null>;
};
