"use client";

import { useEffect, useState } from "react";
import { WatchlistButton } from "@/components/WatchlistButton";
import { RateWidget } from "@/components/RateWidget";
import { hasSessionCookie } from "@/lib/has-session-cookie";

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
    // Series pages are one of the most-visited page types on the site, and
    // this fires on every one of them for every visitor. The server route
    // would end up concluding "not signed in" for the same reason anyway —
    // skip the round-trip when there's plainly no session.
    if (!hasSessionCookie()) {
      setS({ signedIn: false, listStatus: null, myRating: null });
      return;
    }
    fetch(`/api/series-state?seriesId=${encodeURIComponent(seriesId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setS(d ?? { signedIn: false, listStatus: null, myRating: null }))
      .catch(() => setS({ signedIn: false, listStatus: null, myRating: null }));
  }, [seriesId]);

  return (
    <div className={`min-h-[188px] space-y-4 ${className}`}>
      {!s ? (
        <>
          <div className="h-10 w-44 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        </>
      ) : (
        <>
          <WatchlistButton seriesId={seriesId} initial={s.listStatus} signedIn={s.signedIn} />
          <RateWidget
            seriesId={seriesId}
            initial={s.myRating}
            signedIn={s.signedIn}
            avg={avg}
            count={count}
          />
        </>
      )}
    </div>
  );
}
