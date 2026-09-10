"use client";

import { useEffect } from "react";

/**
 * Session-limited popunder. Fires at most once per `cooldownHours` (tracked in
 * localStorage) and only on a real user gesture, which is what every ad network
 * requires and what keeps it from feeling abusive.
 */
export function Popunder({
  source,
  zoneId,
  code,
  cooldownHours,
}: {
  source: "zone" | "code";
  zoneId: string;
  code: string;
  cooldownHours: number;
}) {
  useEffect(() => {
    const KEY = "lh_pu";
    let done = false;

    const eligible = () => {
      try {
        const last = Number(localStorage.getItem(KEY) ?? 0);
        return Date.now() - last > cooldownHours * 3600_000;
      } catch {
        return true;
      }
    };

    const fire = () => {
      if (done || !eligible()) return;
      done = true;
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      if (source === "code" && code) {
        const holder = document.createElement("div");
        holder.style.display = "none";
        holder.innerHTML = code;
        document.body.appendChild(holder);
        holder.querySelectorAll("script").forEach((old) => {
          const s = document.createElement("script");
          for (const a of old.attributes) s.setAttribute(a.name, a.value);
          s.text = old.textContent ?? "";
          old.replaceWith(s);
        });
      } else if (zoneId) {
        try {
          (
            (window as unknown as { AdProvider?: unknown[] }).AdProvider ||
            ((window as unknown as { AdProvider: unknown[] }).AdProvider = [])
          ).push({ serve: { zoneid: zoneId } });
        } catch {
          /* ignore */
        }
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("click", fire, true);
      document.removeEventListener("touchend", fire, true);
    };

    document.addEventListener("click", fire, true);
    document.addEventListener("touchend", fire, true);
    return cleanup;
  }, [source, zoneId, code, cooldownHours]);

  return null;
}
