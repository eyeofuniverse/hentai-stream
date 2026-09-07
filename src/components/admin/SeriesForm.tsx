import type { Series, Studio, Tag } from "@prisma/client";

type Full = Series & { studio: Studio | null; tags: Tag[] };

export function SeriesForm({
  action,
  series,
  submitLabel,
}: {
  action: (form: FormData) => void | Promise<void>;
  series?: Full | null;
  submitLabel: string;
}) {
  const s = series;
  const input =
    "w-full rounded-lg border border-white/10 bg-surface p-2.5 text-sm outline-none focus:border-white/25";

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-xs text-white/50">
        Title
        <input name="title" required defaultValue={s?.title} className={input} />
      </label>

      <label className="grid gap-1 text-xs text-white/50">
        Alternate titles (comma-separated)
        <input name="altTitles" defaultValue={s?.altTitles.join(", ")} className={input} />
      </label>

      <label className="grid gap-1 text-xs text-white/50">
        Synopsis
        <textarea name="synopsis" rows={4} defaultValue={s?.synopsis ?? ""} className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-white/50">
          Cover (Cloudinary id or URL)
          <input name="coverUrl" defaultValue={s?.coverUrl ?? ""} className={input} />
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Banner (Cloudinary id or URL)
          <input name="bannerUrl" defaultValue={s?.bannerUrl ?? ""} className={input} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-xs text-white/50">
          Type
          <select name="type" defaultValue={s?.type ?? "OVA"} className={input}>
            {["OVA", "ONA", "MOVIE", "SPECIAL", "SERIES"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Status
          <select name="status" defaultValue={s?.status ?? "COMPLETED"} className={input}>
            {["ONGOING", "COMPLETED", "HIATUS"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Year
          <input name="year" type="number" defaultValue={s?.year ?? ""} className={input} />
        </label>
        <label className="grid gap-1 text-xs text-white/50">
          Publish
          <select name="publish" defaultValue={s?.publish ?? "PUBLISHED"} className={input}>
            {["PUBLISHED", "PENDING", "HIDDEN", "REJECTED"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-white/50">
          Studio
          <input name="studioName" defaultValue={s?.studio?.name ?? ""} className={input} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="isCensored"
            value="true"
            defaultChecked={s ? s.isCensored : true}
            className="accent-accent"
          />
          Censored
        </label>
      </div>

      <label className="grid gap-1 text-xs text-white/50">
        Tags (comma-separated — created if new)
        <input name="tags" defaultValue={s?.tags.map((t) => t.name).join(", ")} className={input} />
      </label>

      <button className="mt-1 justify-self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold">
        {submitLabel}
      </button>
    </form>
  );
}
