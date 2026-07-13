import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OwlScope — Solana Token Intelligence",
  description:
    "Blockchain provides facts. Backend calculates intelligence. AI explains. You decide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="font-display text-lg font-semibold">
              OwlScope
            </Link>
            <div className="flex gap-4 text-sm text-muted">
              <Link href="/">Analyze</Link>
              <Link href="/new">New</Link>
              <Link href="/trending">Trending</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
