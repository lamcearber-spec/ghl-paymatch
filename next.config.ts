import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.gohighlevel.com https://*.highlevel.com https://app.gohighlevel.com;"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
