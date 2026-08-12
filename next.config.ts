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
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
