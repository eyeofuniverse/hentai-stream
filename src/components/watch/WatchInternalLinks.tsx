import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

type Tag = { slug: string; name: string; seriesCount?: number | null };

/**
 * A dense, organised block of contextual internal links — one per watch page.
 * Every anchor is a real catalogue route (tag / studio / year / format / browse
 * filters), which deepens crawl paths for SEO and gives viewers an obvious next
 * click when the episode ends.
 */
export function WatchInternalLinks({
  seriesTitle,
  seriesSlug,
  studio,
  year,
  type,
  isCensored,
  tags,
}: {
  seriesTitle: string;
  seriesSlug: string;
  studio: { name: string; slug: string } | null;
  year: number | null;
  type: string;
  isCensored: boolean;
  tags: Tag[];
}) {
  const typeLabel = type.toUpperCase();
  const genreTags = tags.slice(0, 12);

  const Col = ({
    heading,
    children,
  }: {
    heading: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
        {heading}
      </h3>
      <ul className="space-y-1.5 text-sm">{children}</ul>
    </div>
  );

  const Row = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <li>
      <Link
        href={href}
        className="text-white/60 transition-colors hover:text-accent"
      >
        {children}
      </Link>
    </li>
  );

  return (
    <section className="mt-12 rounded-2xl border border-line bg-surface/30 p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
        Explore more hentai
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Col heading="This series">
          <Row href={`/hentai/${seriesSlug}`}>All {seriesTitle} episodes</Row>
          {studio && (
            <Row href={`/studio/${studio.slug}`}>More from {studio.name}</Row>
          )}
          {year && <Row href={`/browse/year/${year}`}>Hentai from {year}</Row>}
          <Row href={`/browse?type=${type.toLowerCase()}`}>
            All {typeLabel} hentai
          </Row>
        </Col>

        <Col heading="By theme">
          {genreTags.slice(0, 6).map((t) => (
            <Row key={t.slug} href={`/tag/${t.slug}`}>
              {t.name} hentai
              {t.seriesCount ? (
                <span className="ml-1 text-xs text-white/50">
                  {t.seriesCount}
                </span>
              ) : null}
            </Row>
          ))}
        </Col>

        <Col heading="More themes">
          {genreTags.slice(6, 12).map((t) => (
            <Row key={t.slug} href={`/tag/${t.slug}`}>
              {t.name} hentai
              {t.seriesCount ? (
                <span className="ml-1 text-xs text-white/50">
                  {t.seriesCount}
                </span>
              ) : null}
            </Row>
          ))}
          {genreTags.length <= 6 && (
            <Row href="/tags">Browse all tags</Row>
          )}
        </Col>

        <Col heading={`On ${SITE_NAME}`}>
          {!isCensored && (
            <Row href="/browse/uncensored">Uncensored hentai</Row>
          )}
          <Row href="/browse/trending">Trending now</Row>
          <Row href="/browse/new">Latest additions</Row>
          <Row href="/calendar">Release calendar</Row>
          <Row href="/browse">Full catalogue</Row>
        </Col>
      </div>
    </section>
  );
}
