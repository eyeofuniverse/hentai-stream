/**
 * Emails a daily summary — revenue, new content, reports, traffic, and
 * anything else worth a glance — to the site owner. Runs nightly via
 * .github/workflows/daily-report.yml at 23:59 Asia/Dhaka (17:59 UTC).
 *
 * "Today" is computed in Asia/Dhaka (Bangladesh, UTC+6), not UTC or the
 * runner's own timezone — the report lands at 11:59 PM *local* time, so
 * "today" should mean the same calendar day the recipient is living in,
 * not whatever day UTC happens to be at that moment (17:59 UTC is still
 * the same UTC day as 23:59 BDT, so this mostly doesn't matter today, but
 * would silently be wrong for anyone reasoning about this later without
 * re-deriving it — better to make the timezone explicit here once).
 *
 * Every section is independently try/caught — one bad section (e.g.
 * ExoClick's API down) must never prevent the rest of the report, or the
 * email, from going out.
 */
import { prisma, db } from "@/lib/db";
import { sendDailyReportEmail, type ReportSection } from "@/lib/email";
import { getStats } from "@/lib/exoclick";

const RECIPIENT = "mail.minhajrahman@gmail.com";
const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;

function bdtTodayBounds(): { start: Date; end: Date; dateLabel: string; ymd: string } {
  const nowBdt = new Date(Date.now() + BDT_OFFSET_MS);
  const ymd = nowBdt.toISOString().slice(0, 10);
  const startUtc = new Date(Date.parse(`${ymd}T00:00:00.000Z`) - BDT_OFFSET_MS);
  const dateLabel = new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { start: startUtc, end: new Date(), dateLabel, ymd };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("section failed:", (e as Error).message);
    return fallback;
  }
}

const money = (n: number) => `$${n.toFixed(2)}`;

async function main() {
  const { start, end, dateLabel, ymd } = bdtTodayBounds();
  const range = { createdAt: { gte: start, lt: end } };
  const sections: ReportSection[] = [];

  // ── revenue ──────────────────────────────────────────────────────────
  const revenue = await safe(async () => {
    const rows = await getStats({ dateFrom: ymd, dateTo: ymd, groupBy: "date" });
    const today = rows[0];
    if (!today) return { revenue: 0, impressions: 0, clicks: 0, videoImpressions: 0, videoViews: 0 };
    return {
      revenue: today.revenue,
      impressions: today.impressions,
      clicks: today.clicks,
      videoImpressions: today.video?.impressions ?? 0,
      videoViews: today.video?.views ?? 0,
    };
  }, null);

  sections.push({
    title: "Revenue (ExoClick, today)",
    rows: revenue
      ? [
          { label: "Revenue", value: money(revenue.revenue) },
          { label: "Impressions", value: revenue.impressions.toLocaleString() },
          { label: "Clicks", value: revenue.clicks.toLocaleString() },
          { label: "Video pre-roll plays / paid views", value: `${revenue.videoImpressions.toLocaleString()} / ${revenue.videoViews.toLocaleString()}` },
        ]
      : [{ label: "Revenue", value: "unavailable (ExoClick API error — check logs)", warn: true }],
  });

  // ── content added ───────────────────────────────────────────────────
  const [newSeries, newEpisodes, publishedSeries, publishedEpisodes] = await Promise.all([
    safe(() => db(() => prisma.series.count({ where: range })), 0),
    safe(() => db(() => prisma.episode.count({ where: range })), 0),
    safe(
      () => db(() => prisma.series.count({ where: { ...range, publish: "PUBLISHED" } })),
      0,
    ),
    safe(
      () => db(() => prisma.episode.count({ where: { ...range, publish: "PUBLISHED" } })),
      0,
    ),
  ]);

  sections.push({
    title: "Content added today",
    rows: [
      { label: "New series", value: `${newSeries} (${publishedSeries} published)` },
      { label: "New episodes", value: `${newEpisodes} (${publishedEpisodes} published)` },
    ],
  });

  // ── reports & moderation ────────────────────────────────────────────
  const [newReports, openReportsTotal, newDmca, spotCheckPending, flaggedPending] = await Promise.all([
    safe(() => db(() => prisma.report.count({ where: range })), 0),
    safe(() => db(() => prisma.report.count({ where: { status: "OPEN" } })), 0),
    safe(() => db(() => prisma.dmcaRequest.count({ where: range })), 0),
    safe(
      () =>
        db(() =>
          prisma.series.count({
            where: { autoPublishedAt: { not: null }, reviewedAt: null, publish: "PUBLISHED" },
          }),
        ),
      0,
    ),
    safe(
      () =>
        db(() =>
          prisma.series.count({
            where: { contentWarnings: { has: "possible-minor" }, publish: { not: "REJECTED" } },
          }),
        ),
      0,
    ),
  ]);

  sections.push({
    title: "Reports & moderation",
    rows: [
      { label: "New reports today", value: String(newReports), warn: newReports > 0 },
      { label: "Total open reports", value: String(openReportsTotal), warn: openReportsTotal > 0 },
      { label: "New DMCA requests today", value: String(newDmca), warn: newDmca > 0 },
      { label: "Auto-published, awaiting spot-check", value: String(spotCheckPending) },
      { label: "Flagged possible-minor, awaiting review", value: String(flaggedPending), warn: flaggedPending > 0 },
    ],
  });

  // ── traffic ──────────────────────────────────────────────────────────
  const traffic = await safe(async () => {
    const visits = await db(() =>
      prisma.pageVisit.findMany({ where: { visitedAt: { gte: start, lt: end } }, select: { ip: true } }),
    );
    const uniqueVisitors = new Set(visits.map((v) => v.ip).filter((ip) => ip !== "unknown" && ip !== "0.0.0.0"));
    return { pageViews: visits.length, uniqueVisitors: uniqueVisitors.size };
  }, null);

  const [newUsers, newComments] = await Promise.all([
    safe(() => db(() => prisma.profile.count({ where: range })), 0),
    safe(() => db(() => prisma.comment.count({ where: range })), 0),
  ]);

  sections.push({
    title: "Traffic & engagement",
    rows: [
      { label: "Unique visitors", value: traffic ? traffic.uniqueVisitors.toLocaleString() : "unavailable" },
      { label: "Page views", value: traffic ? traffic.pageViews.toLocaleString() : "unavailable" },
      { label: "New accounts", value: String(newUsers) },
      { label: "New comments", value: String(newComments) },
    ],
  });

  // ── worth knowing ────────────────────────────────────────────────────
  const [unmatchedPending, backupOk] = await Promise.all([
    safe(() => db(() => prisma.unmatchedTitle.count({ where: { status: "PENDING" } })), 0),
    safe(async () => {
      const row = await db(() => prisma.hostRun.findFirst({ orderBy: { startedAt: "desc" } }));
      return row?.startedAt ?? null;
    }, null),
  ]);

  sections.push({
    title: "Worth knowing",
    rows: [
      { label: "Unmatched titles awaiting mapping", value: String(unmatchedPending) },
      { label: "Last Bunny host run", value: backupOk ? backupOk.toISOString() : "unknown" },
    ],
  });

  await sendDailyReportEmail(RECIPIENT, dateLabel, sections);
  console.log(`Daily report sent to ${RECIPIENT} for ${dateLabel}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("daily-report failed:", e);
  process.exit(1);
});
