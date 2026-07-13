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

  return <form onSubmit={handleSubmit} className="w-full"><div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"><span className="text-muted">⌕</span><input type="text" value={value} onChange={(event) => { setValue(event.target.value); if (error) setError(null); }} placeholder="Search mint, symbol, or token name" autoFocus={autoFocus} spellCheck={false} autoComplete="off" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none" /><button type="submit" disabled={busy} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50">{busy ? "Searching" : "Analyze"}</button></div>{error ? <p role="alert" className="mt-2 text-sm text-risk-high">{error}</p> : null}</form>;
}
