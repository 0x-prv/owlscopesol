import { EventCardSkeleton } from "@/components/UiState";

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-3">
        <div className="h-9 w-40 animate-pulse rounded-md bg-border/70" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded-md bg-border/70" />
      </div>
      <div className="mb-8 h-14 animate-pulse rounded-lg bg-border/70" />
      <div className="space-y-4">{[0, 1, 2].map((item) => <EventCardSkeleton key={item} />)}</div>
    </main>
  );
}
