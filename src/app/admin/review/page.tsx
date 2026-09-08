import Link from "next/link";
import { prisma, db } from "@/lib/db";
import { reviewFlag } from "@/lib/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LinkButton,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function ReviewQueue() {
  const flagged = await db(() =>
    prisma.series.findMany({
      where: {
        contentWarnings: { has: "possible-minor" },
        publish: { not: "REJECTED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        synopsis: true,
        year: true,
        publish: true,
        createdAt: true,
        malId: true,
      },
    }),
  );

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle="Titles the importer flagged for possible underage content. Each stays DRAFT and out of the catalogue until you clear or reject it."
      />

      {flagged.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          hint="Nothing is currently flagged for review."
        />
      ) : (
        <div className="grid gap-3">
          {flagged.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="pink">⚑ possible-minor</Badge>
                <Link
                  href={`/admin/series/${s.id}`}
                  className="font-semibold text-white hover:text-accent"
                >
                  {s.title}
                </Link>
                {s.year && <span className="text-xs text-white/35">{s.year}</span>}
                {s.malId && <Badge tone="violet">MAL #{s.malId}</Badge>}
                <span className="ml-auto text-xs text-white/30">
                  imported {timeAgo(s.createdAt)}
                </span>
              </div>

              {s.synopsis && (
                <p className="mb-3 line-clamp-3 text-sm text-white/55">{s.synopsis}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <form action={reviewFlag.bind(null, s.id, "clear")}>
                  <SubmitButton
                    variant="secondary"
                    size="sm"
                    confirm={`Clear the flag on "${s.title}"? It stays DRAFT — you still publish it manually once it has video.`}
                    pendingText="…"
                  >
                    Clear flag
                  </SubmitButton>
                </form>
                <form action={reviewFlag.bind(null, s.id, "reject")}>
                  <SubmitButton
                    variant="danger"
                    size="sm"
                    confirm={`Reject "${s.title}"? It will be hidden permanently.`}
                    pendingText="…"
                  >
                    Reject
                  </SubmitButton>
                </form>
                <LinkButton href={`/admin/series/${s.id}`} variant="ghost" size="sm">
                  Open editor →
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
