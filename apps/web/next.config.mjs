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
  payments: process.env.PAYMENTS_SERVICE_ORIGIN ?? 'http://localhost:3007',
};

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
      { source: '/api/payments/:path*', destination: `${ORIGINS.payments}/:path*` },
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org https://api.mapbox.com https://*.mapbox.com https://api.razorpay.com https://*.razorpay.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "worker-src 'self' blob:",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
