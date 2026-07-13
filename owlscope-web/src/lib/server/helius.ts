import "server-only";
import type { TopHolder } from "./risk-engine";
import { getServerEnv } from "./env";

export type AssetInfo = {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  rawSupply: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isMutable: boolean | null;
};

type JsonRecord = Record<string, unknown>;

function preserveBigIntFields(rawText: string, fieldNames: string[]): string {
  return fieldNames.reduce((text, field) => {
    const regex = new RegExp(`("${field}"\\s*:\\s*)(-?\\d+)(?!\\d*")`, "g");
    return text.replace(regex, `$1"$2"`);
  }, rawText);
}

async function safeFetchJson(label: string, options: RequestInit, bigIntFields: string[] = []): Promise<JsonRecord> {
  const { HELIUS_API_KEY } = getServerEnv();
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, options);
  const rawText = await response.text();
  if (!rawText.trim()) throw new Error(`${label}: empty response body (status ${response.status})`);
  try { return JSON.parse(bigIntFields.length ? preserveBigIntFields(rawText, bigIntFields) : rawText) as JsonRecord; }
  catch { throw new Error(`${label}: response was not valid JSON (status ${response.status})`); }
}

function record(value: unknown): JsonRecord { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {}; }
function str(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export async function getAssetInfo(mintAddress: string): Promise<AssetInfo> {
  const json = await safeFetchJson("Helius getAsset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "owlscope-web", method: "getAsset", params: { id: mintAddress, displayOptions: { showFungible: true } } }) }, ["supply"]);
  if (json.error) throw new Error(`Helius getAsset error`);
  const asset = record(json.result);
  const content = record(asset.content);
  const metadata = record(content.metadata);
  const tokenInfo = record(asset.token_info);
  return {
    name: str(metadata.name),
    symbol: str(metadata.symbol) ?? str(tokenInfo.symbol),
    decimals: num(tokenInfo.decimals),
    rawSupply: tokenInfo.supply != null ? String(tokenInfo.supply) : null,
    mintAuthority: str(tokenInfo.mint_authority),
    freezeAuthority: str(tokenInfo.freeze_authority),
    isMutable: typeof asset.mutable === "boolean" ? asset.mutable : null,
  };
}

export async function getTopHolders(mintAddress: string, retries = 2): Promise<TopHolder[]> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const json = await safeFetchJson(`Helius getTokenLargestAccounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "owlscope-web", method: "getTokenLargestAccounts", params: [mintAddress] }) });
      if (json.error) throw new Error("Helius getTokenLargestAccounts error");
      const result = record(json.result);
      const accounts = Array.isArray(result.value) ? result.value : [];
      return accounts.flatMap((account) => {
        const acc = record(account);
        const address = str(acc.address);
        const amount = str(acc.uiAmountString);
        return address && amount ? [{ address, amount }] : [];
      });
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return [];
}
