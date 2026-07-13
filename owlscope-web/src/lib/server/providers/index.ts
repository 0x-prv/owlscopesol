import "server-only";
import type { TokenDiscoveryProvider } from "./types";
import { birdeyeProvider } from "./birdeye";
import { dexscreenerProvider } from "./dexscreener";
import { heliusProvider } from "./helius";
import { jupiterProvider } from "./jupiter";
import { pumpFunProvider } from "./pumpfun";

export const tokenProviders: TokenDiscoveryProvider[] = [heliusProvider, jupiterProvider, dexscreenerProvider, birdeyeProvider, pumpFunProvider];
export type { DiscoveredToken, MarketSnapshot, ProviderId, TokenDiscoveryProvider, TokenLookupResult } from "./types";
