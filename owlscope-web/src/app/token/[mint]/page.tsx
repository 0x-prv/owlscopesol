import RiskCard from "@/components/RiskCard";
import AiSummaryCard from "@/components/AiSummaryCard";
import TokenHeader from "@/components/TokenHeader";
import TopHoldersTable from "@/components/TopHoldersTable";
import AnalyzingState from "@/components/AnalyzingState";
import {
  getTokenIntelligence,
  TokenNotFoundError,
} from "@/services/token-intelligence-service";
import type { TokenIntelligenceResponse } from "@/types/token-intelligence";

const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type TokenPageProps = {
  params: Promise<{ mint: string }>;
};

export default async function TokenPage({ params }: TokenPageProps) {
  const { mint } = await params;

  if (!MINT_ADDRESS_PATTERN.test(mint)) {
    return (
      <InfoState
        title="Invalid mint address"
        message="That doesn't look like a valid Solana mint address. Double-check the address and try again."
      />
    );
  }

  let data: TokenIntelligenceResponse;

  try {
    data = await getTokenIntelligence(mint);
  } catch (error) {
  if (error instanceof TokenNotFoundError) {
  return <AnalyzingState mintAddress={mint} />;
}
    throw error;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <TokenHeader token={data.token} snapshot={data.snapshot} />
      <RiskCard risk={data.risk} />
      <TopHoldersTable
        topHolders={data.snapshot?.topHolders ?? []}
        token={data.token}
      />
      <AiSummaryCard ai={data.ai} />

      {data.metadata.lastUpdated ? (
        <p className="text-center text-xs text-muted">
          Last updated {new Date(data.metadata.lastUpdated).toLocaleString()}
        </p>
      ) : null}
    </main>
  );
}

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-24 text-center">
      <h1 className="font-display text-lg font-semibold text-foreground">
        {title}
      </h1>
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}