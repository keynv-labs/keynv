import type { NextConfig } from 'next';

const config: NextConfig = {
  // Standalone output bundles the minimum runtime dependencies
  // (next + react + page chunks) into .next/standalone so the
  // Docker image can ship without the full node_modules tree.
  // Required for the apps/web Dockerfile multi-stage build.
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  typedRoutes: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Strip the X-Frame-Options sniffing surface; everything is same-origin.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
