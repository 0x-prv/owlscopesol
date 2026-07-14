import Link from "next/link";

export type BehaviorEventListItem = {
  id: string;
  eventType: string;
  severity: number;
  confidence: number;
  title: string;
  summary: string;
  detectedAt: string;
  tokenSymbol: string | null;
  tokenMintAddress: string | null;
};

export function severityStyle(severity: number): { text: string; bg: string; label: string } {
  if (severity >= 4) return { text: "text-risk-high", bg: "bg-risk-high-bg", label: "high" };
  if (severity === 3) return { text: "text-risk-medium", bg: "bg-risk-medium-bg", label: "medium" };
  if (severity >= 1) return { text: "text-risk-low", bg: "bg-risk-low-bg", label: "low" };
  return { text: "text-risk-unknown", bg: "bg-risk-unknown-bg", label: "unknown" };
}

export function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    authority_change: "Authority",
    holder_concentration_spike: "Holders",
    liquidity_change: "Liquidity",
  };

  return labels[eventType] ?? "Behavior";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shorten(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function EventCard({ event }: { event: BehaviorEventListItem }) {
  const severity = severityStyle(event.severity);
  const confidencePct = Math.round(event.confidence * 100);

  return (
    <Link
      href={`/event/${event.id}`}
      className="group block rounded-xl border border-border bg-background px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${severity.bg} ${severity.text}`}>
            severity {severity.label}
          </span>
          <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted">
            {eventTypeLabel(event.eventType)}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted">{timeAgo(event.detectedAt)}</span>
      </div>

      <p className="mb-1.5 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-accent">{event.title}</p>
      <p className="mb-3 text-sm leading-6 text-muted">{event.summary}</p>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <span className="truncate font-mono text-muted">
          {event.tokenSymbol ? `$${event.tokenSymbol} · ` : ""}
          {event.tokenMintAddress ? shorten(event.tokenMintAddress) : "Token unavailable"}
        </span>
        <span className="shrink-0 font-medium text-accent">{confidencePct}% confidence</span>
      </div>
    </Link>
  );
}
