"use client";

import { useCallback, useEffect, useState } from "react";
import AiSummaryCard from "@/components/AiSummaryCard";
import RiskCard from "@/components/RiskCard";
import DataProvenance from "@/components/DataProvenance";
import TokenHeader from "@/components/TokenHeader";
import TopHoldersTable from "@/components/TopHoldersTable";
import { ErrorState, SkeletonBlock } from "@/components/UiState";
import type { TokenAnalysisApiResponse, TokenAnalysisApiResult, TokenIntelligenceResponse } from "@/types/token-intelligence";

type Props = { mintAddress: string };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TokenAnalysisApiResult };

export default function TokenAnalysisClient({ mintAddress }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/token/${encodeURIComponent(mintAddress)}`, { cache: "no-store" });
      const payload = (await response.json()) as TokenAnalysisApiResponse;
      if (!response.ok || !payload.success) {
        setState({ status: "error", message: payload.success ? "Analysis incomplete" : payload.error.message });
        return;
      }
      setState({ status: "ready", data: payload.data });
    } catch {
      setState({ status: "error", message: "Analysis incomplete" });
    }
  }, [mintAddress]);

  useEffect(() => {
    let cancelled = false;
    async function loadIfCurrent() {
      await load();
      if (cancelled) return;
    }
    void loadIfCurrent();
    return () => { cancelled = true; };
  }, [load]);

  if (state.status === "loading") {
    return <TokenAnalysisSkeleton />;
  }

  if (state.status === "error") {
    return <main className="mx-auto max-w-md px-4 py-24"><ErrorState title="Analysis incomplete" message="We could not load this token analysis right now. The token may not have a completed persisted report yet, or a data provider may be unavailable." action={<button type="button" onClick={() => void load()} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Try again</button>} /></main>;
  }

  const view = toViewModel(state.data);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <TokenHeader token={view.token} snapshot={view.snapshot} />
      <RiskCard risk={view.risk} />
      <AiSummaryCard ai={view.ai} />
      <CurrentAssessment risk={view.risk} />
      <TopHoldersTable topHolders={view.snapshot?.topHolders ?? []} token={view.token} />
      <DataProvenance snapshot={view.snapshot} />
      {state.data.dataAvailabilityWarnings.length > 0 ? (
        <section className="rounded-xl border border-border bg-background p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Known Limitations</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {state.data.dataAvailabilityWarnings.map((item) => (
              <li key={`${item.provider}-${item.operation}`}>{item.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-center text-xs text-muted">Last updated {new Date(view.metadata.lastUpdated ?? state.data.ai.generatedAt).toLocaleString()}</p>
    </main>
  );
}

function CurrentAssessment({ risk }: { risk: TokenIntelligenceResponse["risk"] }) {
  const factors = typeof risk?.factors === "object" && risk.factors !== null && Array.isArray((risk.factors as { factors?: unknown }).factors)
    ? ((risk.factors as { factors: Array<{ category?: string; risk_score?: number | null; data_available?: boolean }> }).factors)
    : [];
  const evaluated = factors.filter((factor) => factor.data_available && typeof factor.risk_score === "number");

  return (
    <section className="rounded-xl border border-border bg-background p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">Current Assessment</h2>
      <p className="mt-2 text-sm leading-6 text-muted">The score summarizes deterministic risk factors available in the latest persisted analysis. AI Interpretation explains this report; it does not calculate, edit, or override the score.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface p-3"><dt className="text-xs text-muted">Score meaning</dt><dd className="mt-1 text-sm font-medium text-foreground">{risk?.score ?? "Unavailable"}/100 · {risk?.level ?? "Not evaluated"}</dd></div>
        <div className="rounded-lg bg-surface p-3"><dt className="text-xs text-muted">Contributors</dt><dd className="mt-1 text-sm font-medium text-foreground">{evaluated.length ? `${evaluated.length} evaluated factors` : "No numeric factors available"}</dd></div>
        <div className="rounded-lg bg-surface p-3"><dt className="text-xs text-muted">AI role</dt><dd className="mt-1 text-sm font-medium text-foreground">Explanation only</dd></div>
      </dl>
    </section>
  );
}

function toViewModel(data: TokenAnalysisApiResult): TokenIntelligenceResponse {
  return {
    token: {
      id: data.token.id,
      mintAddress: data.token.mintAddress,
      name: data.token.name,
      symbol: data.token.symbol,
      logoUrl: data.token.logoUrl,
      decimals: data.token.decimals,
      mintAuthority: data.token.mintAuthority,
      freezeAuthority: data.token.freezeAuthority,
      metadata: { raw_supply: data.token.supply },
      updatedAt: data.snapshot.capturedAt,
    },
    snapshot: {
      id: data.snapshot.id,
      priceUsd: data.snapshot.priceUsd,
      marketCapUsd: data.snapshot.marketCapUsd,
      holderCount: null,
      liquidityUsd: null,
      volume24hUsd: null,
      topHolders: data.snapshot.topHolders,
      source: data.snapshot.source,
      capturedAt: data.snapshot.capturedAt,
    },
    risk: {
      id: data.risk.id,
      score: data.risk.overallRiskScore,
      level: data.risk.overallRiskLabel,
      confidence: data.risk.confidence,
      factors: data.risk.factors,
      modelVersion: "risk-engine-v1",
      calculatedAt: data.ai.generatedAt,
    },
    ai: data.ai,
    metadata: { lastUpdated: data.ai.generatedAt, sources: data.snapshot.source, warnings: data.dataAvailabilityWarnings.map((item) => item.message) },
  };
}

function TokenAnalysisSkeleton() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <section className="border-b border-border pb-6">
        <div className="flex items-center gap-3"><SkeletonBlock className="h-12 w-12 rounded-full" /><div><SkeletonBlock className="h-7 w-48" /><SkeletonBlock className="mt-2 h-5 w-36" /></div></div>
        <div className="mt-6 grid grid-cols-2 gap-4"><SkeletonBlock className="h-12" /><SkeletonBlock className="h-12" /></div>
      </section>
      {[0, 1, 2].map((item) => <section key={item} className="rounded-lg border border-border bg-background p-6"><SkeletonBlock className="h-6 w-40" /><SkeletonBlock className="mt-4 h-24 w-full" /></section>)}
    </main>
  );
}
