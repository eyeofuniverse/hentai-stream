import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/queries";
import { episodeThumb } from "@/lib/cloudinary";
import { buildServers } from "@/lib/stream";
import { WatchPlayer } from "@/components/WatchPlayer";

// A bare, chrome-less player — used as the VideoObject embedUrl and by anyone
// iframing an episode. Never indexed. It covers the site chrome with a
// full-viewport layer and dismisses the age gate for this route only.
export const revalidate = 7200;
export const dynamicParams = true;

export function generateStaticParams() {
  return [] as { slug: string; episode: string }[];
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await params;
  const ep = await getEpisode(slug, Number(episode));
  if (!ep) notFound();

  const bunnyReady = ep.bunnyStatus === "ready" && !!ep.bunnyGuid;
  const servers = buildServers(ep.id, bunnyReady, ep.sources);
  const poster = episodeThumb(ep);

  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center bg-black">
      {/* an embedded player isn't the place for an age wall — the host page
          gates it; drop our overlay for this route */}
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.setAttribute('data-vok','1')",
        }}
      />
      <div className="w-full">
        <WatchPlayer servers={servers} poster={poster} nextHref={null} bare />
      </div>
    </div>
  );
}
