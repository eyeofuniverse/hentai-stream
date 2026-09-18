/**
 * Nightly DB backup — pg_dump, gzip, upload to R2 (same bucket as images,
 * under db-backups/), prune anything past retention. Independent of
 * Supabase's own plan-tier backup/PITR features (untested, plan-dependent,
 * and not something we control from here) — this is a second, verifiable
 * copy we own regardless of Supabase plan.
 *
 * Needs `pg_dump` on PATH (see .github/workflows/backup.yml, which installs
 * postgresql-client) and a DIRECT (non-transaction-pooled) connection — same
 * IPv6-unreachable-from-CI problem documented in db-push.yml, same fix: an
 * IPv4 session-pooler URL (same host as DATABASE_URL, port 5432, no
 * pgbouncer) passed in as PG_DUMP_URL.
 *
 *   npm run backup-db
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { unlink, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";

const execFileAsync = promisify(execFile);

const RETENTION_COUNT = 14; // keep the last 14 daily backups (~2 weeks)

const dumpUrl = process.env.PG_DUMP_URL ?? process.env.DIRECT_URL;
if (!dumpUrl) {
  console.error("no PG_DUMP_URL or DIRECT_URL set — nothing to dump");
  process.exit(1);
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("R2 credentials not fully set — nothing to upload to");
  process.exit(1);
}
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const rawPath = `/tmp/lusthentai-${stamp}.sql`;
const gzPath = `${rawPath}.gz`;
const key = `db-backups/lusthentai-${stamp}.sql.gz`;

console.log(`pg_dump → ${rawPath}`);
await execFileAsync(
  "pg_dump",
  ["--no-owner", "--no-privileges", "--format=plain", "--file", rawPath, dumpUrl],
  { maxBuffer: 1024 * 1024 * 1024 },
);

console.log(`gzip → ${gzPath}`);
await pipeline(createReadStream(rawPath), createGzip({ level: 9 }), createWriteStream(gzPath));
await unlink(rawPath);

const { size } = await stat(gzPath);
console.log(`uploading ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`);

const body = createReadStream(gzPath);
const put = await client.fetch(`${endpoint}/${bucket}/${key}`, {
  method: "PUT",
  body: body as unknown as BodyInit,
  headers: { "Content-Type": "application/gzip", "Content-Length": String(size) },
});
if (!put.ok) {
  console.error(`upload failed: ${put.status} ${await put.text()}`);
  process.exit(1);
}
await unlink(gzPath);
console.log("upload ok");

// prune — list everything under db-backups/, delete all but the newest RETENTION_COUNT
const list = await client.fetch(
  `${endpoint}/${bucket}?list-type=2&prefix=${encodeURIComponent("db-backups/")}`,
);
if (list.ok) {
  const xml = await list.text();
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]).sort(); // lexicographic = chronological (YYYY-MM-DD names)
  const toDelete = keys.slice(0, Math.max(0, keys.length - RETENTION_COUNT));
  for (const k of toDelete) {
    const del = await client.fetch(`${endpoint}/${bucket}/${k}`, { method: "DELETE" });
    console.log(`prune ${k}: ${del.ok ? "ok" : del.status}`);
  }
  if (!toDelete.length) console.log(`nothing to prune (${keys.length}/${RETENTION_COUNT} kept)`);
} else {
  console.error(`could not list bucket for pruning: ${list.status}`);
}
