"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Megaphone, Monitor, Smartphone, Globe, Plus, Trash2 } from "lucide-react";
import { AD_SLOTS, REVENUE_META, type AdSlotId } from "@/lib/ads";
import { PageHeader, Note, EmptyState } from "@/components/console/ui";

const SLOT_KEYS = Object.keys(AD_SLOTS) as AdSlotId[];

type Variant = {
  id?: string;
  type: "network" | "affiliate";
  networkCode: string;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  adTitle: string;
  adDescription: string;
  priority: number;
  active: boolean;
  /** read-only, from the DB — not sent back on save */
  impressions: number;
  clicks: number;
};
const emptyVariant = (): Variant => ({
  type: "network",
  networkCode: "",
  imageUrl: "",
  linkUrl: "",
  altText: "",
  adTitle: "",
  adDescription: "",
  priority: 0,
  active: true,
  impressions: 0,
  clicks: 0,
});
function fromRow(r: Record<string, unknown>): Variant {
  return {
    id: String(r.id ?? ""),
    type: r.type === "affiliate" ? "affiliate" : "network",
    networkCode: String(r.networkCode ?? ""),
    imageUrl: String(r.imageUrl ?? ""),
    linkUrl: String(r.linkUrl ?? ""),
    altText: String(r.altText ?? ""),
    adTitle: String(r.adTitle ?? ""),
    adDescription: String(r.adDescription ?? ""),
    priority: Number(r.priority ?? 0),
    active: r.isActive !== false,
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
  };
}
function filled(v: Variant): boolean {
  return v.type === "affiliate"
    ? !!(v.imageUrl.trim() && v.linkUrl.trim())
    : !!v.networkCode.trim();
}

type Band = "desktop" | "mobile" | "all";
type Pools = Record<Band, Variant[]>;

/** One creative in a slot's rotation pool — same shape every band uses. */
function VariantCard({
  v,
  onChange,
  onRemove,
}: {
  v: Variant;
  onChange: (v: Variant) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Variant>) => onChange({ ...v, ...patch });
  return (
    <div className="c-card c-card-pad">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["network", "affiliate"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ type: t })}
              className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
                v.type === t ? "bg-accent text-white" : "bg-bg text-muted ring-1 ring-inset ring-line hover:text-white"
              }`}
            >
              {t === "network" ? "Ad code" : "Banner image"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={v.active}
              onChange={(e) => set({ active: e.target.checked })}
              className="h-3.5 w-3.5 accent-accent"
            />
            Live
          </label>
          <button type="button" onClick={onRemove} title="Remove from pool" className="c-icon-x">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {v.type === "network" ? (
        <textarea
          value={v.networkCode}
          onChange={(e) => set({ networkCode: e.target.value })}
          rows={4}
          placeholder="Paste the ExoClick / ad-network / affiliate embed for this device only"
          className="c-input font-mono text-xs"
        />
      ) : (
        <div className="space-y-1.5">
          <input value={v.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="Banner image URL" className="c-input" />
          <input value={v.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="Destination URL (your affiliate link)" className="c-input" />
          <div className="grid grid-cols-2 gap-1.5">
            <input value={v.adTitle} onChange={(e) => set({ adTitle: e.target.value })} placeholder="Caption title (optional)" className="c-input text-[13px]" />
            <input value={v.altText} onChange={(e) => set({ altText: e.target.value })} placeholder="Alt text" className="c-input text-[13px]" />
          </div>
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-muted">Priority</span>
        <input
          type="number"
          value={v.priority}
          onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
          className="c-input w-[4.5rem] !py-1 text-[13px]"
        />
        <span className="text-[10px] text-muted">equal priority rotates randomly · higher always wins over lower</span>
      </div>

      {v.id && (
        <div className="mt-1.5 text-[10px] text-muted">
          {v.impressions.toLocaleString()} impressions
          {v.type === "affiliate" && <> · {v.clicks.toLocaleString()} clicks</>}
          {v.type === "network" && <> · clicks tracked by the ad network itself (sub-id in the embed), not here</>}
        </div>
      )}
    </div>
  );
}

function PoolPanel({
  band,
  icon,
  hint,
  disabled,
  items,
  onChange,
}: {
  band: string;
  icon: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  items: Variant[];
  onChange: (items: Variant[]) => void;
}) {
  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          {icon} {band} — not available for this slot
        </span>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {icon} {band}
          {items.length > 1 && <span className="text-[11px] font-medium text-muted">— {items.length} in rotation</span>}
        </span>
      </div>
      {hint && <p className="mb-2 text-[11px] text-muted">{hint}</p>}
      <div className="space-y-2">
        {items.map((v, i) => (
          <VariantCard
            key={v.id ?? `new-${i}`}
            v={v}
            onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, emptyVariant()])} className="c-btn-ghost mt-2 !px-2.5 border border-dashed border-line">
        <Plus size={13} /> Add creative
      </button>
    </div>
  );
}

export function AdsManager() {
  const [status, setStatus] = useState<Record<string, { desktop: boolean; mobile: boolean; all: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [openSlot, setOpenSlot] = useState<AdSlotId | null>(null);
  const [editing, setEditing] = useState<Pools | null>(null);
  // each band's row-id set as last seen from GET — echoed back on save so the
  // server can detect another admin's edit in between (see slot/route.ts)
  const [versions, setVersions] = useState<Record<Band, string[]> | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/console/ads");
    const rows: { slot: string; deviceType: string; isActive: boolean }[] = r.ok ? await r.json() : [];
    const s: Record<string, { desktop: boolean; mobile: boolean; all: boolean }> = {};
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
    setVersions(null);
    setErr(null);
    const r = await fetch(`/api/console/ads/slot?slot=${slot}`);
    const d = r.ok ? await r.json() : {};
    const rowsOf = (band: Band): Record<string, unknown>[] => (Array.isArray(d[band]) ? d[band] : []);
    setEditing({
      desktop: rowsOf("desktop").map(fromRow),
      mobile: rowsOf("mobile").map(fromRow),
      all: rowsOf("all").map(fromRow),
    });
    setVersions({
      desktop: rowsOf("desktop").map((r) => String(r.id)),
      mobile: rowsOf("mobile").map((r) => String(r.id)),
      all: rowsOf("all").map((r) => String(r.id)),
    });
  }

  async function save() {
    if (!openSlot || !editing) return;
    setSaving(true);
    setErr(null);
    const pack = (items: Variant[]) => items.filter(filled);
    const r = await fetch("/api/console/ads/slot", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: openSlot,
        desktop: pack(editing.desktop),
        mobile: pack(editing.mobile),
        all: pack(editing.all),
        versions,
      }),
    });
    setSaving(false);
    if (r.status === 409) {
      setErr("This slot was changed by someone else. Close and reopen it to see the latest, then redo your edit.");
      return;
    }
    if (!r.ok) {
      setErr("Save failed. Try again.");
      return;
    }
    setOpenSlot(null);
    setEditing(null);
    setVersions(null);
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
      <PageHeader title="Ad slots" />
      <Note>
        Each slot per device holds a rotation pool, not just one creative — <strong className="text-white">add several</strong> and they rotate
        randomly across pageviews (equal priority = equal share; raise one&apos;s priority to make it win outright). A code or banner you add
        under <strong className="text-white">Desktop</strong> only ever serves on desktop; <strong className="text-white">Mobile</strong> only on
        phones; <strong className="text-white">All devices</strong> is the fallback when the specific band is empty.
      </Note>

      {loading ? (
        <div className="py-12 text-center text-muted">Loading…</div>
      ) : (
        Object.entries(grouped).map(([page, keys]) => (
          <div key={page} className="mb-7">
            <h2 className="mb-2.5 font-display text-sm font-bold uppercase tracking-wider text-white">{page} pages</h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {keys.map((k) => {
                const s = status[k] ?? { desktop: false, mobile: false, all: false };
                const d = AD_SLOTS[k];
                const r = REVENUE_META[d.hint.revenue];
                const anyLive = s.desktop || s.mobile || s.all;
                return (
                  <button key={k} onClick={() => open(k)} className="c-card c-card-pad flex flex-col text-left transition-colors hover:border-accent/40">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${anyLive ? "bg-good" : "bg-white/25"}`} />
                      <span className="text-[13px] font-semibold text-white">{d.label}</span>
                    </div>
                    <span className="text-[11px] text-muted">{d.description}</span>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-[0.08rem] text-[10px] font-bold"
                        style={{ color: r.color, background: `${r.color}1e` }}
                      >
                        {r.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted">
                        {d.desktop && <span className={s.desktop ? "text-good" : ""}>D</span>}
                        {d.mobile && <span className={s.mobile ? "text-good" : ""}>M</span>}
                        <span className={s.all ? "text-good" : ""}>A</span>
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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenSlot(null);
          }}
        >
          <div className="c-card my-8 w-full max-w-lg p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[1.05rem] font-bold text-white">{def.label}</h3>
                <p className="text-xs text-muted">{def.description}</p>
              </div>
              <button onClick={() => setOpenSlot(null)} className="c-icon-x">
                <X size={20} />
              </button>
            </div>

            {rev && (
              <div className="mb-3 rounded-lg p-2.5 text-[11px] text-muted" style={{ background: `${rev.color}12`, border: `1px solid ${rev.color}33` }}>
                <strong style={{ color: rev.color }}>{rev.label}</strong> · best format: <strong className="text-white">{def.hint.format}</strong> ·{" "}
                {def.hint.size}
              </div>
            )}

            {!editing ? (
              <div className="py-8 text-center text-sm text-muted">Loading…</div>
            ) : (
              <div className="space-y-4">
                <PoolPanel band="Desktop" icon={<Monitor size={13} />} disabled={!def.desktop} items={editing.desktop} onChange={(items) => setEditing({ ...editing, desktop: items })} />
                <PoolPanel band="Mobile" icon={<Smartphone size={13} />} disabled={!def.mobile} items={editing.mobile} onChange={(items) => setEditing({ ...editing, mobile: items })} />
                <PoolPanel
                  band="All devices"
                  icon={<Globe size={13} />}
                  hint="Used on any device where the specific panel above is empty."
                  items={editing.all}
                  onChange={(items) => setEditing({ ...editing, all: items })}
                />
              </div>
            )}

            {err && <p className="mt-3 text-xs text-bad">{err}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpenSlot(null)} className="c-btn-ghost">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !editing} className="c-btn-primary">
                {saving ? "Saving…" : "Save slot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && SLOT_KEYS.every((k) => !status[k] || (!status[k].desktop && !status[k].mobile && !status[k].all)) && (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No ads live yet" hint="Open a slot above and paste a code." />
      )}
    </>
  );
}
