"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
type SearchRow = { mint_address: string; name: string | null; symbol: string | null };
type SearchPayload = { success: true; data: { results: SearchRow[] } } | { success: false; error: { message: string } };

export default function SearchBar({ initialValue = "", autoFocus = false }: { initialValue?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) { setError("Enter a token name, symbol, or mint address."); return; }
    if (MINT_ADDRESS_PATTERN.test(trimmed)) { router.push(`/token/${trimmed}`); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const payload = await response.json() as SearchPayload;
      if (!response.ok || !payload.success) throw new Error(payload.success ? "Search failed." : payload.error.message);
      const first = payload.data.results[0];
      if (!first) { setError("No real token source returned a match. Try a mint address."); return; }
      router.push(`/token/${first.mint_address}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Search is temporarily unavailable."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 shadow-sm transition duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-muted" aria-hidden="true">⌕</span>
          <input type="text" value={value} onChange={(event) => { setValue(event.target.value); if (error) setError(null); }} placeholder="Search mint, symbol, or token name" autoFocus={autoFocus} spellCheck={false} autoComplete="off" className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none" />
        </div>
        <button type="submit" disabled={busy} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-150 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Searching" : "Analyze"}</button>
      </div>
      {error ? <p role="alert" className="mt-2 rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high">{error}</p> : null}
    </form>
  );
}
