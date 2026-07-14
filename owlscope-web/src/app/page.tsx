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

const WORKFLOW_STEPS = [
  { title: "Blockchain Data", description: "OwlScope starts with observable Solana token data and persisted snapshots." },
  { title: "Risk Engine", description: "Deterministic checks score measurable authority, holder, and metadata conditions." },
  { title: "Behavior Detection", description: "Persisted snapshots are compared to identify meaningful on-chain changes." },
  { title: "AI Explanation", description: "AI turns the calculated report into readable interpretation without changing risk." },
] as const;

const ROADMAP_ITEMS = [
  "Wallet Sign In",
  "Saved Analyses",
  "Watchlists",
  "Smart Alerts",
  "Risk History",
  "Historical Behavior Timeline",
  "Wallet Monitoring",
  "Developer Wallet Intelligence",
  "Liquidity Monitoring",
  "Portfolio Intelligence",
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
            Deterministic Solana Risk Intelligence
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Search any Solana token, generate deterministic risk analysis, view an AI Interpretation, and browse recent intelligence from persisted blockchain observations.
          </p>
        </div>
        <div className="mt-7 max-w-2xl">
          <SearchBar label="Search any Solana token" buttonLabel="Analyze" />
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
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Recent Intelligence</h2>
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


      <section aria-labelledby="how-owlscope-works" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Primary flow</p>
          <h2 id="how-owlscope-works" className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">How OwlScope Works</h2>
          <p className="mt-2 text-sm leading-6 text-muted">A focused intelligence workflow: Analyze → Risk Report → AI Interpretation → Intelligence Feed.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-border bg-background p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 font-mono text-sm font-semibold text-accent">{index + 1}</div>
              <h3 className="font-display text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-owlscope" className="rounded-2xl border border-border bg-background p-6 sm:p-8">
        <h2 id="why-owlscope" className="font-display text-2xl font-semibold tracking-tight text-foreground">Why OwlScope?</h2>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-muted md:grid-cols-3">
          <p className="rounded-xl bg-surface p-4">Blockchain explorers show transactions.</p>
          <p className="rounded-xl bg-surface p-4">Market trackers show prices.</p>
          <p className="rounded-xl bg-surface p-4 text-foreground">OwlScope explains observable blockchain behavior using deterministic analysis.</p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">Risk intelligence categories</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {INTELLIGENCE_CATEGORIES.map((category) => (
            <article key={category.title} className="rounded-xl border border-border bg-background p-5">
              <h3 className="font-display text-base font-semibold text-foreground">{category.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{category.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="roadmap" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Coming in future releases</p>
        <h2 id="roadmap" className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">Product roadmap</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">These capabilities are roadmap items only and are not part of the current MVP experience.</p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP_ITEMS.map((item) => (
            <li key={item} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
