/**
 * OwlScope Token Risk Engine v1
 * ------------------------------------------------------------
 * PURE deterministic logic. No AI. No LLM. No I/O (no fetch, no DB).
 * This module only transforms already-fetched facts into a structured
 * risk report. Groq (Phase 3) explains this output in natural language
 * — it never generates the score itself.
 *
 * Rule: if a factor cannot be evaluated from available data, its
 * risk_score is null and it is excluded from the overall aggregate —
 * never defaulted to 0 (safe) or 100 (unsafe). Missing evidence is
 * not a verdict.
 * ------------------------------------------------------------
 */

export interface TopHolder {
  address: string;
  amount: string; // ui-scaled amount, as returned by getTokenLargestAccounts
}

export interface RiskEngineInput {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  assetInfoAvailable: boolean; // false if getAsset call failed entirely
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  rawSupply: string | null; // exact integer string
  topHolders: TopHolder[] | undefined; // undefined if getTopHolders failed
}

interface FactorResult {
  factor: string;
  category: "authority" | "holder_concentration" | "metadata";
  risk_score: number | null; // 0-100, null = not evaluable
  weight: number; // relative importance when aggregating
  data_available: boolean;
  evidence: string[];
}

export interface RiskReport {
  overall_risk_score: number | null;
  overall_risk_label: "Low" | "Medium" | "High" | "Unknown";
  holder_concentration_score: number | null;
  confidence: number; // 0-100, simple: % of factors with usable data
  findings: string[]; // flat, human-readable, deterministic facts
  risk_factors: {
    factors: FactorResult[];
    confidence: number;
    caveats: string[];
  };
}

/**
 * Converts exact raw supply string + decimals into a ui-scaled number.
 * Same approach as market cap computation — BigInt until the final
 * unavoidable float step.
 */
export function toUiSupply(rawSupply: string | null, decimals: number | null): number | null {
  if (rawSupply === null || decimals === null || !Number.isFinite(decimals)) {
    return null;
  }
  let rawSupplyBigInt: bigint;
  try {
    rawSupplyBigInt = BigInt(rawSupply);
  } catch {
    return null;
  }
  const uiSupply = Number(rawSupplyBigInt) / 10 ** decimals;
  return Number.isFinite(uiSupply) ? uiSupply : null;
}

export function computeTopHolderPct(
  topHolders: TopHolder[] | undefined,
  uiSupply: number | null,
  count: number
): number | null {
  if (!topHolders || topHolders.length === 0 || uiSupply === null || uiSupply <= 0) return null;

  const amounts = topHolders
    .map((h) => Number(h.amount))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  if (amounts.length === 0) return null;

  const holderSum = amounts.slice(0, count).reduce((sum, n) => sum + n, 0);
  return (holderSum / uiSupply) * 100;
}

/**
 * Authority risk: mint/freeze authority still active = tokens can still
 * be minted or transfers can still be frozen by a single address.
 */
function evaluateAuthorityRisk(
  mintAuthority: string | null,
  freezeAuthority: string | null,
  assetInfoAvailable: boolean
): FactorResult {
  if (!assetInfoAvailable) {
    return {
      factor: "authority_risk",
      category: "authority",
      risk_score: null,
      weight: 0.4,
      data_available: false,
      evidence: ["Authority data unavailable — asset info fetch failed"],
    };
  }

  const mintActive = mintAuthority !== null;
  const freezeActive = freezeAuthority !== null;

  let riskScore: number;
  const evidence: string[] = [];

  if (mintActive && freezeActive) {
    riskScore = 100;
  } else if (mintActive || freezeActive) {
    riskScore = 55;
  } else {
    riskScore = 0;
  }

  evidence.push(
    mintActive
      ? "Mint authority still enabled — additional tokens may be minted"
      : "Mint authority renounced"
  );
  evidence.push(
    freezeActive
      ? "Freeze authority still enabled — transfers may be frozen by authority address"
      : "Freeze authority renounced"
  );

  return {
    factor: "authority_risk",
    category: "authority",
    risk_score: riskScore,
    weight: 0.4,
    data_available: true,
    evidence,
  };
}

/**
 * Holder concentration risk: computed ONLY from the top 20 largest
 * accounts visible via getTokenLargestAccounts. This is a SAMPLE, not
 * the total holder base — every finding derived from this factor must
 * say "visible top holders", never imply completeness.
 */
function evaluateHolderConcentration(
  topHolders: TopHolder[] | undefined,
  uiSupply: number | null
): FactorResult {
  if (!topHolders || topHolders.length === 0 || uiSupply === null || uiSupply <= 0) {
    return {
      factor: "holder_concentration_risk",
      category: "holder_concentration",
      risk_score: null,
      weight: 0.4,
      data_available: false,
      evidence: ["Holder concentration unavailable — top holders or supply data missing"],
    };
  }

  const amounts = topHolders
    .map((h) => Number(h.amount))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  if (amounts.length === 0) {
    return {
      factor: "holder_concentration_risk",
      category: "holder_concentration",
      risk_score: null,
      weight: 0.4,
      data_available: false,
      evidence: ["Holder concentration unavailable — holder amounts were not numeric"],
    };
  }

  const top1Percent = computeTopHolderPct(topHolders, uiSupply, 1);
  const top5Percent = computeTopHolderPct(topHolders, uiSupply, 5);
  const top10Percent = computeTopHolderPct(topHolders, uiSupply, 10);

  if (top1Percent === null || top5Percent === null || top10Percent === null) {
    return {
      factor: "holder_concentration_risk",
      category: "holder_concentration",
      risk_score: null,
      weight: 0.4,
      data_available: false,
      evidence: ["Holder concentration unavailable — holder amounts were not numeric"],
    };
  }

  let riskScore: number;
  if (top1Percent >= 50) riskScore = 100;
  else if (top1Percent >= 20) riskScore = 70;
  else if (top1Percent >= 10) riskScore = 40;
  else if (top10Percent >= 80) riskScore = 55;
  else riskScore = 15;

  return {
    factor: "holder_concentration_risk",
    category: "holder_concentration",
    risk_score: riskScore,
    weight: 0.4,
    data_available: true,
    evidence: [
      `Largest visible wallet holds ${top1Percent.toFixed(1)}% of supply`,
      `Top 5 visible wallets hold ${top5Percent.toFixed(1)}% of supply`,
      `Top 10 visible wallets hold ${top10Percent.toFixed(1)}% of supply`,
    ],
  };
}

/**
 * Metadata completeness: missing name/symbol/decimals reduces trust in
 * the rest of the data pipeline for this token.
 */
function evaluateMetadataCompleteness(
  name: string | null,
  symbol: string | null,
  decimals: number | null
): FactorResult {
  const fields = [name, symbol, decimals];
  const missingCount = fields.filter((f) => f === null || f === undefined).length;

  if (missingCount === fields.length) {
    return {
      factor: "metadata_risk",
      category: "metadata",
      risk_score: null,
      weight: 0.2,
      data_available: false,
      evidence: ["Metadata unavailable — asset info fetch may have failed"],
    };
  }

  const riskScore = missingCount === 0 ? 0 : missingCount === 1 ? 40 : 80;

  return {
    factor: "metadata_risk",
    category: "metadata",
    risk_score: riskScore,
    weight: 0.2,
    data_available: true,
    evidence: [
      missingCount === 0
        ? "Token metadata is complete (name, symbol, decimals present)"
        : `Token metadata is incomplete — ${missingCount} of ${fields.length} core fields missing`,
    ],
  };
}

function labelFromScore(score: number | null): RiskReport["overall_risk_label"] {
  if (score === null) return "Unknown";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";
  return "Low";
}

/**
 * Aggregates available factors into an overall risk score via
 * weighted average, renormalized across only the factors that had
 * usable data. Confidence = simple % of factors with data available.
 */
export function computeRiskReport(input: RiskEngineInput): RiskReport {
  const uiSupply = toUiSupply(input.rawSupply, input.decimals);

  const authority = evaluateAuthorityRisk(
    input.mintAuthority,
    input.freezeAuthority,
    input.assetInfoAvailable
  );
  const holderConcentration = evaluateHolderConcentration(input.topHolders, uiSupply);
  const metadata = evaluateMetadataCompleteness(input.name, input.symbol, input.decimals);

  const factors = [authority, holderConcentration, metadata];
  const evaluableFactors = factors.filter((f) => f.data_available && f.risk_score !== null);

  let overallRiskScore: number | null = null;
  if (evaluableFactors.length > 0) {
    const totalWeight = evaluableFactors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = evaluableFactors.reduce(
      (sum, f) => sum + (f.risk_score as number) * f.weight,
      0
    );
    overallRiskScore = totalWeight > 0 ? weightedSum / totalWeight : null;
  }

  // Simple confidence: % of defined factors that had usable data.
  const confidence = Math.round((evaluableFactors.length / factors.length) * 100);

  const findings = factors.flatMap((f) => f.evidence);

  const caveats: string[] = [
    "Holder concentration is computed from the top 20 largest visible accounts only, not the total holder base — total holder count is not currently available.",
    "Liquidity, trading behavior, and developer wallet history are not yet evaluated in this version of the risk engine.",
  ];

  return {
    overall_risk_score: overallRiskScore !== null ? Math.round(overallRiskScore * 100) / 100 : null,
    overall_risk_label: labelFromScore(overallRiskScore),
    holder_concentration_score: holderConcentration.risk_score,
    confidence,
    findings,
    risk_factors: {
      factors,
      confidence,
      caveats,
    },
  };
}
