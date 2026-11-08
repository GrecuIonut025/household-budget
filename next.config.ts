import type { NextConfig } from "next";

/** Private LAN hosts for phone testing (Origin hostname only — no scheme/port). */
const LAN_DEV_ORIGINS = [
  "192.168.1.135",
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  // Next blocks cross-origin /_next/* (HMR, chunks) in dev unless listed — breaks phone buttons.
  allowedDevOrigins: LAN_DEV_ORIGINS,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
