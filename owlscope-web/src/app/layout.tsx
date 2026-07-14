import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OwlScope — Solana Token Intelligence",
  description:
    "Blockchain provides facts. Backend calculates intelligence. AI explains. You decide.",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-md px-3 py-2 transition duration-150 hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{children}</Link>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="flex items-center gap-2 rounded-md font-display text-lg font-semibold transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
              <Image src="/owlslogo.jpg" alt="OwlScope" width={28} height={28} className="rounded-md" />
              OwlScope
            </Link>
            <details className="group relative sm:hidden">
              <summary className="flex cursor-pointer list-none items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Menu</summary>
              <div className="absolute right-0 mt-2 grid w-40 gap-1 rounded-lg border border-border bg-background p-2 text-sm text-muted shadow-lg">
                <NavLink href="/">Analyze</NavLink>
                <NavLink href="/new">New</NavLink>
                <NavLink href="/trending">Trending</NavLink>
              </div>
            </details>
            <div className="hidden gap-2 text-sm text-muted sm:flex">
              <NavLink href="/">Analyze</NavLink>
              <NavLink href="/new">New</NavLink>
              <NavLink href="/trending">Trending</NavLink>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}