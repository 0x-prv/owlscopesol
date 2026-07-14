import Link from "next/link";
import TokenAvatar from "@/components/TokenAvatar";
import { EmptyState } from "@/components/UiState";

type Row = { mint_address: string; name: string | null; symbol: string | null; logo_url?: string | null; discovery_time?: string | null; first_seen_at?: string | null; last_updated_at?: string | null; token_snapshots?: { price_usd: number | null; market_cap_usd: number | null; liquidity_usd?: number | null; volume_24h_usd?: number | null; snapshot_at: string | null }[]; risk_reports?: { overall_risk_score: number | null; overall_risk_label: string | null; confidence: number | null }[] };

function value(input: unknown) { return input === null || input === undefined || input === "" ? "Unavailable" : String(input); }
function latest<T>(items: T[] | undefined): T | null { return items?.[0] ?? null; }
function riskBadgeClass(label?: string | null) { if (label === "High") return "bg-risk-high-bg text-risk-high"; if (label === "Medium") return "bg-risk-medium-bg text-risk-medium"; if (label === "Low") return "bg-risk-low-bg text-risk-low"; return "bg-risk-unknown-bg text-risk-unknown"; }

export default function TokenList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState icon="◌" title="No tokens available" message="No persisted real tokens are available for this view yet. Search a token or run discovery to populate this page." />;
  }

  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const snapshot = latest(row.token_snapshots);
        const risk = latest(row.risk_reports);
        return (
          <Link key={row.mint_address} href={`/token/${row.mint_address}`} className="group rounded-lg border border-border bg-background p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <TokenAvatar logoUrl={row.logo_url} symbol={row.symbol} name={row.name} size="md" />
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground transition-colors group-hover:text-accent">{value(row.symbol ?? row.name)}</p>
                  <p className="truncate font-mono text-xs text-muted">{row.mint_address}</p>
                </div>
              </div>
              <div className={`w-fit rounded-md px-2.5 py-1 text-sm font-medium ${riskBadgeClass(risk?.overall_risk_label)}`}>Risk {value(risk?.overall_risk_score)} · {value(risk?.overall_risk_label)}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs text-muted sm:grid-cols-4">
              <Meta label="Price" value={value(snapshot?.price_usd)} />
              <Meta label="Market cap" value={value(snapshot?.market_cap_usd)} />
              <Meta label="Liquidity" value={value(snapshot?.liquidity_usd)} />
              <Meta label="Seen" value={value(row.discovery_time ?? row.first_seen_at ?? row.last_updated_at)} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <p><span className="font-medium text-foreground">{label}:</span> {value}</p>; }
