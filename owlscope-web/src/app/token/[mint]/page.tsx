import TokenAnalysisClient from "@/components/TokenAnalysisClient";
import { ErrorState } from "@/components/UiState";

const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type TokenPageProps = { params: Promise<{ mint: string }> };

export default async function TokenPage({ params }: TokenPageProps) {
  const { mint } = await params;

  if (!MINT_ADDRESS_PATTERN.test(mint)) {
    return <main className="mx-auto max-w-md px-4 py-24"><ErrorState title="Invalid mint address" message="That does not look like a valid Solana mint address. Double-check the address and try again." /></main>;
  }

  return <TokenAnalysisClient mintAddress={mint} />;
}
