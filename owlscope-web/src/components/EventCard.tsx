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

function severityStyle(severity: number): { text: string; bg: string; label: string } {
  if (severity >= 4) return { text: "text-risk-high", bg: "bg-risk-high-bg", label: "high" };
  if (severity === 3) return { text: "text-risk-medium", bg: "bg-risk-medium-bg", label: "medium" };
  if (severity >= 1) return { text: "text-risk-low", bg: "bg-risk-low-bg", label: "low" };
  return { text: "text-risk-unknown", bg: "bg-risk-unknown-bg", label: "unknown" };
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
      className="block rounded-xl border border-border bg-background px-4 py-3 shadow-sm hover:border-accent/40 transition"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${severity.bg} ${severity.text}`}>
          severity {severity.label}
        </span>
        <span className="text-xs text-muted">{timeAgo(event.detectedAt)}</span>
      </div>

      <p className="mb-1 text-sm font-medium text-foreground">{event.title}</p>
      <p className="mb-2 text-sm text-muted">{event.summary}</p>

      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-muted">
          {event.tokenSymbol ? `$${event.tokenSymbol} · ` : ""}
          {event.tokenMintAddress ? shorten(event.tokenMintAddress) : ""}
        </span>
        <span className="text-accent">{confidencePct}% confidence</span>
      </div>
    </Link>
  );
}