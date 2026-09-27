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
  async redirects() {
    return [{ source: "/visual", destination: "/designer-studio#designerPhotoTitle", permanent: false }];
  },
};
export default nextConfig;
