import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security-headers';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  typedRoutes: false,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders(),
      },
    ];
  },
};

export default config;
