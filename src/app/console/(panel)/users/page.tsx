import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { prisma, db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin/auth";
import { banUser, unbanUser, setUserRole } from "@/lib/actions";
import { SubmitButton } from "@/components/console/SubmitButton";
import {
  PageHeader,
  Badge,
  FilterTabs,
  Pagination,
  EmptyState,
  inputCls,
  timeAgo,
} from "@/components/console/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const PER = 50;
const ROLES: Role[] = ["USER", "UPLOADER", "MODERATOR", "ADMIN"];
const ROLE_TONE: Record<Role, string> = {
  USER: "slate",
  UPLOADER: "violet",
  MODERATOR: "amber",
  ADMIN: "pink",
};

type SP = { q?: string; status?: string; role?: string; page?: string };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["banned", "staff"].includes(sp.status ?? "") ? sp.status! : "all";
  const roleFilter = ROLES.includes((sp.role ?? "") as Role) ? (sp.role as Role) : null;

  const me = await getAdminSession();
  const canChangeRoles = me?.role === "ADMIN" || me?.role === "OWNER";

  const where: Prisma.ProfileWhereInput = {
    ...(status === "banned" ? { banned: true } : {}),
    ...(status === "staff" ? { role: { in: ["MODERATOR", "ADMIN"] } } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(sp.q
      ? {
          OR: [
            { handle: { contains: sp.q, mode: "insensitive" } },
            { displayName: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, bannedCount, staffCount] = await db(() =>
    Promise.all([
      prisma.profile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER,
        take: PER,
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          reputation: true,
          strikes: true,
          banned: true,
          bannedReason: true,
          bannedUntil: true,
          createdAt: true,
          _count: { select: { comments: true, ratings: true, reportsFiled: true } },
        },
      }),
      prisma.profile.count({ where }),
      prisma.profile.count({ where: { banned: true } }),
      prisma.profile.count({ where: { role: { in: ["MODERATOR", "ADMIN"] } } }),
    ]),
  );

  const pages = Math.ceil(total / PER);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    p.delete("page");
    return `/console/users?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${total.toLocaleString()} matching · ${bannedCount} banned · ${staffCount} staff (mod/admin)`}
      />

      <form className="mb-3">
        {(["status", "role"] as const).map((k) =>
          sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null,
        )}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search by handle or display name…"
          className={`${inputCls} max-w-sm`}
        />
      </form>

      <div className="mb-3 space-y-2">
        <FilterTabs
          current={status}
          hrefFor={(v) => qs({ status: v === "all" ? undefined : v })}
          options={[
            { value: "all", label: "All" },
            { value: "banned", label: "Banned", count: bannedCount },
            { value: "staff", label: "Mod/Admin", count: staffCount },
          ]}
        />
        <FilterTabs
          current={roleFilter ?? "any"}
          hrefFor={(v) => qs({ role: v === "any" ? undefined : v })}
          options={[
            { value: "any", label: "Any role" },
            ...ROLES.map((r) => ({ value: r, label: r[0] + r.slice(1).toLowerCase() })),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No users match these filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="hidden items-center gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/35 sm:flex">
            <span className="w-8" />
            <span className="flex-1">User</span>
            <span className="w-28">Role</span>
            <span className="w-28">Activity</span>
            <span className="w-20">Joined</span>
            <span className="w-56 text-right">Status</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {rows.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 px-3 py-3 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white/85">
                      {u.displayName || u.handle}
                    </div>
                    <div className="truncate text-xs text-white/40">@{u.handle}</div>
                    {/* compact stand-in for the role/activity/joined columns, mobile only */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/45 sm:hidden">
                      <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                      <span>
                        {u._count.comments} comments · {u._count.ratings} ratings
                      </span>
                      {u.strikes > 0 && <span className="text-rose-400/80">{u.strikes} strikes</span>}
                      <span>joined {timeAgo(u.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden w-28 sm:block">
                  {canChangeRoles ? (
                    <form action={changeRole.bind(null, u.id)} className="flex items-center gap-1">
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border border-white/12 bg-white/[0.03] px-1.5 py-1 text-xs text-white/80 outline-none focus:border-accent/60"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} className="bg-surface">
                            {r}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="ghost" size="sm" pendingText="…">
                        ✓
                      </SubmitButton>
                    </form>
                  ) : (
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                  )}
                </div>

                <div className="hidden w-28 text-xs text-white/50 sm:block">
                  {u._count.comments} comments
                  <br />
                  {u._count.ratings} ratings
                  {u.strikes > 0 && (
                    <>
                      <br />
                      <span className="text-rose-400/80">{u.strikes} strikes</span>
                    </>
                  )}
                </div>

                <div className="hidden w-20 text-xs text-white/35 sm:block">{timeAgo(u.createdAt)}</div>

                {/* role editor, mobile only — desktop gets the inline column above */}
                {canChangeRoles && (
                  <form action={changeRole.bind(null, u.id)} className="flex items-center gap-1.5 sm:hidden">
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="flex-1 rounded-md border border-white/12 bg-white/[0.03] px-2 py-1.5 text-xs text-white/80 outline-none focus:border-accent/60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} className="bg-surface">
                          {r}
                        </option>
                      ))}
                    </select>
                    <SubmitButton variant="secondary" size="sm" pendingText="…">
                      Change role
                    </SubmitButton>
                  </form>
                )}

                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-56 sm:flex-nowrap sm:justify-end">
                  {u.banned ? (
                    <>
                      <div className="min-w-0 flex-1 text-xs sm:flex-none sm:text-right">
                        <Badge tone="red">Banned</Badge>
                        {u.bannedUntil && (
                          <div className="mt-0.5 text-white/35">until {u.bannedUntil.toLocaleDateString()}</div>
                        )}
                        {u.bannedReason && (
                          <div className="mt-0.5 truncate text-white/35" title={u.bannedReason}>
                            {u.bannedReason}
                          </div>
                        )}
                      </div>
                      <form action={unbanUser.bind(null, u.id)}>
                        <SubmitButton variant="secondary" size="sm" pendingText="…">
                          Unban
                        </SubmitButton>
                      </form>
                    </>
                  ) : (
                    <BanForm profileId={u.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(p) => {
          const u = new URLSearchParams();
          for (const [k, v] of Object.entries(sp)) if (v && k !== "page") u.set(k, String(v));
          u.set("page", String(p));
          return `/console/users?${u.toString()}`;
        }}
      />
    </div>
  );
}

async function changeRole(profileId: string, formData: FormData) {
  "use server";
  const role = String(formData.get("role") ?? "") as Role;
  if (ROLES.includes(role)) await setUserRole(profileId, role);
}

function BanForm({ profileId }: { profileId: string }) {
  async function ban(formData: FormData) {
    "use server";
    const reason = String(formData.get("reason") ?? "");
    const days = Number(formData.get("days") ?? "");
    await banUser(profileId, reason, Number.isFinite(days) && days > 0 ? days : undefined);
  }
  return (
    <form action={ban} className="flex items-center gap-1">
      <input
        name="reason"
        placeholder="Reason"
        required
        className="w-24 rounded-md border border-white/12 bg-white/[0.03] px-1.5 py-1 text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-accent/60"
      />
      <input
        name="days"
        type="number"
        min={1}
        placeholder="days"
        title="Days until the ban lifts — leave blank for permanent"
        className="w-14 rounded-md border border-white/12 bg-white/[0.03] px-1.5 py-1 text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-accent/60"
      />
      <SubmitButton
        variant="danger"
        size="sm"
        pendingText="…"
        confirm="Ban this user? They'll be blocked from commenting/rating until unbanned."
      >
        Ban
      </SubmitButton>
    </form>
  );
}
