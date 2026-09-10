"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Link as LinkIcon,
  Monitor,
  ToggleLeft,
  ToggleRight,
  Megaphone,
  Info,
} from "lucide-react";
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

type Ad = {
  id: string;
  slot: string;
  name: string;
  type: string;
  deviceType: string;
  networkCode: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  altText: string | null;
  adTitle: string | null;
  adDescription: string | null;
  isActive: boolean;
  priority: number;
};

const SLOT_KEYS = Object.keys(AD_SLOTS) as AdSlotId[];

const DEVICES = [
  { value: "all", label: "All", desc: "Native / auto-sizing formats and pop-under" },
  { value: "mobile", label: "Mobile", desc: "< 1024px — phones & small tablets" },
  { value: "desktop", label: "Desktop", desc: "≥ 1024px — laptops & monitors" },
] as const;
const DEV_COLOR: Record<string, string> = {
  all: C.muted,
  mobile: "#34d399",
  desktop: "#8b5cf6",
};

const EMPTY = {
  slot: SLOT_KEYS[0] as string,
  name: "",
  type: "network",
  deviceType: "all",
  networkCode: "",
  imageUrl: "",
  linkUrl: "",
  altText: "",
  adTitle: "",
  adDescription: "",
  isActive: true,
  priority: 0,
};

const inputStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.fg,
  borderRadius: "0.7rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
};

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Info size={11} style={{ color: C.muted, opacity: 0.6, cursor: "help" }} />
      {open && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 7px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "0.6rem",
            padding: "0.5rem 0.7rem",
            fontSize: "0.68rem",
            lineHeight: 1.5,
            color: C.fg,
            width: "230px",
            zIndex: 200,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        {hint && <Tip text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function AdsManager() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [filterSlot, setFilterSlot] = useState("all");
  const [err, setErr] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/ads");
    if (r.ok) setAds(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  function openCreate(slot?: string) {
    setEditingId(null);
    setForm({ ...EMPTY, slot: slot ?? SLOT_KEYS[0] });
    setErr(null);
    setOpen(true);
  }
  function openEdit(a: Ad) {
    setEditingId(a.id);
    setForm({
      slot: a.slot,
      name: a.name,
      type: a.type,
      deviceType: a.deviceType ?? "all",
      networkCode: a.networkCode ?? "",
      imageUrl: a.imageUrl ?? "",
      linkUrl: a.linkUrl ?? "",
      altText: a.altText ?? "",
      adTitle: a.adTitle ?? "",
      adDescription: a.adDescription ?? "",
      isActive: a.isActive,
      priority: a.priority,
    });
    setErr(null);
    setOpen(true);
  }

  async function del(id: string) {
    if (!confirm("Delete this ad?")) return;
    await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
    setAds((p) => p.filter((a) => a.id !== id));
  }
  async function toggle(a: Ad) {
    const r = await fetch(`/api/admin/ads/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, isActive: !a.isActive }),
    });
    if (r.ok) {
      const u = await r.json();
      setAds((p) => p.map((x) => (x.id === u.id ? u : x)));
    }
  }
  async function save() {
    if (!form.name.trim()) return setErr("Ad name is required");
    if (form.type === "network" && !form.networkCode.trim())
      return setErr("Embed code is required");
    if (form.type === "affiliate" && (!form.imageUrl.trim() || !form.linkUrl.trim()))
      return setErr("Image URL and destination URL are required");
    setSaving(true);
    setErr(null);
    const payload = {
      ...form,
      networkCode: form.networkCode || null,
      imageUrl: form.imageUrl || null,
      linkUrl: form.linkUrl || null,
      altText: form.altText || null,
      adTitle: form.adTitle || null,
      adDescription: form.adDescription || null,
      priority: Number(form.priority) || 0,
    };
    const url = editingId ? `/api/admin/ads/${editingId}` : "/api/admin/ads";
    const r = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const s = await r.json();
      setAds((p) => (editingId ? p.map((a) => (a.id === s.id ? s : a)) : [...p, s]));
      setOpen(false);
    } else {
      setErr("Failed to save. Try again.");
    }
    setSaving(false);
  }

  const active = ads.filter((a) => a.isActive).length;
  const network = ads.filter((a) => a.type === "network").length;
  const affiliate = ads.filter((a) => a.type === "affiliate").length;
  const filtered = filterSlot === "all" ? ads : ads.filter((a) => a.slot === filterSlot);
  const bySlot = Object.fromEntries(
    SLOT_KEYS.map((k) => [k, ads.filter((a) => a.slot === k)]),
  );

  const slotDef = AD_SLOTS[form.slot as AdSlotId];
  const rev = slotDef ? REVENUE_META[slotDef.hint.revenue] : null;

  return (
    <>
      {/* header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ ...HEAD, fontSize: "1.6rem", fontWeight: 800, color: C.fg }}>
            Ad Management
          </h1>
          <p style={{ color: C.muted, fontSize: "0.875rem", marginTop: "0.2rem" }}>
            Advertising slots across the site. Each slot can hold several ads —
            the highest-priority match for the viewer&apos;s device is served.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: C.accent }}
        >
          <Plus size={15} /> New Ad
        </button>
      </div>

      {/* stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Ads", value: ads.length, color: C.fg },
          { label: "Active", value: active, color: "#34d399" },
          { label: "Network", value: network, color: "#8b5cf6" },
          { label: "Affiliate", value: affiliate, color: C.accent },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <p style={{ color: C.muted, fontSize: "0.72rem" }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: "1.6rem", fontWeight: 800, marginTop: "0.2rem", ...HEAD }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* slot overview */}
      <h2 style={{ ...HEAD, fontSize: "1.05rem", fontWeight: 700, color: C.fg, marginBottom: "0.85rem" }}>
        Slot Overview
      </h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SLOT_KEYS.map((id) => {
          const def = AD_SLOTS[id];
          const list = bySlot[id] ?? [];
          const activeCount = list.filter((a) => a.isActive).length;
          const on = activeCount > 0;
          const r = REVENUE_META[def.hint.revenue];
          return (
            <div
              key={id}
              className="flex items-start justify-between gap-3 rounded-xl p-4"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: on ? "#34d399" : C.muted, opacity: on ? 1 : 0.4 }}
                  />
                  <p className="truncate" style={{ color: C.fg, fontSize: "0.82rem", fontWeight: 600 }}>
                    {def.label}
                  </p>
                </div>
                <p className="truncate" style={{ color: C.muted, fontSize: "0.72rem" }}>
                  {on
                    ? `${activeCount} active`
                    : list.length
                      ? `${list.length} inactive`
                      : "No ads"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    style={{
                      fontSize: "0.56rem",
                      fontWeight: 700,
                      color: r.color,
                      background: `${r.color}1e`,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "999px",
                    }}
                  >
                    {r.label}
                  </span>
                  <span className="truncate" style={{ fontSize: "0.56rem", color: C.muted, opacity: 0.8 }}>
                    {def.hint.format} · {def.hint.size}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {def.desktop && (
                    <span style={{ fontSize: "0.55rem", color: DEV_COLOR.desktop }}>desktop</span>
                  )}
                  {def.desktop && def.mobile && (
                    <span style={{ fontSize: "0.55rem", color: C.muted }}>·</span>
                  )}
                  {def.mobile && (
                    <span style={{ fontSize: "0.55rem", color: DEV_COLOR.mobile }}>mobile</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => openCreate(id)}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-75"
                style={{ background: `${C.accent}1a`, color: C.accent }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
          );
        })}
      </div>

      {/* all ads table */}
      <div className="mb-4 flex items-center justify-between">
        <h2 style={{ ...HEAD, fontSize: "1.05rem", fontWeight: 700, color: C.fg }}>All Ads</h2>
        <select
          value={filterSlot}
          onChange={(e) => setFilterSlot(e.target.value)}
          style={{ ...inputStyle, width: "auto", padding: "0.375rem 0.7rem", fontSize: "0.8rem" }}
        >
          <option value="all">All Slots</option>
          {SLOT_KEYS.map((id) => (
            <option key={id} value={id}>
              {AD_SLOTS[id].label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center" style={{ color: C.muted }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <Megaphone size={30} className="mx-auto mb-3 opacity-20" style={{ color: C.muted }} />
          <p style={{ color: C.fg, fontWeight: 500 }}>No ads yet</p>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Create an ad, or hit “Add” on a slot above.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.border}` }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
              <thead>
                <tr style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
                  {["Name", "Slot", "Type", "Device", "Status", "Priority", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.7rem 1rem",
                        textAlign: "left",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{
                      background: i % 2 ? C.card : C.bg,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <td style={{ padding: "0.7rem 1rem", maxWidth: 180 }}>
                      <p
                        style={{
                          color: C.fg,
                          fontWeight: 500,
                          fontSize: "0.875rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.name}
                      </p>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: C.muted,
                          border: `1px solid ${C.border}`,
                          borderRadius: "0.5rem",
                          padding: "0.15rem 0.5rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {AD_SLOTS[a.slot as AdSlotId]?.label ?? a.slot}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          color: a.type === "network" ? "#8b5cf6" : C.accent,
                        }}
                      >
                        {a.type === "network" ? <Monitor size={12} /> : <LinkIcon size={12} />}
                        {a.type === "network" ? "Network" : "Affiliate"}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          color: DEV_COLOR[a.deviceType ?? "all"],
                          border: `1px solid ${C.border}`,
                          borderRadius: "0.5rem",
                          padding: "0.15rem 0.5rem",
                        }}
                      >
                        {DEVICES.find((d) => d.value === (a.deviceType ?? "all"))?.label ?? "All"}
                      </span>
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <button
                        onClick={() => toggle(a)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {a.isActive ? (
                          <>
                            <ToggleRight size={20} style={{ color: "#34d399" }} />
                            <span style={{ fontSize: "0.74rem", color: "#34d399", fontWeight: 600 }}>
                              Active
                            </span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={20} style={{ color: C.muted }} />
                            <span style={{ fontSize: "0.74rem", color: C.muted }}>Off</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: "0.7rem 1rem", color: C.muted, fontSize: "0.875rem" }}>
                      {a.priority}
                    </td>
                    <td style={{ padding: "0.7rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          onClick={() => openEdit(a)}
                          title="Edit"
                          style={{ padding: "0.35rem", borderRadius: "0.5rem", color: C.muted, background: "none", border: "none", cursor: "pointer" }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => del(a.id)}
                          title="Delete"
                          style={{ padding: "0.35rem", borderRadius: "0.5rem", color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-y-auto rounded-2xl p-6"
            style={{ background: C.card, border: `1px solid ${C.border}`, maxHeight: "90vh" }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 style={{ ...HEAD, fontSize: "1.2rem", fontWeight: 800, color: C.fg }}>
                {editingId ? "Edit Ad" : "New Ad"}
              </h3>
              <button
                onClick={() => setOpen(false)}
                style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Field label="Ad name (internal)" hint="Private label, never shown to viewers. e.g. 'ExoClick 300x600 rail — June'.">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. ExoClick rail rectangle"
                  style={inputStyle}
                />
              </Field>

              <Field label="Slot" hint="Where on the site this ad appears. See the panel below for the exact position and best format.">
                <select
                  value={form.slot}
                  onChange={(e) => {
                    const slot = e.target.value;
                    setForm((f) => ({
                      ...f,
                      slot,
                      ...(slot === "global-popunder" ? { deviceType: "all", type: "network" } : {}),
                    }));
                  }}
                  style={inputStyle}
                >
                  {SLOT_KEYS.map((id) => (
                    <option key={id} value={id}>
                      {AD_SLOTS[id].label}
                    </option>
                  ))}
                </select>
                {slotDef && rev && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.6rem",
                      background: `${rev.color}12`,
                      border: `1px solid ${rev.color}33`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.56rem",
                          fontWeight: 700,
                          color: rev.color,
                          background: `${rev.color}22`,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "999px",
                        }}
                      >
                        {rev.label}
                      </span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: C.fg }}>
                        Best: {slotDef.hint.format}
                      </span>
                      <span style={{ fontSize: "0.6rem", color: C.muted }}>{slotDef.hint.size}</span>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: C.muted, lineHeight: 1.5, margin: 0 }}>
                      {slotDef.description}. {slotDef.hint.why}
                    </p>
                  </div>
                )}
              </Field>

              <Field label="Ad type" hint="Network: paste a raw ExoClick / ad-network embed (scripts run on load). Affiliate: your own banner image + destination link.">
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["network", "affiliate"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "0.7rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1px solid ${C.border}`,
                        background: form.type === t ? C.accent : C.bg,
                        color: form.type === t ? "#fff" : C.muted,
                      }}
                    >
                      {t === "network" ? "Ad Network" : "Affiliate"}
                    </button>
                  ))}
                </div>
              </Field>

              {form.slot !== "global-popunder" && (
                <Field label="Target device" hint="For a slot with both a desktop and a mobile position, add two ads — one Desktop (e.g. 728×90), one Mobile (e.g. 300×250). 'All' serves the same unit everywhere (use for Native).">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {DEVICES.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setForm((f) => ({ ...f, deviceType: d.value }))}
                        title={d.desc}
                        style={{
                          flex: 1,
                          padding: "0.5rem 0.375rem",
                          borderRadius: "0.7rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: `1px solid ${C.border}`,
                          background: form.deviceType === d.value ? `${DEV_COLOR[d.value]}22` : C.bg,
                          color: form.deviceType === d.value ? DEV_COLOR[d.value] : C.muted,
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.68rem", color: C.muted, marginTop: "0.25rem" }}>
                    {DEVICES.find((d) => d.value === form.deviceType)?.desc}
                  </p>
                </Field>
              )}

              {form.type === "network" ? (
                <Field label="Embed code (HTML / script)" hint="Paste the full ad tag exactly as the network gives it. One ad unit per slot+device.">
                  <textarea
                    value={form.networkCode}
                    onChange={(e) => setForm((f) => ({ ...f, networkCode: e.target.value }))}
                    rows={6}
                    placeholder={"<ins class=\"eas6a97888e...\" data-zoneid=\"12345\"></ins>\n<script>(AdProvider = window.AdProvider || []).push({\"serve\": {}});</script>"}
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.75rem", resize: "vertical" }}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Banner image URL" hint="Direct URL to a JPG/PNG/GIF at the slot's recommended size.">
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="https://cdn.example.com/banner.jpg"
                      style={inputStyle}
                    />
                    {form.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.imageUrl}
                        alt="preview"
                        style={{ marginTop: "0.5rem", maxHeight: 80, borderRadius: "0.5rem", border: `1px solid ${C.border}` }}
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    )}
                  </Field>
                  <Field label="Destination URL" hint="Where a click goes — put your affiliate tracking link here.">
                    <input
                      type="url"
                      value={form.linkUrl}
                      onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                      placeholder="https://partner.com/?ref=lusthentai"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Alt text" hint="Short description for screen readers / if the image fails.">
                    <input
                      value={form.altText}
                      onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Caption title (optional)">
                    <input
                      value={form.adTitle}
                      onChange={(e) => setForm((f) => ({ ...f, adTitle: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Caption text (optional)">
                    <input
                      value={form.adDescription}
                      onChange={(e) => setForm((f) => ({ ...f, adDescription: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <Field label="Priority" hint="When a slot has several matching ads, the highest number wins; equal numbers rotate evenly.">
                  <input
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Status">
                  <button
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.7rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${C.border}`,
                      background: form.isActive ? "rgba(52,211,153,0.12)" : C.bg,
                      color: form.isActive ? "#34d399" : C.muted,
                    }}
                  >
                    {form.isActive ? "Active" : "Inactive"}
                  </button>
                </Field>
              </div>
            </div>

            {err && <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "1rem" }}>{err}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: "0.5rem 1rem", borderRadius: "0.7rem", fontSize: "0.875rem", color: C.muted, background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.7rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: C.accent,
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create ad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
