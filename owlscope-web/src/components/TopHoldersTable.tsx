import type { TokenOverview } from "@/types/token-intelligence";
import { formatNumber, formatPercent, truncateAddress } from "@/lib/format";

type Holder = {
  address: string;
  amount: string;
};

function isHolder(value: unknown): value is Holder {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.address === "string" &&
    typeof candidate.amount === "string"
  );
}

function getRawSupply(metadata: TokenOverview["metadata"]): string | null {
  if (!metadata) return null;
  const value = metadata.raw_supply;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function computeUiSupply(
  rawSupply: string | null,
  decimals: number | null,
): number | null {
  if (rawSupply === null || decimals === null) return null;
  try {
    const supplyBigInt = BigInt(rawSupply);
    const uiSupply = Number(supplyBigInt) / 10 ** decimals;
    return Number.isFinite(uiSupply) ? uiSupply : null;
  } catch {
    return null;
  }
}

type TopHoldersTableProps = {
  topHolders: Holder[];
  token: Pick<TokenOverview, "metadata" | "decimals">;
};

export default function TopHoldersTable({
  topHolders,
  token,
}: TopHoldersTableProps) {
  const holders = topHolders.filter(isHolder);
  const rawSupply = getRawSupply(token.metadata);
  const uiSupply = computeUiSupply(rawSupply, token.decimals);

  if (holders.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-background p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Largest holders
        </h2>
        <p className="mt-2 text-sm text-muted">
          Not provided by current data source.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-background p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Largest holders
      </h2>
      <p className="mt-1 text-sm text-muted">
        Top {holders.length} accounts by balance. This is not the total
        holder count.
      </p>

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {holders.map((holder, index) => {
          const amountNumber = Number(holder.amount);
          const percentage =
            uiSupply !== null && uiSupply > 0 && Number.isFinite(amountNumber)
              ? (amountNumber / uiSupply) * 100
              : null;

          return (
            <li
              key={holder.address}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">
                  {index + 1}
                </span>
                <span className="truncate font-mono text-sm text-foreground">
                  {truncateAddress(holder.address, 5)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm text-foreground">
                  {formatNumber(
                    Number.isFinite(amountNumber) ? amountNumber : null,
                  )}
                </span>
                <span className="w-14 text-right font-mono text-xs text-muted">
                  {percentage !== null ? formatPercent(percentage) : "Unavailable"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}