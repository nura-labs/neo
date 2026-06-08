import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async redirects() {
    return [
      {
        source: "/docs",
        destination: "https://nura.sh/neo/docs",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "https://nura.sh/neo/docs",
        permanent: true,
      },
    ];
  },

  // No CDN caching on app HTML — dashboard pages are client-rendered and
  // their bundle hashes change every deploy. If the edge keeps serving old
  // HTML, browsers load stale JS. Static assets under _next/static/* keep
  // their immutable far-future caching (they're already content-hashed).
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon|icon).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
