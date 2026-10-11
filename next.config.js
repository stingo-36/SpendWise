/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Two `next dev` processes in one checkout share .next and corrupt each
  // other's build output (the second one's shutdown deletes pages the first is
  // still serving, which surfaces as sudden 404s/500s). Setting NEXT_DIST_DIR
  // gives a second instance its own directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Prisma + googleapis are server-only; keep them external so they are not
  // bundled into serverless client code.
  serverExternalPackages: ['@prisma/client', 'prisma', 'googleapis'],
  async headers() {
    return [
      {
        // API responses are per-user and auth-dependent — never cache them
        // (prevents one user seeing another's cached response).
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
      {
        // Service worker must be served from the root scope and not cached hard.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
