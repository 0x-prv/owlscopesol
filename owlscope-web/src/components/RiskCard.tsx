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
  Moderate: "var(--risk-medium)",
  Elevated: "var(--risk-medium)",
  High: "var(--risk-high)",
};

const CATEGORY_LABELS: Record<string, string> = {
  authority: "Authority Risk",
  holder_concentration: "Holder Concentration Risk",
  metadata: "Metadata Risk",
};

function statusLabel(score: number | null, available: boolean): string {
  if (!available || score === null) return "Not evaluated";
  if (score <= 24) return "Low";
  if (score <= 49) return "Moderate";
  if (score <= 74) return "Elevated";
  return "High";
}

function factorLabel(factor: FactorResult): string {
  return CATEGORY_LABELS[factor.category] ?? factor.factor.replace(/_/g, " ");
}

type RiskCardProps = {
  risk: TokenRiskReport | null;
};

export default function RiskCard({ risk }: RiskCardProps) {
  if (!risk) {
    return (
      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Overall On-Chain Risk
        </h2>
        <p className="mt-2 text-sm text-muted">
          No risk report is available for this token yet.
        </p>
      </section>
    );
  }

  const parsedFactors = isRiskFactorsShape(risk.factors) ? risk.factors : null;
  const evaluatedFactors = parsedFactors?.factors.filter((factor) => factor.data_available && factor.risk_score !== null) ?? [];
  const primaryFactor = evaluatedFactors.reduce<FactorResult | null>((highest, factor) => {
    if (!highest) return factor;
    return (factor.risk_score ?? -1) > (highest.risk_score ?? -1) ? factor : highest;
  }, null);
  const overallStatus = statusLabel(risk.score, risk.score !== null);

  return (
    <section className="rounded-lg border border-border bg-background p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Overall On-Chain Risk
      </h2>
      <p className="mt-1 text-sm text-muted">
        Computed deterministically from on-chain data. No AI is involved in scoring.
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <RiskGauge
          score={risk.score}
          level={risk.level}
          confidence={risk.confidence}
        />

        <div className="w-full flex-1">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Current assessment</p>
            <p className="mt-2 text-sm text-foreground">
              {overallStatus} risk based on the evaluated on-chain factors.
            </p>
            <p className="mt-3 text-sm text-muted">
              <span className="font-medium text-foreground">Primary watch item:</span>{" "}
              {primaryFactor ? `${factorLabel(primaryFactor)} is the largest contributor to the current score.` : "No evaluated category has a numeric contribution yet."}
            </p>
          </div>
        </div>
      </div>

      {parsedFactors ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {parsedFactors.factors.map((factor) => {
            const status = statusLabel(factor.risk_score, factor.data_available);
            return (
              <article key={factor.factor} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{factorLabel(factor)}</h3>
                    <span className="mt-1 inline-flex rounded-md bg-surface px-2 py-0.5 text-xs font-medium" style={{ color: LEVEL_COLOR[status] ?? "var(--risk-unknown)" }}>{status}</span>
                  </div>
                  {factor.data_available && factor.risk_score !== null ? (
                    <span className="font-mono text-sm font-semibold text-foreground">{factor.risk_score}/100</span>
                  ) : (
                    <span className="text-xs text-muted">Not evaluated</span>
                  )}
                </div>
                {factor.evidence.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {factor.evidence.map((line, index) => (
                      <li key={index} className="text-xs leading-5 text-muted before:mr-1.5 before:text-border before:content-['•']">{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted">No readable reasons are available for this category.</p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Risk factor breakdown is not available in a readable format.</p>
      )}

      {parsedFactors && parsedFactors.caveats.length > 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Known limitations</p>
          <ul className="flex flex-col gap-1">
            {parsedFactors.caveats.map((caveat, index) => (
              <li key={index} className="text-xs leading-5 text-muted">{caveat}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
