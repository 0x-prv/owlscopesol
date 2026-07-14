import Link from "next/link";
import { notFound } from "next/navigation";
import { eventTypeLabel, severityStyle } from "@/components/EventCard";
import { supabaseAdmin } from "@/lib/supabase-server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type EvidenceRow = {
  id: string;
  evidence_type: string | null;
  source: string | null;
  before_value: JsonValue;
  after_value: JsonValue;
  created_at: string | null;
};

type EventRow = {
  id: string;
  event_type: string | null;
  severity: number | string | null;
  confidence: number | string | null;
  title: string | null;
  summary: string | null;
  detected_at: string | null;
  occurred_at?: string | null;
  created_at: string | null;
  tokens: { symbol: string | null; name: string | null; mint_address: string | null } | { symbol: string | null; name: string | null; mint_address: string | null }[] | null;
  behavior_event_evidence: EvidenceRow[] | null;
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatJson(value: JsonValue): string {
  return JSON.stringify(value ?? null, null, 2);
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const baseSelect =
    "id,event_type,severity,confidence,title,summary,detected_at,created_at,tokens(symbol,name,mint_address),behavior_event_evidence(id,evidence_type,source,before_value,after_value,created_at)";

  const queryById = (select: string) =>
    supabaseAdmin
      .from("behavior_events")
      .select(select)
      .eq("id", id)
      .order("created_at", { referencedTable: "behavior_event_evidence", ascending: true })
      .maybeSingle();

  let { data, error } = await queryById(
    baseSelect.replace("detected_at,", "detected_at,occurred_at,"),
  );

  if (error && error.message.includes("occurred_at")) {
    const retry = await queryById(baseSelect);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[event-detail] failed to load behavior event:", error.message);
    notFound();
  }

  if (!data) notFound();

  const event = data as unknown as EventRow;
  const severity = severityStyle(asNumber(event.severity, 0));
  const confidencePct = Math.round(asNumber(event.confidence, 0) * 100);
  const token = Array.isArray(event.tokens) ? event.tokens[0] : event.tokens;
  const evidence = event.behavior_event_evidence ?? [];
  const occurredAt = event.occurred_at ?? event.created_at;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm font-medium text-accent transition hover:opacity-80">
        ← Back to feed
      </Link>

      <article className="mt-6 rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${severity.bg} ${severity.text}`}>
            severity {severity.label}
          </span>
          <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted">
            {eventTypeLabel(event.event_type ?? "unknown")}
          </span>
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {event.title ?? "Behavior event"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">{event.summary ?? "No summary available."}</p>

        <dl className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Confidence</dt><dd className="mt-1 font-medium text-foreground">{confidencePct}%</dd></div>
          <div><dt className="text-xs text-muted">Token</dt><dd className="mt-1 font-mono text-foreground">{token?.symbol ? `$${token.symbol}` : token?.name ?? "Unavailable"}</dd></div>
          <div><dt className="text-xs text-muted">Detected</dt><dd className="mt-1 text-foreground">{formatDateTime(event.detected_at)}</dd></div>
          <div><dt className="text-xs text-muted">Occurred</dt><dd className="mt-1 text-foreground">{formatDateTime(occurredAt)}</dd></div>
        </dl>

        {token?.mint_address ? (
          <Link href={`/token/${token.mint_address}`} className="mt-6 inline-flex rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent transition hover:border-accent/40">
            View token intelligence
          </Link>
        ) : null}
      </article>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-foreground">Evidence trail</h2>
        <div className="mt-4 flex flex-col gap-4">
          {evidence.length === 0 ? (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted shadow-sm">No evidence rows are available for this event.</p>
          ) : evidence.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{item.evidence_type ?? "Evidence"}</span>
                <span className="text-xs text-muted">{item.source ?? "unknown source"}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="mb-1 text-xs text-muted">Before</p><pre className="overflow-x-auto rounded-xl border border-border bg-risk-unknown-bg p-3 font-mono text-xs text-foreground">{formatJson(item.before_value)}</pre></div>
                <div><p className="mb-1 text-xs text-muted">After</p><pre className="overflow-x-auto rounded-xl border border-border bg-risk-unknown-bg p-3 font-mono text-xs text-foreground">{formatJson(item.after_value)}</pre></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
