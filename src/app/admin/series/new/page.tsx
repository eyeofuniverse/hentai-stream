import Link from "next/link";
import { redirect } from "next/navigation";
import { createSeries } from "@/lib/actions";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewSeriesPage() {
  async function action(form: FormData) {
    "use server";
    const id = await createSeries(form);
    redirect(`/admin/series/${id}`);
  }

  return (
    <div>
      <PageHeader
        title="New series"
        subtitle="For titles MyAnimeList doesn't have. Everything else comes in via the metadata sync."
        actions={
          <Link href="/admin/series" className="text-sm text-white/40 hover:text-white">
            ← Series
          </Link>
        }
      />
      <SeriesForm action={action} submitLabel="Create series" />
    </div>
  );
}
