import "server-only";

export function asRecord(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function asString(value: unknown): string | null { return typeof value === "string" && value.trim().length > 0 ? value.trim() : null; }
export function asNumber(value: unknown): number | null { const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(n) ? n : null; }
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> { const response = await fetch(url, init); if (!response.ok) throw new Error(`${url} failed with status ${response.status}`); return response.json(); }
