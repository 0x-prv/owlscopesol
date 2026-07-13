/**
 * Formatting helpers for displaying token intelligence data.
 * These are presentation-only — they never invent values. A null
 * input always produces the "not available" fallback, never a guess.
 */

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (value !== 0 && Math.abs(value) < 0.01) {
    // Very small prices (common for new tokens) need more precision
    // than 2 decimals, or they'd all display as "$0.00".
    return `$${value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}%`;
}

export function truncateAddress(address: string | null, chars = 4): string {
  if (!address) {
    return "—";
  }

  if (address.length <= chars * 2 + 3) {
    return address;
  }

  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) {
    return "—";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Parses the pipe-delimited provenance string produced by the fetch
 * pipeline, e.g. "price_usd:jupiter_price_v3|holder_count:unavailable(...)".
 * Returns null if the string is empty/malformed rather than guessing.
 */
export function parseSourceString(
  source: string | null,
): { field: string; status: string }[] {
  if (!source) {
    return [];
  }

  return source
    .split("|")
    .map((part) => {
      const [field, ...rest] = part.split(":");
      return { field: field?.trim() ?? "", status: rest.join(":").trim() };
    })
    .filter((entry) => entry.field.length > 0);
}