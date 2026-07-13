import type { AiExplanation } from "@/types/token-intelligence";

type AiSummaryCardProps = {
  ai: AiExplanation | null;
};

export default function AiSummaryCard({ ai }: AiSummaryCardProps) {
  if (!ai || !ai.summary) {
    return (
      <section className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center gap-2">
          <AiBadge />
          <h2 className="font-display text-lg font-semibold text-foreground">
            AI explanation
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          No AI explanation is available for this token yet.
        </p>
      </section>
    );
  }

  const findings = Array.isArray(ai.findings) ? ai.findings : [];
  const limitations = Array.isArray(ai.limitations) ? ai.limitations : [];

  return (
    <section className="rounded-xl border border-border bg-background p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AiBadge />
          <h2 className="font-display text-lg font-semibold text-foreground">
            AI explanation
          </h2>
        </div>
        {ai.provider || ai.model ? (
          <span className="font-mono text-[11px] text-muted">
            {ai.provider}
            {ai.provider && ai.model ? " · " : ""}
            {ai.model}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-muted">
        Generated from the deterministic risk report above. The AI explains
        the findings — it does not calculate or change the risk score.
      </p>

      {ai.headline ? (
        <p className="mt-4 font-display text-base font-medium text-foreground">
          {ai.headline}
        </p>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {ai.summary}
      </p>

      {findings.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-medium text-muted mb-2">Key findings</p>
          <ul className="flex flex-col gap-1.5">
            {findings.map((finding, index) => (
              <li
                key={index}
                className="text-sm text-foreground before:content-['•'] before:mr-1.5 before:text-border"
              >
                {finding}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div className="mt-4 rounded-lg bg-surface p-3">
          <p className="text-xs font-medium text-muted mb-1.5">
            Limitations
          </p>
          <ul className="flex flex-col gap-1">
            {limitations.map((limitation, index) => (
              <li key={index} className="text-xs text-muted">
                {limitation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </svg>
      AI
    </span>
  );
}