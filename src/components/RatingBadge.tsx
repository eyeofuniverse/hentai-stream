/**
 * A compact score chip. Prefers our own Bayesian rating once it has real votes,
 * otherwise the external (MyAnimeList) score. Server component — no interactivity.
 */
export function RatingBadge({
  score,
  votes,
  size = "md",
  source,
}: {
  score: number | null | undefined;
  votes?: number | null;
  size?: "sm" | "md" | "lg";
  source?: string | null;
}) {
  if (score == null || score <= 0) return null;
  const s = Math.round(score * 10) / 10;
  const pad = size === "lg" ? "px-3 py-1.5 text-base gap-1.5" : size === "sm" ? "px-1.5 py-0.5 text-[11px] gap-0.5" : "px-2 py-1 text-sm gap-1";
  const star = size === "lg" ? 16 : size === "sm" ? 10 : 13;

  return (
    <span
      className={`inline-flex items-center rounded-lg bg-warn/15 font-bold text-warn ${pad}`}
      title={
        votes
          ? `${s} from ${votes.toLocaleString()} ${source === "mal" ? "MyAnimeList " : ""}ratings`
          : `${s}${source === "mal" ? " · MyAnimeList" : ""}`
      }
    >
      <svg width={star} height={star} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l3 6.9 7.6.7-5.7 5 1.7 7.4L12 18l-6.6 4 1.7-7.4-5.7-5 7.6-.7z" />
      </svg>
      {s.toFixed(1)}
      {votes ? (
        <span className="font-medium text-warn/60">
          ({votes > 999 ? `${(votes / 1000).toFixed(1)}k` : votes})
        </span>
      ) : null}
    </span>
  );
}
