import { redirect } from "next/navigation";
import { createSeries } from "@/lib/actions";
import { SeriesForm } from "@/components/admin/SeriesForm";

export default function NewSeriesPage() {
  async function action(form: FormData) {
    "use server";
    const id = await createSeries(form);
    redirect(`/admin/series/${id}`);
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">New series</h1>
      <SeriesForm action={action} submitLabel="Create" />
    </div>
  );
}
