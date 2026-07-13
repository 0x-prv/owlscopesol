"use client";

import { useEffect, useState } from "react";
import AiSummaryCard from "@/components/AiSummaryCard";
import RiskCard from "@/components/RiskCard";
import TokenHeader from "@/components/TokenHeader";
import TopHoldersTable from "@/components/TopHoldersTable";
import type { TokenAnalysisApiResponse, TokenAnalysisApiResult, TokenIntelligenceResponse } from "@/types/token-intelligence";

type Props = { mintAddress: string };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TokenAnalysisApiResult };

export default function TokenAnalysisClient({ mintAddress }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/token/${encodeURIComponent(mintAddress)}`, { cache: "no-store" });
        const payload = (await response.json()) as TokenAnalysisApiResponse;
        if (cancelled) return;
        if (!response.ok || !payload.success) {
          setState({ status: "error", message: payload.success ? "Analysis incomplete" : payload.error.message });
          return;
        }
        setState({ status: "ready", data: payload.data });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Analysis incomplete" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [mintAddress]);

  if (state.status === "loading") {
    return <InfoState title="Analyzing token" message="Running deterministic risk analysis. Missing provider data will be marked unavailable." />;
  }

  if (state.status === "error") {
    return <InfoState title="Analysis incomplete" message={state.message} />;
  }

  const view = toViewModel(state.data);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <TokenHeader token={view.token} snapshot={view.snapshot} />
      <RiskCard risk={view.risk} />
      <TopHoldersTable topHolders={view.snapshot?.topHolders ?? []} token={view.token} />
      <AiSummaryCard ai={view.ai} />
      {state.data.dataAvailabilityWarnings.length > 0 ? (
        <section className="rounded-xl border border-border bg-background p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Data availability warnings</h2>
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

function toViewModel(data: TokenAnalysisApiResult): TokenIntelligenceResponse {
  return {
    token: {
      id: data.token.id,
      mintAddress: data.token.mintAddress,
      name: data.token.name,
      symbol: data.token.symbol,
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

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-24 text-center">
      <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}
