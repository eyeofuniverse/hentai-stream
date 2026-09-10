"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Megaphone, Monitor, Smartphone, Globe } from "lucide-react";
import { AD_SLOTS, REVENUE_META, type AdSlotId } from "@/lib/ads";

const C = {
  card: "#14141d",
  bg: "#0d0d13",
  border: "rgba(255,255,255,0.09)",
  fg: "#ececf1",
  muted: "#8b8b99",
  accent: "#ff3d7f",
};
const HEAD = { fontFamily: "var(--font-sora), var(--font-inter), sans-serif" };
const SLOT_KEYS = Object.keys(AD_SLOTS) as AdSlotId[];

type Variant = {
  type: "network" | "affiliate";
  networkCode: string;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  adTitle: string;
  adDescription: string;
  active: boolean;
};
const emptyVariant = (): Variant => ({
  type: "network",
  networkCode: "",
  imageUrl: "",
  linkUrl: "",
  altText: "",
  adTitle: "",
  adDescription: "",
  active: true,
});
function fromRow(r: Record<string, unknown> | null): Variant {
  if (!r) return emptyVariant();
  return {
    type: r.type === "affiliate" ? "affiliate" : "network",
    networkCode: String(r.networkCode ?? ""),
    imageUrl: String(r.imageUrl ?? ""),
    linkUrl: String(r.linkUrl ?? ""),
    altText: String(r.altText ?? ""),
    adTitle: String(r.adTitle ?? ""),
    adDescription: String(r.adDescription ?? ""),
    active: r.isActive !== false,
  };
}
function filled(v: Variant): boolean {
  return v.type === "affiliate"
    ? !!(v.imageUrl.trim() && v.linkUrl.trim())
    : !!v.networkCode.trim();
}

const input: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.fg,
  borderRadius: "0.6rem",
  padding: "0.5rem 0.7rem",
  fontSize: "0.85rem",
  width: "100%",
  outline: "none",
};

type SlotStatus = { desktop: boolean; mobile: boolean; all: boolean };

function DevicePanel({
  band,
  icon,
  hint,
  disabled,
  v,
  onChange,
}: {
  band: string;
  icon: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  v: Variant;
  onChange: (v: Variant) => void;
}) {
  const set = (patch: Partial<Variant>) => onChange({ ...v, ...patch });
  if (disabled) {
    return (
      <div
        style={{ border: `1px dashed ${C.border}`, borderRadius: "0.7rem" }}
        className="p-3 text-xs"
      >
        <span style={{ color: C.muted }} className="flex items-center gap-1.5">
          {icon} {band} — not available for this slot
        </span>
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: "0.7rem" }} className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: C.fg }}>
          {icon} {band}
        </span>
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => set({ active: e.target.checked })}
            className="h-3.5 w-3.5 accent-[color:#ff3d7f]"
          />
          Live
        </label>
      </div>
      {hint && (
        <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
          {hint}
        </p>
      )}

      <div className="mb-2 flex gap-1.5">
        {(["network", "affiliate"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set({ type: t })}
            style={{
              flex: 1,
              padding: "0.35rem",
              borderRadius: "0.5rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${C.border}`,
              background: v.type === t ? C.accent : C.bg,
              color: v.type === t ? "#fff" : C.muted,
            }}
          >
            {t === "network" ? "Ad code" : "Banner image"}
          </button>
        ))}
      </div>

      {v.type === "network" ? (
        <textarea
          value={v.networkCode}
          onChange={(e) => set({ networkCode: e.target.value })}
          rows={4}
          placeholder="Paste the ExoClick / ad-network embed for this device only"
          style={{ ...input, fontFamily: "monospace", fontSize: "0.72rem", resize: "vertical" }}
        />
      ) : (
        <div className="space-y-1.5">
          <input
            value={v.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            placeholder="Banner image URL"
            style={input}
          />
          <input
            value={v.linkUrl}
            onChange={(e) => set({ linkUrl: e.target.value })}
            placeholder="Destination URL (your affiliate link)"
            style={input}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              value={v.adTitle}
              onChange={(e) => set({ adTitle: e.target.value })}
              placeholder="Caption title (optional)"
              style={{ ...input, fontSize: "0.78rem" }}
            />
            <input
              value={v.altText}
              onChange={(e) => set({ altText: e.target.value })}
              placeholder="Alt text"
              style={{ ...input, fontSize: "0.78rem" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AdsManager() {
  const [status, setStatus] = useState<Record<string, SlotStatus>>({});
  const [loading, setLoading] = useState(true);
  const [openSlot, setOpenSlot] = useState<AdSlotId | null>(null);
  const [editing, setEditing] = useState<{
    desktop: Variant;
    mobile: Variant;
    all: Variant;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/console/ads");
    const rows: { slot: string; deviceType: string; isActive: boolean }[] = r.ok
      ? await r.json()
      : [];
    const s: Record<string, SlotStatus> = {};
    for (const k of SLOT_KEYS) s[k] = { desktop: false, mobile: false, all: false };
    for (const row of rows) {
      if (!s[row.slot]) continue;
      if (row.isActive && (row.deviceType === "desktop" || row.deviceType === "mobile" || row.deviceType === "all")) {
        s[row.slot][row.deviceType] = true;
      }
    }
    setStatus(s);
    setLoading(false);
  }, []);
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function open(slot: AdSlotId) {
    setOpenSlot(slot);
    setEditing(null);
    setErr(null);
    const r = await fetch(`/api/console/ads/slot?slot=${slot}`);
    const d = r.ok ? await r.json() : {};
    setEditing({
      desktop: fromRow(d.desktop ?? null),
      mobile: fromRow(d.mobile ?? null),
      all: fromRow(d.all ?? null),
    });
  }

  async function save() {
    if (!openSlot || !editing) return;
    setSaving(true);
    setErr(null);
    const pack = (v: Variant) => (filled(v) ? { ...v } : null);
    const r = await fetch("/api/console/ads/slot", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: openSlot,
        desktop: pack(editing.desktop),
        mobile: pack(editing.mobile),
        all: pack(editing.all),
      }),
    });
    setSaving(false);
    if (!r.ok) {
      setErr("Save failed. Try again.");
      return;
    }
    setOpenSlot(null);
    setEditing(null);
    refreshStatus();
  }

  const def = openSlot ? AD_SLOTS[openSlot] : null;
  const rev = def ? REVENUE_META[def.hint.revenue] : null;

  const grouped = SLOT_KEYS.reduce<Record<string, AdSlotId[]>>((acc, k) => {
    (acc[AD_SLOTS[k].page] ??= []).push(k);
    return acc;
  }, {});

  return (
    <>
      <div className="mb-6">
        <h1 style={{ ...HEAD, fontSize: "1.6rem", fontWeight: 800, color: C.fg }}>
          Ad slots
        </h1>
        <p style={{ color: C.muted, fontSize: "0.875rem", marginTop: "0.2rem" }}>
          One creative per slot per device. A code you paste under{" "}
          <strong style={{ color: C.fg }}>Desktop</strong> serves on desktop only;{" "}
          <strong style={{ color: C.fg }}>Mobile</strong> on phones only;{" "}
          <strong style={{ color: C.fg }}>All devices</strong> is the fallback when
          the specific one is empty.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center" style={{ color: C.muted }}>
          Loading…
        </div>
      ) : (
        Object.entries(grouped).map(([page, keys]) => (
          <div key={page} className="mb-7">
            <h2
              style={{ ...HEAD, color: C.fg }}
              className="mb-2.5 text-sm font-bold uppercase tracking-wider"
            >
              {page} pages
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map((k) => {
                const s = status[k] ?? { desktop: false, mobile: false, all: false };
                const d = AD_SLOTS[k];
                const r = REVENUE_META[d.hint.revenue];
                const anyLive = s.desktop || s.mobile || s.all;
                return (
                  <button
                    key={k}
                    onClick={() => open(k)}
                    className="flex flex-col rounded-xl p-3.5 text-left transition-opacity hover:opacity-90"
                    style={{ background: C.card, border: `1px solid ${C.border}` }}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: anyLive ? "#34d399" : C.muted, opacity: anyLive ? 1 : 0.4 }}
                      />
                      <span style={{ color: C.fg }} className="text-[13px] font-semibold">
                        {d.label}
                      </span>
                    </div>
                    <span style={{ color: C.muted }} className="text-[11px]">
                      {d.description}
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        style={{
                          fontSize: "0.55rem",
                          fontWeight: 700,
                          color: r.color,
                          background: `${r.color}1e`,
                          padding: "0.08rem 0.4rem",
                          borderRadius: "999px",
                        }}
                      >
                        {r.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                        {d.desktop && (
                          <span style={{ color: s.desktop ? "#34d399" : C.muted }}>D</span>
                        )}
                        {d.mobile && (
                          <span style={{ color: s.mobile ? "#34d399" : C.muted }}>M</span>
                        )}
                        <span style={{ color: s.all ? "#34d399" : C.muted }}>A</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {openSlot && def && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenSlot(null);
          }}
        >
          <div
            className="my-8 w-full max-w-lg rounded-2xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 style={{ ...HEAD, fontSize: "1.05rem", fontWeight: 800, color: C.fg }}>
                  {def.label}
                </h3>
                <p className="text-xs" style={{ color: C.muted }}>
                  {def.description}
                </p>
              </div>
              <button
                onClick={() => setOpenSlot(null)}
                style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {rev && (
              <div
                className="mb-3 rounded-lg p-2.5 text-[11px]"
                style={{ background: `${rev.color}12`, border: `1px solid ${rev.color}33`, color: C.muted }}
              >
                <strong style={{ color: rev.color }}>{rev.label}</strong> · best format:{" "}
                <strong style={{ color: C.fg }}>{def.hint.format}</strong> · {def.hint.size}
              </div>
            )}

            {!editing ? (
              <div className="py-8 text-center text-sm" style={{ color: C.muted }}>
                Loading…
              </div>
            ) : (
              <div className="space-y-3">
                <DevicePanel
                  band="Desktop"
                  icon={<Monitor size={13} />}
                  disabled={!def.desktop}
                  v={editing.desktop}
                  onChange={(v) => setEditing({ ...editing, desktop: v })}
                />
                <DevicePanel
                  band="Mobile"
                  icon={<Smartphone size={13} />}
                  disabled={!def.mobile}
                  v={editing.mobile}
                  onChange={(v) => setEditing({ ...editing, mobile: v })}
                />
                <DevicePanel
                  band="All devices"
                  icon={<Globe size={13} />}
                  hint="Used on any device where the specific panel above is empty."
                  v={editing.all}
                  onChange={(v) => setEditing({ ...editing, all: v })}
                />
              </div>
            )}

            {err && <p className="mt-3 text-xs text-red-400">{err}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpenSlot(null)}
                style={{ padding: "0.5rem 1rem", borderRadius: "0.6rem", fontSize: "0.85rem", color: C.muted, background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !editing}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.6rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: C.accent,
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Save slot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && SLOT_KEYS.every((k) => !status[k] || (!status[k].desktop && !status[k].mobile && !status[k].all)) && (
        <div
          className="mt-2 rounded-xl py-10 text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <Megaphone size={26} className="mx-auto mb-2 opacity-20" style={{ color: C.muted }} />
          <p style={{ color: C.muted, fontSize: "0.85rem" }}>
            No ads live yet — open a slot above and paste a code.
          </p>
        </div>
      )}
    </>
  );
}
