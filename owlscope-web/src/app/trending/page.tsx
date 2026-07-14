import TokenList from "@/components/TokenList";
import { TokenRowSkeleton } from "@/components/UiState";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const { data } = await supabaseAdmin.from("tokens").select("mint_address,name,symbol,logo_url,last_updated_at,token_snapshots(price_usd,market_cap_usd,liquidity_usd,volume_24h_usd,snapshot_at),risk_reports(overall_risk_score,overall_risk_label,confidence)").order("last_updated_at", { ascending: false }).limit(50);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Trending signals</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Ranked by available real internal updates and market signals. Missing metrics remain unavailable.</p>
      </div>
      <TokenList rows={(data ?? []) as []} />
    </main>
  );
}

export function TrendingPageSkeleton() {
  return <div className="grid gap-4">{[0, 1, 2].map((item) => <TokenRowSkeleton key={item} />)}</div>;
}
