import Link from "next/link";
import type { ReactNode } from "react";
import { gradientFor } from "@/lib/gradient";
import { coverSet, COVER_SIZES } from "@/lib/cloudinary";

export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "good" | "solid";
  className?: string;
}) {
  const tones = {
    default: "bg-white/8 text-white/70",
    accent: "bg-accent/15 text-accent",
    good: "bg-good/15 text-good",
    solid: "bg-white/10 text-white backdrop-blur-sm",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  href,
  linkLabel = "View all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight sm:text-xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
        {title}
      </h2>
      {children}
      {href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-white/40 transition-colors hover:text-accent"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

/** Portrait artwork with a deterministic gradient fallback and hover zoom. */
export function Poster({
  src,
  coverId,
  title,
  seed,
  priority,
  className = "",
  children,
}: {
  src: string | null;
  /** raw stored cover value — enables a responsive srcset */
  coverId?: string | null;
  title: string;
  seed: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-white/5 ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          srcSet={coverSet(coverId) ?? undefined}
          sizes={COVER_SIZES}
          alt={title}
          width={300}
          height={450}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="flex h-full items-end p-3"
          style={{ backgroundImage: gradientFor(seed) }}
        >
          <span className="line-clamp-4 font-display text-sm font-bold leading-tight text-white drop-shadow">
            {title}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 transition group-hover:opacity-90" />
      {children}
    </div>
  );
}

export function PlayGlyph() {
  return (
    <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/90 text-white shadow-glow backdrop-blur-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
