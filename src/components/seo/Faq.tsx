export type QA = { q: string; a: string };

/**
 * A visible FAQ block that also emits FAQPage structured data. Both halves come
 * from the same list so the markup can never drift from what's on the page.
 */
export function Faq({ items, title = "FAQ" }: { items: QA[]; title?: string }) {
  const clean = items.filter((x) => x.q && x.a);
  if (clean.length === 0) return null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: clean.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  return (
    <section className="mt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-accent to-accent-2" />
        {title}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/40">
        {clean.map((x, i) => (
          <details key={i} className="group px-4 py-3.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
              {x.q}
              <svg
                className="shrink-0 text-white/30 transition-transform group-open:rotate-45"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
