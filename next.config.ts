import type { NextConfig } from "next";

/** Private LAN hosts for phone testing (Origin hostname only — no scheme/port). */
const LAN_DEV_ORIGINS = [
  "192.168.1.135",
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

function supabaseHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();

const nextConfig: NextConfig = {
  // Next blocks cross-origin /_next/* (HMR, chunks) in dev unless listed — breaks phone buttons.
  allowedDevOrigins: LAN_DEV_ORIGINS,
  images: {
    // Absolute Supabase URLs (fallback) + local stack for next/image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/storage/v1/object/**",
      },
      ...(supabaseHost && supabaseHost !== "127.0.0.1" && supabaseHost !== "localhost"
        ? ([
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/**",
            },
            {
              protocol: "http" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/**",
            },
          ] as const)
        : []),
    ],
  },
  async headers() {
    // Prefer same-origin /api/media. Allow https + http so LAN phones and remotes both work.
    // No upgrade-insecure-requests — that breaks plain-HTTP phone testing.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "img-src 'self' data: blob: https: http:; media-src 'self' blob: data: https: http:;",
          },
        ],
      },
    ];
  },
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
