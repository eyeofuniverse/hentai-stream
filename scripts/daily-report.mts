/**
 * Emails a daily summary — revenue, new content, reports, traffic, and
 * anything else worth a glance — to the site owner. Runs every day via
 * .github/workflows/daily-report.yml shortly after midnight Asia/Dhaka.
 *
 * The report always covers the LAST COMPLETE day in Asia/Dhaka (Bangladesh,
 * UTC+6): yesterday, relative to whenever the run actually starts. GitHub
 * Actions cron is routinely late — by minutes or by an hour or more — and the
 * old "report today" version, scheduled for 23:59, kept starting after
 * midnight and emailing the brand-new, nearly empty day. Reporting yesterday
 * makes lateness irrelevant. Pass --date=YYYY-MM-DD (or REPORT_DATE) to
 * re-send a specific day.
 *
 * Every section is independently try/caught — one bad section (e.g.
 * ExoClick's API down) must never prevent the rest of the report, or the
 * email, from going out.
 */
import { prisma, db } from "@/lib/db";
import { sendDailyReportEmail, type ReportSection } from "@/lib/email";
import { getDayTotals } from "@/lib/exoclick";

const RECIPIENT = "mail.minhajrahman@gmail.com";
const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TZ = "Asia/Dhaka";

/** The Asia/Dhaka calendar day to report: an explicit YYYY-MM-DD if given,
 *  otherwise yesterday (the last complete day). */
function bdtDayBounds(explicit?: string): { start: Date; end: Date; dateLabel: string; ymd: string } {
  const ymd =
    explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)
      ? explicit
      : new Date(Date.now() + BDT_OFFSET_MS - DAY_MS).toISOString().slice(0, 10);
  const start = new Date(Date.parse(`${ymd}T00:00:00.000Z`) - BDT_OFFSET_MS);
  const end = new Date(start.getTime() + DAY_MS);
  const dateLabel = new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return { start, end, dateLabel, ymd };
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
  const arg = process.argv.find((x) => x.startsWith("--date="))?.slice(7) || process.env.REPORT_DATE || undefined;
  const { start, end, dateLabel, ymd } = bdtDayBounds(arg);
  const range = { createdAt: { gte: start, lt: end } };
  const sections: ReportSection[] = [];

  // ── revenue ──────────────────────────────────────────────────────────
  // exact Asia/Dhaka day (sum of hourly buckets — ExoClick's plain daily totals
  // are New York days regardless of any timezone setting, see getDayTotals)
  const revenue = await safe(() => getDayTotals(ymd, REPORT_TZ), null);

  sections.push({
    title: "Revenue (ExoClick)",
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
    title: "Content added",
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
      { label: "New reports", value: String(newReports), warn: newReports > 0 },
      { label: "Total open reports", value: String(openReportsTotal), warn: openReportsTotal > 0 },
      { label: "New DMCA requests", value: String(newDmca), warn: newDmca > 0 },
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
