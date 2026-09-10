import { moderationQueue } from "@/lib/comment-mod";
import { PageHeader, Card, EmptyState } from "@/components/console/ui";
import { CommentModRow } from "@/components/console/CommentModRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comments", robots: { index: false } };

function targetHref(t: { targetType: string; targetId: string }) {
  return null; // comment targets are ids, not slugs — no deep link for now
}
void targetHref;

export default async function CommentsModPage() {
  const { reported, hidden } = await moderationQueue();

  return (
    <div>
      <PageHeader
        title="Comments"
        subtitle="Reported and auto-hidden comments. Deleting a comment removes its replies too."
      />

      <h2 className="mb-3 mt-2 text-sm font-bold uppercase tracking-wider text-white/45">
        Reported{reported.length ? ` (${reported.length})` : ""}
      </h2>
      {reported.length === 0 ? (
        <EmptyState title="No open reports." />
      ) : (
        <div className="grid gap-2">
          {reported.map((c) => (
            <Card key={c.id} className="p-3">
              <CommentModRow
                id={c.id}
                body={c.body}
                status={c.status}
                author={c.profile?.displayName || c.profile?.handle || "?"}
                createdAt={c.createdAt.toISOString()}
                replyCount={c._count.replies}
                report={{
                  count: c.report.count,
                  reasons: c.report.reasons,
                }}
              />
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-white/45">
        Auto-hidden{hidden.length ? ` (${hidden.length})` : ""}
      </h2>
      {hidden.length === 0 ? (
        <EmptyState title="Nothing auto-hidden." />
      ) : (
        <div className="grid gap-2">
          {hidden.map((c) => (
            <Card key={c.id} className="p-3">
              <CommentModRow
                id={c.id}
                body={c.body}
                status="HIDDEN"
                author={c.profile?.displayName || c.profile?.handle || "?"}
                createdAt={c.createdAt.toISOString()}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
