import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#09090e",
        surface: "#14141d",
        "surface-2": "#1e1e2b",
        "surface-3": "#2a2a3b",
        line: "rgba(255,255,255,0.08)",
        accent: "#ff3d7f",
        "accent-2": "#8b5cf6",
        good: "#34d399",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
      },
      maxWidth: {
        content: "1440px",
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(255,61,127,0.4), 0 12px 40px -8px rgba(255,61,127,0.35)",
      },
      keyframes: {
        fadein: { from: { opacity: "0" }, to: { opacity: "1" } },
        rise: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slow-zoom": {
          from: { transform: "scale(1)" },
          to: { transform: "scale(1.08)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        fadein: "fadein .5s ease both",
        rise: "rise .5s cubic-bezier(.2,.7,.3,1) both",
        "slow-zoom": "slow-zoom 16s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
