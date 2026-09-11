import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LustHentai — Watch Hentai Online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#0b0b12",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: "#ff3d7f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="30" viewBox="0 0 26 30" style={{ marginLeft: 6 }}>
              <path d="M0 0L26 15L0 30V0Z" fill="#ffffff" />
            </svg>
          </div>
          <div
            style={{ display: "flex", fontSize: 44, fontWeight: 800, marginLeft: 20 }}
          >
            <span>Lust</span>
            <span style={{ color: "#ff3d7f" }}>Hentai</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 940,
          }}
        >
          Watch Hentai Online — Subbed & Uncensored
        </div>
        <div style={{ marginTop: 24, fontSize: 30, color: "#9a9aa8" }}>
          Series · OVAs · Movies — free HD streaming, updated daily
        </div>
      </div>
    ),
    size,
  );
}
