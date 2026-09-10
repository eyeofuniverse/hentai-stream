export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="h-full w-1/4 animate-[loadbar_1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
      <div className="h-7 w-44 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-surface/60" />
    </div>
  );
}
