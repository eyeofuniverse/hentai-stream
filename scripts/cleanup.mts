/**
 * Nightly retention sweep — deletes rows from tables that grow with public
 * traffic (not admin activity) and have no natural cap otherwise.
 *
 *   PageVisit        — page-view beacon rows, one per page load
 *   AdminLoginAttempt — throttle/lockout log; only ever read for a 15-30min window
 *   IpGeoCache        — geo lookups keyed by IP; stale entries just re-resolve
 *   SearchTermStat    — NOT age-pruned wholesale (it's an aggregate, upserted per
 *                        distinct term, so it doesn't grow with traffic volume the
 *                        same way) — only clears out old, never-useful junk terms
 *                        (zero-hit, single-digit count) so garbage/typo'd search
 *                        spam doesn't accumulate forever in "most searched" stats.
 *
 * AuditLog is deliberately left alone: it's admin-action history (accountability
 * trail), grows only as fast as the admin acts, and isn't a real growth risk.
 *
 *   npm run cleanup
 */
import { prisma, db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;
const PAGE_VISIT_RETENTION_DAYS = 180;
const LOGIN_ATTEMPT_RETENTION_DAYS = 30;
const IP_GEO_RETENTION_DAYS = 90;
const SEARCH_JUNK_RETENTION_DAYS = 90;

const started = Date.now();

const pageVisits = await db(() =>
  prisma.pageVisit.deleteMany({
    where: { visitedAt: { lt: new Date(Date.now() - PAGE_VISIT_RETENTION_DAYS * DAY) } },
  }),
);
console.log(`PageVisit: deleted ${pageVisits.count} rows older than ${PAGE_VISIT_RETENTION_DAYS}d`);

const loginAttempts = await db(() =>
  prisma.adminLoginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_DAYS * DAY) } },
  }),
);
console.log(`AdminLoginAttempt: deleted ${loginAttempts.count} rows older than ${LOGIN_ATTEMPT_RETENTION_DAYS}d`);

const geoCache = await db(() =>
  prisma.ipGeoCache.deleteMany({
    where: { cachedAt: { lt: new Date(Date.now() - IP_GEO_RETENTION_DAYS * DAY) } },
  }),
);
console.log(`IpGeoCache: deleted ${geoCache.count} rows older than ${IP_GEO_RETENTION_DAYS}d`);

// "junk" = searched fewer than 3 times ever, and at least one of those
// searches hit zero results — low-signal noise, not a real content gap.
const junkTerms = await db(() =>
  prisma.searchTermStat.deleteMany({
    where: {
      lastSearchedAt: { lt: new Date(Date.now() - SEARCH_JUNK_RETENTION_DAYS * DAY) },
      count: { lt: 3 },
      zeroHitCount: { gt: 0 },
    },
  }),
);
console.log(`SearchTermStat: deleted ${junkTerms.count} old junk terms`);

console.log(`\ncleanup done in ${Date.now() - started}ms`);
await prisma.$disconnect();
