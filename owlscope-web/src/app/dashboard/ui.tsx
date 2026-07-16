import Link from "next/link";
export function short(v:string){return `${v.slice(0,4)}…${v.slice(-4)}`}
export function fmt(iso:string|null|undefined){return iso?new Date(iso).toLocaleString():"Unavailable"}
export function Shell({children}:{children:React.ReactNode}){return <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10"><nav className="flex gap-2 text-sm"><Link className="rounded-md border border-border px-3 py-2" href="/dashboard">Overview</Link><Link className="rounded-md border border-border px-3 py-2" href="/dashboard/analyses">Saved Analyses</Link><Link className="rounded-md border border-border px-3 py-2" href="/dashboard/watchlist">Watchlist</Link></nav>{children}</main>}
export function Risk({score,level}:{score:number|null,level:string|null}){return <span className="rounded-full border border-border px-2 py-1 text-xs">{score ?? "—"}/100 · {level ?? "Unavailable"}</span>}
