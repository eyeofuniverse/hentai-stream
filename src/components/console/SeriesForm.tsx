import type { Series, Studio, Tag } from "@prisma/client";
import { Card, Field, inputCls, SectionTitle } from "@/components/console/ui";
import { SubmitButton } from "@/components/console/SubmitButton";

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
    <form action={action} className="grid gap-4">
      <Card className="grid gap-4 p-4 sm:p-5">
        <SectionTitle>Titles</SectionTitle>
        <Field
          label="Primary title"
          info="The main title shown across the site — usually the romaji (e.g. 'Bible Black'). Required."
        >
          <input name="title" required defaultValue={s?.title} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="English" info="Official English title, if one exists. Shown as a subtitle and used for SEO and scraper matching.">
            <input name="titleEnglish" defaultValue={s?.titleEnglish ?? ""} className={inputCls} />
          </Field>
          <Field label="Romaji" info="Romanised Japanese title.">
            <input name="titleRomaji" defaultValue={s?.titleRomaji ?? ""} className={inputCls} />
          </Field>
          <Field label="Original (JP)" info="Native Japanese title in kanji / kana.">
            <input name="titleOriginal" defaultValue={s?.titleOriginal ?? ""} className={inputCls} />
          </Field>
        </div>
        <Field
          label="Alternate titles"
          hint="comma-separated"
          info="Every other name this goes by — old titles, fan translations, abbreviations. The scraper matches source-site episodes against these, so add generously."
        >
          <input name="altTitles" defaultValue={s?.altTitles.join(", ")} className={inputCls} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-4 sm:p-5">
        <SectionTitle>Content</SectionTitle>
        <Field
          label="Synopsis"
          info="Plot summary. Shown on the series page and used as the search-engine meta description. Auto-filled from MyAnimeList."
        >
          <textarea name="synopsis" rows={5} defaultValue={s?.synopsis ?? ""} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cover" hint="Cloudinary id or URL" info="Portrait poster image (2:3 ratio). Auto-filled from MyAnimeList.">
            <input name="coverUrl" defaultValue={s?.coverUrl ?? ""} className={inputCls} />
          </Field>
          <Field label="Banner" hint="Cloudinary id or URL" info="Wide hero image (16:5) for the top of the series page. Optional.">
            <input name="bannerUrl" defaultValue={s?.bannerUrl ?? ""} className={inputCls} />
          </Field>
        </div>
        <Field
          label="Tags"
          hint="comma-separated"
          info="Genres, themes and fetishes. New tags are created automatically. These power the /tag/ browse pages and are a major SEO lever."
        >
          <input name="tags" defaultValue={s?.tags.map((t) => t.name).join(", ")} className={inputCls} />
        </Field>
        <Field
          label="Content warnings"
          hint="comma-separated slugs"
          info="Flags like 'possible-minor' — that one hides the series and blocks auto-publishing until a moderator clears it in the review queue."
        >
          <input name="contentWarnings" defaultValue={s?.contentWarnings.join(", ")} className={inputCls} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-4 sm:p-5">
        <SectionTitle>Classification</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Type" info="OVA / ONA / Movie / Special / Series — the release format.">
            <select name="type" defaultValue={s?.type ?? "OVA"} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" info="Announced (not out yet) / Ongoing / Completed / Hiatus.">
            <select name="status" defaultValue={s?.status ?? "COMPLETED"} className={inputCls}>
              {STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Source material" info="What this was adapted from — manga, game, visual novel, or an original work.">
            <select name="sourceMaterial" defaultValue={s?.sourceMaterial ?? ""} className={inputCls}>
              {SOURCES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ") || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Studio" info="Animation studio or circle. Created if it doesn't exist. Powers the /studio/ pages.">
            <input name="studioName" defaultValue={s?.studio?.name ?? ""} className={inputCls} />
          </Field>
          <Field label="Year" info="Release year.">
            <input name="year" type="number" defaultValue={s?.year ?? ""} className={inputCls} />
          </Field>
          <Field label="Season" info="Winter / Spring / Summer / Fall — the airing season.">
            <select name="animeSeason" defaultValue={s?.animeSeason ?? ""} className={inputCls}>
              {SEASONS.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Season year" info="Year that season falls in — usually the same as Year.">
            <input name="seasonYear" type="number" defaultValue={s?.seasonYear ?? ""} className={inputCls} />
          </Field>
          <Field label="Total episodes" hint="expected" info="How many episodes this series has in total (per MyAnimeList). Drives the '3 / 12 available' display.">
            <input name="totalEpisodes" type="number" defaultValue={s?.totalEpisodes ?? ""} className={inputCls} />
          </Field>
          <Field label="Airs on" info="For ongoing series — the weekday new episodes drop.">
            <select name="airDay" defaultValue={s?.airDay ?? ""} className={inputCls}>
              {DAYS.map((t) => (
                <option key={t} value={t}>
                  {t || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Featured rank" hint="lower = higher" info="Position in the homepage hero rotation. Lower number = shown first. Blank = not featured.">
            <input name="featuredRank" type="number" defaultValue={s?.featuredRank ?? ""} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-white/70">
          <input
            type="checkbox"
            name="isCensored"
            value="true"
            defaultChecked={s ? s.isCensored : true}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            Censored (mosaic)
            <span className="block text-xs text-white/40">
              On for the standard Japanese release; off for an uncensored version.
            </span>
          </span>
        </label>
      </Card>

      {s?.externalScore != null && (
        <p className="px-1 text-xs text-white/35">
          MyAnimeList score {s.externalScore.toFixed(2)} · metadata source:{" "}
          {s.metadataSource ?? "—"}
        </p>
      )}

      {/* save bar — sticks to the viewport bottom while the form is on screen */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-1 flex items-end gap-3 border-t border-white/10 bg-bg/90 px-4 py-3 backdrop-blur">
        <Field
          label="Publish"
          className="w-36"
          info="DRAFT = hidden. PUBLISHED = live. PENDING = awaiting review. HIDDEN = manually pulled. REJECTED = permanently removed."
        >
          <select name="publish" defaultValue={s?.publish ?? "DRAFT"} className={inputCls}>
            {PUBLISH.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <SubmitButton variant="primary" pendingText="Saving…" className="ml-auto">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
