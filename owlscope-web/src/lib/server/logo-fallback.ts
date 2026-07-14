import "server-only";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function getJupiterLogo(mintAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.jup.ag/tokens/v1/token/${mintAddress}`);
    if (!response.ok) return null;
    const json = record(await response.json());
    return str(json.logoURI);
  } catch {
    return null;
  }
}

async function getDexScreenerLogo(mintAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (!response.ok) return null;
    const json = record(await response.json());
    const pairs = Array.isArray(json.pairs) ? json.pairs : [];
    for (const pair of pairs) {
      const info = record(record(pair).info);
      const imageUrl = str(info.imageUrl);
      if (imageUrl) return imageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves a logo URL for a mint address, trying (in order):
 * 1. An already-known value (e.g. cached in DB) - passed in as `known`.
 * 2. Jupiter token list.
 * 3. DexScreener token pairs.
 * Returns null only if none of the sources have an image.
 */
export async function resolveLogoUrl(mintAddress: string, known: string | null): Promise<string | null> {
  if (known) return known;
  const jupiterLogo = await getJupiterLogo(mintAddress);
  if (jupiterLogo) return jupiterLogo;
  return getDexScreenerLogo(mintAddress);
}