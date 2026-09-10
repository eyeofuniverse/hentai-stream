"use client";

import { useEffect, useRef, useState } from "react";
import { formatDims, type AdVariant } from "@/lib/ads";

/**
 * Renders one ad variant. Reserves the exact box (no layout shift), lazy-loads
 * when it scrolls near the viewport, then either injects the raw `code` or an
 * ExoClick-style `<ins data-zoneid>` + serve call.
 */
export function AdUnit({
  slotKey,
  variant,
  className = "",
}: {
  slotKey: string;
  variant: AdVariant;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const dims = formatDims(variant.format);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!show) return;
    const el = ref.current;
    if (!el) return;

    if (variant.source === "code") {
      // execute inline <script> tags too (innerHTML doesn't run them)
      el.innerHTML = variant.code;
      el.querySelectorAll("script").forEach((old) => {
        const s = document.createElement("script");
        for (const a of old.attributes) s.setAttribute(a.name, a.value);
        s.text = old.textContent ?? "";
        old.replaceWith(s);
      });
      return;
    }

    // zone mode — ExoClick / magsrv "AdProvider" convention
    el.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "eas6a97888e";
    ins.style.display = "block";
    ins.setAttribute("data-zoneid", variant.zoneId);
    if (dims) {
      ins.style.width = `${dims.w}px`;
      ins.style.height = `${dims.h}px`;
    }
    el.appendChild(ins);
    try {
      (
        (window as unknown as { AdProvider?: unknown[] }).AdProvider ||
        ((window as unknown as { AdProvider: unknown[] }).AdProvider = [])
      ).push({ serve: {} });
    } catch {
      /* provider script not ready yet — it sweeps unserved <ins> on load */
    }
  }, [show, variant.source, variant.zoneId, variant.code, dims]);

  return (
    <div
      ref={ref}
      data-ad-slot={slotKey}
      data-ad-format={variant.format}
      className={`mx-auto overflow-hidden ${className}`}
      style={
        dims
          ? { width: dims.w, height: dims.h, maxWidth: "100%" }
          : { minHeight: 90, width: "100%" }
      }
    />
  );
}
