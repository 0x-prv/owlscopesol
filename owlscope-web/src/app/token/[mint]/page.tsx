import TokenAnalysisClient from "@/components/TokenAnalysisClient";

const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type TokenPageProps = { params: Promise<{ mint: string }> };

export default async function TokenPage({ params }: TokenPageProps) {
  const { mint } = await params;

  if (!MINT_ADDRESS_PATTERN.test(mint)) {
    return <InfoState title="Invalid mint address" message="That doesn't look like a valid Solana mint address. Double-check the address and try again." />;
  }

  return <TokenAnalysisClient mintAddress={mint} />;
}

function InfoState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-24 text-center">
      <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
    </main>
  );
}
