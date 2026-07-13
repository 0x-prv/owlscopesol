export type JsonObject = Record<string, unknown>;

export type TokenOverview = {
  id: string;
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadata: JsonObject | null;
  updatedAt: string | null;
};

export type TokenSnapshot = {
  id: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  holderCount: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  topHolders: unknown[];
  source: string | null;
  capturedAt: string | null;
};

export type TokenRiskReport = {
  id: string;
  score: number | null;
  level: string | null;
  confidence: number | null;
  factors: unknown;
  modelVersion: string | null;
  calculatedAt: string | null;
};

export type AiExplanation = {
  headline: string | null;
  summary: string | null;
  findings: string[];
  limitations: string[];
  provider: string | null;
  model: string | null;
  generatedAt: string | null;
};

export type TokenIntelligenceResponse = {
  token: TokenOverview;
  snapshot: TokenSnapshot | null;
  risk: TokenRiskReport | null;
  ai: AiExplanation | null;
  metadata: {
    lastUpdated: string | null;
    sources: string | null;
  };
};