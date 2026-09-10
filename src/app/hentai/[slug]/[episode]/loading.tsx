export default function Loading() {
  return (
    <main className="bg-bg">
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="h-full w-1/4 animate-[loadbar_1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
      <div className="border-b border-line bg-black/40">
        <div className="mx-auto max-w-6xl sm:px-4 sm:py-4 lg:px-8">
          <div className="aspect-video w-full animate-pulse bg-surface-2 sm:rounded-xl" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="h-6 w-2/3 animate-pulse rounded-lg bg-surface-2" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-surface/70" />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-surface/70" />
          </div>
          <div className="hidden h-64 animate-pulse rounded-xl bg-surface-2 lg:block" />
        </div>
      </div>
    </main>
  );
}
