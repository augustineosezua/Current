import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.55"],

  async rewrites() {
    // API_URL is a server-side-only env var — never exposed to the browser.
    // In production the vercel.json rewrite fires first at the edge, so this
    // only matters for local development (where vercel.json isn't active).
    const dest = process.env.API_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${dest}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
