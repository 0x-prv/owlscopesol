import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import {
  EventCard,
  type BehaviorEventListItem,
} from "@/components/EventCard";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatNumber, formatRelativeTime } from "@/lib/format";

export const revalidate = 30;

const FILTERS = [
  { label: "All events", value: "all" },
  { label: "Authorities", value: "authority_change" },
  { label: "Holders", value: "holder_concentration_spike" },
] as const;

const INTELLIGENCE_CATEGORIES = [
  {
    title: "Authority Risk",
    description: "Checks whether mint or freeze permissions remain active or have changed.",
  },
  {
    title: "Holder Concentration",
    description: "Measures visible ownership concentration from the largest accounts available to the system.",
  },
  {
    title: "Metadata Integrity",
    description: "Verifies whether essential token metadata is present and readable.",
  },
];

type SystemStatus = {
  tokensAnalyzed: number | null;
  riskReportsGenerated: number | null;
  behaviorEventsDetected: number | null;
  latestScanTime: string | null;
};

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getCount(table: "tokens" | "risk_reports" | "behavior_events"): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error(`[homepage] failed to count ${table}:`, error.message);
    return null;
  }

  return typeof count === "number" ? count : null;
}

async function getSystemStatus(): Promise<SystemStatus> {
  const [tokensAnalyzed, riskReportsGenerated, behaviorEventsDetected, latestSnapshot] = await Promise.all([
    getCount("tokens"),
    getCount("risk_reports"),
    getCount("behavior_events"),
    supabaseAdmin
      .from("token_snapshots")
      .select("snapshot_at")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (latestSnapshot.error) {
    console.error("[homepage] failed to load latest snapshot:", latestSnapshot.error.message);
  }

  return {
    tokensAnalyzed,
    riskReportsGenerated,
    behaviorEventsDetected,
    latestScanTime: asNullableString(latestSnapshot.data?.snapshot_at),
  };
}

async function getEvents(
  filter: string,
): Promise<BehaviorEventListItem[]> {
  let query = supabaseAdmin
    .from("behavior_events")
    .select(
      "id, event_type, severity, confidence, title, summary, detected_at, tokens(symbol, name, logo_url, mint_address)",
    )
    .order("detected_at", { ascending: false })
    .limit(50);

  if (filter !== "all") {
    query = query.eq("event_type", filter);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[homepage] failed to load behavior_events:",
      error.message,
    );

    return [];
  }

  return (data ?? []).flatMap((row) => {
    const id = asNullableString(row.id);
    const title = asNullableString(row.title);
    const summary = asNullableString(row.summary);
    const detectedAt = asNullableString(row.detected_at);
    const eventType = asNullableString(row.event_type);

    if (!id || !title || !summary || !detectedAt || !eventType) {
      return [];
    }

    const tokenRow = Array.isArray(row.tokens)
      ? row.tokens[0]
      : row.tokens;

    return [
      {
        id,
        eventType,
        severity: asNumber(row.severity, 1),
        confidence: asNumber(row.confidence, 0),
        title,
        summary,
        detectedAt,
        tokenSymbol: asNullableString(tokenRow?.symbol),
        tokenName: asNullableString(tokenRow?.name),
        tokenLogoUrl: asNullableString(tokenRow?.logo_url),
        tokenMintAddress: asNullableString(
          tokenRow?.mint_address,
        ),
      } satisfies BehaviorEventListItem,
    ];
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;

  const validFilter = FILTERS.some(
    (item) => item.value === filter,
  )
    ? filter
    : "all";

  const [events, status] = await Promise.all([getEvents(validFilter), getSystemStatus()]);
  const statusItems = [
    status.tokensAnalyzed !== null ? { label: "Tokens analyzed", value: formatNumber(status.tokensAnalyzed) } : null,
    status.riskReportsGenerated !== null ? { label: "Risk reports generated", value: formatNumber(status.riskReportsGenerated) } : null,
    status.behaviorEventsDetected !== null ? { label: "Behavior events detected", value: formatNumber(status.behaviorEventsDetected) } : null,
    status.latestScanTime ? { label: "Latest scan time", value: formatRelativeTime(status.latestScanTime) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:py-14">
      <section className="rounded-2xl border border-border bg-surface px-5 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Solana intelligence dashboard</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Solana Token Intelligence, Explained
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Analyze live on-chain behavior, identify measurable token risks, and understand what changed without relying on hype or market prompts.
          </p>
        </div>
        <div className="mt-7 max-w-2xl">
          <SearchBar label="Search by mint, symbol, or token name" buttonLabel="Analyze Token" />
          <p className="mt-3 text-xs leading-5 text-muted">
            Deterministic risk scoring from observable Solana data. AI explains the findings but never calculates the score.
          </p>
        </div>
      </section>

      <section aria-label="Live system status" className="rounded-xl border border-border bg-background p-4">
        {statusItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statusItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-surface p-4">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No persisted scans yet.</p>
        )}
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Latest On-Chain Intelligence</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Observable token behavior changes detected from persisted Solana snapshots.</p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Intelligence filters">
            {FILTERS.map((item) => (
              <Link key={item.value} href={item.value === "all" ? "/" : `/?filter=${item.value}`} className={`rounded-md border px-3 py-1.5 text-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${validFilter === item.value ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:border-accent/40"}`}>{item.label}</Link>
            ))}
          </nav>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center">
            <p className="font-display text-lg font-semibold text-foreground">No behavior changes detected yet.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">OwlScope records new intelligence when persisted token snapshots reveal measurable authority or holder concentration changes.</p>
            <Link href="/" className="mt-5 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Analyze a Token</Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">What OwlScope Evaluates</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {INTELLIGENCE_CATEGORIES.map((category) => (
            <article key={category.title} className="rounded-xl border border-border bg-background p-5">
              <h3 className="font-display text-base font-semibold text-foreground">{category.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{category.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
