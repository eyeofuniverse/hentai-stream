/** Loading skeleton for the catalogue-style pages (browse / tag / studio). */
export function GridSkeleton() {
  return (
    <div className="mx-auto max-w-content px-4 py-8 lg:px-8">
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="h-full w-1/3 animate-[loadbar_1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
      <div className="h-7 w-52 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface/70" />
      <div className="mt-8 grid grid-cols-3 gap-x-3.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-2" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-surface/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
