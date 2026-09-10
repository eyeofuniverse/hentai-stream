/** A self-hosted banner: image + click-through link, optional title/description. */
export function AffiliateAd({
  imageUrl,
  linkUrl,
  altText,
  title,
  description,
}: {
  imageUrl: string;
  linkUrl: string;
  altText: string;
  title?: string | null;
  description?: string | null;
}) {
  if (!imageUrl) return null;
  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="nofollow sponsored noopener"
      className="group block overflow-hidden rounded-xl border border-line bg-surface/50"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={altText || title || "Advertisement"}
        loading="lazy"
        decoding="async"
        className="mx-auto block max-w-full"
      />
      {(title || description) && (
        <div className="px-3 py-2">
          {title && (
            <p className="text-sm font-semibold text-white/85 group-hover:text-accent">
              {title}
            </p>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-white/45">{description}</p>
          )}
        </div>
      )}
    </a>
  );
}
