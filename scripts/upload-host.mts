/**
 * Host episodes in Bunny by downloading the source file ourselves and uploading
 * it — for source CDNs that refuse Bunny's own fetch workers (hentaigasm's
 * hgasm1/2/3). See src/lib/hosting/upload-host.ts.
 *
 *   npm run upload-host
 *   npm run upload-host -- --site=hentaigasm --limit=2 --max-minutes=40 --concurrency=2
 */
import { bunnyEnabled } from "@/lib/hosting/bunny";
import { runUploadHost } from "@/lib/hosting/upload-host";

if (!bunnyEnabled()) {
  console.log("Bunny env not configured — skipping upload-host.");
  process.exit(0);
}

const args = process.argv.slice(2);
const flag = (n: string) => {
  const h = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return h ? (h.split("=")[1] ?? "true") : undefined;
};

const s = await runUploadHost({
  site: flag("site") || "hentaigasm",
  limit: flag("limit") ? Number(flag("limit")) : undefined,
  maxMinutes: Number(flag("max-minutes") ?? 300),
  concurrency: Number(flag("concurrency") ?? 3),
  log: (m) => console.log(m),
});
console.log(
  `upload-host done in ${Math.round(s.tookMs / 60000)} min: seen ${s.seen}, uploaded ${s.uploaded} (${(s.bytes / 1e9).toFixed(1)} GB), skipped ${s.skipped}, failed ${s.errors.length}`,
);
process.exit(0);
