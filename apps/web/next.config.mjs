/** @type {import('next').NextConfig} */

// Backend origins the Next server proxies to (server-side env, not exposed to
// the browser). Defaults match local docker-compose host ports. In containers
// or other hosts, override these.
const ORIGINS = {
  auth: process.env.AUTH_SERVICE_ORIGIN ?? 'http://localhost:3001',
  teacher: process.env.TEACHER_SERVICE_ORIGIN ?? 'http://localhost:3002',
  search: process.env.SEARCH_SERVICE_ORIGIN ?? 'http://localhost:3003',
  scheduling: process.env.SCHEDULING_SERVICE_ORIGIN ?? 'http://localhost:3004',
  voice: process.env.VOICE_SERVICE_ORIGIN ?? 'http://localhost:3005',
};

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@learn-and-build/api-client', '@learn-and-build/types'],
  // Single-origin proxy: the browser only ever talks to this app's origin,
  // so one public tunnel (e.g. Cloudflare) exposes the whole platform.
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${ORIGINS.auth}/:path*` },
      {
        source: '/api/teacher/:path*',
        destination: `${ORIGINS.teacher}/:path*`,
      },
      { source: '/api/search/:path*', destination: `${ORIGINS.search}/:path*` },
      {
        source: '/api/scheduling/:path*',
        destination: `${ORIGINS.scheduling}/:path*`,
      },
      { source: '/api/voice/:path*', destination: `${ORIGINS.voice}/:path*` },
    ];
  },
};

export default nextConfig;
