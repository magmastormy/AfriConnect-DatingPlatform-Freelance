/** @type {import('next').NextConfig} */
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Per-request nonce so Next.js can whitelist its own inline bootstrap scripts
// without falling back to 'unsafe-inline'. React escapes all dynamic content,
// so this keeps the CSP strict while not breaking the App Router runtime.
function buildCsp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com",
    "img-src 'self' data: https: https://*.clerk.com https://*.clerk.accounts.dev https://img.clerk.com https://images.clerk.dev",
    "font-src 'self' https://*.clerk.accounts.dev https://*.clerk.com data:",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.ingest.clerk.com https://clerk-telemetry.com https://africonnect-datingplatform-freelance.onrender.com wss://africonnect-datingplatform-freelance.onrender.com https: wss: blob:",
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
    "worker-src 'self' blob: https://*.clerk.accounts.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const securityHeaders = (nonce) => [
  { key: 'Content-Security-Policy', value: buildCsp(nonce) },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@africonnect/shared'],
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  // Production hardening: drop debug console.* calls from the client bundle
  // (they survive minification otherwise) to shrink First Load JS, and skip
  // shipping source maps to end users (smaller download, less info leakage).
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: { exclude: ['error', 'warn'] },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: '**.picsum.photos' },
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    // allow R2 / S3 / clerk avatars without extra config
    dangerouslyAllowSVG: false,
  },
  experimental: {
    optimizePackageImports: ['@clerk/nextjs', 'qrcode.react'],
  },
  webpack: (config, { isServer }) => {
    // Fix: PackFileCacheStrategy big strings 192kib warning — use gzip compression
    if (config.cache && typeof config.cache === 'object' && 'compression' in config.cache) {
      config.cache.compression = 'gzip';
    }
    config.infrastructureLogging = { level: 'error' };
    if (!isServer) {
      config.resolve.alias['@africonnect/shared'] = path.resolve(
        __dirname,
        '../../packages/shared/src/client.ts',
      );
    }
    return config;
  },
  async headers() {
    // The strict CSP below forbids 'unsafe-eval'. Next.js Fast Refresh
    // (react-refresh) and the dev error overlay both require 'unsafe-eval' in
    // `next dev`, so enforcing it would break local previews. Apply the strict
    // policy only in production; dev runs unconstrained.
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/(.*)',
        headers: securityHeaders(crypto.randomBytes(16).toString('base64')),
      },
    ];
  },
  async rewrites() {
    const mount = (process.env.NEXT_PUBLIC_API_MOUNT || 'api').replace(/^\/+|\/+$/g, '');
    const origin = process.env.API_BASE_URL || 'http://localhost:4000';
    return [
      {
        source: `/${mount}/:path*`,
        destination: `${origin}/${mount}/:path*`,
      },
      // Cheap unauthenticated probe the client uses to absorb the backend's
      // cold start (Render's free tier spins instances down when idle). Kept
      // same-origin so it escapes CORS and the CSP connect-src allowlist, and
      // it sits ahead of the API's rate limiter so it costs no quota.
      {
        source: '/healthz',
        destination: `${origin}/healthz`,
      },
    ];
  },
};

export default nextConfig;
