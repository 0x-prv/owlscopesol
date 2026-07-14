export type JsonObject = Record<string, unknown>;

export type TokenOverview = {
  id: string;
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
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
  topHolders: { address: string; amount: string }[];
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
    warnings?: string[];
  };
};
export type DataAvailabilityWarning = {
  provider: string;
  operation: string;
  message: string;
};

export type TokenAnalysisApiResult = {
  token: {
    id: string;
    mintAddress: string;
    symbol: string | null;
    logoUrl: string | null;
    name: string | null;
    decimals: number | null;
    supply: string | null;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  };
  snapshot: {
    id: string;
    priceUsd: number | null;
    marketCapUsd: number | null;
    topHolders: { address: string; amount: string }[];
    capturedAt: string;
    source: string;
  };
  risk: {
    id: string;
    overallRiskScore: number | null;
    overallRiskLabel: "Low" | "Medium" | "High" | "Unknown";
    confidence: number;
    findings: string[];
    caveats: string[];
    factors: unknown;
  };
  ai: {
    headline: string;
    summary: string;
    findings: string[];
    limitations: string[];
    provider: string;
    model: string;
    generatedAt: string;
  };
  dataAvailabilityWarnings: DataAvailabilityWarning[];
};

export type TokenAnalysisApiResponse =
  | { success: true; data: TokenAnalysisApiResult; warnings: DataAvailabilityWarning[] }
  | { success: false; error: { code: string; message: string } };
