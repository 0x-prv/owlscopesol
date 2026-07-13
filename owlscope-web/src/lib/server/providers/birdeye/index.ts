import "server-only";
import type { DiscoveredToken, TokenDiscoveryProvider } from "../types";
import { asNumber, asRecord, asString, fetchJson } from "../utils";

export const birdeyeProvider: TokenDiscoveryProvider = {
  id: "birdeye",
  enabled: () => Boolean(process.env.BIRDEYE_API_KEY),
  async discoverNewTokens(): Promise<DiscoveredToken[]> {
    const key = process.env.BIRDEYE_API_KEY;
    if (!key) return [];
    const json = await fetchJson("https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=50", { headers: { "X-API-KEY": key, "x-chain": "solana" }, next: { revalidate: 120 } });
    const data = asRecord(json).data; const items = Array.isArray(data) ? data : Array.isArray(asRecord(data).items) ? asRecord(data).items as unknown[] : [];
    const now = new Date().toISOString();
    return items.flatMap((item) => { const r = asRecord(item); const mint = asString(r.address) ?? asString(r.mint); return mint ? [{ mintAddress: mint, name: asString(r.name), symbol: asString(r.symbol), logoUrl: asString(r.logoURI) ?? asString(r.logo_uri), decimals: asNumber(r.decimals), source: "birdeye" as const, sourceKind: "new_listing" as const, sourceId: mint, discoveredAt: now, firstSeenAt: asNumber(r.created_time) ? new Date(Number(r.created_time) * 1000).toISOString() : null, raw: r }] : []; });
  },
};
