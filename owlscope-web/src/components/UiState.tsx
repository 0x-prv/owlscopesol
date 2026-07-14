import type { ReactNode } from "react";

export function EmptyState({ title, message, icon = "○" }: { title: string; message: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background text-lg text-muted shadow-sm" aria-hidden="true">{icon}</div>
      <h2 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}

export function ErrorState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-risk-high/30 bg-risk-high-bg p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background text-risk-high" aria-hidden="true">!</div>
      <h1 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-border/70 ${className}`} />;
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2"><SkeletonBlock className="h-5 w-20" /><SkeletonBlock className="h-5 w-16" /></div>
        <SkeletonBlock className="h-4 w-12" />
      </div>
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="mt-3 h-4 w-full" />
      <SkeletonBlock className="mt-2 h-4 w-5/6" />
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3"><SkeletonBlock className="h-7 w-36" /><SkeletonBlock className="h-4 w-24" /></div>
    </div>
  );
}

export function TokenRowSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3"><SkeletonBlock className="h-10 w-10 rounded-full" /><div><SkeletonBlock className="h-5 w-28" /><SkeletonBlock className="mt-2 h-3 w-44" /></div></div>
        <SkeletonBlock className="h-10 w-16" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[0,1,2,3].map((i) => <SkeletonBlock key={i} className="h-4" />)}</div>
    </div>
  );
}
