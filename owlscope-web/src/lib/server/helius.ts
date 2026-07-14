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

function heliusErrorMessage(json: JsonRecord, label: string): string {
  const error = record(json.error);
  const message = str(error.message);
  const code = error.code != null ? ` (${String(error.code)})` : "";
  return message ? `${label} error${code}: ${message}` : `${label} error`;
}

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

function topHoldersFromLargestAccounts(json: JsonRecord): TopHolder[] {
  const result = record(json.result);
  const accounts = Array.isArray(result.value) ? result.value : [];
  return accounts.flatMap((account) => {
    const acc = record(account);
    const address = str(acc.address);
    const amount = str(acc.uiAmountString);
    return address && amount ? [{ address, amount }] : [];
  });
}

function topHoldersFromTokenAccounts(json: JsonRecord, decimals: number | null): TopHolder[] {
  const result = record(json.result);
  const accounts = Array.isArray(result.token_accounts) ? result.token_accounts : [];
  const decimalPlaces = decimals !== null && Number.isInteger(decimals) && decimals >= 0 ? decimals : null;

  return accounts
    .flatMap((account) => {
      const acc = record(account);
      const address = str(acc.address);
      const rawAmount =
        typeof acc.amount === "number" || typeof acc.amount === "string" ? String(acc.amount) : null;
      if (!address || rawAmount === null) return [];

      let rawAmountBigInt: bigint;
      try {
        rawAmountBigInt = BigInt(rawAmount);
      } catch {
        return [];
      }

      const amount = decimalPlaces === null
        ? rawAmountBigInt.toString()
        : formatTokenAmount(rawAmountBigInt, decimalPlaces);
      return [{ address, amount, rawAmount: rawAmountBigInt }];
    })
    .sort((a, b) => (a.rawAmount === b.rawAmount ? 0 : a.rawAmount > b.rawAmount ? -1 : 1))
    .slice(0, 20)
    .map(({ address, amount }) => ({ address, amount }));
}

function formatTokenAmount(rawAmount: bigint, decimals: number): string {
  if (decimals === 0) return rawAmount.toString();
  const negative = rawAmount < BigInt(0);
  const digits = (negative ? -rawAmount : rawAmount).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export async function getTopHolders(mintAddress: string, retries = 2): Promise<TopHolder[]> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const json = await safeFetchJson(`Helius getTokenLargestAccounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "owlscope-web", method: "getTokenLargestAccounts", params: [mintAddress] }) });
      if (json.error) throw new Error(heliusErrorMessage(json, "Helius getTokenLargestAccounts"));
      return topHoldersFromLargestAccounts(json);
    } catch {
      if (attempt === retries) {
        const assetInfo = await getAssetInfo(mintAddress);
        const fallbackJson = await safeFetchJson(`Helius getTokenAccounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "owlscope-web", method: "getTokenAccounts", params: { mint: mintAddress, page: 1, limit: 1000, options: { showZeroBalance: false } } }) });
        if (fallbackJson.error) throw new Error(heliusErrorMessage(fallbackJson, "Helius getTokenAccounts"));
        return topHoldersFromTokenAccounts(fallbackJson, assetInfo.decimals);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return [];
}
