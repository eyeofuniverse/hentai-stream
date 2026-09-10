import { getAdConfig, AD_SLOTS, AD_FORMATS, type SlotConfig } from "@/lib/ads";
import { saveAdConfig } from "@/lib/ad-actions";
import { PageHeader, Card, SectionTitle, inputCls } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const sel = `${inputCls} py-1.5 text-xs`;
const box = "h-4 w-4 rounded border-white/20 bg-white/5 accent-accent";

function VariantFields({
  name,
  v,
  formats,
}: {
  name: string;
  v: { enabled: boolean; source: string; zoneId: string; code: string; format: string };
  formats: readonly string[];
}) {
  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-2 text-xs text-white/70">
        <input type="checkbox" name={`${name}.enabled`} defaultChecked={v.enabled} className={box} />
        Enabled
      </label>
      <div className="flex gap-1.5">
        <select name={`${name}.source`} defaultValue={v.source} className={sel}>
          <option value="zone">Zone ID</option>
          <option value="code">Raw code</option>
        </select>
        <select name={`${name}.format`} defaultValue={v.format} className={sel}>
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <input
        name={`${name}.zoneId`}
        defaultValue={v.zoneId}
        placeholder="zone id"
        className={`${inputCls} py-1.5 text-xs`}
      />
      <textarea
        name={`${name}.code`}
        defaultValue={v.code}
        rows={2}
        placeholder="<ins …> / <script> (only if source = raw code)"
        className={`${inputCls} py-1.5 font-mono text-[11px]`}
      />
    </div>
  );
}

export default async function AdminAdsPage() {
  const cfg = await getAdConfig();

  const grouped = AD_SLOTS.reduce<Record<string, typeof AD_SLOTS>>((acc, s) => {
    (acc[s.page] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Ad slots"
        subtitle="Every ad position on the site. Slots and universal units render nothing until the master switch and the slot are both on."
      />

      <form action={saveAdConfig} className="space-y-6">
        {/* ── globals ── */}
        <Card className="p-4">
          <SectionTitle>Global</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className={box} />
              Ads enabled site-wide (master switch)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" name="consentLine" defaultChecked={cfg.consentLine} className={box} />
              Show the cookie / ads line in the age gate
            </label>
            <div>
              <span className="mb-1 block text-xs text-white/45">Network</span>
              <select name="network" defaultValue={cfg.network} className={sel}>
                {["exoclick", "trafficjunky", "juicyads", "hilltopads", "adsterra", "custom"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-white/45">Provider script URL (loaded once)</span>
              <input
                name="providerScript"
                defaultValue={cfg.providerScript}
                placeholder="https://a.magsrv.com/ad-provider.js"
                className={`${inputCls} py-1.5 text-xs`}
              />
            </div>
          </div>
        </Card>

        {/* ── universal: popunder ── */}
        <Card className="p-4">
          <SectionTitle>Popunder (universal)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" name="popunder.enabled" defaultChecked={cfg.popunder.enabled} className={box} />
              Enabled
            </label>
            <select name="popunder.source" defaultValue={cfg.popunder.source} className={sel}>
              <option value="zone">Zone ID</option>
              <option value="code">Raw code</option>
            </select>
            <input
              name="popunder.zoneId"
              defaultValue={cfg.popunder.zoneId}
              placeholder="zone id"
              className={`${inputCls} py-1.5 text-xs`}
            />
            <label className="text-xs text-white/45">
              Cooldown (hours)
              <input
                name="popunder.cooldownHours"
                type="number"
                min={1}
                max={168}
                defaultValue={cfg.popunder.cooldownHours}
                className={`${inputCls} mt-1 py-1.5 text-xs`}
              />
            </label>
          </div>
          <textarea
            name="popunder.code"
            defaultValue={cfg.popunder.code}
            rows={2}
            placeholder="raw popunder code (only if source = raw code)"
            className={`${inputCls} mt-2 py-1.5 font-mono text-[11px]`}
          />
        </Card>

        {/* ── universal: VAST ── */}
        <Card className="p-4">
          <SectionTitle>Video ad — VAST (in player)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" name="vast.enabled" defaultChecked={cfg.vast.enabled} className={box} />
              Enabled
            </label>
            <input
              name="vast.tagUrl"
              defaultValue={cfg.vast.tagUrl}
              placeholder="VAST tag URL (set on the Bunny player / passed to the mirror player)"
              className={`${inputCls} py-1.5 text-xs`}
            />
          </div>
          <p className="mt-2 text-xs text-white/35">
            For Bunny-hosted episodes the VAST tag is configured on the Bunny Stream player;
            this value is surfaced here for reference and used by the fallback mirror player.
          </p>
        </Card>

        {/* ── slots ── */}
        {Object.entries(grouped).map(([page, slots]) => (
          <Card key={page} className="p-4">
            <SectionTitle>{page} pages</SectionTitle>
            <div className="space-y-4">
              {slots.map((s) => {
                const sc: SlotConfig = cfg.slots[s.key];
                return (
                  <div key={s.key} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-white/85">
                        {s.name}{" "}
                        <code className="ml-1 rounded bg-white/5 px-1 text-[11px] text-white/40">
                          {s.key}
                        </code>
                      </p>
                      <p className="text-xs text-white/40">{s.where}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/35">
                          Desktop {s.desktop ? "" : "— n/a"}
                        </p>
                        {s.desktop ? (
                          <VariantFields
                            name={`slot.${s.key}.desktop`}
                            v={sc.desktop}
                            formats={AD_FORMATS}
                          />
                        ) : (
                          <p className="text-xs text-white/25">This slot is mobile-only.</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/35">
                          Mobile {s.mobile ? "" : "— n/a"}
                        </p>
                        {s.mobile ? (
                          <VariantFields
                            name={`slot.${s.key}.mobile`}
                            v={sc.mobile}
                            formats={AD_FORMATS}
                          />
                        ) : (
                          <p className="text-xs text-white/25">This slot is desktop-only.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        <div className="sticky bottom-4 flex justify-end">
          <SubmitButton pendingText="Saving…">Save ad configuration</SubmitButton>
        </div>
      </form>
    </div>
  );
}
