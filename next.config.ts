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
      // A share URL is a public bearer credential. Never forward its path in
      // same-origin Referer headers or invite crawlers to index the token.
      // This route-specific policy must follow the global header rule.
      {source:"/share/:token",headers:[
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"},
        {key:"Cache-Control",value:"private, no-store, max-age=0"},
      ]},
    ];
  },
};
export default nextConfig;
