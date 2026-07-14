import type { TokenRiskReport } from "@/types/token-intelligence";
import RiskGauge from "./RiskGauge";

type FactorResult = {
  factor: string;
  category: string;
  risk_score: number | null;
  weight: number;
  data_available: boolean;
  evidence: string[];
};

type RiskFactorsShape = {
  factors: FactorResult[];
  confidence: number;
  caveats: string[];
};

function isRiskFactorsShape(value: unknown): value is RiskFactorsShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.factors) && Array.isArray(candidate.caveats);
}

const LEVEL_COLOR: Record<string, string> = {
  Low: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  High: "var(--risk-high)",
};

type RiskCardProps = {
  risk: TokenRiskReport | null;
};

export default function RiskCard({ risk }: RiskCardProps) {
  if (!risk) {
    return (
      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Risk assessment
        </h2>
        <p className="mt-2 text-sm text-muted">
          No risk report is available for this token yet.
        </p>
      </section>
    );
  }

  const parsedFactors = isRiskFactorsShape(risk.factors) ? risk.factors : null;

  return (
    <section className="rounded-lg border border-border bg-background p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Risk assessment
      </h2>
      <p className="mt-1 text-sm text-muted">
        Computed deterministically from on-chain data. No AI involved in
        scoring.
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <RiskGauge
          score={risk.score}
          level={risk.level}
          confidence={risk.confidence}
        />

        <div className="flex-1 w-full">
          {parsedFactors ? (
            <ul className="flex flex-col gap-3">
              {parsedFactors.factors.map((factor) => (
                <li
                  key={factor.factor}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground capitalize">
                      {factor.factor.replace(/_/g, " ")}
                    </span>
                    {factor.data_available && factor.risk_score !== null ? (
                      <span
                        className="font-mono text-xs font-medium"
                        style={{
                          color:
                            factor.risk_score >= 61
                              ? LEVEL_COLOR.High
                              : factor.risk_score >= 31
                                ? LEVEL_COLOR.Medium
                                : LEVEL_COLOR.Low,
                        }}
                      >
                        {factor.risk_score}/100
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        not evaluable
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {factor.evidence.map((line, index) => (
                      <li
                        key={index}
                        className="text-xs text-muted before:content-['•'] before:mr-1.5 before:text-border"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Risk factor breakdown is not available in a readable format.
            </p>
          )}
        </div>
      </div>

      {parsedFactors && parsedFactors.caveats.length > 0 ? (
        <div className="mt-6 rounded-lg bg-surface p-3">
          <p className="text-xs font-medium text-muted mb-1.5">
            Known limitations
          </p>
          <ul className="flex flex-col gap-1">
            {parsedFactors.caveats.map((caveat, index) => (
              <li key={index} className="text-xs text-muted">
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}