import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { episodeThumb, thumb } from "@/lib/cloudinary";
import { thumbUrl as bunnyThumbUrl } from "@/lib/hosting/bunny";
import { fetchAsDataUri } from "@/lib/og-image-fetch";

// Node runtime, not edge — this needs the standard Prisma client (a raw TCP
// connection to Postgres), which edge's V8 isolates can't open.
export const alt = "Watch on LustHentai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Cache the generated PNG — a social crawler revisiting the same URL
// shouldn't pay for a fresh DB query + thumbnail fetch + render every time.
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const number = Number(episode);
  const ep = await prisma.episode
    .findFirst({
      where: { number, series: { slug } },
      select: {
        number: true,
        title: true,
        bunnyGuid: true,
        bunnyStatus: true,
        thumbUrl: true,
        series: {
          select: {
            title: true,
            year: true,
            isCensored: true,
            coverUrl: true,
            tags: { select: { name: true }, take: 3 },
          },
        },
      },
    })
    .catch(() => null);

  const seriesTitle = ep?.series.title ?? "LustHentai";
  const cen = ep?.series.isCensored === false ? "Uncensored" : null;
  const genres = ep?.series.tags.map((t) => t.name) ?? [];

  // Bunny's pull zone hotlink-checks the Referer, which next/og's own image
  // fetch doesn't send — fetchAsDataUri does the fetch itself with the right
  // header, whether the source ends up being our own R2 copy or a live
  // Bunny hotlink.
  const bunnyFallback = ep?.bunnyStatus === "ready" && ep.bunnyGuid ? bunnyThumbUrl(ep.bunnyGuid) : null;
  const rawThumb = ep ? (episodeThumb(ep.thumbUrl, bunnyFallback) ?? thumb(ep.series.coverUrl)) : null;
  const dataUri = await fetchAsDataUri(rawThumb);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0b0b12",
          color: "#ffffff",
        }}
      >
        {/* top: thumbnail strip */}
        <div style={{ width: "100%", height: 400, display: "flex", position: "relative" }}>
          {dataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUri}
              width={1200}
              height={400}
              style={{ objectFit: "cover", width: 1200, height: 400 }}
              alt=""
            />
          ) : (
            <div style={{ width: 1200, height: 400, display: "flex", backgroundColor: "#161620" }} />
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              background: "linear-gradient(0deg, #0b0b12 0%, rgba(11,11,18,0.15) 55%, rgba(11,11,18,0.5) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 32,
              left: 60,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#ff3d7f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="16" viewBox="0 0 14 16" style={{ marginLeft: 3 }}>
                <path d="M0 0L14 8L0 16V0Z" fill="#ffffff" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 800, marginLeft: 12 }}>
              <span>Lust</span>
              <span style={{ color: "#ff3d7f" }}>Hentai</span>
            </div>
          </div>
          {/* play badge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 999,
                backgroundColor: "rgba(11,11,18,0.55)",
                border: "3px solid rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="32" height="36" viewBox="0 0 32 36" style={{ marginLeft: 8 }}>
                <path d="M0 0L32 18L0 36V0Z" fill="#ffffff" />
              </svg>
            </div>
          </div>
        </div>

        {/* bottom: title */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: seriesTitle.length > 34 ? 42 : 50,
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: 1080,
            }}
          >
            {(seriesTitle.length > 60 ? seriesTitle.slice(0, 57) + "…" : seriesTitle) +
              ` — Episode ${ep?.number ?? number}`}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 26, color: "#9a9aa8" }}>
            {[ep?.series.year, cen, genres.length ? genres.join(" · ") : null]
              .filter(Boolean)
              .join("  ·  ")}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
