import { cookies } from "next/headers";
import Link from "next/link";

export default async function DashboardPage() {
  const hasCookie = Boolean((await cookies()).get("owlscope_session"));
  return <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10"><h1 className="font-display text-4xl font-semibold">Dashboard</h1><p className="text-muted">{hasCookie ? "Wallet session detected. Phase 2 dashboard features are intentionally not enabled yet." : "Connect a Solana wallet to access the protected dashboard."}</p><Link className="text-accent" href="/intelligence">Return to public intelligence</Link></main>;
}
