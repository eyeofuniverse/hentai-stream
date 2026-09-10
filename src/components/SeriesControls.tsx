"use client";

import { useEffect, useState } from "react";
import { WatchlistButton } from "@/components/WatchlistButton";
import { RateWidget } from "@/components/RateWidget";

type State = {
  signedIn: boolean;
  listStatus:
    | "WATCHING"
    | "COMPLETED"
    | "PLAN_TO_WATCH"
    | "ON_HOLD"
    | "DROPPED"
    | null;
  myRating: number | null;
};

/** Personalised series-page controls. Fetched client-side so the series page
 *  stays static / ISR-cached. */
export function SeriesControls({
  seriesId,
  avg,
  count,
  className = "",
}: {
  seriesId: string;
  avg: number;
  count: number;
  className?: string;
}) {
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    fetch(`/api/series-state?seriesId=${seriesId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS({ signedIn: false, listStatus: null, myRating: null }));
  }, [seriesId]);

  if (!s) {
    return <div className={`h-10 w-40 animate-pulse rounded-xl bg-surface-2 ${className}`} />;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <WatchlistButton seriesId={seriesId} initial={s.listStatus} signedIn={s.signedIn} />
      <RateWidget
        seriesId={seriesId}
        initial={s.myRating}
        signedIn={s.signedIn}
        avg={avg}
        count={count}
      />
    </div>
  );
}
