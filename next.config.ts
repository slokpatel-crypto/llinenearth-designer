import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.fashn.ai" },
      { protocol: "https", hostname: "media.fashn.ai" },
    ],
  },
};
export default nextConfig;
