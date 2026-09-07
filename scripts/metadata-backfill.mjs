/**
 * One-off: pull the whole hentai catalogue from MyAnimeList into the DB.
 *
 * Season-walks a year range against a RUNNING server, one year per request, with
 * per-year retries and a progress file so a crash / connection reset never loses
 * work — just run it again and it resumes where it stopped. Recomputes taxonomy
 * counts once at the very end.
 *
 *   node --env-file=.env scripts/metadata-backfill.mjs [fromYear] [toYear] [baseUrl]
 *
 * Flags (anywhere in argv):
 *   --fresh    ignore the progress file and redo every year
 *   --no-recount   skip the final taxonomy recount
 *
 * Tip: point it at a deployed US server, not localhost from far away —
 *   node scripts/metadata-backfill.mjs 1985 2027 https://yourdomain.com
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const PROGRESS = join(__dir, ".metadata-backfill-progress.json");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const pos = args.filter((a) => !a.startsWith("--"));

const from = Number(pos[0]) || 1985;
const to = Number(pos[1]) || new Date().getFullYear() + 1;
const base = pos[2] || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET missing from env (run with: node --env-file=.env …)");
  process.exit(1);
}

const MAX_TRIES = 4; // per year
const PAUSE_MS = 4000; // between years, let the pool recover
const REQ_TIMEOUT_MS = 15 * 60 * 1000; // a single year should never take 15 min

// ── progress ──────────────────────────────────────────────────────────────
let done = new Set();
if (!flags.has("--fresh") && existsSync(PROGRESS)) {
  try {
    done = new Set(JSON.parse(readFileSync(PROGRESS, "utf8")).done ?? []);
    if (done.size) console.log(`resuming — ${done.size} year(s) already imported\n`);
  } catch {
    /* ignore a corrupt progress file */
  }
}
const saveProgress = () =>
  writeFileSync(PROGRESS, JSON.stringify({ done: [...done].sort() }, null, 0));

// ── helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(u) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      // an HTML error page (dev-server crash / 502) — treat as retryable
      throw new Error(
        `non-JSON response (HTTP ${r.status}): ${text.slice(0, 80).replace(/\s+/g, " ")}`,
      );
    }
    if (!r.ok || j.ok === false) {
      throw new Error(`HTTP ${r.status}: ${j.error ?? JSON.stringify(j).slice(0, 120)}`);
    }
    return j;
  } finally {
    clearTimeout(timer);
  }
}

async function importYear(year) {
  const u = `${base}/api/cron/metadata?mode=range&from=${year}&to=${year}&recount=0&key=${secret}`;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const t = Date.now();
    try {
      const j = await fetchJson(u);
      return { j, secs: ((Date.now() - t) / 1000) | 0 };
    } catch (e) {
      lastErr = e;
      const wait = Math.min(60_000, 5000 * 2 ** (attempt - 1));
      process.stdout.write(
        `\n      try ${attempt}/${MAX_TRIES} failed: ${e.message} — waiting ${wait / 1000}s `,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ── run ───────────────────────────────────────────────────────────────────
const total = { scanned: 0, created: 0, updated: 0, skipped: 0, flagged: 0 };
const failures = [];
const allErrors = [];

console.log(`backfill ${from}–${to}  →  ${base}\n`);

for (let year = from; year <= to; year++) {
  if (done.has(year)) {
    console.log(`  ${year}  ✓ (already done)`);
    continue;
  }
  process.stdout.write(`  ${year}  … `);
  try {
    const { j, secs } = await importYear(year);
    for (const k of Object.keys(total)) total[k] += j[k] ?? 0;
    allErrors.push(...(j.errors ?? []));
    done.add(year);
    saveProgress();
    console.log(
      `+${j.created} new, ${j.updated} upd, ${j.skipped} kept, ${j.flagged} flagged` +
        `${j.errorCount ? `, ${j.errorCount} item-errors` : ""}  (${secs}s)`,
    );
  } catch (e) {
    failures.push(year);
    console.log(`\n  ${year}  ✗ GAVE UP: ${e.message}`);
  }
  await sleep(PAUSE_MS);
}

// ── final recount ─────────────────────────────────────────────────────────
if (!flags.has("--no-recount") && failures.length === 0) {
  process.stdout.write("\n  recount … ");
  try {
    await fetchJson(`${base}/api/cron/metadata?recount=only&key=${secret}`);
    console.log("done");
  } catch (e) {
    console.log(`FAILED (${e.message}) — run once more: ` +
      `curl "${base}/api/cron/metadata?recount=only&key=<secret>"`);
  }
} else if (failures.length) {
  console.log("\n  skipping recount — re-run the script to retry failed years first");
}

// ── summary ───────────────────────────────────────────────────────────────
console.log("\n── done ──");
console.log(total);
if (allErrors.length) {
  console.log(`\n${allErrors.length} per-title error(s); first 30:`);
  for (const e of allErrors.slice(0, 30)) console.log("  · " + e);
}
if (failures.length) {
  console.log(`\n⚠ ${failures.length} year(s) still failed: ${failures.join(", ")}`);
  console.log("  just run the script again — it resumes from these.");
  process.exit(1);
}
console.log("\nall years imported. progress file:", PROGRESS);
