/** @type {import('next').NextConfig} */
const nextConfig = {
  // the Docker image runs the self-contained server (see Dockerfile); Vercel builds are not affected
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  // Behind our own proxy the server binds 0.0.0.0, and without this every absolute URL it builds from the request (redirects,
  // sign-in callbacks) read http://0.0.0.0:3000/...; with it they use the Host header the proxy passes on.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { experimental: { trustHostHeader: true } } : {}),
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Cloudinary-delivered thumbnails/covers (we use plain <img>, but keep this
    // for any next/image usage).
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "api-cdn.myanimelist.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nobody else may iframe our pages — including /embed/*, which renders the
          // full player over our Bunny-hosted files. Without this any site could embed
          // our episodes (hotlinking through our own domain). Crawlers fetch the pages
          // normally; frame-ancestors only restricts who may render them in a frame.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
