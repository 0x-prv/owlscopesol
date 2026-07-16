export const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function normalizeMintAddress(value: unknown): string | null { if (typeof value !== "string") return null; const mint = value.trim(); return MINT_ADDRESS_PATTERN.test(mint) ? mint : null; }
export function isUuid(value: string) { return UUID_PATTERN.test(value); }
export function pageParams(search: URLSearchParams) { const page = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1); const requested = Number.parseInt(search.get("limit") ?? "20", 10) || 20; const limit = Math.min(50, Math.max(1, requested)); return { page, limit, from: (page - 1) * limit, to: page * limit - 1 }; }
