import type { NextConfig } from 'next';
import { MAIN_SITE } from '@acee/shared';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  transpilePackages: ['@acee/shared', '@acee/i18n'],
  poweredByHeader: false,
  // Same-origin API: the session cookie stays first-party and no CORS is needed.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` }];
  },
  // About, Contact and destinations live on the main ACEE website; old portal URLs forward there.
  async redirects() {
    return [
      { source: '/about', destination: MAIN_SITE.about, permanent: false },
      { source: '/contact', destination: MAIN_SITE.contact, permanent: false },
      { source: '/countries', destination: MAIN_SITE.destinations, permanent: false },
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default config;
