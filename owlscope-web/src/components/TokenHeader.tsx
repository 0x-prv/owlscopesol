"use client";

import { useState } from "react";
import TokenAvatar from "@/components/TokenAvatar";
import type { TokenOverview, TokenSnapshot } from "@/types/token-intelligence";
import { formatCompactUsd, formatUsd, truncateAddress } from "@/lib/format";

type TokenHeaderProps = {
  token: TokenOverview;
  snapshot: TokenSnapshot | null;
};

export default function TokenHeader({ token, snapshot }: TokenHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token.mintAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail silently (permissions, insecure
      // context) - not worth surfacing an error for a copy button.
    }
  }

  const mintRenounced = token.mintAuthority === null;
  const freezeRenounced = token.freezeAuthority === null;
  const hasHeliusMetadata = Boolean(token.metadata?.raw_supply);
  const mintAvailable = hasHeliusMetadata || token.mintAuthority !== null;
  const freezeAvailable = hasHeliusMetadata || token.freezeAuthority !== null;

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <TokenAvatar logoUrl={token.logoUrl} symbol={token.symbol} name={token.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {token.name ?? "Unknown token"}
          </h1>
          {token.symbol ? (
            <span className="font-mono text-sm text-muted">
              ${token.symbol}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted transition duration-150 hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          title={token.mintAddress}
        >
          {truncateAddress(token.mintAddress, 6)}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {copied ? (
              <path d="M20 6 9 17l-5-5" />
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
        </button>

        <div className="flex flex-wrap gap-2 pt-1">
          <AuthorityBadge label="Mint authority" renounced={mintRenounced} available={mintAvailable} />
          <AuthorityBadge label="Freeze authority" renounced={freezeRenounced} available={freezeAvailable} />
        </div>
        </div>
      </div>

      <div className="flex gap-6 sm:gap-8">
        <Stat label="Price" value={formatUsd(snapshot?.priceUsd ?? null)} />
        <Stat
          label="Market cap"
          value={formatCompactUsd(snapshot?.marketCapUsd ?? null)}
        />
      </div>
    </div>
  );
}

function AuthorityBadge({
  label,
  renounced,
  available,
}: {
  label: string;
  renounced: boolean;
  available: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: !available ? "var(--risk-unknown-bg)" : renounced ? "var(--risk-low-bg)" : "var(--risk-medium-bg)",
        color: !available ? "var(--risk-unknown)" : renounced ? "var(--risk-low)" : "var(--risk-medium)",
      }}
    >
      {label}: {!available ? "Unavailable" : renounced ? "renounced" : "active"}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-lg font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}