import { createSign } from "node:crypto";

/**
 * Shared service-account JWT bearer flow for every Google API this MCP
 * server talks to (GA4 Data API, Search Console API) — same service account,
 * different OAuth scopes per API. Extracted out of google-analytics.ts once
 * Search Console needed the identical flow with a different scope.
 *
 * The service account itself must be granted access on each property it's
 * meant to read — GA4 under Admin > Property Access Management (Viewer),
 * Search Console under Settings > Users and permissions (Restricted is
 * enough for read-only queries) — for every site, not just the first one.
 */

const CLIENT_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL ?? "";
// Vercel/GitHub env vars can't hold real newlines cleanly — stored with
// literal "\n" escapes, unescaped here (the standard convention for pasting
// a PEM private key into a single-line env var).
const PRIVATE_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

export function googleSaConfigured(): boolean {
  return !!(CLIENT_EMAIL && PRIVATE_KEY);
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// cached per scope — a GA4-only token and a GSC-only token are different
// bearer tokens even though they come from the same service account
const cache = new Map<string, { token: string; expiresAt: number }>();

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer
    .sign(PRIVATE_KEY)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token exchange failed: ${body.error ?? res.status} ${body.error_description ?? ""}`);
  }
  cache.set(scope, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}
