import { formatRelativeTime, parseSourceString } from "@/lib/format";
import type { TokenIntelligenceResponse } from "@/types/token-intelligence";

type DataProvenanceProps = {
  snapshot: TokenIntelligenceResponse["snapshot"];
};

const SOURCE_LABELS: Record<string, string> = {
  price_usd: "Price source",
  market_cap_usd: "Market cap calculation source",
  top_holders: "Top-holder source",
  holder_count: "Holder count source",
  liquidity_usd: "Liquidity source",
  volume_24h_usd: "Volume source",
};

export default function DataProvenance({ snapshot }: DataProvenanceProps) {
  const sourceRows = parseSourceString(snapshot?.source ?? null);

  return (
    <section className="rounded-lg border border-border bg-background p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">Data Provenance</h2>
      <p className="mt-1 text-sm text-muted">Sources returned by the current snapshot and persisted with the analysis.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {sourceRows.map((row) => (
          <div key={row.field} className="rounded-lg bg-surface p-3">
            <dt className="text-xs text-muted">{SOURCE_LABELS[row.field] ?? row.field.replace(/_/g, " ")}</dt>
            <dd className="mt-1 break-words font-mono text-xs text-foreground">{row.status || "Unavailable"}</dd>
          </div>
        ))}
        {snapshot?.capturedAt ? (
          <div className="rounded-lg bg-surface p-3">
            <dt className="text-xs text-muted">Snapshot timestamp</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{formatRelativeTime(snapshot.capturedAt)}</dd>
          </div>
        ) : null}
      </dl>
      {sourceRows.length === 0 && !snapshot?.capturedAt ? (
        <p className="mt-4 text-sm text-muted">No provenance metadata is available for this snapshot.</p>
      ) : null}
    </section>
  );
}
