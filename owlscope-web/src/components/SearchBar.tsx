"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type SearchBarProps = {
  initialValue?: string;
  autoFocus?: boolean;
};

export default function SearchBar({
  initialValue = "",
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = value.trim();

    if (!MINT_ADDRESS_PATTERN.test(trimmed)) {
      setError("Enter a valid Solana mint address.");
      return;
    }

    setError(null);
    router.push(`/token/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste a Solana token mint address"
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted placeholder:font-sans focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 active:opacity-80 transition"
        >
          Analyze
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-risk-high">
          {error}
        </p>
      ) : null}
    </form>
  );
}