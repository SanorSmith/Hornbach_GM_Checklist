import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Type errors fail the build. This is deliberate: the rules engine and the
  // offline sync layer are not safe to ship with type errors suppressed.
  // (Next 16 removed built-in linting, so ESLint runs as its own CI step.)
  typescript: { ignoreBuildErrors: false },

  // The app handles employee data and workplace photos; keep it out of frames and
  // out of referrers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
