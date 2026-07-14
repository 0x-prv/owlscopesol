import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import {
  EventCard,
  type BehaviorEventListItem,
} from "@/components/EventCard";
import { supabaseAdmin } from "@/lib/supabase-server";

export const revalidate = 30;

const FILTERS = [
  { label: "All events", value: "all" },
  { label: "Authorities", value: "authority_change" },
  { label: "Holders", value: "holder_concentration_spike" },
] as const;

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getEvents(
  filter: string,
): Promise<BehaviorEventListItem[]> {
  let query = supabaseAdmin
    .from("behavior_events")
    .select(
      "id, event_type, severity, confidence, title, summary, detected_at, tokens(symbol, mint_address)",
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

    if (!id || !title || !summary || !detectedAt) {
      return [];
    }

    const tokenRow = Array.isArray(row.tokens)
      ? row.tokens[0]
      : row.tokens;

    return [
      {
        id,
        eventType:
          asNullableString(row.event_type) ?? "unknown",
        severity: asNumber(row.severity, 1),
        confidence: asNumber(row.confidence, 0),
        title,
        summary,
        detectedAt,
        tokenSymbol: asNullableString(tokenRow?.symbol),
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

  const events = await getEvents(validFilter);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          OwlScope
        </h1>

        <p className="text-sm text-muted">
          Live Solana behavior events. No trading signals, no hype.
        </p>
      </div>

      <div className="mb-3">
        <SearchBar />
      </div>

      <p className="mb-5 text-xs text-muted">
        Search by mint, symbol, or name. OwlScope uses persisted
        intelligence first, then live provider lookup when needed.
        No fake rankings, no hype.
      </p>

      <nav className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={
              item.value === "all"
                ? "/"
                : `/?filter=${item.value}`
            }
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              validFilter === item.value
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-border text-muted hover:border-accent/40"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No behavior events detected yet for this filter.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
