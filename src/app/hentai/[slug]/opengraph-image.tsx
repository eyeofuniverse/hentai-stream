import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { fetchAsDataUri } from "@/lib/og-image-fetch";

// Node runtime, not edge — this needs the standard Prisma client (a raw TCP
// connection to Postgres), which edge's V8 isolates can't open.
export const alt = "Watch on LustHentai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Cache the generated PNG — a social crawler revisiting the same URL
// shouldn't pay for a fresh DB query + cover-image fetch + render every time.
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await prisma.series
    .findUnique({
      where: { slug },
      select: {
        title: true,
        year: true,
        isCensored: true,
        coverUrl: true,
        ratingAvg: true,
        ratingCount: true,
        externalScore: true,
        _count: { select: { episodes: { where: { publish: "PUBLISHED" } } } },
        tags: { select: { name: true }, take: 3 },
      },
    })
    .catch(() => null);

  const title = s?.title ?? "LustHentai";
  const cen = s?.isCensored === false ? "Uncensored" : null;
  const genres = s?.tags.map((t) => t.name) ?? [];
  const rating = s && s.ratingCount > 0 ? s.ratingAvg : s?.externalScore;
  const cover = await fetchAsDataUri(s?.coverUrl ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0b0b12",
          color: "#ffffff",
        }}
      >
        {/* left: text */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "70px 60px",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                backgroundColor: "#ff3d7f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="18" viewBox="0 0 16 18" style={{ marginLeft: 4 }}>
                <path d="M0 0L16 9L0 18V0Z" fill="#ffffff" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 800, marginLeft: 14 }}>
              <span>Lust</span>
              <span style={{ color: "#ff3d7f" }}>Hentai</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: title.length > 34 ? 52 : 62,
              fontWeight: 800,
              lineHeight: 1.12,
              maxWidth: cover ? 640 : 980,
            }}
          >
            {title.length > 70 ? title.slice(0, 67) + "…" : title}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            {s?.year && (
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  fontSize: 24,
                }}
              >
                {s.year}
              </div>
            )}
            {cen && (
              <div
                style={{
                  display: "flex",
                  padding: "8px 18px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,61,127,0.18)",
                  color: "#ff8fb3",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                Uncensored
              </div>
            )}
            {typeof rating === "number" && rating > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 18px",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  fontSize: 24,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                  <path
                    d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.9-6.2 3.9 1.6-7-5.4-4.7 7.1-.6z"
                    fill="#ffab00"
                  />
                </svg>
                {rating.toFixed(1)}
              </div>
            )}
          </div>

          {genres.length > 0 && (
            <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#9a9aa8" }}>
              {genres.join(" · ")}
            </div>
          )}

          <div style={{ display: "flex", marginTop: 36, fontSize: 28, color: "#c9c9d4" }}>
            Watch free HD{" "}
            {s?._count.episodes ? `· ${s._count.episodes} episode${s._count.episodes === 1 ? "" : "s"}` : ""}
          </div>
        </div>

        {/* right: cover art, only when it actually loaded */}
        {cover && (
          <div
            style={{
              width: 420,
              height: "100%",
              display: "flex",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              width={420}
              height={630}
              style={{ objectFit: "cover", width: 420, height: 630 }}
              alt=""
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                background: "linear-gradient(90deg, #0b0b12 0%, rgba(11,11,18,0) 22%)",
              }}
            />
          </div>
        )}
      </div>
    ),
    size,
  );
}
