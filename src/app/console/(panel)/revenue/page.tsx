import { getAccount, getStats, reconcileZones } from "@/lib/exoclick";
import { Card, PageHeader, SectionTitle, Stat, Table, Th, Td, Badge, EmptyState } from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue", robots: { index: false } };

function fmtMoney(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function dateRange(days: number): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: iso(from), dateTo: iso(to) };
}

async function loadData() {
  const { dateFrom, dateTo } = dateRange(30);
  const [account, byDate, byZone, reconciliation] = await Promise.all([
    getAccount(),
    getStats({ dateFrom, dateTo, groupBy: "date" }),
    getStats({ dateFrom, dateTo, groupBy: "zone_id" }),
    reconcileZones(),
  ]);
  return { account, byDate, byZone, reconciliation, dateFrom, dateTo };
}

export default async function RevenuePage() {
  let data: Awaited<ReturnType<typeof loadData>> | null = null;
  let error: string | null = null;
  try {
    data = await loadData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Revenue" subtitle="Live from ExoClick — lusthentai.com only." />
        <EmptyState
          title="Couldn't reach ExoClick"
          hint={error ?? "Check EXOCLICK_USERNAME/EXOCLICK_PASSWORD are set correctly."}
        />
      </div>
    );
  }

  const { account, byDate, byZone, reconciliation } = data;

  const days = [...byDate].sort((a, b) =>
    String(a.group_by.date?.date).localeCompare(String(b.group_by.date?.date)),
  );
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalImpressions = days.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = days.reduce((s, d) => s + d.clicks, 0);
  const maxDayRevenue = Math.max(...days.map((d) => d.revenue), 0.0001);

  const zonesByRevenue = [...byZone].sort((a, b) => b.revenue - a.revenue);
  const zoneMeta = new Map(reconciliation.map((r) => [r.zone.id, r]));
  const unused = reconciliation.filter((r) => !r.usedOnSite);
  const zeroRevenueActive = zonesByRevenue.filter((z) => {
    const id = Number(z.group_by.zone_id?.id);
    const meta = zoneMeta.get(id);
    return meta?.usedOnSite && meta.zone.active === 1 && z.revenue === 0;
  });

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle={`Live from ExoClick — lusthentai.com only, last 30 days (${data.dateFrom} to ${data.dateTo}).`}
      />

      {(unused.length > 0 || zeroRevenueActive.length > 0) && (
        <Card className="mb-6 p-4">
          <SectionTitle>Needs attention</SectionTitle>
          <ul className="space-y-1.5 text-sm text-white/70">
            {unused.map((r) => (
              <li key={r.zone.id} className="flex items-center gap-2">
                <Badge tone="amber">Not wired in</Badge>
                {r.zone.name} ({r.zone.publisher_ad_type_label}, id {r.zone.id}) is active in ExoClick but
                isn&apos;t referenced anywhere on the site.
              </li>
            ))}
            {zeroRevenueActive.map((z) => {
              const id = Number(z.group_by.zone_id?.id);
              const meta = zoneMeta.get(id);
              return (
                <li key={id} className="flex items-center gap-2">
                  <Badge tone="red">Zero revenue</Badge>
                  {meta?.zone.name ?? `Zone ${id}`} is wired in and active but earned $0 in the last 30 days.
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Balance" value={fmtMoney(account.balance)} />
        <Stat label="30-day revenue" value={fmtMoney(totalRevenue)} />
        <Stat label="30-day impressions" value={totalImpressions} />
        <Stat label="30-day clicks" value={totalClicks} />
      </div>

      <Card className="mb-6 p-4">
        <SectionTitle>Daily revenue</SectionTitle>
        <Table
          head={
            <>
              <Th>Date</Th>
              <Th className="text-right">Impressions</Th>
              <Th className="text-right">Clicks</Th>
              <Th className="text-right">CTR</Th>
              <Th className="text-right">eCPM</Th>
              <Th>Revenue</Th>
            </>
          }
        >
          {days.map((d) => {
            const date = String(d.group_by.date?.date ?? "");
            const width = Math.max(2, (d.revenue / maxDayRevenue) * 100);
            return (
              <tr key={date}>
                <Td>{date}</Td>
                <Td className="text-right tabular-nums">{d.impressions.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{d.clicks.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{d.ctr.toFixed(2)}%</Td>
                <Td className="text-right tabular-nums">{fmtMoney(d.cpm)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${width}%` }} />
                    <span className="tabular-nums text-white/85">{fmtMoney(d.revenue)}</span>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card className="p-4">
        <SectionTitle>By zone</SectionTitle>
        <Table
          head={
            <>
              <Th>Zone</Th>
              <Th>Format</Th>
              <Th className="text-right">Impressions</Th>
              <Th className="text-right">eCPM</Th>
              <Th>Revenue</Th>
              <Th>Status</Th>
            </>
          }
        >
          {zonesByRevenue.map((z) => {
            const id = Number(z.group_by.zone_id?.id);
            const meta = zoneMeta.get(id);
            return (
              <tr key={id}>
                <Td className="font-medium text-white/85">{meta?.zone.name ?? `Zone ${id}`}</Td>
                <Td className="text-white/60">{meta?.zone.publisher_ad_type_label ?? "—"}</Td>
                <Td className="text-right tabular-nums">{z.impressions.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{fmtMoney(z.cpm)}</Td>
                <Td className="tabular-nums">{fmtMoney(z.revenue)}</Td>
                <Td>
                  {!meta ? (
                    <Badge tone="red">Unknown to ExoClick</Badge>
                  ) : !meta.usedOnSite ? (
                    <Badge tone="amber">Not wired in</Badge>
                  ) : meta.zone.active === 1 ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="slate">Paused</Badge>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
