import "server-only";
import type { DiscoveredToken, TokenDiscoveryProvider } from "../types";
import { asNumber, asRecord, asString, fetchJson } from "../utils";

export const pumpFunProvider: TokenDiscoveryProvider = {
  id: "pumpfun",
  enabled: () => true,
  async discoverNewTokens(): Promise<DiscoveredToken[]> {
    const json = await fetchJson("https://frontend-api-v3.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false", { next: { revalidate: 60 } });
    const items = Array.isArray(json) ? json : [];
    const now = new Date().toISOString();
    return items.flatMap((item) => { const r = asRecord(item); const mint = asString(r.mint); const created = asNumber(r.created_timestamp); return mint ? [{ mintAddress: mint, name: asString(r.name), symbol: asString(r.symbol), logoUrl: asString(r.image_uri), decimals: 6, source: "pumpfun" as const, sourceKind: "launch" as const, sourceId: mint, discoveredAt: now, firstSeenAt: created ? new Date(created).toISOString() : null, raw: r }] : []; });
  },
};
