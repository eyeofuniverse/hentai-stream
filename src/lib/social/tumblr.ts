import { prisma } from "@/lib/db";

/**
 * Tumblr posting — OAuth2 access token stored in the SocialToken table
 * (obtained once via the admin "Connect Tumblr" flow), auto-refreshed here
 * when expired.
 *
 * Tumblr's content policy bans explicit sexual imagery, so unlike Bluesky we
 * NEVER attach the cover image — every post here is a plain `link` type
 * carrying title + description + tags + the watch URL only.
 */

async function getAccessToken(): Promise<string> {
  const token = await prisma.socialToken.findUnique({ where: { platform: "tumblr" } });
  if (!token) throw new Error("Tumblr not connected — connect it from /console/social first.");

  if (!token.expiresAt || token.expiresAt > new Date()) {
    return token.accessToken;
  }

  if (!token.refreshToken) {
    throw new Error("Tumblr token expired. Please reconnect your Tumblr account.");
  }

  const res = await fetch("https://api.tumblr.com/v2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: process.env.TUMBLR_CONSUMER_KEY!,
      client_secret: process.env.TUMBLR_CONSUMER_SECRET!,
    }),
  });

  if (!res.ok) throw new Error("Tumblr token refresh failed. Please reconnect.");
  const data = await res.json();

  await prisma.socialToken.update({
    where: { platform: "tumblr" },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    },
  });

  return data.access_token as string;
}

const DEFAULT_TAGS = ["hentai", "lusthentai", "adult anime"];

export function isTumblrConfigured(): boolean {
  return !!(process.env.TUMBLR_CONSUMER_KEY && process.env.TUMBLR_CONSUMER_SECRET && process.env.TUMBLR_BLOG_NAME);
}

export async function isTumblrConnected(): Promise<boolean> {
  const token = await prisma.socialToken.findUnique({ where: { platform: "tumblr" }, select: { platform: true } });
  return !!token;
}

export async function postToTumblr({
  title,
  caption,
  url,
  tags = [],
}: {
  title: string;
  caption: string;
  url: string;
  tags?: string[];
}) {
  const accessToken = await getAccessToken();
  const blog = process.env.TUMBLR_BLOG_NAME!;

  const allTags = [...new Set([...DEFAULT_TAGS, ...tags.map((t) => t.toLowerCase())])].slice(0, 20);
  const tagsStr = allTags.join(",");

  const res = await fetch(`https://api.tumblr.com/v2/blog/${blog}/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      type: "link",
      url,
      title,
      description: caption.slice(0, 500),
      tags: tagsStr,
      state: "published",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Tumblr post failed: ${err?.meta?.msg ?? err?.errors?.[0]?.detail ?? err?.errors?.[0]?.title ?? res.status}`,
    );
  }

  const result = await res.json();
  // Tumblr post ids are 64-bit and exceed Number.MAX_SAFE_INTEGER — by the
  // time `res.json()` has parsed the numeric `id` field into a JS number the
  // precision is already gone (confirmed live: id 827814950116425700 vs the
  // real 827814950116425728). `id_string` carries the same value as a JSON
  // string, which JSON.parse never touches, so it's the only reliable one.
  return { id: result.response?.id_string ?? String(result.response?.id ?? result.id ?? "") };
}
