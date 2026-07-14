"use client";

import { useState } from "react";

type TokenAvatarProps = {
  logoUrl?: string | null;
  symbol?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

function fallbackLetter(symbol?: string | null, name?: string | null): string {
  const candidate = symbol?.trim() || name?.trim() || "?";
  return candidate.charAt(0).toUpperCase();
}

export default function TokenAvatar({ logoUrl, symbol, name, size = "md" }: TokenAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;
  const className = `${sizeClasses[size]} shrink-0 overflow-hidden rounded-full border border-border bg-risk-unknown-bg`;

  if (showImage) {
    return (
      <img
        src={logoUrl ?? undefined}
        alt={symbol ? `${symbol} token logo` : name ? `${name} token logo` : "Token logo"}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <span
      aria-label={symbol ? `${symbol} token fallback avatar` : "Token fallback avatar"}
      className={`${className} inline-flex items-center justify-center font-mono font-semibold text-risk-unknown`}
    >
      {fallbackLetter(symbol, name)}
    </span>
  );
}
