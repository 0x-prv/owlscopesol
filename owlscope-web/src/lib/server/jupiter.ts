import "server-only";

export type PriceData = { priceUsd: number | null };

export async function getPriceData(mintAddress: string): Promise<PriceData> {
  const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mintAddress}`);
  if (!response.ok) throw new Error(`Jupiter Price API failed with status ${response.status}`);
  const json = (await response.json()) as Record<string, { usdPrice?: unknown } | undefined>;
  const value = json[mintAddress]?.usdPrice;
  const priceUsd = typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
  return { priceUsd: priceUsd !== null && Number.isFinite(priceUsd) ? priceUsd : null };
}
