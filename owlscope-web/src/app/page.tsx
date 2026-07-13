import SearchBar from "@/components/SearchBar";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
          OwlScope
        </h1>
        <p className="text-base text-muted sm:text-lg">
          Blockchain provides facts. Our engine calculates risk. AI explains
          it. You decide.
        </p>
      </div>

      <div className="w-full">
        <SearchBar autoFocus />
      </div>

      <p className="text-xs text-muted">
        Paste any Solana token mint address to get a deterministic risk
        report — no trading signals, no hype.
      </p>
    </main>
  );
}