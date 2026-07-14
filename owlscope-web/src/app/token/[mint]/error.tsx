"use client";

import { useEffect } from "react";

export default function TokenPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for now - swap for real error reporting
    // (Sentry, etc.) when that's wired up.
    console.error("Token page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="font-display text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="text-sm text-muted">
        We couldn&apos;t load this token&apos;s data right now. This is a
        temporary issue on our end, not a problem with the token itself.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 active:opacity-80 transition"
      >
        Try again
      </button>
    </main>
  );
}