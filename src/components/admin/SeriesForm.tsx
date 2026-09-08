import type { Series, Studio, Tag } from "@prisma/client";
import { Card, Field, inputCls, SectionTitle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

type Full = Series & { studio: Studio | null; tags: Tag[] };

const TYPES = ["OVA", "ONA", "MOVIE", "SPECIAL", "SERIES"];
const STATUSES = ["ANNOUNCED", "ONGOING", "COMPLETED", "HIATUS"];
const PUBLISH = ["DRAFT", "PENDING", "PUBLISHED", "HIDDEN", "REJECTED"];
const SOURCES = ["", "ORIGINAL", "MANGA", "GAME", "VISUAL_NOVEL", "LIGHT_NOVEL", "DOUJINSHI", "OTHER"];
const SEASONS = ["", "WINTER", "SPRING", "SUMMER", "FALL"];
const DAYS = ["", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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

  return (
    <form action={action} className="grid gap-5">
      <Card className="grid gap-3 p-4">
        <SectionTitle>Titles</SectionTitle>
        <Field label="Primary title">
          <input name="title" required defaultValue={s?.title} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="English">
            <input name="titleEnglish" defaultValue={s?.titleEnglish ?? ""} className={inputCls} />
          </Field>
          <Field label="Romaji">
            <input name="titleRomaji" defaultValue={s?.titleRomaji ?? ""} className={inputCls} />
          </Field>
          <Field label="Original (JP)">
            <input name="titleOriginal" defaultValue={s?.titleOriginal ?? ""} className={inputCls} />
          </Field>
        </div>
        <Field label="Alternate titles" hint="comma-separated — used for scraper matching">
          <input name="altTitles" defaultValue={s?.altTitles.join(", ")} className={inputCls} />
        </Field>
      </Card>

      <Card className="grid gap-3 p-4">
        <SectionTitle>Content</SectionTitle>
        <Field label="Synopsis">
          <textarea
            name="synopsis"
            rows={5}
            defaultValue={s?.synopsis ?? ""}
            className={inputCls}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cover" hint="Cloudinary id or URL">
            <input name="coverUrl" defaultValue={s?.coverUrl ?? ""} className={inputCls} />
          </Field>
          <Field label="Banner" hint="Cloudinary id or URL">
            <input name="bannerUrl" defaultValue={s?.bannerUrl ?? ""} className={inputCls} />
          </Field>
        </div>
        <Field label="Tags" hint="comma-separated — created if new">
          <input
            name="tags"
            defaultValue={s?.tags.map((t) => t.name).join(", ")}
            className={inputCls}
          />
        </Field>
        <Field label="Content warnings" hint="comma-separated slugs, e.g. possible-minor">
          <input
            name="contentWarnings"
            defaultValue={s?.contentWarnings.join(", ")}
            className={inputCls}
          />
        </Field>
      </Card>

      <Card className="grid gap-3 p-4">
        <SectionTitle>Classification</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Type">
            <select name="type" defaultValue={s?.type ?? "OVA"} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={s?.status ?? "COMPLETED"} className={inputCls}>
              {STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Source material">
            <select name="sourceMaterial" defaultValue={s?.sourceMaterial ?? ""} className={inputCls}>
              {SOURCES.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Studio">
            <input name="studioName" defaultValue={s?.studio?.name ?? ""} className={inputCls} />
          </Field>
          <Field label="Year">
            <input name="year" type="number" defaultValue={s?.year ?? ""} className={inputCls} />
          </Field>
          <Field label="Season">
            <select name="animeSeason" defaultValue={s?.animeSeason ?? ""} className={inputCls}>
              {SEASONS.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Season year">
            <input name="seasonYear" type="number" defaultValue={s?.seasonYear ?? ""} className={inputCls} />
          </Field>
          <Field label="Total episodes" hint="expected">
            <input
              name="totalEpisodes"
              type="number"
              defaultValue={s?.totalEpisodes ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Airs on">
            <select name="airDay" defaultValue={s?.airDay ?? ""} className={inputCls}>
              {DAYS.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Featured rank" hint="lower = higher">
            <input
              name="featuredRank"
              type="number"
              defaultValue={s?.featuredRank ?? ""}
              className={inputCls}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            name="isCensored"
            value="true"
            defaultChecked={s ? s.isCensored : true}
            className="h-4 w-4 accent-accent"
          />
          Censored (mosaic) — most licensed Japanese releases
        </label>
      </Card>

      <Card className="flex flex-wrap items-end justify-between gap-3 p-4">
        <Field label="Publish state" className="w-40">
          <select name="publish" defaultValue={s?.publish ?? "DRAFT"} className={inputCls}>
            {PUBLISH.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {s?.externalScore != null && (
          <p className="text-xs text-white/35">
            MAL score {s.externalScore.toFixed(2)} · source: {s.metadataSource ?? "—"}
          </p>
        )}
        <SubmitButton variant="primary" pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </Card>
    </form>
  );
}
