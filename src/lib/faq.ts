import type { QA } from "@/components/seo/Faq";
import { SITE_NAME } from "@/lib/seo";

type SeriesLike = {
  title: string;
  type: string;
  year: number | null;
  status: string;
  isCensored: boolean;
  synopsis: string | null;
  studio?: { name: string } | null;
  tags: { name: string }[];
  episodes: { number: number }[];
};

function cap(s: string) {
  return s ? s[0] + s.slice(1).toLowerCase() : s;
}

export function seriesFaq(s: SeriesLike): QA[] {
  const n = s.episodes.length;
  const genres = s.tags.slice(0, 5).map((t) => t.name).join(", ");
  const out: QA[] = [];

  out.push({
    q: `How many episodes of ${s.title} are there?`,
    a:
      n > 0
        ? `${s.title} has ${n} episode${n === 1 ? "" : "s"} available to stream on ${SITE_NAME}, all free in HD.`
        : `${s.title} is in the catalogue on ${SITE_NAME}; episodes are added as soon as they're released.`,
  });

  out.push({
    q: `Is ${s.title} uncensored?`,
    a: s.isCensored
      ? `The version on ${SITE_NAME} is censored (mosaic). An uncensored release is added if and when one exists.`
      : `Yes — ${s.title} is available fully uncensored on ${SITE_NAME}.`,
  });

  out.push({
    q: `Where can I watch ${s.title} online for free?`,
    a: `You can watch every episode of ${s.title} free, with no account, on ${SITE_NAME}. It streams in HD in your browser on desktop and mobile.`,
  });

  if (s.studio) {
    out.push({
      q: `Who animated ${s.title}?`,
      a: `${s.title} was produced by ${s.studio.name}${s.year ? ` and released in ${s.year}` : ""}.`,
    });
  }

  if (genres) {
    out.push({
      q: `What genre is ${s.title}?`,
      a: `${s.title} is a ${s.year ? `${s.year} ` : ""}${cap(s.type)} hentai. Its main tags are ${genres}.`,
    });
  }

  if (s.status?.toUpperCase() === "ONGOING") {
    out.push({
      q: `Is ${s.title} finished?`,
      a: `${s.title} is ongoing — new episodes are still being released and land on ${SITE_NAME} as they come out.`,
    });
  }

  return out;
}

export function episodeFaq(ep: {
  number: number;
  runtimeSec: number | null;
  series: SeriesLike;
}): QA[] {
  const s = ep.series;
  const mins = ep.runtimeSec ? Math.round(ep.runtimeSec / 60) : null;
  const out: QA[] = [
    {
      q: `Where can I watch ${s.title} Episode ${ep.number}?`,
      a: `${s.title} Episode ${ep.number} streams free in HD on ${SITE_NAME} — no sign-up, works on desktop and mobile.`,
    },
    {
      q: `Is ${s.title} Episode ${ep.number} uncensored?`,
      a: s.isCensored
        ? `This episode is the censored (mosaic) version. If an uncensored cut is released it's added here.`
        : `Yes, ${s.title} Episode ${ep.number} is uncensored on ${SITE_NAME}.`,
    },
  ];
  if (mins) {
    out.push({
      q: `How long is ${s.title} Episode ${ep.number}?`,
      a: `This episode runs about ${mins} minutes.`,
    });
  }
  return out;
}
