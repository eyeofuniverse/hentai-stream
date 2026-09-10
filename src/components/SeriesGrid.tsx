import { SeriesCard } from "@/components/SeriesCard";

type S = Parameters<typeof SeriesCard>[0]["series"];

export function SeriesGrid({ items, cols }: { items: S[]; cols?: "wide" | "sidebar" }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-white/40">
        Nothing here yet — try a different filter.
      </p>
    );
  }
  const grid =
    cols === "sidebar"
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";
  return (
    <div className={`grid gap-x-3.5 gap-y-6 ${grid}`}>
      {items.map((s) => (
        <SeriesCard key={s.slug} series={s} />
      ))}
    </div>
  );
}
