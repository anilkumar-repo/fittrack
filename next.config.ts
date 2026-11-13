import type { NextConfig } from "next";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

const nextConfig: NextConfig = {
  images: {
    qualities: [75],
    formats: ["image/webp"],
    // Optimised copies stay on Vercel's network for 31 days, so they are made once, not per visitor.
    minimumCacheTTL: 2678400,
    // Small set of widths: Rozi, thumbnails and figures are all shown at phone sizes.
    deviceSizes: [360, 480, 640, 768, 1080],
    imageSizes: [32, 64, 96, 128, 180, 256],
  },
  async headers() {
    // Pictures in public/ change rarely; browsers and the CDN may keep them for 30 days and refresh in the background.
    const cache = [{ key: "Cache-Control", value: `public, max-age=${THIRTY_DAYS}, stale-while-revalidate=${THIRTY_DAYS}` }];
    return [
      { source: "/rozi/:path*", headers: cache },
      { source: "/figures/:path*", headers: cache },
      { source: "/icons/:path*", headers: cache },
    ];
  },
};

export default nextConfig;
