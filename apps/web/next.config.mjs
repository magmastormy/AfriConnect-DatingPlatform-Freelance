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
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@africonnect/shared'],
  webpack: (config, { isServer }) => {
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
    return [
      {
        source: `/${mount}/:path*`,
        destination: process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL}/${mount}/:path*`
          : `http://localhost:4000/${mount}/:path*`,
      },
    ];
  },
};

export default nextConfig;
