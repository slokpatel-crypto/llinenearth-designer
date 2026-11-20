import type { NextConfig } from "next";

const securityHeaders=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), usb=()"},
  {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
  {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.fashn.ai" },
      { protocol: "https", hostname: "media.fashn.ai" },
    ],
  },
  async headers(){
    return [
      {source:"/:path*",headers:securityHeaders},
      // Public design-share paths contain an expiring bearer token. Never send
      // it as a Referer to images, same-origin API endpoints or third parties.
      {source:"/share/:path*",headers:[
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"Cache-Control",value:"private, no-store, max-age=0"},
        {key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"},
      ]},
    ];
  },
};
export default nextConfig;
