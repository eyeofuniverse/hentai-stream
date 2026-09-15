/**
 * Bluesky posting — authenticates fresh via an app password on every post
 * (no token storage needed), then uploads the cover as a standalone image
 * embed and posts a rich-text record with a clickable link + hashtag facets.
 *
 * Bluesky fully allows explicit adult content (just requires the account's
 * own "Adult Content" setting to be on), so unlike Tumblr we always attach
 * the real cover image here.
 */

async function uploadBlob(
  imageUrl: string,
  accessJwt: string,
): Promise<Record<string, unknown> | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const buffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

    const blobRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.uploadBlob", {
      method: "POST",
      headers: { "Content-Type": contentType, Authorization: `Bearer ${accessJwt}` },
      body: Buffer.from(buffer),
    });
    if (!blobRes.ok) return null;
    const { blob } = await blobRes.json();
    return blob ?? null;
  } catch {
    return null;
  }
}

// Builds post text with a link facet (URL) and hashtag facets, all counted
// in graphemes/bytes the way Bluesky itself counts the 300-char limit.
function buildPost(
  title: string,
  caption: string,
  tags: string[],
  url: string,
): { text: string; facets: object[] } {
  const enc = new TextEncoder();
  const MAX = 295; // slight safety margin for multi-byte chars

  const prefix = `${title}\n\n`;
  const urlSuffix = `\n\n${url}`;
  const reservedGraphemes = [...prefix].length + [...urlSuffix].length;

  const captionBudget = MAX - reservedGraphemes;
  const captionTrimmed =
    [...caption].length > captionBudget
      ? [...caption].slice(0, Math.max(0, captionBudget - 1)).join("") + "…"
      : caption;

  let text = prefix + captionTrimmed;
  const facets: object[] = [];

  const urlByteStart = enc.encode(text).length + 2; // skip "\n\n"
  text += `\n\n${url}`;
  const urlByteEnd = enc.encode(text).length;
  facets.push({
    index: { byteStart: urlByteStart, byteEnd: urlByteEnd },
    features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
  });

  for (const rawTag of tags.slice(0, 8)) {
    const tag = rawTag.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
    if (!tag) continue;
    const addition = ` #${tag}`;
    if ([...text].length + addition.length > MAX) break;
    const byteStart = enc.encode(text).length + 1; // skip space, land on #
    text += addition;
    const byteEnd = enc.encode(text).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
    });
  }

  return { text, facets };
}

export function isBlueskyConfigured(): boolean {
  return !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
}

export async function postToBluesky({
  title,
  caption,
  url,
  tags = [],
  coverImageUrl,
}: {
  title: string;
  caption: string;
  url: string;
  tags?: string[];
  coverImageUrl?: string | null;
}) {
  if (!isBlueskyConfigured()) throw new Error("Bluesky not configured (BLUESKY_HANDLE/BLUESKY_APP_PASSWORD)");

  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_APP_PASSWORD,
    }),
  });
  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    throw new Error(`Bluesky auth failed: ${err.message ?? sessionRes.status}`);
  }
  const { accessJwt, did } = await sessionRes.json();

  const thumb = coverImageUrl ? await uploadBlob(coverImageUrl, accessJwt) : null;
  const { text, facets } = buildPost(title, caption, tags, url);

  const embed = thumb
    ? { $type: "app.bsky.embed.images", images: [{ alt: title, image: thumb }] }
    : {
        $type: "app.bsky.embed.external",
        external: { uri: url, title, description: caption.slice(0, 300) },
      };

  const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        ...(facets.length > 0 && { facets }),
        embed,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.json().catch(() => ({}));
    throw new Error(`Bluesky post failed: ${err.message ?? postRes.status}`);
  }

  const result = await postRes.json();
  return { uri: result.uri as string };
}
