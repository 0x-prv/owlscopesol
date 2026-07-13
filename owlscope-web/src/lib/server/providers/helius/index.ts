import "server-only";
import type { DiscoveredToken, TokenDiscoveryProvider, TokenLookupResult } from "../types";
import { getAssetInfo } from "../../helius";

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const heliusProvider: TokenDiscoveryProvider = {
  id: "helius",
  enabled: () => Boolean(process.env.HELIUS_API_KEY),
  async discoverNewTokens(): Promise<DiscoveredToken[]> { return []; },
  async lookupToken(query: string): Promise<TokenLookupResult | null> {
    if (!MINT.test(query)) return null;
    const asset = await getAssetInfo(query);
    const now = new Date().toISOString();
    return { mintAddress: query, name: asset.name, symbol: asset.symbol, logoUrl: null, decimals: asset.decimals, supply: asset.rawSupply, source: "helius", sourceKind: "asset", sourceId: query, discoveredAt: now, firstSeenAt: null, raw: { mintAuthority: asset.mintAuthority, freezeAuthority: asset.freezeAuthority, isMutable: asset.isMutable } };
  },
};
